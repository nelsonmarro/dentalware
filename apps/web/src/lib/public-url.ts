/**
 * URL pública del laboratorio para enlaces que salen del navegador (I-2, ronda de fixes 1 de
 * la Tarea 14, #71): antes el QR de la orden imprimible codificaba `window.location.origin`
 * directo dentro de `PrintOrder`, así que si recepción entraba por la IP o por un alias
 * distinto del dominio público, el papel quedaba con una URL que nadie de afuera podía abrir.
 * `VITE_PUBLIC_URL` se fija en build (`.env`/`.env.example`) con el dominio real de despliegue;
 * `window.location.origin` es el respaldo en desarrollo, donde no hace falta configurarla. Se
 * calcula aquí, fuera de `PrintOrder`, para que el componente reciba un valor ya resuelto (una
 * prop, testeable sin `window`) en vez de leer `window` dentro de su cuerpo.
 */
export function getPublicUrl(): string {
  return import.meta.env.VITE_PUBLIC_URL || window.location.origin
}
