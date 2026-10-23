import Link from '@docusaurus/Link'
import Content from '@theme-original/NotFound/Content'

/** La 404 del tema más una salida (UX8-10): en el teléfono «el menú» es una hamburguesa y «el
 * buscador», una lupa; un enlace a la portada es más claro. */
export default function NotFoundContent(props: { className?: string }) {
  return (
    <>
      <Content {...props} />
      <div className="margin-bottom--xl container">
        <div className="row">
          <div className="col col--6 col--offset-3">
            <Link className="button button--primary portada__volver" to="/">
              Ir a la portada
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
