import type { ReactNode } from 'react'
import { EmptyState } from '@/components/empty-state'

export function GridEmpty({ message, action }: { message: string; action?: ReactNode }) {
  return <EmptyState title={message} action={action} />
}
