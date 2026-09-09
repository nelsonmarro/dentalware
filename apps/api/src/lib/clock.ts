import { toIsoDate } from '@dentalware/shared'

export interface Clock {
  today(): string // YYYY-MM-DD
  now(): Date
}

export const systemClock: Clock = { today: () => toIsoDate(new Date()), now: () => new Date() }
