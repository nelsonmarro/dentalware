import { createAuth } from './auth.ts'
import { loadConfig } from './config.ts'
import { createDb } from './db/index.ts'

const config = loadConfig()
export const auth = createAuth(createDb(config.DATABASE_URL).db, config)
