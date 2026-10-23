/** `@docusaurus/useBaseUrl` solo existe dentro del bundler de Docusaurus: en los tests, el sitio
 * vive en la raíz (`baseUrl: '/'`) y la ruta sale tal cual. */
export default function useBaseUrl(url: string | undefined): string {
  return url ?? ''
}
