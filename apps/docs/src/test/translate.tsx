import type { ReactNode } from 'react'

/** `@docusaurus/Translate` solo existe dentro del bundler de Docusaurus: en los tests pinta el
 * texto por omisión de sus hijos. */
export default function Translate({ children }: { id?: string; children?: ReactNode }) {
  return <>{children}</>
}
