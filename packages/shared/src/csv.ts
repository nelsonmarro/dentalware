/**
 * Parser CSV mínimo (RFC 4180): comillas, comas y saltos de línea dentro de campos
 * entre comillas, `""` como comilla escapada, `\r\n` y `\n`, BOM inicial y filas
 * vacías ignoradas. Autómata de 3 estados: inicio de campo, campo sin comillas,
 * campo entre comillas.
 */
export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let hasContent = false
  let state: 'start' | 'unquoted' | 'quoted' = 'start'
  let i = 0
  const n = src.length

  function endField() {
    row.push(field)
    field = ''
  }
  function endRow() {
    endField()
    if (hasContent || row.some((f) => f !== '')) rows.push(row)
    row = []
    hasContent = false
    state = 'start'
  }

  while (i < n) {
    const ch = src[i]!
    if (state === 'quoted') {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        state = 'unquoted'
        i++
        continue
      }
      field += ch
      i++
      continue
    }
    // state === 'start' | 'unquoted'
    if (ch === '"' && state === 'start') {
      state = 'quoted'
      i++
      continue
    }
    if (ch === ',') {
      endField()
      state = 'start'
      i++
      continue
    }
    if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      endRow()
      i++
      continue
    }
    field += ch
    hasContent = true
    state = 'unquoted'
    i++
  }
  if (field !== '' || row.length > 0) endRow()
  return rows
}

const NEEDS_QUOTING = /["\r\n,]/
function quoteField(v: string): string {
  return NEEDS_QUOTING.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

/**
 * Serializa filas a CSV (RFC 4180), citando solo los campos que lo requieren.
 *
 * NO neutraliza la inyección de fórmulas: un campo que empiece con `=`, `+`, `-` o `@`
 * se escribe tal cual y Excel/Sheets pueden interpretarlo como fórmula al abrirlo. Usar
 * solo para contenido estático controlado por el servidor (p. ej. la plantilla de
 * importación); si en el futuro se genera un CSV a partir de datos de usuario para
 * descargar, hay que anteponer un `'` (o similar) a esos campos antes de llamar aquí.
 */
export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map(quoteField).join(',')).join('\r\n')
}
