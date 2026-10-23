import Link from '@docusaurus/Link'
import Translate from '@docusaurus/Translate'
import Heading from '@theme/Heading'
import clsx from 'clsx'

/** La 404 del tema (`NotFound/Content`, copiada a mano) más una salida dentro de su `main`
 * (UX8-10): en el teléfono «el menú» es una hamburguesa y «el buscador», una lupa; un botón a la
 * portada es más claro. Todos los textos, también el del botón, salen de `i18n/es/code.json`. */
export default function NotFoundContent({ className }: { className?: string }) {
  return (
    <main className={clsx('margin-vert--xl container', className)}>
      <div className="row">
        <div className="col col--6 col--offset-3">
          <Heading as="h1" className="hero__title">
            <Translate id="theme.NotFound.title" description="The title of the 404 page">
              Page Not Found
            </Translate>
          </Heading>
          <p>
            <Translate id="theme.NotFound.p1" description="The first paragraph of the 404 page">
              We could not find what you were looking for.
            </Translate>
          </p>
          <p>
            <Translate id="theme.NotFound.p2" description="The 2nd paragraph of the 404 page">
              Please contact the owner of the site that linked you to the original URL and let them
              know their link is broken.
            </Translate>
          </p>
          <Link className="button button--primary portada__volver" to="/">
            <Translate
              id="theme.NotFound.volver"
              description="El botón de la 404 que lleva a la portada"
            >
              Ir a la portada
            </Translate>
          </Link>
        </div>
      </div>
    </main>
  )
}
