import type { ComponentProps } from 'react'

/** `@docusaurus/Link` solo existe dentro del bundler de Docusaurus: en los tests es un `<a>`. */
export default function Link({ to, href, ...rest }: ComponentProps<'a'> & { to?: string }) {
  return <a href={to ?? href} {...rest} />
}
