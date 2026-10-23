/** Caja en px de CSS, relativa a la ventana (la de `locator.boundingBox()`). */
export type Caja = { x: number; y: number; width: number; height: number }

/** Lo que mide de más una caja por redondeo (15.6 en vez de 16) sin que deje de caber. */
const TOLERANCIA = 0.5

/** La caja del elemento más `margen` px por lado. Lanza si no cabe en la ventana: con `margen`
 * se recorta la página, que no se desplaza, y un elemento más grande saldría cortado. */
export function recorte(caja: Caja, ventana: { width: number; height: number }, margen: number) {
  const x = caja.x - margen
  const y = caja.y - margen
  const derecha = caja.x + caja.width + margen
  const abajo = caja.y + caja.height + margen
  if (
    x < -TOLERANCIA ||
    y < -TOLERANCIA ||
    derecha > ventana.width + TOLERANCIA ||
    abajo > ventana.height + TOLERANCIA
  ) {
    throw new Error(
      `La captura con margen ${margen} no cabe en la ventana (${ventana.width}×${ventana.height}): ` +
        `el elemento mide ${caja.width}×${caja.height} en (${caja.x}, ${caja.y}).`,
    )
  }
  const izquierda = Math.max(0, x)
  const arriba = Math.max(0, y)
  return {
    x: izquierda,
    y: arriba,
    width: Math.min(ventana.width, derecha) - izquierda,
    height: Math.min(ventana.height, abajo) - arriba,
  }
}
