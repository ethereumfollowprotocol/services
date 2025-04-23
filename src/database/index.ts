import { type InsertObject, Kysely } from 'kysely'
import { PostgresJSDialect } from 'kysely-postgres-js'
import postgres from 'postgres'

import { env } from '#/env.ts'
import type { DB } from './generated/index.ts'

export type Row<T extends keyof DB> = InsertObject<DB, T>

let postgresClient = postgres(env.DATABASE_URL + '?unique=' + Date.now(), { max: 1 })
let kyselyInstance = new Kysely<DB>({
  dialect: new PostgresJSDialect({ postgres: postgresClient })
})

let retryTimeout: ReturnType<typeof setTimeout> | null = null
let reconnectCount = 0
let lastDisconnectAt: number | null = null

// Optional hook: users of this module can assign this to observe reconnection events
export let onReconnect: ((info: { reconnectCount: number; since: number | null }) => void) | null = null

function scheduleReconnect() {
  if (retryTimeout) return
  lastDisconnectAt = Date.now()

  retryTimeout = setTimeout(() => {
    retryTimeout = null
    try {
      postgresClient = postgres(env.DATABASE_URL + '?unique=' + Date.now(), { max: 1 })
      kyselyInstance = new Kysely<DB>({
        dialect: new PostgresJSDialect({ postgres: postgresClient })
      })
      reconnectCount++
      console.log('[POSTGRES] Reconnected successfully')

      if (onReconnect) {
        onReconnect({ reconnectCount, since: lastDisconnectAt })
      }
    } catch (err) {
      console.error('[POSTGRES] Reconnection attempt failed:', err)
      scheduleReconnect()
    }
  }, 5000)
}

const database: Kysely<DB> = new Proxy({} as Kysely<DB>, {
  get(_, prop) {
    const target = kyselyInstance[prop as keyof Kysely<DB>]

    if (typeof target === 'function') {
      return async (...args: any[]) => {
        try {
          const result = await (kyselyInstance[prop as keyof Kysely<DB>] as any)(...args)
          return result
        } catch (err) {
          console.error(`[POSTGRES] Kysely method ${String(prop)} failed:`, err)
          scheduleReconnect()
          throw err
        }
      }
    }

    return target
  }
})

export { database }
