import { z } from 'zod'
import { isoDate } from './cases.ts'
import { textoOpcional } from './config.ts'

export const tryinInputSchema = z.object({
  sentAt: isoDate,
  note: textoOpcional(500),
})
export type TryinInput = z.infer<typeof tryinInputSchema>
