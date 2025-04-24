
import { ens_normalize } from '@adraffy/ens-normalize'
import { sql } from 'kysely'
import { database } from '#/database'
import { env } from '#/env'
import { logger } from '#/logger'
import type { CountRow, ENSProfile, ENSProfileResponse, LeaderBoardRow } from '#/types'
import { arrayToChunks } from '#/utilities'
import { colors } from 'consola/utils';

export async function ensMetadata() {
  try {
    logger.log(colors.cyan('[ens]'), `Fetching Users...`)
    const query = sql<CountRow>`SELECT * FROM public.efp_leaderboard `
    const result = await query.execute(database)

    const leaderboard: LeaderBoardRow[] = []
    const ensData: ENSProfile[] = []
    logger.log(colors.cyan('[ens]'), `Fetching ENS data for ${result.rows.length} leaderboard records...`)

    const formattedBatches = arrayToChunks(result.rows, 50).map(batch =>
      batch.map(row => `addresses[]=${row.address}`).join('&')
    )
    logger.log(colors.cyan('[ens]'), `Fetching ENS data in ${formattedBatches.length} chunks...`)
    const data: { response_length: number; response: ENSProfileResponse }[] = [];
    for (const batch of formattedBatches) {
        try {
            const response = await fetch(`${env.ENS_API_URL}/bulk/a?${batch}`);
            if (response.ok) {
                const batchData = await response.json();
                data.push(batchData);
            } else {
                logger.error(colors.red('[recommended]'), `Failed to fetch batch: ${batch}`);
            }
        } catch (error) {
            logger.error(colors.red('[recommended]'), `Error fetching batch: ${batch}`, error);
        }
    }
    logger.log(colors.cyan('[ens]'), `Formatting ENS requests...`)
    const validResponses = data.filter(datum => datum)
    const fetchedRecords = validResponses.flatMap(datum => datum.response)
    const nonZeroAddressRecords = fetchedRecords.filter(record => record.address && record.address !== '0x0000000000000000000000000000000000000000')
    const filteredRecords = nonZeroAddressRecords.filter(record => record.address && record.type === 'success')
    logger.log(colors.cyan('[ens]'), `fetchedRecords ${fetchedRecords.length}`)
    logger.log(colors.cyan('[ens]'), `filteredRecords ${filteredRecords.length}`)

    const formatted = filteredRecords.map(record => {
      let name: string
      try {
        name = ens_normalize(record.name)
      } catch (error) {
        return {
          name: '',
          address: record.address?.toLowerCase(),
          avatar: ''
        }
      }
      if(record.contenthash){
        const records = (record.records) ? JSON.parse(JSON.stringify(record.records)) : {}
        record.records = {
            ...records,
            contenthash: record.contenthash
        }
      }
      return {
        name: name,
        address: record.address?.toLowerCase(),
        records: record.records,
        avatar:
          record.avatar?.indexOf('http') === 0 &&
          record.avatar?.indexOf('https://ipfs') !== 0 &&
          record.avatar?.indexOf('ipfs') !== 0
            ? record.avatar
            : `https://metadata.ens.domains/mainnet/avatar/${record.name}`
      }
    })
    const uniqueFormatted = formatted.filter((item, index, self) =>
        self.findIndex((obj) => obj.address === item.address) === index
    );

    logger.log(colors.cyan('[ens]'), `Updating ENS Cache: ${uniqueFormatted.length} records...`)
    if (uniqueFormatted.length > 0) {
        const batchSize = 5000
        const batches = arrayToChunks(uniqueFormatted, batchSize)
        for (const batch of batches) {
            const insertENSCache = await database
            .insertInto('ens_metadata')
            .values(batch)
            .onConflict(oc =>
              oc.column('name').doUpdateSet(eb => ({
                address: eb.ref('excluded.address'),
                avatar: eb.ref('excluded.avatar'),
                records: eb.ref('excluded.records')
              }))
            )
            .executeTakeFirst()
            if (insertENSCache.numInsertedOrUpdatedRows !== BigInt(batch.length)) {
                logger.error(`Failed to insert leaderboard rows ${JSON.stringify(batch)}`)
            }
        }
    }

    logger.log(colors.cyan('[ens]'), colors.green('Done!'))
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : error
    logger.error('EXCEPTION', errorMessage)
  }
}