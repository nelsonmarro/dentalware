import { useLayoutEffect, useRef } from 'react'

/** El `h1` de la página, enfocable por programa (`tabIndex=-1`) sin entrar en el orden del
 * tabulador. */
function pageHeading(): HTMLElement | null {
  const h1 = document.querySelector<HTMLElement>('h1')
  if (h1 && !h1.hasAttribute('tabindex')) h1.tabIndex = -1
  return h1
}

/**
 * Adónde vuelve el foco al cerrar un diálogo controlado (sin `DialogTrigger`, así que Radix no
 * sabe quién lo abrió y lo dejaba en el `body`). Lo usan `FormDialog` y `ConfirmDialog`.
 *
 * Quien lo abrió se toma en un efecto de layout, que corre antes de que Radix mueva el foco
 * dentro del diálogo. Al cerrar, el foco vuelve a él; si ya no está (la acción lo quitó: la
 * tarjeta que dejó de estar pendiente, «Finalizar»), o si el foco estaba en el `body` (Safari en
 * el iPhone no enfoca un botón al tocarlo), va al `h1` de la página. Siempre con
 * `preventScroll`, como enfoca Radix: con la lista desplazada, quien cierra no pierde su sitio
 * (I-1 de la revisión de la Tarea 9).
 *
 * Devuelve el manejador para `onCloseAutoFocus` del contenido del diálogo.
 */
export function useReturnFocus(open: boolean): (event: Event) => void {
  const opener = useRef<HTMLElement | null>(null)
  useLayoutEffect(() => {
    if (open) {
      const active = document.activeElement
      opener.current = active instanceof HTMLElement && active !== document.body ? active : null
    }
  }, [open])

  return (event) => {
    event.preventDefault()
    const target = opener.current?.isConnected ? opener.current : pageHeading()
    target?.focus({ preventScroll: true })
  }
}
