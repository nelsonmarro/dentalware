// Los componentes del tema que se envuelven (swizzle «wrap»): el bundler de Docusaurus resuelve
// `@theme-original/*`; TypeScript solo necesita sus props.
declare module '@theme-original/SearchBar' {
  import type { ComponentType } from 'react'
  const SearchBar: ComponentType<Record<string, unknown>>
  export default SearchBar
}
declare module '@theme-original/SearchPage' {
  import type { ComponentType } from 'react'
  const SearchPage: ComponentType<Record<string, unknown>>
  export default SearchPage
}
