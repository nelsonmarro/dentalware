# Manual de usuario de Dentalware (`apps/docs`)

El manual en línea para recepción, el mensajero y, más adelante, técnicos y administración: un sitio de
[Docusaurus](https://docusaurus.io) en español, con buscador local y capturas de la app hechas con datos
ficticios. Se publica en `docs.dentalware.naphsoft.dev`.

## Verlo en local

```bash
export PATH=$HOME/.nvm/versions/node/v24.19.0/bin:$PATH
pnpm --filter @dentalware/docs dev      # http://localhost:3100, recarga al guardar
pnpm --filter @dentalware/docs build    # como en CI: falla con un enlace, ancla o imagen rotos
pnpm --filter @dentalware/docs serve    # sirve el build en http://localhost:3100
```

El buscador solo funciona sobre el build (`build` + `serve`), no en `dev`. El `pnpm build` de la raíz
construye también el manual, así que el job `quality` de CI lo comprueba en cada PR.

## Escribir una guía

1. Copia `plantillas/guia.md` (está fuera de `docs/` para que no se publique) a la sección que toque,
   por ejemplo `docs/recepcion/registrar-un-pago.md`, y añádela a `sidebars.ts` en su orden.
2. **Captura primero, texto después**: define las capturas en la tubería (sección siguiente), genéralas,
   míralas y escribe los pasos sobre lo que se ve.
3. Frases cortas, en sentence case y con el vocabulario del laboratorio (trabajo, clínica, doctor,
   pieza, fase, recogida, entrega, saldo a favor). Los botones, tal cual salen en la app.
4. `:::warning Importante` solo para lo que no tiene vuelta (finalizar, cancelar, anular un pago) y
   `:::tip Consejo` para atajos.

Los tres componentes propios se usan en cualquier página sin importarlos:

```mdx
<Rol roles={['admin', 'recepcion']} />
```

Quién puede hacerlo, con los rótulos de la app (`admin`, `recepcion`, `tecnico`, `mensajero`). El MDX
no pasa por `tsc`: otro valor (`'recepción'`, con tilde) rompe el build con «Rol desconocido en
`<Rol>`».

```mdx
Toca <Boton>Registrar pago</Boton>.
```

El texto de un botón o enlace de la app, tal cual.

```mdx
<Captura
  nombre="recepcion/registrar-pago"
  alt="Diálogo Registrar pago con el reparto sugerido"
  telefono
/>
```

Una captura de `static/img/capturas/<nombre>.escritorio.png`; con `telefono`, también la de
`<nombre>.telefono.png` al lado (debajo en el teléfono), y con `solo="telefono"`, solo esa. `alt`
describe lo que se ve; `pie` añade un texto debajo.

## Regenerar las capturas

Las capturas salen de una tubería de Playwright (`capturas/`) sobre los datos de demostración de
`seed:demo` (ficticios), con el reloj fijo en el martes 20 de octubre de 2026 a las 10:30 (API,
seed y navegador): dos corridas dan las mismas imágenes bit a bit. Cada spec recorre una pantalla y
llama a `captura(page, '<seccion>/<nombre>', locator, { testInfo })` (o, para la pantalla entera,
`{ pagina: true, esperar: locator }`), que escribe
`static/img/capturas/<seccion>/<nombre>.escritorio.png` (1280×800) y `….telefono.png` (Pixel 7).
Los specs nunca guardan nada: los diálogos se abren, se capturan y se cierran con «Volver».

Requisitos: Postgres de desarrollo arriba (`pnpm db:up`, puerto 5433) y Node 24.

**Modo completo**, antes de cada commit y al cerrar una tarea (el puerto 3000 tiene que estar libre):

```bash
pnpm capturas                                      # todas
pnpm capturas -- recepcion.spec.ts -g "pago"       # solo las que casen
```

Genera una contraseña de demostración nueva, vacía la BD de test y la vuelve a sembrar
(`reset-test-db` → `seed` → `seed:demo`), arranca su propia API con el reloj fijo (y la web, si no
está en 5173), entra con los cuatro roles y toma las capturas. Al terminar lista las imágenes que
cambiaron.

**Modo rápido**, mientras se diseña una captura (segundos por corrida, sin resembrar):

```bash
pnpm --filter @dentalware/docs capturas:servidores   # en otra terminal; se para con Ctrl+C
CAPTURAS_RAPIDO=1 pnpm capturas -- primeros-pasos.spec.ts -g entrar
```

`capturas:servidores` deja la BD sembrada y la API con el reloj fijo en primer plano; el modo rápido la
reutiliza, igual que las sesiones guardadas, y se niega a correr si la API de 3000 no es la suya
(comprueba su PID en `capturas/.auth/api.pid`). Si las capturas con sesión salen con la pantalla de
entrar, las sesiones guardadas ya no valen: borra `capturas/.auth/*.json` y vuelve a correrlo.

La web dev la arranca Playwright en cada corrida, o déjala corriendo aparte
(`pnpm --filter @dentalware/web dev`) para ganar unos segundos. Mientras corre no edites `apps/web`:
la recarga de Vite rompe la corrida.

La contraseña de demostración y las sesiones viven en `capturas/.auth/` (solo para ti, ignorado por
git): nunca se copian a un archivo del repo, a un informe ni a una captura.

**Qué revisar en el `git diff`**: una imagen cambiada significa que cambió la UI (los datos y el reloj
son fijos). Ábrela y comprueba que el cambio es el esperado y que la guía sigue diciendo lo que se
ve. Una imagen nueva necesita su `<Captura nombre="…">` en una guía, y una guía no puede pedir una
captura que ningún spec produce: `capturas-referenciadas.test.ts` (en `pnpm test`) lo comprueba en
las dos direcciones.

## Qué no puede salir nunca

Ni en el texto ni en una captura: pacientes, clínicas o doctores reales; el nombre, la dirección o los
teléfonos del laboratorio; contraseñas, tokens, IPs ni URLs internas. Las capturas salen solo de los
datos de demostración, que son ficticios.
