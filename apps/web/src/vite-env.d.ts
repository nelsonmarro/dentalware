/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Dominio público de despliegue (I-2, Tarea 14, #71): usado por `lib/public-url.ts` para el
   * QR de la orden imprimible, sin depender de `window.location.origin`. Documentada en
   * `.env.example`; opcional (cae a `window.location.origin` si falta, p. ej. en desarrollo). */
  readonly VITE_PUBLIC_URL?: string
  /** URL pública del manual de usuario (Iteración 8): la usa `features/help/help-url.ts` para el
   * enlace «Ayuda». Se incrusta al compilar, como `VITE_PUBLIC_URL`; opcional (por omisión, el
   * manual público). */
  readonly VITE_DOCS_URL?: string
}
