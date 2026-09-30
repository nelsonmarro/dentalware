/**
 * URL pública del laboratorio para enlaces que salen del navegador (I-2, ronda de fixes 1 de
 * la Tarea 14, #71): antes el QR de la orden imprimible codificaba `window.location.origin`
 * directo dentro de `PrintOrder`, así que si recepción entraba por la IP o por un alias
 * distinto del dominio público, el papel quedaba con una URL que nadie de afuera podía abrir.
 * `VITE_PUBLIC_URL` se fija en build con el dominio real de despliegue: en producción la pasa
 * `infra/docker-compose.yml` desde `PUBLIC_URL` (el mismo dominio de la API) como argumento de
 * build de `infra/web.Dockerfile`, porque Vite la incrusta al compilar y no la lee en ejecución;
 * `window.location.origin` es el respaldo en desarrollo, donde no hace falta configurarla. Se
 * calcula aquí, fuera de `PrintOrder`, para que el componente reciba un valor ya resuelto (una
 * prop, testeable sin `window`) en vez de leer `window` dentro de su cuerpo.
 */
export function getPublicUrl(): string {
  // Sin barra final: quien configura el dominio suele escribirlo con `/`, y el QR acabaría en
  // `https://lab.ec//t/26-00001` (N-2 de la re-revisión de la Tarea 14).
  return (import.meta.env.VITE_PUBLIC_URL || window.location.origin).replace(/\/+$/, '')
}
