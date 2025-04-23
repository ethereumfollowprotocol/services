import { sql } from 'kysely'
import { database } from '#/database'
import { logger } from '#/logger'
import { arrayToChunks } from '#/utilities'
import { colors } from 'consola/utils';
import { isAddress, type Address } from 'viem';

async function buildAddressList(): Promise<void> {
    const followers = sql<{address:string}>`
        SELECT DISTINCT hexlify(r.record_data) AS address 
        FROM efp_list_records r
        LEFT JOIN efp_list_record_tags t ON r.chain_id::bigint = t.chain_id::bigint AND r.contract_address::text = t.contract_address::text AND r.slot::bytea = t.slot::bytea AND r.record = t.record
        JOIN view__join__efp_lists_with_metadata l ON l.list_storage_location_chain_id = r.chain_id::bigint AND l.list_storage_location_contract_address::text = r.contract_address::text AND l.list_storage_location_slot::bytea = r.slot::bytea
        JOIN efp_account_metadata meta ON l."user"::text = meta.address::text AND l.token_id::bigint = convert_hex_to_bigint(meta.value::text);`
    const followersResult = await followers.execute(database)

    let addresses: {address:string}[] = followersResult.rows.map(row => row) 

    const following = sql<{address:string}>`
        SELECT DISTINCT l.user AS address 
        FROM efp_list_records r
        LEFT JOIN efp_list_record_tags t ON r.chain_id::bigint = t.chain_id::bigint AND r.contract_address::text = t.contract_address::text AND r.slot::bytea = t.slot::bytea AND r.record = t.record
        JOIN view__join__efp_lists_with_metadata l ON l.list_storage_location_chain_id = r.chain_id::bigint AND l.list_storage_location_contract_address::text = r.contract_address::text AND l.list_storage_location_slot::bytea = r.slot::bytea
        JOIN efp_account_metadata meta ON l."user"::text = meta.address::text AND l.token_id::bigint = convert_hex_to_bigint(meta.value::text);`
    const followingResult = await following.execute(database)

    for (const row of followingResult.rows) {
        addresses.push(row)
    }
    addresses = addresses.filter((value, index, self) =>
        index === self.findIndex((t) => t.address.toLowerCase() === value.address.toLowerCase())
    )
    addresses = addresses.filter(record => isAddress(record.address) && record.address !== '0x')

    logger.log(colors.cyanBright('[efpCache]'), `Cleaning up Table...`)
    const truncate = sql`TRUNCATE TABLE efp_addresses`
    const clearTable = await truncate.execute(database)

    logger.log(colors.cyanBright('[efpCache]'), `Inserting new EFP cache data...`)
    const batchSize = 5000
    const batches = arrayToChunks(addresses, batchSize)
    for (const batch of batches) {
        const insert = await database.insertInto('efp_addresses')
        .values(batch.map(record => ({ address: record.address.toLowerCase() })))
        .onConflict(oc => oc.doNothing())
        .execute()
    }
}

// async function joinCalcs(): Promise<void> {
//     const cache = sql<{address:string}>`
//         SELECT fers.address,
//         COALESCE(ens.name) AS ens_name,
//         COALESCE(ens.avatar) AS ens_avatar,
//         COALESCE(mut.mutuals, 0::bigint) AS mutuals,
//         COALESCE(fers.followers_count, 0::bigint) AS followers,
//         COALESCE(fing.following_count, 0::bigint) AS following,
//         COALESCE(blocks.blocked_count, 0::bigint) AS blocks,
//         COALESCE(top8.top8_count, 0::bigint) AS top8
//        FROM efp_addresses efp  
//          LEFT JOIN query.get_leaderboard_followers(10000::bigint) fers(address, followers_count) ON fers.address::text = efp.address::text
//          LEFT JOIN query.get_leaderboard_following(10000::bigint) fing(address, following_count) ON fing.address::text = efp.address::text
//          LEFT JOIN query.get_leaderboard_blocked(10000::bigint) blocks(address, blocked_count) ON blocks.address::text = efp.address::text
//          LEFT JOIN query.get_leaderboard_top8(10000::bigint) top8(address, top8_count) ON top8.address::text = efp.address::text
//          LEFT JOIN view__events__efp_leaderboard_mutuals mut ON mut.leader::text = efp.address::text
//          LEFT JOIN ens_metadata ens ON ens.address::text = efp.address::text
//       ORDER BY mut.mutuals DESC NULLS LAST;`
//     const cacheResult = await cache.execute(database)
//     console.log(cacheResult.rows)
// }

export async function efpCache(): Promise<void> {
    try {
        logger.log(colors.cyanBright('[efpCache]'), `Caching EFP Data...`)
        await buildAddressList()
        // await joinCalcs()
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : error
        logger.error('EXCEPTION', errorMessage)
    }
    logger.info(colors.cyanBright('[efpCache]'), colors.green('Done!'), )
}