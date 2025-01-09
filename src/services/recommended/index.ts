import { sql } from "kysely";
import { database } from "#/database";
import { env } from "#/env";
import { List_A, List_B, List_C } from "./lists";
import { logger } from "#/logger";
import type { ENSProfileResponse } from "#/types";
import { arrayToChunks, sleep } from "#/utilities";
import { colors } from 'consola/utils';
import { Octokit } from "@octokit/rest";

async function getPrivateFile(): Promise<string | void> {
    const octokit = new Octokit({
      auth: env.GITHUB_ACCESS_TOKEN, 
    });
  
    // const owner = "ethereumfollowprotocol"; // Replace with the repository owner's username
    // const repo = "recommended-list"; // Replace with the repository name
    // const path = "recommended.json"; // Replace with the path to the file
  
    // example
    // const gitpath = "owner/repo/path/to/list.json"; 
    const gitpath = env.GITHUB_LIST_PATH
    const [owner, repo, ...filePathParts] = gitpath.split('/');
    const path = filePathParts.join('/');

    try {
      const response = await octokit.rest.repos.getContent({
        owner,
        repo,
        path,
      });
  
      if ("content" in response.data) {
        const content = Buffer.from(response.data.content, "base64").toString();
        return content;
      } else {
        console.error("File not found or not a text file.");
      }
    } catch (error) {
      console.error("Error fetching file:", error);
    }
    
  }

type EFPRecommended = {
	index: number
	address: string
	name: string
	avatar: string
	class: string
};

async function importList(list: string[], _class: string) {
	logger.log(colors.yellow('[recommended]'), "Resolving ENS requests...");
	const formattedBatches = arrayToChunks(list, 10).map((batch) =>
		batch.map((row) => `names[]=${row}`).join("&"),
	);
	logger.log(colors.yellow('[recommended]'), `Fetching ENS data in ${formattedBatches.length} chunks...`);
	const response = await Promise.all(
		formattedBatches.map((batch) => {
			return fetch(`${env.ENS_API_URL}bulk/n?${batch}`);
		}),
	);
	logger.log(colors.yellow('[recommended]'), "Resolving responses...");
	const data = (await Promise.all(
		response.map(async (response) => {
			await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for 1 second
			if (response.ok) {
				return response.json();
			}
		}),
	)) as {
		response_length: number;
		response: ENSProfileResponse;
	}[];
	logger.log(colors.yellow('[recommended]'), "Formatting ENS responses...");
	const validResponses = data.filter((datum) => datum);
	const fetchedRecords = validResponses.flatMap((datum) => datum.response);
	const filteredRecords = fetchedRecords.filter(
		(record) => record.type === "success",
	);
	logger.log(colors.yellow('[recommended]'), `fetchedRecords ${fetchedRecords.length}`);
	logger.log(colors.yellow('[recommended]'), `filteredRecords ${filteredRecords.length}`);

    const refetchFormatted = filteredRecords.map((record) => record.address.toLowerCase()); 
    const refetchBatches = arrayToChunks(refetchFormatted, 10).map((batch) =>
        batch.map((row) => `addresses[]=${row}`).join("&"),
    );
    logger.log(colors.yellow('[recommended]'), `Fetching ENS data from addresses in ${refetchBatches.length} chunks...`);
    const refetchResponse = await Promise.all(
        refetchBatches.map((batch) => {
            return fetch(`${env.ENS_API_URL}bulk/a?${batch}`);
        }),
    );
    logger.log(colors.yellow('[recommended]'), "Reverse resolving responses...");
    const refetchData = (await Promise.all(
        refetchResponse.map(async (response) => {
            await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for 1 second
            if (response.ok) {
                return response.json();
            }
        }),
    )) as {
        response_length: number;
        response: ENSProfileResponse;
    }[];
    logger.log(colors.yellow('[recommended]'), "Formatting ENS responses...");
    const refetchValidResponses = refetchData.filter((datum) => datum);
    const refetchedRecords = refetchValidResponses.flatMap((datum) => datum.response);
    const refetchedFilteredRecords = refetchedRecords.filter(
        (record) => record.type === "success",
    );
    logger.log(colors.yellow('[recommended]'), `refetchedRecords ${refetchedRecords.length}`);
    logger.log(colors.yellow('[recommended]'), `refetchedFilteredRecords ${refetchedFilteredRecords.length}`);

	const formatted = refetchedFilteredRecords.map((record) => {
		return {
			name: record.name,
			address: record.address.toLowerCase(),
			records: record.records,
			avatar:
				record.avatar?.indexOf("http") === 0 &&
				record.avatar?.indexOf("https://ipfs") !== 0 &&
				record.avatar?.indexOf("ipfs") !== 0
					? record.avatar
					: `https://metadata.ens.domains/mainnet/avatar/${record.name}`,
		};
	});

    const uniqueFormatted = formatted.filter((item, index, self) =>
        self.findIndex((obj) => obj.address === item.address) === index
    );

	if (uniqueFormatted.length > 0) {
		logger.log(colors.yellow('[recommended]'), "Updating ENS data...");
		const insertENSCache = await database
			.insertInto("ens_metadata")
			.values(uniqueFormatted)
			.onConflict((oc) =>
				oc.column("address").doUpdateSet((eb) => ({
					name: eb.ref("excluded.name"),
					avatar: eb.ref("excluded.avatar"),
					records: eb.ref("excluded.records"),
				})),
			)
			.executeTakeFirst();
	}

	const formattedClass = filteredRecords.map((record) => {
		return {
			index: 0, //list.indexOf(record.address),
			name: record.name,
			address: record.address.toLowerCase(),
			avatar:
				record.avatar?.indexOf("http") === 0 &&
				record.avatar?.indexOf("https://ipfs") !== 0 &&
				record.avatar?.indexOf("ipfs") !== 0
					? record.avatar
					: `https://metadata.ens.domains/mainnet/avatar/${record.name}`,
			class: _class,
		}
	});
	if (formattedClass.length > 0) {
        const uniqueFormattedClass = formattedClass.filter((item, index, self) =>
            self.findIndex((obj) => obj.address === item.address) === index
        );

		logger.log(colors.yellow('[recommended]'), "Inserting recommended accounts...");
        try{
            const batchSize = 400;
            const batches = arrayToChunks(uniqueFormattedClass, batchSize);

            for (const batch of batches) {
                const insert = await database
                    .insertInto("efp_recommended")
                    .values(batch)
                    .onConflict((oc) =>
                        oc.column("address").doUpdateSet((eb) => ({
                            name: eb.ref("excluded.name"),
                            avatar: eb.ref("excluded.avatar"),
                        })),
                    )
                    .executeTakeFirst();
                if (insert.numInsertedOrUpdatedRows !== BigInt(uniqueFormattedClass.length)) {
                    logger.error(
                        `Failed to insert recommended rows ${JSON.stringify(uniqueFormattedClass)}`,
                    );
                }
            }
		
        } catch (error) {
            logger.error(`ERROR ${error}`)
        }
		
	}

	logger.log(colors.yellow('[recommended]'), `Data updated for ${_class}...`);
}

function findDuplicates(lists: string[][]): string[] {
	const allStrings = lists.flat();
	const duplicates: string[] = [];
	const countMap: { [key: string]: number } = {};

	for (const str of allStrings) {
		countMap[str] = (countMap[str] || 0) + 1;
		if (countMap[str] === 2) {
			duplicates.push(str);
		}
	}

	return duplicates;
}

export async function recommended() {
    logger.info("Fetching List of Users...");
    let parsedList = {
            List_A: List_A,
            List_B: List_B,
            List_C: List_C,
    }
    if (env.GITHUB_ACCESS_TOKEN !== 'unset' && env.GITHUB_LIST_PATH !== 'unset') {
        const recList = await getPrivateFile();
        parsedList = JSON.parse(recList as string)
    }
    
    const duplicates = findDuplicates([parsedList.List_A, parsedList.List_B, parsedList.List_C]);
	if (duplicates.length > 0) {
		logger.error(`Duplicates found in lists: ${duplicates}`);
		throw new Error(`Duplicates found in lists: ${duplicates}`);
	}
	
	const truncate = sql`TRUNCATE TABLE efp_recommended`;
	const clearTable = await truncate.execute(database);

    logger.info("Compiling List of Users...");
	await importList(parsedList.List_A, "A");
	await importList(parsedList.List_B, "B");
	await importList(parsedList.List_C, "C");

	logger.log(colors.yellow('[recommended]'), "Scrambling recommended accounts...");
	const query = sql<EFPRecommended>`WITH
        ListA_Weighted AS (
            SELECT name, address, avatar, class,  RANDOM() * 0.5 AS weighted_value
            FROM public.efp_recommended WHERE class = 'A'
        ),
        ListB_Weighted AS (
            SELECT name, address, avatar, class, .1 + RANDOM() * 0.35 AS weighted_value
            FROM public.efp_recommended WHERE class = 'B'
        ),
        ListC_Weighted AS (
            SELECT name, address, avatar, class, RANDOM() * 0.2 AS weighted_value
            FROM public.efp_recommended WHERE class = 'C'
        ),
        Combined AS (
            SELECT * FROM ListA_Weighted
            UNION ALL
            SELECT * FROM ListB_Weighted 
            UNION ALL
            SELECT * FROM ListC_Weighted
        )
        SELECT name, address, avatar, class, weighted_value
        FROM Combined
        ORDER BY weighted_value DESC;`;
	const result = await query.execute(database);

	let recIndex = 0;
	const indexedRows = result.rows.map((record) => {
		const row = {
			index: recIndex,
			name: record.name,
			address: record.address,
			avatar: record.avatar,
			class: record.class,
		};
		recIndex++;
		return row;
	});

	logger.log(colors.yellow('[recommended]'), "Cleaning up Table...");
	const truncateAgain = sql`TRUNCATE TABLE efp_recommended`;
	const clearTableAgain = await truncateAgain.execute(database);

	logger.log(colors.yellow('[recommended]'), "Inserting scrambled recommended accounts into database...");
	const insert = await database
		.insertInto("efp_recommended")
		.values(indexedRows)
		.onConflict((oc) =>
			oc.column("address").doUpdateSet((eb) => ({
				name: eb.ref("excluded.name"),
				avatar: eb.ref("excluded.avatar"),
				class: eb.ref("excluded.class"),
			})),
		)
		.executeTakeFirst();
	logger.info(colors.yellow('[recommended]'), colors.green('Done!'));
}
