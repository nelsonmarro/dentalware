import { toString as qrCodeToString } from 'qrcode'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

/** Último segmento de la URL (el código del trabajo, `/t/26-00123`), para la etiqueta
 * accesible; si no se puede extraer, la etiqueta queda genérica. */
function codeFromUrl(value: string): string | null {
  const parts = value.split('/').filter(Boolean)
  return parts.length > 0 ? (parts[parts.length - 1] ?? null) : null
}

/** QR de la ficha corta del trabajo (`/t/:code`), como SVG en línea — sin `<canvas>`, para que
 * también funcione en la vista de impresión (Tarea 14, FIC-1). `qrcode` (`toString`, `type:
 * 'svg'`) confirmado con context7: solo SVG en el entorno del navegador, `opts.type` se ignora
 * ahí, así que el `type: 'svg'` explícito es el contrato documentado, no redundante. */
export function QrCode({
  value,
  size = 96,
  className,
}: {
  value: string
  size?: number
  /** Para escalar el QR al imprimir (UX3-20); el SVG llena siempre la caja. */
  className?: string
}) {
  const [svg, setSvg] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    qrCodeToString(value, { type: 'svg', margin: 0, width: size })
      .then((result) => {
        if (!cancelled) setSvg(result)
      })
      .catch(() => {
        if (!cancelled) setSvg(null)
      })
    return () => {
      cancelled = true
    }
  }, [value, size])

  const code = codeFromUrl(value)
  const label = code ? `Código QR del trabajo ${code}` : 'Código QR del trabajo'

  return (
    <div
      role="img"
      aria-label={label}
      className={cn('[&_svg]:size-full', className)}
      style={{ width: size, height: size }}
      // El SVG lo genera `qrcode` a partir de la URL del trabajo (dato propio, no del
      // usuario): no hay entrada libre que inyectar aquí.
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  )
}
