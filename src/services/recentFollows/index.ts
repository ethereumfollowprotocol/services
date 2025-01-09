import { sql } from 'kysely'
import { database } from '#/database'
import { logger } from '#/logger'
import type { RecentActivityRow } from '#/types'
import { arrayToChunks } from '#/utilities'
import { colors } from 'consola/utils';

export async function recentFollows(): Promise<void> {
  try {
    logger.log(colors.magentaBright("[RecentFollows]"), `Fetching latest activity...`)
    const recentActivity = sql<RecentActivityRow>`
    SELECT 
        hexlify(r.record_data) AS address,
        lb.name,
        lb.avatar,
        lb.followers,
        lb.following,
        0 AS _index
    FROM efp_list_records r
    JOIN view__join__efp_lists_with_metadata l ON l.list_storage_location_chain_id = r.chain_id::bigint AND l.list_storage_location_contract_address::text = r.contract_address::text AND l.list_storage_location_slot::bytea = r.slot::bytea
    JOIN efp_account_metadata meta ON l."user"::text = meta.address::text AND l.token_id::bigint = convert_hex_to_bigint(meta.value::text)
    LEFT JOIN public.efp_leaderboard lb ON lb.address = hexlify(r.record_data)
    ORDER BY r.updated_at DESC
    LIMIT 250;`
        // SELECT 
        //     hexlify(record_tags.record_data) AS address,
        //     lb.name,
        //     lb.avatar,
        //     lb.followers,
        //     lb.following,
        //     0 AS _index
        // FROM view__join__efp_list_records_with_tags record_tags
        // JOIN view__join__efp_lists_with_metadata l ON l.list_storage_location_chain_id = record_tags.chain_id::bigint AND l.list_storage_location_contract_address::text = record_tags.contract_address::text AND l.list_storage_location_slot::bytea = record_tags.slot::bytea
        // JOIN efp_account_metadata meta ON l."user"::text = meta.address::text AND l.token_id::bigint = convert_hex_to_bigint(meta.value::text)
        
        // LEFT JOIN public.efp_leaderboard lb ON lb.address = hexlify(record_data)
        // ORDER BY record_tags.updated_at DESC
        // LIMIT 250;`

    const recentActivityResult = await recentActivity.execute(database)
    const recents: RecentActivityRow[] = []
    logger.log(colors.magentaBright("[RecentFollows]"), `Building latest follows for ${recentActivityResult.rows.length} records...`)
    let index = 0
    for (const row of recentActivityResult.rows) {
        recents.push({
            address: row.address,
            name: row.name,
            avatar: row.avatar,
            following: row.following,
            followers: row.followers,
            _index: row._index
        })
        index++
    }
    const uniqueDiscovers = recents.filter(
        (discover, index, self) => index === self.findIndex(d => d.address === discover.address)
    )
    if(recentActivityResult.rows.length === 0){
        logger.log(colors.magentaBright("[RecentFollows]"), `No new activity found.`)
        return 
    }
    logger.log(colors.magentaBright("[RecentFollows]"), `Cleaning up Table...`)
    const truncate = sql`TRUNCATE TABLE efp_recent_activity`
    const clearTable = await truncate.execute(database)

    logger.log(colors.magentaBright("[RecentFollows]"), `Inserting new activity data...`)
    const batchSize = 5000
    const batches = arrayToChunks(uniqueDiscovers, batchSize)
    for (const batch of batches) {
      const insert = await database.insertInto('efp_recent_activity').values(batch).executeTakeFirst()
      if (insert.numInsertedOrUpdatedRows !== BigInt(batch.length)) {
        logger.error(`Failed to insert recent activity rows ${JSON.stringify(batch)}`)
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : error
    logger.error('EXCEPTION', errorMessage)
  }
  logger.info(colors.magentaBright("[RecentFollows]"), colors.green('Done!'), )
}