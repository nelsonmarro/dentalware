import type { ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useReturnFocus } from './use-return-focus'

export function FormDialog({
  open,
  onOpenChange,
  title,
  context,
  description,
  children,
  footer,
  summary,
  size = 'default',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** Sobre qué se actúa («26-00087 · Clínica Sur», UX4-12): abre la descripción, para que quien
   * tiene la lista tapada por el diálogo compruebe que eligió el bueno. El código va en
   * monoespaciada; el resto, no. Sin código, solo el nombre (la clínica de «Registrar pago»). */
  context?: { code?: string; label: string }
  description?: string
  children: ReactNode
  footer: ReactNode
  /** Lo que tiene que verse mientras se edita el cuerpo (el «Aplicado $ X · Queda a favor $ Y»
   * del reparto, UX5-06): va en el pie fijo, encima de los botones. */
  summary?: ReactNode
  /**
   * `wide`: para contenido ancho como el odontograma de `TeethDialog`. En móvil deja solo
   * 8 px de margen a cada lado (`max-w-[calc(100%-1rem)]`) y en escritorio `sm:max-w-4xl`.
   */
  size?: 'default' | 'wide'
}) {
  const returnFocus = useReturnFocus(open)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // Al cerrar, el foco vuelve a quien lo abrió, o al `h1` (`useReturnFocus`).
        onCloseAutoFocus={returnFocus}
        // UX5-06: solo el cuerpo se desplaza. La cabecera y el pie (botones y `summary`) quedan
        // siempre a la vista, aunque el contenido no quepa (el reparto de cinco trabajos a
        // 1280×800). Columna flexible con alto máximo: el cuerpo encoge (`min-h-0`) y se desplaza.
        // `*:min-w-0`: los hijos medían, como mínimo, lo que su texto más largo sin cortar (el
        // reparto con un paciente largo). Así se encogen al ancho del diálogo en vez de salirse
        // por la derecha y recortar los botones del pie.
        className={cn(
          'flex max-h-[90svh] flex-col overflow-hidden *:min-w-0',
          size === 'wide' ? 'max-w-[calc(100%-1rem)] sm:max-w-4xl' : 'sm:max-w-lg',
        )}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
          {(context || description) && (
            <DialogDescription>
              {context && (
                <span className="block font-medium text-foreground">
                  {context.code && (
                    <>
                      <span className="font-mono">{context.code}</span> ·{' '}
                    </>
                  )}
                  {context.label}
                </span>
              )}
              {context && description && ' '}
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        {/* Llega a los bordes (`-mx-4 px-4`, `-my-1 py-1`) para que el anillo de foco de los
         * campos no quede recortado por el desplazamiento. */}
        <div
          data-slot="form-dialog-body"
          className="-mx-4 -my-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-1"
        >
          {children}
        </div>
        <div
          data-slot="form-dialog-footer"
          className="-mx-4 -mb-4 flex shrink-0 flex-col gap-3 rounded-b-xl border-t bg-muted/50 p-4"
        >
          {summary}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
