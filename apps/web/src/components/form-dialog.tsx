import type { ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'default',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  footer: ReactNode
  /**
   * `wide`: para contenido ancho como el odontograma de `TeethDialog`. En móvil deja solo
   * 8 px de margen a cada lado (`max-w-[calc(100%-1rem)]`) y en escritorio `sm:max-w-4xl`.
   */
  size?: 'default' | 'wide'
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-h-[90svh] overflow-x-hidden overflow-y-auto',
          size === 'wide' ? 'max-w-[calc(100%-1rem)] sm:max-w-4xl' : 'sm:max-w-lg',
        )}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        <DialogFooter className="gap-2">{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
