# Manual de usuario — diseño (Iteración 8, MAN-1)

Historia: MAN-1 (#127), épica #126, hito 10. Decisiones de Nelson (2026-10-13 a 2026-10-16): Docusaurus en `docs.dentalware.naphsoft.dev`, público; capturas reproducibles con Playwright sobre datos de demostración ficticios; dos entregas (MAN-1 y MAN-2); se despliega junto con la app en la Tarea 9 de la Iteración 7.

## 1. Objetivo y alcance

Un manual en línea, en español y en lenguaje para personas no técnicas, con el que recepción y el mensajero aprendan a usar Dentalware sin preguntar, y que Nelson pueda regenerar cuando cambie la UI.

**MAN-1 (esta iteración):** el sitio, la tubería de capturas, el enlace «Ayuda» en la app, el despliegue y tres secciones de contenido: «Primeros pasos», «Recepción» y «Mensajero».

**MAN-2 (historia nueva, misma épica):** «Técnico», «Administración» y «Referencia» (glosario, diagrama de estados, preguntas frecuentes). Se abre al cerrar MAN-1 con la misma plantilla y la misma tubería.

**Fuera de alcance:** Algolia (queda como opción), versiones del manual, traducciones, modo demo en producción, vídeos.

## 2. El sitio: `apps/docs`

- Paquete `@dentalware/docs` del monorepo (`apps/*` ya está en `pnpm-workspace.yaml`), con Docusaurus **3.10.2** y sus dependencias fijadas en el `catalog:`. Node 24 cumple su requisito (≥ 20).
- `docusaurus.config.ts` tipado (`Config`, `Preset.Options`, `satisfies`). Modo solo docs: `docs.routeBasePath: '/'`, `blog: false`, `pages` fuera salvo la portada. `i18n.defaultLocale: 'es'`, `locales: ['es']`, `htmlLang: 'es-EC'`.
- `onBrokenLinks: 'throw'`, `onBrokenAnchors: 'throw'` y `onBrokenMarkdownImages: 'throw'` (si la versión no lo trae, un test propio comprueba que toda imagen referenciada exista; se decide en el plan con context7).
- **Buscador local**: `@easyops-cn/docusaurus-search-local` 0.55.3 con `language: ['es']`, `hashed: true`, `indexBlog: false`, atajo de teclado (`searchBarShortcut`) y «Buscar» como texto del campo. Sin servicios externos.
- **Navegación**: sidebar por sección y tarea (`sidebars.ts` explícito, no autogenerado, para fijar el orden); navbar con las secciones; migas de pan, «Anterior/Siguiente» y tabla de contenidos (de serie en el tema clásico). Portada (`src/pages/index.tsx`) con tres accesos: «Primeros pasos», «Soy recepción», «Soy mensajero» (MAN-2 añade «Soy técnico» y «Administro el laboratorio»).
- **Tema**: `src/css/custom.css` con los tokens de Dentalware (primario `#0f766e`, fondo `#F4F6F5`, tinta `#1e2a2d`, Instrument Sans y JetBrains Mono desde `@fontsource-variable`), objetivos de 44 px en la navegación móvil, foco visible, contraste AA. Sin modo oscuro (`colorMode.disableSwitch: true`, como la app). Se diseña con `frontend-design` y se revisa a 1280, 390 y 360 sin scroll horizontal, con la consola limpia y Lighthouse de accesibilidad ≥ 95.
- **Componentes propios** (MDX): `Captura` (imagen con `alt`, con la variante de escritorio y teléfono cuando existan las dos, y pie opcional), `Boton` (el texto de un botón de la app tal cual, en el estilo de la app), `Rol` (chip de quién puede hacerlo) y los avisos nativos `:::warning Importante` y `:::tip Consejo`.
- **Scripts**: `dev` (`docusaurus start`), `build`, `typecheck` (`tsc --noEmit`), `capturas` (sección 4). El raíz añade `capturas` (`pnpm --filter @dentalware/docs capturas`). `pnpm build`, `lint`, `format:check` y `typecheck` del raíz ya lo incluyen, así el job `quality` construye el sitio y falla con enlaces o imágenes rotos. Coste aceptado: uno o dos minutos más en `quality`; no se toca la ruleset.
- ESLint y Prettier del repo aplican a `apps/docs` (`src/`, `docusaurus.config.ts`, `sidebars.ts`, `capturas/`); el `build/` y `.docusaurus/` quedan en `.gitignore` y en los ignores de lint y Prettier.

## 3. Contenido de MAN-1

Plantilla de cada guía de tarea, en este orden y con estos títulos: **Para qué sirve**, **Quién puede hacerlo** (chip `Rol`), **Pasos** (numerados, cada uno con su captura cuando aporta), **Qué pasa después**, **Problemas frecuentes** («¿Qué hago si…?»). Reglas de redacción: frases cortas, sentence case, el vocabulario del laboratorio (trabajo, clínica, doctor, pieza, fase, recogida, entrega, saldo a favor), los textos de los botones tal cual salen en la app (`Boton`), «Importante» en lo que no tiene vuelta (finalizar, cancelar, anular pago) y «Consejo» para atajos. Nada que no exista en el MVP.

```
docs/
  index.md                      Bienvenida: qué es Dentalware y el flujo recibir → producir → entregar → cobrar
  primeros-pasos/
    entrar-y-salir.md
    instalar-la-app.md          Android, iPhone y PC (PWA)
    que-ve-cada-rol.md
  recepcion/
    index.md                    Un día de recepción (recorrido corto que enlaza las guías)
    crear-un-trabajo.md         Datos, clínica y doctor, líneas, odontograma, fecha comprometida
    la-ficha-del-trabajo.md     Cabecera, estado, acciones, historial, adjuntos y fotos
    estados-y-acciones.md       Qué significa cada estado y qué acción lo mueve
    recogidas-y-entregas.md     Programar recogida, «Recibido», «Marcar enviado», «Entregas» del día
    cuentas-y-pagos.md          Saldo, «Por cobrar», «Registrar pago», «Aplicar saldo a favor»
    avisar-por-whatsapp.md
    imprimir.md                 Orden de trabajo y estado de cuenta
  mensajero/
    index.md                    Un día del mensajero
    entregas-del-dia.md         Lista, mapa y llamada, «Recogido»
    marcar-entregado.md         Con la foto de constancia
    no-se-pudo.md               Motivos y reprogramación
    sin-senal.md                Qué pasa sin conexión y qué se envía después
```

Cada página lleva `description` en el frontmatter (sale en el buscador y en las tarjetas) y un `sidebar_position`.

## 4. Datos de demostración: `seed:demo`

`apps/api/src/scripts/seed-demo.ts`, script `seed:demo` de `@dentalware/api`, con `isMainModule` como los demás.

- **Guardia**: solo corre con `NODE_ENV=test` (la BD `dentalware_test` de `.env.test`). En cualquier otro caso termina con un mensaje limpio y código 1, sin tocar nada. Así nunca pisa datos reales.
- **Idempotencia**: no la tiene ni la necesita. Se corre siempre después de `reset-test-db` y `seed` (catálogo de productos, fases y admin de prueba); si encuentra ya una clínica de demostración, termina con error para no duplicar.
- **Laboratorio ficticio**: sobrescribe `lab_settings` con «Laboratorio Demo», RUC vacío, dirección «Av. de los Ejemplos 123 y Calle Ficticia, Quito», teléfono «099 000 0000», prefijo de código vacío. El seed normal escribe los datos reales de Arte Dental y el manual es público: ninguna captura puede mostrarlos.
- **Usuarios**: uno por rol (`recepcion`, `tecnico`, `mensajero`; dos mensajeros para que el `Select` tenga de dónde elegir), con nombres ficticios («Carla Recepción», «Diego Técnico», «Marco Mensajero», «Lucía Mensajera»), correos `*@demo.local` y la contraseña de la variable `DEMO_PASSWORD`, obligatoria. Nunca se escribe en archivos, informes ni capturas; la genera la tubería de capturas en cada corrida.
- **Clínicas y doctores**: tres clínicas ficticias con dirección, ciudad, teléfono y WhatsApp inventados («Clínica Sonrisa Norte», «Centro Dental Los Álamos», «Consultorio Dra. Paredes»), uno o dos doctores cada una, precios por clínica en algunos productos.
- **Trabajos**: entre quince y veinte, con pacientes solo por iniciales o nombres inventados (`patientRef`), repartidos para que cada pantalla tenga qué mostrar: `por_recoger` con recogida programada hoy, `nuevo`, varios `en_proceso` en fases distintas (uno que vence hoy, uno atrasado, uno para mañana), `en_espera`, `en_prueba`, `terminado`, `enviado` con entrega de hoy asignada a cada mensajero, `entregado` con saldo pendiente, `cobrado`, una repetición al 50 % y uno `cancelado`. Una entrega fallida reprogramada. Una cuenta con pago parcial y saldo a favor; otra con saldo inicial. Fechas relativas al día en que se corre (`addBusinessDays` de shared), para que «Vencen hoy» y «Atrasados» tengan datos.
- **Cómo escribe**: a través de los servicios de cada feature (la misma composición que `app.ts`, con el reloj real), nunca con inserts directos, para que el historial, las entregas y la cuenta salgan como en el uso real. Las fotos de ejemplo son dos imágenes ficticias del repo (`apps/api/src/scripts/demo/*.jpg`, generadas con sharp: un degradado con texto), subidas por el `Storage`.
- **Prueba**: `seed-demo.test.ts` contra Postgres real: se niega fuera de `NODE_ENV=test`, exige `DEMO_PASSWORD`, deja un trabajo en cada estado, el laboratorio de demostración y ningún dato de Arte Dental (comprueba literalmente el nombre y el teléfono reales por ausencia).

## 5. Capturas: `pnpm capturas`

En `apps/docs/capturas/`, con su propio `playwright.config.ts` (el de `apps/web` no se toca).

- **Servidores** (`webServer`, `reuseExistingServer` fuera de CI): la API en modo test tras `reset-test-db`, `seed` y `seed:demo`, y la web de Vite. El script `capturas` genera `DEMO_PASSWORD` con `node -e "crypto.randomBytes(...)"` y la exporta a los dos procesos; no queda en ningún archivo.
- **Proyectos**: `escritorio` (1280×800, Chromium) y `telefono` (Pixel 7, 390 de ancho). Cada captura declara en qué proyectos existe; por omisión solo `escritorio`.
- **Helper** `captura(page, nombre, locator, opciones)`: espera a que el elemento esté visible y sin animaciones, `locator.screenshot()` del elemento (o de la página si `nombre` lo pide), y guarda en `apps/docs/static/img/capturas/<seccion>/<nombre>.<proyecto>.png` pasando por sharp (`png({ compressionLevel: 9, palette: true })`). Si el elemento no existe, el test falla: una guía nunca se queda con una captura vieja sin que lo note nadie.
- **Sesiones**: `storageState` por rol, creado una vez por corrida con el login de cada usuario de demostración; el admin es el de `.env.test`.
- **Specs** por sección (`primeros-pasos.spec.ts`, `recepcion.spec.ts`, `mensajero.spec.ts`), un test por guía, que recorre la pantalla como el usuario y toma sus capturas con el mismo nombre que referencia el MDX. Un test en Vitest (`capturas-referenciadas.test.ts`) cruza los nombres que declaran los specs con las imágenes que usan los MDX en las dos direcciones: ninguna imagen huérfana, ninguna referencia sin spec.
- **Regeneración**: `pnpm capturas` las reescribe todas; el `git diff` de las imágenes muestra qué cambió. Chrome DevTools se usa para diseñar cada captura (qué elemento, qué estado) y para revisar el sitio, no para producirlas. El procedimiento queda en `docs/conventions.md` §7 y, para Nelson, en `apps/docs/README.md`.
- **Lo que nunca sale en una captura**: datos reales, contraseñas, tokens, direcciones internas, URLs del VPS. La tubería corre contra `localhost` y los datos de demostración; el `alt` de cada imagen describe lo que se ve.

## 6. Enlace «Ayuda» en la app

- En el menú de usuario del `AppShell` (escritorio y móvil), un enlace «Ayuda» que abre en una pestaña nueva la guía del rol, con `aria-label` «Ayuda (abre el manual en otra pestaña)» e icono.
- `features/help/help-url.ts`: `helpUrl(role)` compone `DOCS_URL` + `HELP_PATH[role]`, con `HELP_PATH: Record<UserRole, string>` exhaustivo (`admin` → `/`, `recepcion` → `/recepcion/`, `tecnico` → `/`, `mensajero` → `/mensajero/`; MAN-2 cambia `tecnico` y `admin` a sus guías). `DOCS_URL` sale de `VITE_DOCS_URL` (argumento de build, como `VITE_PUBLIC_URL`) con `https://docs.dentalware.naphsoft.dev` por omisión, sin barra final.
- Tests: `help-url.test.ts` (cada rol con valores literales, sin barra doble) y el test del `AppShell` (el enlace existe para cada rol, con `target="_blank"` y `rel="noopener"`).

## 7. Despliegue

- **Imagen**: `infra/docs.Dockerfile`, dos etapas: `node:24-alpine` con pnpm construye `@dentalware/docs` (solo ese paquete y sus dependencias; sin `apps/web` ni `apps/api`), y `caddy:2-alpine` sirve `build/` con `infra/Caddyfile.docs`: `{$SITE_ADDRESS}`, `encode`, las mismas cabeceras de seguridad que el `Caddyfile` de la app, `file_server` con `try_files {path} {path}/index.html` y `Cache-Control` `immutable` solo en `/assets/*` (Docusaurus pone hash en sus assets) y `no-cache` en el resto.
- **Compose**: servicio `docs` en `infra/docker-compose.yml` (`restart: unless-stopped`, `SITE_ADDRESS: ${DOCS_SITE_ADDRESS}`, healthcheck como el de `caddy`, sin dependencias). `.env.example` añade `DOCS_SITE_ADDRESS` y `DOCS_PUBLIC_URL`. En el VPS, el `docker-compose.vps.yml` local (documentado, no versionado) lo deja en `127.0.0.1:8081:80`; sin nginx delante, `DOCS_SITE_ADDRESS` = dominio y Caddy saca el certificado.
- **nginx y DNS** (solo con Nelson, Tarea 9): registro A `docs.dentalware` en Porkbun, sitio nginx `docs.dentalware.naphsoft.dev` → `127.0.0.1:8081`, certificado con `certbot --nginx`. Pasos nuevos en `docs/operacion/despliegue.md` (paso 8 bis y «Actualizar a una versión nueva»: el mismo `dw up -d --build` reconstruye también el manual).
- **Pruebas de infra**: `infra/tests/docs-image.sh` (construye la imagen, la arranca en un puerto libre, pide `/` y `/recepcion/`, comprueba las cabeceras y el `Cache-Control` de un asset y del `index.html`, y la borra), con `shellcheck` limpio; corre en el job `infra`.

## 8. Pruebas (resumen por capa)

| Capa | Prueba |
|---|---|
| Sitio | `docusaurus build` en `quality` con enlaces, anclas e imágenes rotos en `throw`; `capturas-referenciadas.test.ts`; Lighthouse de accesibilidad ≥ 95 y revisión en los tres viewports antes de cerrar cada sección |
| Seed demo | `seed-demo.test.ts` contra Postgres (guardia, estados, laboratorio ficticio, ausencia de datos reales) |
| Capturas | cada test de captura falla si el elemento no existe; `pnpm capturas` corre entero antes de cerrar cada sección y en el cierre de la historia |
| Web | `help-url.test.ts` y el test del `AppShell` |
| Infra | `docs-image.sh` en el job `infra` |

## 9. Documentación que cambia

- `docs/conventions.md` §7: cómo se toman y regeneran las capturas, qué no puede salir en ellas, la regla de `DEMO_PASSWORD`; §5: el enlace «Ayuda» y `VITE_DOCS_URL`.
- `docs/architecture.md` §7: el servicio `docs` y su imagen; §3 Web: `features/help`.
- `docs/operacion/despliegue.md`: DNS, nginx y actualización del manual.
- `CLAUDE.md`: `apps/docs` en la descripción del monorepo y `pnpm capturas` en «Entorno».
- `docs/superpowers/specs/2026-09-12-historias-de-usuario-mvp.md`: MAN-1 con su recorte y MAN-2 nueva.

## 10. Orden de trabajo sugerido

1. Sitio vacío con tema, buscador, portada y CI (`quality` lo construye).
2. `seed:demo` con su test.
3. Tubería de capturas con el helper, las sesiones y el test de referencias cruzadas, probada con una captura.
4. «Primeros pasos» (texto y capturas).
5. «Recepción».
6. «Mensajero».
7. Enlace «Ayuda» en la app.
8. Imagen, compose, test de infra y documentación de despliegue.
9. Cierre: revisión UI/UX del sitio con `frontend-design` (issue de revisión de la iteración, regla 6), historia MAN-2 y actualización de docs.
