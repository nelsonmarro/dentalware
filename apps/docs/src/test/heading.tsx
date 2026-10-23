import type { ComponentProps, ElementType } from 'react'

/** `@theme/Heading` solo existe dentro del bundler de Docusaurus: en los tests es la etiqueta de
 * `as`. */
export default function Heading({ as: Tag, ...rest }: { as: ElementType } & ComponentProps<'h1'>) {
  return <Tag {...rest} />
}
