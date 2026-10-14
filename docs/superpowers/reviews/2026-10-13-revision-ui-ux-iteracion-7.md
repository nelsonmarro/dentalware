# Revisión UI/UX de la Iteración 7 (#129)

Revisor: Claude, con el criterio de `frontend-design`. Fecha: 2026-10-13. Rama `main` (0295532), web de desarrollo en `localhost:5173`, API en `:3000`.

## Resumen

Lo que trae la Iteración 7 funciona y respeta las reglas: «Avisar por WhatsApp» está bajo «clínica · doctor», mide 44 px, tiene foco visible (anillo y borde teal), se oye bien («Avisar por WhatsApp a {clínica} (se abre en otra pestaña)») y no compite con el primario del panel («Marcar entregado»). El `href` es `wa.me` con el número E.164 sin `+` y un texto sin precios, igual para admin y recepción. Técnico y mensajero no lo ven: `CASE_NOTIFY_ROLES` es admin y recepción, y `CaseWhatsapp` devuelve `null` para los demás roles. `?editar` abre el diálogo una vez, limpia la URL con `replace` (atrás vuelve a la ficha y no lo reabre) y, al cerrar, devuelve el foco al `h1`. El manifiesto de la build está bien (`id`, `scope` y `start_url` en `/`, `standalone`, iconos `any` y un `maskable` aparte con el logo en la zona segura). El `apple-touch-icon` mide 180×180 y el favicon es un ICO real de 16/32/48 con su SVG. La consola sale limpia y sin scroll horizontal en la ficha, en Clínicas y en Inicio a 1280, 390 y 360 px.

Lo que falla está en los flujos de alrededor más que en el botón. Arreglar un aviso sin número es un viaje de ida sin vuelta, y en un iPhone con la app instalada no hay botón atrás (UX7-01). El diálogo de la clínica abre con el nombre seleccionado y el campo que se vino a llenar queda fuera de vista (UX7-02). Además, `viewport-fit=cover` llegó sin los márgenes laterales de `safe-area` (UX7-03). Quedan 3 Important y 9 Minor; ningún Critical.

## Hallazgos

### Critical

Ninguno.

### Important

#### UX7-01 · «Añadirlo» lleva a Clínicas y no vuelve al trabajo
- **Pantalla**: ficha sin WhatsApp (admin) → Configuración › Clínicas. **Viewport**: todos; en la PWA de iPhone es peor.
- **Qué pasa**: «Añadirlo» abre el diálogo y, al guardar, el admin se queda en la lista de clínicas con el toast «Clínica actualizada» y el foco en «Clínicas». Para avisar, que era a lo que iba, tiene que volver a buscar el trabajo. En el navegador sirve «atrás», porque `replace` dejó limpio el historial. La app instalada en iPhone, en cambio, no tiene botón atrás: hay que pasar otra vez por Trabajos y buscar el código.
- **Por qué importa**: el criterio de la historia es «avisar a una clínica desde la ficha». Sin vuelta, la tarea se corta a la mitad justo cuando la persona ya tiene el número.
- **Propuesta**: que «Añadirlo» pase el origen: `/configuracion/clinicas?editar={id}&volver=/trabajos/{caseId}`. El `validateSearch` de la ruta lo acepta, siempre pasado por `safeRedirect`. Al guardar con `volver`, navegar a la ficha con el toast «WhatsApp de {clínica} guardado» y el foco en «Avisar por WhatsApp». Si el admin cancela, también se vuelve a la ficha. Sin `volver`, todo sigue como hoy. Un E2E `@clave`: ficha sin número → Añadirlo → guardar → la ficha muestra «Avisar por WhatsApp».
- **Archivos**: `apps/web/src/features/cases/case-whatsapp.tsx`, `apps/web/src/routes/_app/configuracion/clinicas.tsx`, `apps/web/src/features/clinics/clinics-page.tsx`, `apps/web/e2e/trabajos.spec.ts`.

#### UX7-02 · El diálogo abierto por `?editar` enfoca «Nombre» con todo el texto seleccionado
- **Pantalla**: Configuración › Clínicas › «Editar clínica» abierto desde «Añadirlo». **Viewport**: 1280 (captura 08), 390 (09) y 360.
- **Qué pasa**: Radix enfoca el primer campo y le selecciona el contenido (`selectionStart 0 – end 56/56`). En el móvil se abre el teclado sobre «Nombre» seleccionado, y «WhatsApp», el campo que se vino a llenar, queda en la mitad de abajo (a 574 px de 844) o tapado por el teclado. Basta una tecla para borrar el nombre de la clínica sin querer.
- **Por qué importa**: el error es fácil de cometer y difícil de notar, porque el diálogo se guarda con el nombre roto. Además, el admin tiene que buscar el campo por su cuenta.
- **Propuesta**: si se llega por `?editar` desde el aviso de WhatsApp (por ejemplo, `&campo=whatsapp`), `onOpenAutoFocus` hace `preventDefault`, enfoca `#clinic-whatsapp` y lo trae a la vista. En general, ningún diálogo de **edición** debería seleccionar todo el primer campo: que el foco caiga sin selección, con el cursor al final.
- **Archivos**: `apps/web/src/features/clinics/clinic-form.tsx`, `apps/web/src/components/form-dialog.tsx`.

#### UX7-03 · `viewport-fit=cover` sin `safe-area` a los lados ni arriba
- **Pantalla**: todo el layout autenticado. **Viewport**: teléfono con muesca o recorte en horizontal; con la app instalada, también arriba si cambia la barra de estado. **No verificable aquí** (DevTools no emula los recortes); se deduce del CSS.
- **Qué pasa**: con `cover`, el navegador ya no deja márgenes en las zonas inseguras, y eso le toca a la página. Solo la barra inferior usa `pb-[env(safe-area-inset-bottom)]`: en todo `apps/web/src`, `env(safe-area-inset` aparece una sola vez. En horizontal, la cabecera («Dentalware», «Cerrar sesión»), el `main` (`p-4`) y los extremos de la barra inferior (`inset-x-0`) quedan debajo de la muesca, de unos 47 px en iPhone. Hoy la barra de estado es `default`, así que arriba no pasa nada; con `black-translucent`, la cabecera quedaría debajo de la barra.
- **Por qué importa**: es una regresión que trajo esta iteración. Sin `cover`, el navegador hacía de colchón.
- **Propuesta**: márgenes con `max()` en la cabecera móvil, el `main` y la barra inferior: `pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]`, y `pt-[env(safe-area-inset-top)]` en la cabecera por si cambia el estilo de la barra de estado. Nelson debe probarlo en Android e iPhone en horizontal.
- **Archivos**: `apps/web/src/components/app-shell.tsx` (y `index.css` si se prefiere una utilidad).

### Minor

#### UX7-04 · El aviso sin WhatsApp repite el nombre de la clínica y se alarga (diferido de la iteración)
- **Pantalla**: ficha sin WhatsApp. **Viewport**: 360 (capturas 06 y 10) y 1280 (07).
- **Qué pasa**: confirmado. Con un nombre largo, el aviso del admin ocupa 4 líneas (84 px; la última mide 44 px por el `inline-flex min-h-11` de «Añadirlo» dentro del `<p>`) y el de recepción otras 4, debajo de las 2 de «clínica · doctor». Son 6 líneas grises seguidas en el bloque de identidad. El nombre ya está justo encima, el aviso tiene el mismo color y tamaño y no se distingue de esa línea. Y «Añadirlo», fuera de contexto (la lista de enlaces de un lector de pantalla), no dice qué añade.
- **Propuesta**: «Sin WhatsApp registrado.», sin repetir el nombre, con el `MessageCircle` en gris delante para que se lea como un estado y no como continuación de la línea de arriba. Para el admin, el enlace «Añadir WhatsApp» en su propia fila flex de 44 px, fuera del `<p>`; para recepción, «Pídele al administrador que lo registre.». A 360 quedan 1–2 líneas.
- **Archivos**: `apps/web/src/features/cases/case-whatsapp.tsx` y `case-whatsapp.test.tsx` (textos literales).

#### UX7-05 · `?editar` con una clínica inactiva o inexistente no hace nada ni avisa (diferido)
- **Pantalla**: Clínicas. **Viewport**: todos.
- **Qué pasa**: confirmado con «Clínica It7 inactiva» y con un UUID inexistente. La URL se limpia, no se abre nada y no sale ningún aviso. La ficha de un trabajo viejo de una clínica desactivada sí ofrece «Añadirlo», así que el admin llega a una lista que no le dice por qué no se abrió nada.
- **Por qué importa**: es poco frecuente (un trabajo de una clínica inactiva que aún hay que avisar), pero es un enlace que no responde. La convención pide decir qué pasa con lo inactivo.
- **Propuesta**: si el id no está en la lista, pedir `GET /api/config/clinicas/:id`, que también devuelve las inactivas. Si existe, abrir el diálogo con la nota «Clínica inactiva: actívala para que vuelva a salir en las listas». Si responde 404, el toast «Esa clínica ya no existe».
- **Archivos**: `apps/web/src/features/clinics/clinics-page.tsx`, `clinics-page.test.tsx`.

#### UX7-06 · El campo WhatsApp rechaza cómo se escribe un número en Ecuador
- **Pantalla**: «Editar clínica». **Viewport**: 360 (captura 18).
- **Qué pasa**: «099 000 0000» da «El WhatsApp debe ir en formato internacional, ej. +593991234567». La ayuda dice lo mismo justo encima, así que el formato se lee dos veces. El placeholder `+593991234567` tiene el mismo gris que la ayuda y parece un número ya guardado. Ni la ayuda ni el error están ligados al input por `aria-describedby`; el error sí sale anunciado.
- **Propuesta**: normalizar en `shared`, en el schema: quitar espacios, guiones y paréntesis, y convertir `0` + 9 dígitos en `+593…`. Así el admin puede escribir como habla. Quitar el placeholder y dejar la ayuda «Ej.: 099 123 4567 o +593 99 123 4567», ligada con `aria-describedby`, igual que el error. Esto vuelve innecesario el diferido «`whatsappUrl` limpia solo dígitos».
- **Archivos**: `packages/shared/src/schemas/config.ts` (`whatsappE164`) y su test, `apps/web/src/features/clinics/clinic-form.tsx`.

#### UX7-07 · En móvil, «Avisar por WhatsApp» e «Imprimir» quedan apilados con anchos distintos
- **Pantalla**: ficha con número. **Viewport**: 390 (04) y 360 (05).
- **Qué pasa**: dos botones outline uno debajo del otro, de 213 px y unos 110 px, alineados a la izquierda. El de WhatsApp está entre los datos de identidad y el de «Imprimir» en el grupo de acciones. En escritorio se ve bien (01, 03).
- **Propuesta**: en móvil, un solo grupo de acciones bajo la línea de clínica (`flex flex-wrap gap-2`), con WhatsApp primero. O los dos a ancho completo por debajo de `sm`, como la barra de acciones del panel. Es de prioridad baja.
- **Archivos**: `apps/web/src/features/cases/case-header.tsx`.

#### UX7-08 · «(se abre en otra pestaña)» no es cierto en el teléfono
- **Pantalla**: ficha. **Viewport**: móvil y PWA.
- **Qué pasa**: en Android, iPhone y la app instalada, `wa.me` abre la app de WhatsApp, no otra pestaña.
- **Propuesta**: que el `aria-label` diga «Avisar por WhatsApp a {clínica} (abre WhatsApp)».
- **Archivos**: `case-whatsapp.tsx` y su test.

#### UX7-09 · El texto del aviso mezcla «le» y «ustedes»
- **Pantalla**: el mensaje que se envía. **Viewport**: n/a.
- **Qué pasa**: «Hola, le escribimos de Arte Dental…» va en singular y `en_espera` dice «…necesitamos hablar con ustedes». Lo demás está bien: código, paciente y estado, sin precios, sin doctor y sin notas, verificado en el `href`.
- **Propuesta**: «Hola, les escribimos de {lab}.», que concuerda con «su clínica» y «ustedes». Cambiar el test de shared con el literal.
- **Archivos**: `packages/shared/src/case-notify.ts` y su test.

#### UX7-10 · `apple-touch-icon` con esquinas transparentes
- **Pantalla**: icono en iPhone. **No verificable aquí.**
- **Qué pasa**: el PNG de 180 px es el rectángulo redondeado del SVG (`rx=96`) sobre fondo transparente (píxel 0,0 = `0,0,0,0`). iOS rellena la transparencia de negro y aplica su propia máscara. Su radio es mayor, así que casi todo queda tapado, pero Apple pide un icono cuadrado y opaco y en algunos fondos puede asomar un filo negro (captura 13, a la derecha, sobre negro).
- **Propuesta**: generar el `apple-touch-icon` a sangre completa, cuadrado con fondo `#0f766e` y sin `rx`, como el maskable. Que el test compruebe que el píxel (0,0) es opaco.
- **Archivos**: `apps/web/scripts/gen-icons.mjs`, `apps/web/src/pwa-manifest.test.ts`.

#### UX7-11 · `theme_color` teal sobre una cabecera clara
- **Pantalla**: app instalada en Android. **No verificable aquí.**
- **Qué pasa**: con la app en `standalone`, la barra de estado sale teal (`#0f766e`) y justo debajo va la cabecera móvil gris clara (`bg-background`). Queda una franja de color que no pertenece a la interfaz.
- **Propuesta**: es una decisión de diseño. O `theme_color` y `<meta name="theme-color">` = `#F4F6F5`, el fondo, para que la app se sienta nativa y continua, o una cabecera de marca. Recomiendo lo primero: la marca ya está en el icono y en los primarios. Nelson debe mirarlo en el teléfono.
- **Archivos**: `apps/web/src/pwa-manifest.ts`, `apps/web/index.html`, `pwa-manifest.test.ts`.

#### UX7-12 · `useLabSettings` se pide también para técnico y mensajero (diferido)
- **Pantalla**: ficha. **Viewport**: n/a.
- **Qué pasa**: confirmado por código. `GET /api/config/laboratorio` solo exige sesión: responde 200, sin error en consola y sin datos sensibles. Es una petición que no se usa. Aparte, si alguien toca «Avisar» antes de que cargue, el texto dice «del laboratorio» en lugar del nombre.
- **Propuesta**: `useLabSettings({ enabled: hasRole(CASE_NOTIFY_ROLES, role) })`. Lo de la carrera es aceptable; no merece deshabilitar el botón.
- **Archivos**: `apps/web/src/routes/_app/trabajos/$caseId.tsx`, `apps/web/src/features/config/use-lab-settings.ts`.

### Diferidos del issue: veredicto

| Diferido | ¿Pasa? | Clasificación |
|---|---|---|
| `?editar` con clínica inactiva no abre ni avisa | Sí, también con un id inexistente | Minor → **UX7-05** |
| «Añadirlo» `min-h-11` en `<p>`; 4 líneas a 360 | Sí: 4 líneas (84 px) para el admin, 4 + 2 para recepción | Minor → **UX7-04** (texto más corto y enlace en su propia fila) |
| `useLabSettings` para técnico/mensajero | Sí, sin efecto visible | Minor trivial → **UX7-12** |
| `validateSearch` de clínicas sin test; reapertura con el mismo `editar` | En el navegador funciona: limpia la URL con `replace`, «atrás» vuelve a la ficha sin reabrir y guardar no reabre | Minor, deuda de test: un test de ruta para `editar` válido/ausente/basura y otro de «no se reabre» al volver a renderizar con el mismo `editId` |
| `whatsappUrl` sin limpieza de dígitos | No pasa: la única entrada es `clinicSchema` (E.164 estricto) y la importación CSV no crea clínicas | Descartar; queda resuelto con la normalización de **UX7-06** |
| Tests de iconos débiles | Los archivos reales están bien: firma PNG válida en los 4, `apple-touch-icon` de 180×180 y `maskable` distinto del `any`, con el logo dentro del círculo del 80 % (captura 13) | Minor, deuda de test: comprobar firma, 180×180, que el maskable sea opaco en las esquinas y el `any` no, y (con **UX7-10**) el apple opaco |
| `gen-icons.mjs` sin `density` | Sin efecto: el SVG tiene `viewBox` 512, se rasteriza a 512 y solo se reduce | Descartar (o Minor cosmético si algún día se pide un tamaño > 512) |

## Checklist de #129

- ✅ Ficha: «Avisar por WhatsApp» bajo «clínica · doctor», con número y sin número («{Clínica} no tiene WhatsApp registrado.», el enlace «Añadirlo» del admin y el aviso a recepción). Admin y recepción probados en los tres viewports; el `href` es correcto y no lleva precios. Técnico y mensajero, comprobado por código. Mejoras en UX7-04, 07, 08 y 09.
- ✅ Configuración › Clínicas con `?editar={id}`: abre el diálogo una vez, limpia la URL y devuelve el foco al `h1` al cerrar. Con hallazgos UX7-01, 02 y 05.
- ⏭ App instalada (PWA) en Android e iPhone: pantalla completa, icono y nombre, splash y vuelta a la app tras abrir WhatsApp quedan **no verificables aquí**. Para Nelson en teléfonos reales: probar el ida y vuelta (UX7-01) y la orientación horizontal (UX7-03). Sí verificado aquí: manifiesto de la build (`id`/`scope`/`start_url` = `/`, `display: standalone`, `background_color`, `theme_color`, `lang: es`), `viewport-fit=cover` y `apple-mobile-web-app-*` en `index.html`. `safe-area` solo cubre la parte inferior (UX7-03).
- ✅ Iconos: `maskable` aparte con el logo en la zona segura y `apple-touch-icon` de 180×180 (UX7-10 por la transparencia). El favicon ICO 16/32/48 + SVG se sirve con su `content-type`. Verlos en el lanzador real, ⏭.
- ✅ Consola limpia (solo mensajes `debug` de Vite y el `info` de React DevTools) y sin scroll horizontal en la ficha (con y sin número), Clínicas e Inicio a 1280×800, 390×844 y 360×740. La tira de pestañas de Configuración se desplaza dentro de su contenedor, no la página.

## Datos creados durante la revisión

- Usuario `Recepción It7 revisión` (rol `recepcion`, correo `recepcion.it7rev1791949740516@t.local`). La contraseña se generó en tiempo de ejecución y no está escrita en ningún sitio. Su sesión quedó en un contexto aislado ya cerrado.
- Clínica «Clínica It7 inactiva» (inactiva, sin WhatsApp) para probar `?editar` con una inactiva.
- Clínica «Clínica It7 con WhatsApp» (`+593990000000`, activa) para probar guardar desde `?editar`.
- No se tocaron las clínicas UX It5. «Clínica UX It5 Sur» ya tenía `+593990000000` y «Centro Odontológico Integral UX It5 Valle de los Chillos» sigue sin WhatsApp.
- La sesión de admin del Chrome del MCP sigue abierta.

## Capturas

Las 18 capturas de la revisión (ficha con y sin número a 1280/390/360 para admin y recepción, el diálogo abierto desde «Añadirlo» a 1280 y 390, los iconos `any` · `maskable` · `apple-touch-icon`, Inicio y Clínicas a 1280/390/360 y el campo WhatsApp rechazando «099 000 0000») se guardaron en el directorio temporal de la sesión y se perdieron al reiniciar el equipo antes de copiarlas al repo. Lo que mostraban está descrito en cada hallazgo. Las capturas «después» de la ola van en `capturas/it7/` (sección «Resultado de la ola»).

## Resultado de la ola

Ola de fixes de #129 en la rama `fix/revision-ui-ux-it7`. Todos los hallazgos se corrigieron salvo los descartados y los Minor diferidos de abajo.

| Hallazgo | Commit | Qué se hizo |
|---|---|---|
| UX7-06, UX7-09 | 878dc36 | `normalizeWhatsapp` en shared, dentro de `clinicSchema`: «099 123 4567» pasa a E.164; el aviso va en plural, «les escribimos». |
| UX7-01 (ida), 04, 07, 08, 12 | b387315 | Ficha: «Sin WhatsApp registrado.» sin repetir el nombre; «Añadir WhatsApp» con `volver` y `campo`; `aria-label` «(abre WhatsApp)»; ancho completo bajo `sm`; `?foco=whatsapp`; `useLabSettings` solo para `CASE_NOTIFY_ROLES`. |
| UX7-02, UX7-06 (campo) | 6392cca | `FormDialog` enfoca sin seleccionar el texto y acepta `initialFocusId`; la ayuda del campo WhatsApp va con `aria-describedby` y sin placeholder. |
| UX7-01 (vuelta), UX7-05, deuda de `validateSearch` | 634ed72 | `parseClinicsSearch` con `safeRedirect`; al guardar o cancelar vuelve a la ficha; clínica inactiva (nota) o inexistente (toast); E2E `@clave` del viaje; test de «no se reabre». |
| Ronda de fixes de la Tarea 3 | 9424532 | La búsqueda de clínica fallida no deja petición viva; `invalidateQueries(['trabajos'])` y la ficha limpia `foco` con `!q.isFetching`; `volver` sin `?` ni `#`; el selector de foco excluye ocultos. |
| UX7-03, 10, 11 y deuda de iconos | 86594d2 | `safe-area` en cabecera, `main` y barra inferior; `apple-touch-icon` opaco; `theme_color` `#F4F6F5`; tests de firma, medidas y esquinas. |
| I-1, M-1, M-2, M-5 y deuda de la Tarea 1 | (SHA al commit) | Ronda de fixes de la revisión final: `normalizeWhatsapp` quita el 0 tras +593 («+593 099 123 4567»); el foco de `CaseWhatsapp` lleva su dependencia comentada y probada; el diálogo de edición de clínica nombra la clínica (`context`); la API prueba la normalización y el 422 del WhatsApp. |

### Deuda de tests cerrada

- `parseClinicsSearch`: `editar` válido, ausente y basura, y `volver` por `safeRedirect`.
- «No se reabre»: volver a renderizar Clínicas con el mismo `editar` no reabre el diálogo.
- Iconos: firma PNG, 180×180 del `apple-touch-icon`, `maskable` opaco en las esquinas y `any` no, y el apple opaco.
- `clinicSchema`: `whatsapp` `''`, `'  '`, `null` y `undefined` dan `null`, y `'---'` se rechaza con el mensaje del campo.
- `clinic-form`: ayuda ligada con `aria-describedby`, sin placeholder y número en formato local aceptado.

### Descartados

- Limpieza de dígitos en `whatsappUrl`: la única entrada es `clinicSchema`, que ahora normaliza.
- `density` en `gen-icons.mjs`: sin efecto con el SVG de `viewBox` 512.

### Fuera de la ola

Minor diferidos, anotados en el ledger de la ola; ninguno bloquea:

- Tarea 2: `case-header.test` no prueba que `CaseHeader` pase `focusWhatsapp`.
- Tarea 2: el efecto que limpia `foco` en `$caseId.tsx` no tiene test de ruta (lo cubre en parte el E2E del viaje).
- Tarea 3: carrera entre la búsqueda de la clínica y «Nueva clínica» (comprobar `editing === null` antes de abrir).
- Tarea 3: el test «sin campos no falla» no protege nada y falta el caso de `initialFocusId` inexistente.
- Tarea 3: `navigate({ href })` hace push; valorar `replace: true` más adelante.
- El efecto que consume `foco` vive en `routes/_app/trabajos/$caseId.tsx` sin test de ruta; podría pasar a un hook `features/cases/use-consume-focus-search.ts` con test (M-4).
- «Cancelar» en el diálogo abierto desde la ficha vuelve a la ficha con el foco en `body`; valorar un `foco` que enfoque el `h1` o «Añadir WhatsApp» (M-6).
- Tarea 4: el test de la meta `theme-color` está en el `describe` de Apple y no en el del manifiesto; su regex depende del orden de atributos; los tests de `safe-area` miran subcadenas de `className`.

### Pendiente para Nelson en teléfonos reales (Tarea 9)

- Ida y vuelta en la PWA de iPhone (UX7-01).
- Orientación horizontal con muesca (UX7-03).
- Icono en iPhone (UX7-10).
- `FormDialog` hace `scrollIntoView` al enfocar un campo: comprobar en Safari de iOS, abriendo un diálogo desde una lista desplazada, que no mueve la página de fondo (M-3 de la revisión final).
- Barra de estado en Android (UX7-11).

### Capturas «después»

Con datos ficticios («Clínica Demo It7 con WhatsApp» y «sin WhatsApp», «Paciente demo A/B»), en `capturas/it7/`:

- `ficha-con-whatsapp-admin-1280.png`: «Avisar por WhatsApp» bajo «clínica · doctor».
- `ficha-con-whatsapp-admin-360.png`: el botón a ancho completo.
- `ficha-sin-whatsapp-admin-360.png`: «Sin WhatsApp registrado.» y el enlace «Añadir WhatsApp» en su propia fila.
- `ficha-sin-whatsapp-recepcion-360.png`: el mismo aviso para recepción, que le pide al administrador registrarlo, sin enlace.
- `clinicas-editar-desde-ficha-390.png`: el diálogo abierto desde «Añadir WhatsApp», con el campo WhatsApp enfocado y vacío, y su ayuda.
- `clinica-whatsapp-formato-local-360.png`: «099 123 4567» escrito en el campo, sin error.
- `iconos-any-maskable-apple.png`: `any`, `maskable` y `apple-touch-icon` sobre negro; los dos últimos opacos hasta las esquinas.

Consola sin errores ni avisos en la ficha de recepción a 360 px.
