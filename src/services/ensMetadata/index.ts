
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
    let index = 0

    const formattedBatches = arrayToChunks(result.rows, 10).map(batch =>
      batch.map(row => `addresses[]=${row.address}`).join('&')
    )
    logger.log(colors.cyan('[ens]'), `Fetching ENS data in ${formattedBatches.length} chunks...`)
    const response = await Promise.all(
      formattedBatches.map(batch => {
        return fetch(`${env.ENS_API_URL}bulk/a?${batch}`)
      })
    )
    logger.log(colors.cyan('[ens]'), `Resolving ENS requests...`)

    const data = (await Promise.all(
      response.map(async response => {
        await new Promise(resolve => setTimeout(resolve, 1000)) // Wait for 1 second
        if (response.ok) {
          return response.json()
        }
      })
    )) as {
      response_length: number
      response: ENSProfileResponse
    }[]
    logger.log(colors.cyan('[ens]'), `Formatting ENS requests...`)
    const validResponses = data.filter(datum => datum)
    const fetchedRecords = validResponses.flatMap(datum => datum.response)
    const filteredRecords = fetchedRecords.filter(record => record.address && record.type === 'success')
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
    logger.log(colors.cyan('[ens]'), `Updating ENS Cache: ${formatted.length} records...`)
    if (formatted.length > 0) {
      const insertENSCache = await database
        .insertInto('ens_metadata')
        .values(formatted)
        .onConflict(oc =>
          oc.column('address').doUpdateSet(eb => ({
            name: eb.ref('excluded.name'),
            avatar: eb.ref('excluded.avatar'),
            records: eb.ref('excluded.records')
          }))
        )
        .executeTakeFirst()
    }
    logger.log(colors.cyan('[ens]'), colors.green('Done!'))
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : error
    logger.error('EXCEPTION', errorMessage)
  }
}