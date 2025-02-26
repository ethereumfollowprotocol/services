import { sql } from 'kysely'
import { database } from '#/database'
import { logger } from '#/logger'
import type { CountRow, LeaderBoardRow } from '#/types'
import { arrayToChunks } from '#/utilities'
import { colors } from 'consola/utils';

export async function leaderboard(): Promise<void> {
  try {
    logger.log(colors.blue('[leaderboard]'), `Fetching leaderboard counts...`)
    const reloaded = sql<CountRow>`SELECT * FROM query.get_built_leaderboard();`
    // SELECT efp.address,
    //     COALESCE(ens.name) AS ens_name,
    //     COALESCE(ens.avatar) AS ens_avatar,
    //     mut.mutuals_rank,
    //     fers.followers_rank,
    //     fing.following_rank,
    //     blocks.blocked_rank AS blocks_rank,
    //     top8.top8_rank,
    //     COALESCE(mut.mutuals, 0::bigint) AS mutuals,
    //     COALESCE(fers.followers_count, 0::bigint) AS followers,
    //     COALESCE(fing.following_count, 0::bigint) AS following,
    //     COALESCE(blocks.blocked_count, 0::bigint) AS blocks,
    //     COALESCE(top8.top8_count, 0::bigint) AS top8
    // FROM efp_addresses efp  
    // LEFT JOIN query.get_leaderboard_followers(10000::bigint) fers(address, followers_count) ON fers.address::text = efp.address::text
    // LEFT JOIN query.get_leaderboard_following(10000::bigint) fing(address, following_count) ON fing.address::text = efp.address::text
    // LEFT JOIN query.get_leaderboard_blocked(10000::bigint) blocks(address, blocked_count) ON blocks.address::text = efp.address::text
    // LEFT JOIN query.get_leaderboard_top8(10000::bigint) top8(address, top8_count) ON top8.address::text = efp.address::text
    // LEFT JOIN public.efp_mutuals mut ON mut.address::text = efp.address::text
    // LEFT JOIN ens_metadata ens ON ens.address::text = efp.address::text
    // ORDER BY mut.mutuals DESC NULLS LAST;`


    const reloadedResult = await reloaded.execute(database)
    const leaderboard: LeaderBoardRow[] = []
    logger.log(colors.blue('[leaderboard]'), `Building leaderboard for ${reloadedResult.rows.length} records...`)
    let index = 0
    for (const row of reloadedResult.rows) {
      leaderboard.push({
        address: row.address,
        name: row.name,
        avatar: row.avatar,
        header: row.header,
        mutuals_rank: row.mutuals_rank,
        followers_rank: row.followers_rank,
        following_rank: row.following_rank,
        blocks_rank: row.blocks_rank,
        top8_rank: row.top8_rank,
        mutuals: row.mutuals,
        followers: row.followers,
        following: row.following,
        blocks: row.blocks,
        top8: row.top8
      })
      index++
    }

    // logger.log(colors.blue('[leaderboard]'), `Cleaning up Table...`)
    // const truncate = sql`TRUNCATE TABLE efp_leaderboard`
    // const clearTable = await truncate.execute(database)

    logger.log(colors.blue('[leaderboard]'), `Inserting new leaderboard data...`)
    const batchSize = 3000
    const batches = arrayToChunks(leaderboard, batchSize)
    for (const batch of batches) {
      const insert = await database.insertInto('efp_leaderboard')
      .values(batch)
      .onConflict(oc =>
        oc.column('address').doUpdateSet(eb => ({
          name: eb.ref('excluded.name'),
          avatar: eb.ref('excluded.avatar'),
          header: eb.ref('excluded.header'),
          mutuals_rank: eb.ref('excluded.mutuals_rank'),
          followers_rank: eb.ref('excluded.followers_rank'),
          following_rank: eb.ref('excluded.following_rank'),
          blocks_rank: eb.ref('excluded.blocks_rank'),
          top8_rank: eb.ref('excluded.top8_rank'),
          mutuals: eb.ref('excluded.mutuals'),
          following: eb.ref('excluded.following'),
          followers: eb.ref('excluded.followers'),
          blocks: eb.ref('excluded.blocks'),
          top8: eb.ref('excluded.top8'),
          updated_at: sql`CURRENT_TIMESTAMP`
        }))
      )
      .executeTakeFirst()
      if (insert.numInsertedOrUpdatedRows !== BigInt(batch.length)) {
        logger.error(`Failed to insert leaderboard rows ${JSON.stringify(batch)}`)
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : error
    logger.error('EXCEPTION', errorMessage)
  }
  logger.info(colors.blue('[leaderboard]'), colors.green('Done!'), )
}
