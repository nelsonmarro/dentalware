import type { ReactNode } from 'react'

export function EmptyState({
  title,
  description,
  action,
  pageTitle = false,
}: {
  title: string
  description?: string
  action?: ReactNode
  /** La pantalla entera es este estado (no encontrado, no se pudo cargar): el título es su `h1`. */
  pageTitle?: boolean
}) {
  const Title = pageTitle ? 'h1' : 'p'
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <Title className="font-medium">{title}</Title>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  )
}
