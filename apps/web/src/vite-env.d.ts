/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Dominio público de despliegue (I-2, Tarea 14, #71): usado por `lib/public-url.ts` para el
   * QR de la orden imprimible, sin depender de `window.location.origin`. Documentada en
   * `.env.example`; opcional (cae a `window.location.origin` si falta, p. ej. en desarrollo). */
  readonly VITE_PUBLIC_URL?: string
}
