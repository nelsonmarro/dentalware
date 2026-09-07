import { describe, expect, it } from 'vitest'
import { assertTestEnv } from './reset-test-db.ts'

describe('assertTestEnv', () => {
  it('no lanza cuando NODE_ENV=test', () => {
    expect(() => assertTestEnv('test')).not.toThrow()
  })

  it('lanza para cualquier otro NODE_ENV, para no vaciar por error una BD real', () => {
    expect(() => assertTestEnv('development')).toThrow('NODE_ENV=test')
    expect(() => assertTestEnv('production')).toThrow('NODE_ENV=test')
  })
})
