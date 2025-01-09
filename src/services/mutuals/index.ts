import { sql } from 'kysely'
import { database } from '#/database'
import { logger } from '#/logger'
import type { CountRow, MutualsRow } from '#/types'
import { arrayToChunks } from '#/utilities'
import { colors } from 'consola/utils';
import type { Address } from 'viem'

export async function mutuals(): Promise<void> {
  try {
    logger.log(colors.blueBright('[mutuals]'), `Fetching mutuals counts...`)
    const mutualsQuery = sql<{
        leader: Address
        mutuals_rank: number
        mutuals: number
    }>` SELECT * FROM query.get_built_mutuals();` 
// 	hexlify(r.record_data) AS leader,
// 	count(r.record_data) AS mutuals,
// 	 rank() OVER (ORDER BY (count(r.record_data)) DESC NULLS LAST) AS mutuals_rank

//    FROM efp_list_records r
//    LEFT JOIN efp_list_record_tags t ON r.chain_id::bigint = t.chain_id::bigint AND r.contract_address::text = t.contract_address::text AND r.slot::bytea = t.slot::bytea AND r.record = t.record
//    LEFT JOIN view__join__efp_lists_with_metadata l ON l.list_storage_location_chain_id = r.chain_id::bigint AND l.list_storage_location_contract_address::text = r.contract_address::text AND l.list_storage_location_slot::bytea = r.slot::bytea
//    JOIN efp_account_metadata meta ON l."user"::text = meta.address::text AND l.token_id::bigint = convert_hex_to_bigint(meta.value::text)
//    JOIN (
// 	  SELECT 
// 		l2."user",
// 		hexlify(r2.record_data),
// 	    r2.chain_id,
// 	    r2.contract_address,
// 	    r2.slot,
// 	    r2.record,
// 	    r2.record_version,
// 	    r2.record_type,
// 	    hexlify(r2.record_data) as target,
// 	    r2.updated_at
// 	   FROM efp_list_records r2
// 	   LEFT JOIN efp_list_record_tags t2 ON r2.chain_id::bigint = t2.chain_id::bigint AND r2.contract_address::text = t2.contract_address::text AND r2.slot::bytea = t2.slot::bytea AND r2.record = t2.record
// 	   LEFT JOIN view__join__efp_lists_with_metadata l2 ON l2.list_storage_location_chain_id = r2.chain_id::bigint AND l2.list_storage_location_contract_address::text = r2.contract_address::text AND l2.list_storage_location_slot::bytea = r2.slot::bytea
// 	   JOIN efp_account_metadata meta2 ON l2."user"::text = meta2.address::text AND l2.token_id::bigint = convert_hex_to_bigint(meta2.value::text)
// 	 ) as s 
// 	 ON s."user" = hexlify(r.record_data) AND l."user" = s.target
// 	 GROUP BY r.record_data;
//    `
    const mutualsResult = await mutualsQuery.execute(database)
    const mutuals: MutualsRow[] = []
    logger.log(colors.blueBright('[mutuals]'), `Building mutuals for ${mutualsResult.rows.length} records...`)
    let index = 0
    for (const row of mutualsResult.rows) {
        if(row.leader){
            mutuals.push({
                address: row.leader,
                mutuals_rank: row.mutuals_rank,
                mutuals: row.mutuals
            })
            index++
        }
    }

    // logger.log(colors.blueBright('[mutuals]'), `Cleaning up Table...`)
    // const truncate = sql`TRUNCATE TABLE efp_mutuals`
    // const clearTable = await truncate.execute(database)

    logger.log(colors.blueBright('[mutuals]'), `Inserting new mutuals data...`)
    const batchSize = 5000
    const batches = arrayToChunks(mutuals, batchSize)
    for (const batch of batches) {
      const insert = await database.insertInto('efp_mutuals')
        .values(batch)
        .onConflict(oc =>
          oc.column('address').doUpdateSet(eb => ({
            mutuals_rank: eb.ref('excluded.mutuals_rank'),
            mutuals: eb.ref('excluded.mutuals')
          }))
        )
        .executeTakeFirst()
      if (insert.numInsertedOrUpdatedRows !== BigInt(batch.length)) {
        logger.error(`Failed to insert mutuals rows ${JSON.stringify(batch)}`)
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : error
    logger.error('EXCEPTION', errorMessage)
  }
  logger.info(colors.blueBright('[mutuals]'), colors.green('Done!'), )
}