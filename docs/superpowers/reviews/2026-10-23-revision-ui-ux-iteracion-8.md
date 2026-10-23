# Revisión UI/UX de la Iteración 8 (#137)

Revisor: Claude, con el criterio de `frontend-design`. Fecha: 2026-10-23. Rama `main` (2c0d789). Sitio del manual construido (`pnpm --filter @dentalware/docs build`) y servido en `localhost:3100`; app en modo test con los datos de demostración (`capturas:servidores`, reloj fijo) y la web de desarrollo con `VITE_DOCS_URL=http://localhost:3100`.

Método: un barrido automatizado con el Chromium de Playwright (el MCP de Chrome DevTools no conectó) sobre las 18 páginas del manual, la página de búsqueda y la 404, a 1280×800, 390×844 (iPhone 13) y 360×740 (Pixel 5): consola, scroll horizontal, objetivos táctiles (todo `a`, `button`, `input` visible con menos de 44 px), `<img>` sin dimensiones, `h1`, el buscador con teclado (`Ctrl+K`, escribir, flecha abajo, Enter), el orden del foco en la portada y el menú del teléfono; Lighthouse CLI 13.5 (solo accesibilidad, móvil y escritorio) en once páginas; y revisión a ojo de las capturas. El enlace «Ayuda» de la app se comprobó con los cuatro roles a los tres anchos (href, `target`, tamaño y la página que abre).

## Resumen

El manual funciona y se ve como la app: los tokens de Dentalware (porcelana, grafito, teal), Instrument Sans, los chips de rol y los botones tal cual salen en la app, y la pestaña del ticket en las tarjetas de la portada. Las 16 guías siguen la plantilla (para qué sirve, quién, pasos, qué pasa después, problemas frecuentes), el texto es corto y concreto, y las capturas se leen en el teléfono porque solo se muestra la variante del teléfono. No hay scroll horizontal en ningún ancho, la consola está limpia, el foco se ve en todo control (anillo teal de 2 px), el buscador busca en español y se recorre con el teclado, y Lighthouse de accesibilidad da 100 en todas las guías y la portada (98 en la página de búsqueda). El enlace «Ayuda» mide 44 px en los tres anchos, abre en otra pestaña y lleva a recepción y al mensajero a su sección y al resto a la portada.

Lo que falla son detalles de la capa de Docusaurus que el tema no corrige solo y dos cosas de la app. El campo del buscador se anuncia en inglés («Search») a quien use un lector de pantalla (UX8-01). Varios controles de navegación miden menos de 44 px en el teléfono: las migas de pan, el botón «En esta página», el campo de la página de búsqueda y la marca del navbar (UX8-02). En la app, la barra lateral de escritorio no es fija: con una lista larga, como la del técnico, «Ayuda» y «Cerrar sesión» quedan bajo el pliegue (UX8-03). Las capturas no declaran su tamaño y la página salta mientras cargan (UX8-04). El resto son pulidos: la flecha de las tarjetas con `content` alternativo, rótulos de Docusaurus mal traducidos, los títulos de los avisos en mayúsculas, «Primeros pasos» con tres puertas y dos destinos, el hueco entre un chip de botón y la puntuación, la 404 sin ninguna acción y la página de búsqueda sin `main`.

## Hallazgos

### Critical

Ninguno.

### Important

#### UX8-01 · El campo del buscador se anuncia «Search»

- **Pantalla**: navbar del manual (escritorio y teléfono) y página de búsqueda. **Viewport**: todos.
- **Qué pasa**: `@easyops-cn/docusaurus-search-local` 0.55.3 escribe `aria-label="Search"` fijo en el `<input>` del navbar (`SearchBar.jsx:401`); el `placeholder` sí sale de `i18n/es/code.json` («Buscar»). El campo de la página de búsqueda (`.searchQueryInput`) tampoco lleva nombre en español. Un lector de pantalla lee «Search, cuadro combinado».
- **Por qué importa**: es el único control del manual en inglés y es el que da acceso a todo lo demás. Ya estaba anotado en #137 como «no se cierra sin arreglarlo».
- **Propuesta**: un wrapper `src/theme/SearchBar/index.tsx` sobre `@theme-original/SearchBar` que, al montar y ante cada cambio del DOM del contenedor (el teléfono vuelve a montar el campo al abrirlo), ponga `aria-label="Buscar en el manual"` al `.navbar__search-input`; otro sobre `SearchPage` que nombre su campo y marque el contenedor como `main` (UX8-13). La regla que renombra va en una función pura con test en jsdom.
- **Archivos**: `apps/docs/src/theme/SearchBar/index.tsx`, `apps/docs/src/theme/SearchPage/index.tsx`, `apps/docs/src/theme/buscador-accesible.ts` (+ test).

#### UX8-02 · Controles de navegación por debajo de 44 px

- **Pantalla**: todas. **Viewport**: 390 y 360 (y escritorio en el navbar y la tabla de contenidos).
- **Qué pasa** (medido en el DOM, elementos visibles): migas de pan `.breadcrumbs__link` 31 px de alto (capturas 02, 08); botón «En esta página» (`.tocCollapsibleButton`) 33 px; campo de la página de búsqueda `.searchQueryInput` 36 px; marca «Dentalware» del navbar (`.navbar__brand`) 32 px, también dentro del menú del teléfono. En escritorio: enlaces del navbar 34 px y enlaces de la tabla de contenidos lateral entre 20 y 41 px. Lo que ya se arregló en la iteración (menú lateral, flechas, hamburguesa, cerrar, «Volver al menú principal», campo del navbar) mide 44.
- **Por qué importa**: regla 4 de `CLAUDE.md`: 44 px por omisión, para dedos con guantes; las migas y «En esta página» son la navegación principal dentro de una guía en el teléfono.
- **Propuesta**: en `custom.css`, `min-height: 44px` con `display: inline-flex; align-items: center` para `.breadcrumbs__link`, `.tocCollapsibleButton`, `.navbar__brand` y `.navbar__link`; `min-height: 44px` para `.searchQueryInput`; en la tabla de contenidos de escritorio, `padding-block` para que cada entrada llegue a 44 (o 36 con puntero fino, como las tablas densas, y 44 con `pointer: coarse`).
- **Archivos**: `apps/docs/src/css/custom.css`.

#### UX8-03 · En escritorio, la barra lateral de la app no es fija: «Ayuda» y «Cerrar sesión» se van bajo el pliegue

- **Pantalla**: todo el layout autenticado de la app. **Viewport**: 1280×800 (captura 10).
- **Qué pasa**: el `<aside>` es `static` dentro de un `flex min-h-svh`, así que mide lo que mida el contenido: en el inicio del técnico («Mis trabajos» con cinco tarjetas) el documento mide 1010 px y el pie de la barra, con «Ayuda» y «Cerrar sesión», queda en y = 902 (medido con el enlace), fuera de una ventana de 800. En una lista de trabajos larga, peor. Recepción y administración lo ven en y = 692 solo porque su inicio cabe.
- **Por qué importa**: el enlace «Ayuda» de MAN-1 y el botón de salir son lo único que no está en el menú y desaparecen justo para el rol que más desplaza. Es anterior a la iteración, pero «Ayuda» lo hace visible.
- **Propuesta**: barra lateral pegajosa y de la altura de la ventana: `lg:sticky lg:top-0 lg:h-svh` en el `<aside>`, con el `<nav>` desplazable (`overflow-y-auto`) y el pie siempre a la vista. Comprobarlo en `accesibilidad.spec.ts` (el enlace «Ayuda» dentro de la ventana con la lista larga) y en el barrido de 1280.
- **Archivos**: `apps/web/src/components/app-shell.tsx`, `apps/web/src/components/app-shell.test.tsx`, `apps/web/e2e/accesibilidad.spec.ts`.

#### UX8-04 · Las capturas no declaran `width`/`height` y la página salta al cargarlas

- **Pantalla**: toda guía con capturas (hasta nueve en «Crear un trabajo» y «Cuentas y pagos»). **Viewport**: todos.
- **Qué pasa**: `Captura` pinta `<img srcSet="… 2x" loading="lazy">` sin `width` ni `height` (63 imágenes sin dimensiones en el barrido). El navegador no reserva el alto hasta que llega el PNG, y como cargan en diferido, el texto se mueve mientras se lee o se vuelve de un ancla.
- **Por qué importa**: en el teléfono, con señal lenta, un salto de 400–700 px bajo el dedo hace perder el paso que se estaba leyendo.
- **Propuesta**: la tubería de capturas escribe, junto a cada PNG, sus dimensiones en `static/img/capturas/dimensiones.json` (`{"recepcion/trabajos-lista.escritorio": [w, h]}`, en píxeles de CSS, la mitad del PNG a DPR 2); `Captura` las lee y pone `width`/`height` (CSS ya hace `height: auto`); `capturas-referenciadas.test.ts` comprueba que cada PNG referenciado tiene su entrada y que coincide con la cabecera del PNG (IHDR), para que no se desincronicen.
- **Archivos**: `apps/docs/capturas/helpers.ts`, `apps/docs/static/img/capturas/dimensiones.json`, `apps/docs/src/components/captura.tsx` (+ test), `apps/docs/src/capturas-referenciadas.test.ts`.

### Minor

#### UX8-05 · La flecha de las tarjetas de la portada depende de `content: '→' / ''`

- **Qué pasa**: `.portada__titulo::after { content: '→' / '' }`. La sintaxis con texto alternativo la admiten Chrome 73+ y Safari 17.4+, pero Firefox solo desde 128 (julio de 2024): en uno anterior la declaración entera se descarta y la tarjeta se queda sin flecha. No rompe nada, pero el elemento que se mueve al pasar el ratón desaparece sin aviso.
- **Propuesta**: la flecha como `<span aria-hidden="true" className="portada__flecha">→</span>` en `Portada`, con la misma transición; sin `content` en CSS.
- **Archivos**: `apps/docs/src/components/portada.tsx` (+ test), `apps/docs/src/css/custom.css`.

#### UX8-06 · Rótulos de Docusaurus mal traducidos

- **Qué pasa**: el tema trae «Cerrar barra de lateral» (botón de cerrar el menú del teléfono), «Alternar barra lateral» (hamburguesa) y «Enlace directo al Quién puede hacerlo» (enlace de ancla de cada título, con artículo de más). Son `theme.docs.sidebar.closeSidebarButtonAriaLabel`, `theme.docs.sidebar.toggleSidebarButtonAriaLabel` y `theme.common.headingLinkTitle` de `theme-common.json`.
- **Propuesta**: sobrescribirlos en `i18n/es/code.json`: «Cerrar el menú», «Abrir el menú» y «Enlace a la sección «{heading}»».
- **Archivos**: `apps/docs/i18n/es/code.json`.

#### UX8-07 · Los títulos de los avisos salen en mayúsculas

- **Qué pasa**: Infima pone `text-transform: uppercase` al título de los `:::info`/`:::tip`/`:::warning`: «PRECIOS», «AJUSTES Y PAGOS ANULADOS», «DATOS DEL PACIENTE» (captura 09). La convención es sentence case; en mayúsculas los títulos largos se leen peor y gritan.
- **Propuesta**: `.theme-admonition .admonitionHeading, .alert > :first-child { text-transform: none; letter-spacing: 0 }` (la clase exacta la da el CSS del tema; apuntar a la estructura, no al hash).
- **Archivos**: `apps/docs/src/css/custom.css`.

#### UX8-08 · «Primeros pasos» tiene tres puertas y dos destinos

- **Qué pasa**: el navbar y la tarjeta de la portada llevan a «Entrar y salir»; la categoría del menú lateral, a un índice generado por Docusaurus con tres tarjetas genéricas (icono de documento y descripción cortada: «Cómo iniciar sesión en Dentalware con tu co…», captura 03). Recepción y Mensajero sí tienen su página propia («Un día de recepción», «Un día del mensajero»).
- **Propuesta**: `primeros-pasos/index.md` («Primeros pasos»: qué hay en la sección y en qué orden, con el mismo tono que las otras dos), la categoría con `link: { type: 'doc' }`, y navbar y portada a `/primeros-pasos/`. `HELP_PATH` de la app no cambia (admin y técnico siguen en la portada hasta MAN-2).
- **Archivos**: `apps/docs/docs/primeros-pasos/index.md`, `apps/docs/sidebars.ts`, `apps/docs/docusaurus.config.ts`, `apps/docs/src/components/portada.tsx` (+ test).

#### UX8-09 · Hueco entre un chip de botón y la puntuación que le sigue

- **Qué pasa**: «Toca <Boton>Nuevo trabajo</Boton>.» se pinta como «Toca  Nuevo trabajo .» (captura 08): el `kbd.boton` deja aire antes y después, y el punto queda suelto. Pasa en cada paso que termina en un botón.
- **Propuesta**: averiguar de dónde sale el margen (Infima da `margin` al `kbd`, o el MDX conserva espacios alrededor del componente) y quitarlo: `margin: 0` en `kbd.boton` y, si es el espacio del MDX, escribir los chips pegados a la puntuación en la plantilla y en las guías.
- **Archivos**: `apps/docs/src/css/custom.css`, `apps/docs/src/components/boton.tsx`.

#### UX8-10 · La 404 no ofrece ninguna acción

- **Qué pasa**: «Página no encontrada. Esta página no existe en el manual. Busca lo que necesitas con el buscador o vuelve a la portada desde el menú.» y nada más (captura 07): en el teléfono «el menú» es una hamburguesa y el buscador, una lupa.
- **Propuesta**: wrapper `src/theme/NotFound/Content` que añada un enlace «Ir a la portada» (44 px) bajo el texto; los textos siguen en `code.json`.
- **Archivos**: `apps/docs/src/theme/NotFound/Content/index.tsx` (+ test).

#### UX8-11 · Las capturas con un campo de fecha vacío muestran «dd/mm/yyyy»

- **Qué pasa**: el Chromium de Playwright no trae los textos en español del `input type="date"`: un campo vacío sale «dd/mm/yyyy» (ya anotado en #137). Pasa en las capturas con una fecha sin valor.
- **Propuesta**: en los specs, rellenar esa fecha sin guardar (los specs no mutan datos: rellenar un campo de un formulario que se cierra con «Volver» no muta nada) o elegir un estado del seed donde ya tenga valor; regenerar solo esas capturas en modo rápido. Si ninguna captura la muestra, cerrar sin cambios.
- **Archivos**: `apps/docs/capturas/*.spec.ts`, PNG afectados.

#### UX8-12 · Contenedores de la app sin nombre accesible

- **Qué pasa**: la cabecera de la ficha, la tarjeta «Programar recogida» y el bloque código/clínica/WhatsApp no tienen rol ni nombre, así que `recepcion.spec.ts` los encuentra con `[data-slot=card]` y xpath en vez de por rol, y un lector de pantalla no puede saltar a ellos.
- **Propuesta**: `<section aria-labelledby>` o `aria-label` en esos tres contenedores («Datos del trabajo», «Programar recogida», …) y los locators de las capturas por rol (`getByRole('region', { name })`). Sin cambiar nada visible: las capturas deben salir idénticas (`git diff` de los PNG vacío).
- **Archivos**: `apps/web/src/features/cases/*.tsx` (los tres contenedores), `apps/docs/capturas/recepcion.spec.ts`.

#### UX8-13 · La página de búsqueda no tiene `main`

- **Qué pasa**: Lighthouse 98 por `landmark-one-main`: `SearchPage` del plugin pinta un `<div class="container">` dentro del `Layout`, sin `<main>`. Es la única página por debajo de 100.
- **Propuesta**: en el wrapper de `SearchPage` (UX8-01), `role="main"` al contenedor de resultados (o `<main>` si el wrapper puede envolverlos sin tocar el navbar).
- **Archivos**: `apps/docs/src/theme/SearchPage/index.tsx`.

### Diferidos del issue: veredicto

| Diferido | ¿Pasa? | Clasificación |
|---|---|---|
| Migas de pan y enlaces sueltos del contenido en móvil sin 44 px | Migas: sí, 31 px. Enlaces en línea del texto: 20–29 px, pero son texto corrido con interlineado 1.6 (unos 29 px entre líneas) | Migas → **UX8-02**. Enlaces en línea → **descartado**: WCAG 2.5.8 exceptúa los enlaces dentro de una frase; alargarlos con `padding` rompería el ritmo del texto y no se tocan con guantes (los lee recepción en la computadora) |
| `content: '→' / ''` sin respaldo | Sí, en Firefox < 128 se pierde la flecha | Minor → **UX8-05** |
| `aria-label="Search"` en inglés | Sí, fijo en el plugin | Important → **UX8-01** |
| `<img>` de `Captura` sin `width`/`height` | Sí, 63 imágenes | Important → **UX8-04** (salta la página en el teléfono) |
| Contenedores sin nombre accesible en la app | Sí | Minor → **UX8-12** |
| «dd/mm/yyyy» en las capturas | Sí, en los campos de fecha vacíos | Minor → **UX8-11** |
| Retomar `primeros-pasos-telefono.png` | Hecho en esta revisión (captura nueva de «Entrar y salir» a 390, con el seed arreglado) | Cerrado |
| Rótulos de «Instalar la app» en teléfonos reales | No comprobable aquí | **Fuera de la ola**: Tarea 9 de la It7, con Nelson |

### Descartados

- **Enlaces de ancla de los títulos (`.hash-link`, 29 px en el teléfono)**: solo se ven con el ratón encima o con el foco del teclado; en el teléfono no hay forma de tocarlos y no hacen falta (el título ya está a la vista). Se dejan.
- **Enlaces en línea del texto** (ver tabla).
- **Resultados duplicados en el listado del buscador**: artefacto del barrido (el locator casaba dos nodos por resultado); en pantalla salen una vez (captura 05).

## Checklist de #137

- [x] Portada: tres accesos, jerarquía y lectura en el teléfono (capturas 01 y 02). Bien; UX8-05 y UX8-08 son pulidos.
- [x] Primeros pasos: las tres páginas. Bien; UX8-08 (índice) y UX8-11.
- [x] Recepción: las ocho páginas, capturas legibles, solo la variante del teléfono en móvil, avisos con su color. UX8-04, UX8-07, UX8-09.
- [x] Mensajero: las cinco páginas, pensadas para el teléfono. Bien.
- [x] Buscador: `Ctrl+K` enfoca el campo, «recogida» da resultados en español, flecha abajo y Enter abren el resultado (`/recepcion/recogidas-y-entregas/#pasos-para-una-recogida`); en el teléfono, la lupa abre el campo. UX8-01 y UX8-13.
- [x] Navegación: menú lateral y menú del teléfono a 44 px (captura 04), migas (UX8-02), «Anterior/Siguiente» legibles a 360, tabla de contenidos (UX8-02 en escritorio). UX8-06.
- [x] Enlace «Ayuda» en la app para los cuatro roles: 44×44 en el teléfono, 215×44 en escritorio, `target="_blank"` y `rel="noopener"`, recepción → «Un día de recepción», mensajero → «Un día del mensajero», admin y técnico → portada (capturas 11 y 12). UX8-03 en escritorio.
- [x] Consola limpia (solo el 404 del propio documento en `/no-existe/`), sin scroll horizontal a 1280, 390 ni 360; Lighthouse de accesibilidad 100 en portada, los tres índices, «Entrar y salir», «Instalar la app», «Crear un trabajo», «Cuentas y pagos» y «Las entregas del día» (móvil y escritorio), 98 en la página de búsqueda (UX8-13).

## Datos creados durante la revisión

Ninguno: el sitio es estático y la app se revisó con los datos de demostración de `seed:demo` sobre la BD de test, que se resiembra en cada corrida.

## Capturas

En `docs/superpowers/reviews/capturas/it8/`: `01-portada-escritorio`, `02-portada-telefono`, `03-primeros-pasos-indice-generado-escritorio`, `04-menu-movil-360`, `05-buscador-resultados-escritorio`, `06-pagina-busqueda-telefono`, `07-404-escritorio`, `08-chip-boton-y-captura-360`, `09-aviso-mayusculas-telefono`, `10-app-tecnico-sidebar-escritorio`, `11-ayuda-recepcion-escritorio`, `12-ayuda-recepcion-telefono`, `13-estados-escritorio` y `primeros-pasos-telefono` (retomada). Las de antes de la iteración (`sitio-vacio-*`, `ayuda-telefono`, `mensajero-entregas-telefono`, `recepcion-cuentas-escritorio`) se dejan como estaban.

## Resultado de la ola

Ola de fixes de #137 en la rama `fix/revision-ui-ux-it8` (base `5cabf19`). Los trece hallazgos se corrigieron; lo descartado y lo que queda fuera está abajo.

| Hallazgo | Commit | Qué se hizo |
|---|---|---|
| UX8-02, UX8-07, UX8-09 | 51c2f99 | Barrido del manual en Playwright (`pnpm --filter @dentalware/docs sitio`, `apps/docs/sitio/`): 18 páginas, búsqueda y 404 a 1280, 390 y 360, con consola, scroll horizontal, `h1`, objetivos táctiles de 44 px (`expectObjetivosTactiles` falla si no mide nada) y menú del teléfono. Migas, marca, enlaces del navbar, «En esta página», tabla de contenidos y campo de búsqueda a 44 px; títulos de los avisos sin mayúsculas; el «hueco» del chip de botón era su relleno lateral (0,5 em, no un espacio): 0,35 em. Corre en el job `e2e` de CI. |
| Ronda de fixes de la Tarea 1 | 32cf58c | El `inline-flex` del navbar solo en escritorio (Infima lo oculta con `display: none` a ≤ 996 px y empataba en especificidad); tabla de contenidos en bloque, con el margen de Infima; avisos con título (`avisos-con-titulo.test.ts` falla ante un `:::info` sin título, con `archivo:línea`); proyecto `telefono-webkit` solo en CI. |
| UX8-01, UX8-13 | cd192cd | Wrappers `SearchBar` y `SearchPage` sobre los del plugin: el campo se anuncia «Buscar en el manual» y la página de búsqueda lleva `main`. La regla es una función pura (`buscador-accesible.ts`) con test en jsdom y un `MutationObserver` (el teléfono vuelve a montar el campo al abrirlo). |
| Ronda de fixes de la Tarea 2 | 1b7e591 | El campo de la página de búsqueda con nombre propio («Buscar en el manual: términos»), para no repetir el del navbar; no se reescribe un `main` que ya existe. |
| UX8-04 | 2da6116 | `static/img/capturas/dimensiones.json` (63 entradas) que la tubería escribe al guardar cada PNG (`capturas:dimensiones` lo rehace entero); `Captura` pinta `width`/`height` a la mitad; `capturas-referenciadas.test.ts` cruza el JSON con la cabecera IHDR de cada PNG. La página ya no salta al cargar. |
| UX8-05, UX8-06, UX8-08, UX8-10 | 043adab | Flecha de las tarjetas como `<span aria-hidden>`, sin `content` CSS; los tres rótulos de Docusaurus en `i18n/es/code.json` («Cerrar el menú», «Abrir el menú», «Enlace a la sección «{heading}»»); «Primeros pasos» con su página (`primeros-pasos/index.md`), la categoría con `link: doc` y navbar y portada a `/primeros-pasos/`; la 404 con «Ir a la portada». |
| Ronda de fixes de la Tarea 4 | e55136c | `NotFound/Content` completo (no un envoltorio), para que el botón quede dentro de `main`; texto de la 404 y cierre de «Primeros pasos» ajustados. |
| UX8-03, UX8-12 | bc9652d | Barra lateral de la app `lg:sticky lg:top-0 lg:h-svh` con el `nav` desplazable: «Ayuda» y «Cerrar sesión» siempre a la vista; la cabecera de la ficha («Datos del trabajo»), el bloque código/clínica/aviso y «Programar recogida» con rol y nombre, y los locators de las capturas por rol. El E2E mira «Inicio», «Ayuda» y «Cerrar sesión» arriba, a media página y al final: el del brief (solo al final) pasaba también sin el arreglo. |
| UX8-03 (capturas) | 05460e2 | 15 PNG de escritorio regenerados: ahora muestran el pie de la barra y Chromium pinta el texto de las páginas altas con otro suavizado (el `aside` sticky va en su capa). Determinista: dos corridas dan AE = 0. |
| Ronda de fixes de la Tarea 5 | 248b754 | El `nav` con `py-0.5`, para que el anillo de foco entero no se recorte; ids de `useId` en «Programar recogida», con test de dos secciones montadas a la vez; el E2E espera una fila de datos y no la cabecera. |
| UX8-11 | 556b0fc | `recepcion/nuevo-trabajo-formulario` rellena (sin enviar) «Fecha deseada» con 27/10/2026 antes de capturar; era la única que mostraba «dd/mm/yyyy». |
| UX8-11 (capturas), UX8-03, UX8-12 | 7a27060 | 15 PNG al día con «Ayuda» (icono en la cabecera del teléfono, texto en la barra de escritorio), la barra lateral y la fecha deseada. Atribuidos uno a uno con un CSS temporal que deshacía cada cambio de UI: sin él, todos salían idénticos a los de antes salvo los de la fecha y el menú de recepción. |

Contexto, no parte de la ola: `33376da` (#142, llegó por el merge de `main`) pasa el job `e2e` a la imagen oficial de Playwright de la versión del catalog; ahí corre también el barrido del manual.

### Barrido del manual

`pnpm --filter @dentalware/docs sitio` termina con 90 pruebas en verde y 6 omitidas a propósito (navbar y categoría lateral solo en escritorio, porque en el teléfono viven dentro de la hamburguesa), repartidas en `escritorio` (1280×800), `telefono` (Pixel 7, Chromium, 390×844) y `telefono-360` (Pixel 5, 360×740). En CI se suma `telefono-webkit` (iPhone 13), que no arranca en local fuera de Ubuntu (#133).

### Lighthouse (accesibilidad)

CLI 13.5 sobre el sitio construido y servido en el 3100, con el Chromium de Playwright, móvil y escritorio (`--preset=desktop`):

| Página | Móvil | Escritorio |
|---|---|---|
| `/` | 100 | 100 |
| `/search/?q=recogida` | 100 (antes, 98) | 100 (antes, 98) |
| `/primeros-pasos/entrar-y-salir/` | 100 | 100 |
| `/recepcion/crear-un-trabajo/` | 100 | 100 |
| `/mensajero/entregas-del-dia/` | 100 | 100 |
| `/no-existe/` | sin puntuación | sin puntuación |

La 404 responde con status 404 y Lighthouse lo informa como `ERRORED_DOCUMENT_REQUEST` en lugar de puntuarla; su accesibilidad la cubre el barrido (un solo `main`, un `h1`, botón de 44 px y consola limpia).

### Deuda cerrada en el cierre

- «Qué ve cada rol»: el texto y el `alt` del menú de escritorio nombran «Ayuda», que la captura ya muestra.
- `docs/conventions.md` §7: la regla de las fechas vacías exceptúa los filtros de una lista.
- `capturas/dimensiones.ts`: `leerDimensiones` valida la forma del JSON («dimensiones.json inválido»), `leerDimensionesPng` exige `IHDR` tras la firma, y el escritor a mano dice hasta cuándo coincide con Prettier (líneas bajo 100 columnas); `Captura` deja dicho que sus píxeles son pares (DPR 2).
- `apps/docs/README.md`: el barrido `sitio` y los cambios al tema de Docusaurus (`SearchBar`, `SearchPage`, `NotFound/Content`, rótulos de `code.json`, 44 px).

### Descartados

- **Enlaces en línea del texto y enlaces de ancla de los títulos** (ver «Descartados» arriba): se dejan.
- **Resultados duplicados del buscador**: artefacto del barrido, no del sitio.

### Observaciones

- `recepcion/trabajos-lista.escritorio` sigue mostrando «dd/mm/yyyy» en los filtros «Desde» y «Hasta»: vacíos son el estado por omisión de la lista, y rellenarlos filtraría los trabajos y cambiaría la URL. El Chromium de Playwright no trae los textos en español; en un Chrome en español se lee «dd/mm/aaaa». Decisión: se deja y la convención lo exceptúa.
- La barra de acciones fija del formulario de nuevo trabajo es translúcida y deja ver la tarjeta «Trabajo» al fondo a la izquierda en `nuevo-trabajo-formulario.escritorio`. Es diseño anterior a la ola, no de ella; queda anotado para una revisión UI/UX futura.

### Fuera de la ola

- Los rótulos de «Instalar la app» en teléfonos reales: Tarea 9 de la It7, con Nelson.
- MAN-2 (#138), las guías de técnico y administración, es lo siguiente.

### Capturas «después»

En `docs/superpowers/reviews/capturas/it8/`, con el sitio construido y la app en modo test (datos de demostración, reloj fijo):

- `despues-portada-escritorio` (1280×800) y `despues-portada-telefono` (390): tres accesos, «Primeros pasos» con su página.
- `despues-menu-telefono-360`: menú abierto en una guía de recepción, con «Primeros pasos» como categoría y la hamburguesa («Abrir el menú») y el cierre con sus rótulos nuevos (que se leen en el DOM, no en la imagen).
- `despues-404-telefono` (390): «Ir a la portada» de 44 px dentro de `main`.
- `despues-busqueda-telefono` (390): «Resultados para «recogida»» con el campo a 44 px.
- `despues-app-tecnico-barra-fija-escritorio` (1280×800): inicio del técnico desplazado al final (documento de 1010 px), con «Diego Técnico», «Ayuda» y «Cerrar sesión» a la vista en la barra fija.
