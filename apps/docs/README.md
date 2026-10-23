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
pnpm --filter @dentalware/docs sitio    # barrido del sitio construido a 1280, 390 y 360 (Playwright)
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
4. `:::warning Importante` solo para lo que no tiene vuelta (finalizar, cancelar, anular un pago),
   `:::tip Consejo` para atajos y `:::info <título>` para notas neutras (p. ej. «Precios»: el técnico y
   el mensajero no los ven).
   Todo aviso lleva su título en sentence case: sin él, el tema pone su rótulo en minúsculas
   («nota»); `avisos-con-titulo.test.ts` lo comprueba.
5. Las páginas de referencia (como «Qué ve cada rol») no son tareas: no llevan «Quién puede hacerlo»
   ni pasos.

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
`<nombre>.telefono.png` al lado (debajo si las dos no caben a su tamaño real; en el teléfono, solo la
del teléfono), y con `solo="telefono"`, solo esa. `alt`
describe lo que se ve; `pie` añade un texto debajo. Las capturas se toman a 2 píxeles por punto y
`Captura` las declara `2x`: se ven a su tamaño real en la app, nítidas, y nunca se estiran.

## Regenerar las capturas

Las capturas salen de una tubería de Playwright (`capturas/`) sobre los datos de demostración de
`seed:demo` (ficticios), con el reloj fijo en el martes 20 de octubre de 2026 a las 10:30 (API,
seed y navegador): dos corridas dan las mismas imágenes bit a bit. Cada spec recorre una pantalla y
llama a `captura(page, '<seccion>/<nombre>', locator, { testInfo })` (o, para la pantalla entera,
`{ pagina: true, esperar: locator }`; con `margen: 16`, el recorte deja 16 px del fondo de la página
alrededor del elemento, que tiene que caber en la ventana), que escribe
`static/img/capturas/<seccion>/<nombre>.escritorio.png` (1280×800) y `….telefono.png` (Pixel 7), las
dos a `deviceScaleFactor: 2`.
Los specs nunca guardan nada: los diálogos se abren, se capturan y se cierran con «Volver». Los botones
de las devtools de TanStack (solo existen en `vite dev`) se ocultan en toda captura.

Tres detalles de la tubería que conviene saber:

- **Fechas en español**: Chromium se lanza con `LANGUAGE=es_EC` y `LANG=es_EC.UTF-8` en
  `launchOptions.env` (`capturas/playwright.config.ts`). El `input type="date"` toma el formato del
  idioma de la interfaz, no de `locale`: sin eso sale «10/20/2026» y no «20/10/2026». Un campo de fecha
  vacío sigue mostrando «dd/mm/yyyy», porque el Chromium de Playwright no trae los textos en español.
- **El historial es la excepción al reloj fijo**: sus eventos llevan la hora real de la base de datos
  (`case_events.created_at` es `clock_timestamp()`), así que la captura del historial fija el reloj del
  navegador dos horas después del último evento del trabajo y muestra siempre «hace 2 horas».
- **`Captura` declara las imágenes solo con `srcset … 2x`, sin `src`**: con `src`, una pantalla normal
  (1x) lo elegiría y pintaría la imagen al doble de su tamaño.
- **El tamaño de cada captura va en `static/img/capturas/dimensiones.json`**, en píxeles del PNG
  (`"<nombre>.<proyecto>": [ancho, alto]`): `captura()` lo escribe al guardar cada imagen y `Captura`
  lo pinta como `width`/`height` a la mitad, para que la página no salte mientras cargan. Si borras o
  renombras capturas a mano, regenéralo entero con `pnpm --filter @dentalware/docs capturas:dimensiones`;
  `capturas-referenciadas.test.ts` falla si no cuadra con los PNG.

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
captura que ningún spec produce, ni quedar un PNG que ninguna guía pide (una variante de teléfono
que ya no se usa): `capturas-referenciadas.test.ts` (en `pnpm test`) lo comprueba.

## Qué no puede salir nunca

Ni en el texto ni en una captura: pacientes, clínicas o doctores reales; el nombre, la dirección o los
teléfonos del laboratorio; contraseñas, tokens, IPs ni URLs internas. Las capturas salen solo de los
datos de demostración, que son ficticios.

## Qué falta (MAN-2)

Este manual cubre MAN-1 (#127): «Primeros pasos», «Recepción» y «Mensajero». MAN-2 (#138) añade, con
la misma plantilla y la misma tubería de capturas:

- **Técnico**: mis trabajos, avanzar fase, pruebas y en espera, finalizar.
- **Administración**: clínicas y doctores, productos y precios por clínica, fases, usuarios y roles,
  datos del laboratorio; ajustes, saldo inicial y anular pagos; importar CSV.
- **Referencia**: glosario, estados del trabajo con su diagrama (derivados de `CASE_TRANSITIONS` de
  `shared`) y preguntas frecuentes.

Al publicarlas: «Soy técnico» y «Administro el laboratorio» en la portada, las secciones en
`sidebars.ts` y en el menú superior, y `HELP_PATH` de `admin` y `tecnico`
(`apps/web/src/features/help/help-url.ts`) a sus guías, que hoy llevan a la portada. Antes, la ola de
fixes de la revisión UI/UX de la Iteración 8 (#137).
