/** Todas las páginas del manual (las guías de `docs/`, con la portada). Si una guía nueva no está
 * aquí, el barrido no la ve: `paginas.test.ts` la cruza con la carpeta `docs/`. Sin Playwright,
 * para que Vitest lo pueda importar. */
export const PAGINAS = [
  '/',
  '/primeros-pasos/',
  '/primeros-pasos/entrar-y-salir/',
  '/primeros-pasos/instalar-la-app/',
  '/primeros-pasos/que-ve-cada-rol/',
  '/recepcion/',
  '/recepcion/crear-un-trabajo/',
  '/recepcion/la-ficha-del-trabajo/',
  '/recepcion/estados-y-acciones/',
  '/recepcion/recogidas-y-entregas/',
  '/recepcion/avisar-por-whatsapp/',
  '/recepcion/cuentas-y-pagos/',
  '/recepcion/imprimir/',
  '/tecnico/',
  '/tecnico/mis-trabajos/',
  '/tecnico/avanzar-fase/',
  '/tecnico/pruebas-y-espera/',
  '/tecnico/finalizar/',
  '/mensajero/',
  '/mensajero/entregas-del-dia/',
  '/mensajero/marcar-entregado/',
  '/mensajero/no-se-pudo/',
  '/mensajero/sin-senal/',
  '/administracion/',
  '/administracion/datos-del-laboratorio/',
  '/administracion/fases/',
  '/administracion/productos-y-precios/',
  '/administracion/clinicas-y-doctores/',
  '/administracion/usuarios-y-roles/',
  '/administracion/ajustes-y-anular-pagos/',
  '/administracion/importar-csv/',
  '/referencia/',
  '/referencia/estados/',
  '/referencia/glosario/',
  '/referencia/preguntas-frecuentes/',
] as const

const conBarras = (ruta: string) => `/${ruta}/`.replace(/\/+/g, '/')

/** La ruta que publica Docusaurus para una guía (`routeBasePath: '/'`, `trailingSlash: true`):
 * `archivo` es relativo a `docs/` y con `/`. Un `index.md` es la ruta de su carpeta; un `slug` del
 * frontmatter manda, absoluto o relativo a la carpeta. */
export function rutaDeGuia(archivo: string, texto: string): string {
  const partes = archivo.replace(/\.mdx?$/, '').split('/')
  const nombre = partes.pop() ?? ''
  const carpeta = partes.join('/')
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(texto)?.[1] ?? ''
  const slug = /^slug:\s*(.+?)\s*$/m.exec(frontmatter)?.[1]?.replace(/^(['"])(.*)\1$/, '$2')
  if (slug !== undefined) return conBarras(slug.startsWith('/') ? slug : `${carpeta}/${slug}`)
  return conBarras(nombre === 'index' ? carpeta : `${carpeta}/${nombre}`)
}
