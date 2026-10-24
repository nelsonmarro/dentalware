/** `@theme/Mermaid` solo existe dentro del bundler de Docusaurus (y pinta en el navegador): en los
 * tests deja el texto del diagrama en un `<pre>`, para leerlo. */
export default function Mermaid({ value }: { value: string }) {
  return <pre data-mermaid="">{value}</pre>
}
