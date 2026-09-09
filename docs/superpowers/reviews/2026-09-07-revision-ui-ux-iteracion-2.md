# Revisión UI/UX — Iteración 2 (Trabajos I)

Fecha: 2026-09-07 · Revisor: Claude (frontend-design + chrome-devtools-mcp) · Issue: #50 · Rama: `fix/revision-ui-ux-it1-it2`

## Resumen ejecutivo

Trabajos I implementa bien la identidad visual de la dirección de diseño (pestaña de color del ticket, chips con texto, tipografía monoespaciada, conversión tabla→tarjeta en móvil sin scroll horizontal de página) y varios flujos completos funcionan de punta a punta sin errores de consola: crear una orden con dos líneas y odontograma, subir y ver fotos, comentar en el historial, importar por CSV, y las restricciones por rol (técnico sin precios, sin notas internas, sin eliminar fotos, barra inferior reducida) están bien aplicadas. Dicho esto, esta iteración tiene dos hallazgos de causa raíz que explican por qué el "piso de calidad" de 44 px falla de forma sistemática: `SelectTrigger` (`select.tsx`) fija `data-[size=default]:h-8` con más especificidad CSS que el `h-11` que cada pantalla intenta pasarle, así que **todos** los `<Select>` de la app miden 32 px pese al código; `TabsList` (`tabs.tsx`) fija `h-8` sin variante táctil, así que **todas** las pestañas (lista y ficha) miden 25 px. Un tercer hallazgo crítico es funcional, no solo visual: al elegir piezas en el odontograma para un producto "por pieza" (ej. Zirconio), el conteo de piezas marcadas no se sincroniza con "Cantidad", que sigue en 1 salvo que alguien la edite a mano — confirmado de punta a punta (formulario → ficha), con el trabajo creado facturando 1 unidad pese a 2 piezas marcadas. Ningún hallazgo exige rediseño: los dos de causa raíz se resuelven con un cambio de una línea cada uno en el componente compartido, y el resto son ajustes acotados sobre componentes existentes.

## Pantallas × viewport

| Pantalla | 1280×800 | 390×844 | 360×740 |
|---|---|---|---|
| Trabajos → lista (pestañas, filtros, tabla/tarjetas, badges, paginación) | UX2-01, UX2-02, UX2-05 | UX2-01, UX2-02 | OK (sin scroll horizontal) |
| Nuevo trabajo (clínica→doctor, paciente, líneas, odontograma, checklist, notas) | UX2-01, UX2-03, UX2-04 | UX2-01, UX2-07, UX2-08 | UX2-07 |
| Ficha (Detalle con odontograma de solo lectura, Fotos, Historial) | UX2-02, UX2-09, UX2-10 | UX2-02 | — |
| Importar (plantilla, CSV con errores, CSV válido) | UX2-06, UX2-11 | — | — |
| Como técnico (lista sin precios, ficha sin precios, comentar, subir foto) | OK (permisos correctos) | OK (permisos correctos) | — |

`—` = no recorrida a este ancho por repetir un patrón ya verificado sin diferencias nuevas.

## Hallazgos

### Critical

**UX2-01 — El trigger de `<Select>` mide 32 px en toda la aplicación pese a que el código pide 44 px**
Pantallas: Lista (filtros Clínica/Doctor/Estado/Técnico), Nuevo trabajo/Editar (Clínica, Doctor, Sexo, Prioridad, Sistema, Producto) · Viewports: 1280, 390 (aplica a todos; es una regla CSS, no de layout)
Evidencia (`getComputedStyle`/`getBoundingClientRect`): los triggers de Clínica, Doctor, Sexo, Prioridad y Sistema en el formulario de trabajo, y de Clínica/Doctor/Estado/Técnico en los filtros de la lista, miden **31.99 px de alto**, aunque su `className` incluye literalmente `h-11` (44 px) pasado desde cada pantalla — por ejemplo `apps/web/src/features/cases/clinic-patient-fields.tsx:62` (`<SelectTrigger className="h-11 w-full">`).
Causa: `apps/web/src/components/ui/select.tsx:39` — la clase base de `SelectTrigger` incluye `data-[size=default]:h-8`, y `data-size={size}` (línea 37) vale `'default'` salvo que el caller pase `size="sm"`. Un selector de atributo (`[data-size=default]`) tiene más especificidad CSS que una clase simple (`h-11`), así que `h-8` (32 px) gana siempre sobre el `h-11` que cualquier pantalla intente pasar por `className`, sin importar el orden en el código. Esto explica también el hallazgo ya anotado "Trigger del Select de producto de 32 px".
Fix propuesto: cambiar la variante por defecto de `SelectTrigger` en `select.tsx:39` de `data-[size=default]:h-8` a `data-[size=default]:h-11` (o eliminar la variante `default` y dejar `h-11` como alto base, conservando `data-[size=sm]:h-7` solo para el caso explícito `size="sm"` si algún caller lo necesita). Es un cambio de una línea que corrige todos los `<Select>` de la app a la vez, sin tocar cada pantalla.

**UX2-02 — Las pestañas (Tabs) de la lista y de la ficha miden 25 px de alto**
Pantallas: Trabajos → lista (Nuevos/En curso/.../Todos), Ficha (Detalle/Fotos/Historial) · Viewports: 1280, 390
Evidencia: `getBoundingClientRect` sobre cada `[role=tab]` da **24.99 px** de alto en las 6 pestañas de la lista y en las 3 de la ficha, en ambos viewports probados. Coincide exactamente con el hallazgo ya anotado "Pestañas de la lista y la ficha de 25 px de alto".
Causa: `apps/web/src/components/ui/tabs.tsx:24` — `TabsList` fija `group-data-horizontal/tabs:h-8` (32 px) sin variante táctil, y `TabsTrigger` (línea 58) usa `h-[calc(100%-1px)]` heredando esa altura; con el `p-[3px]` de `TabsList` el alto útil del trigger queda en ~25 px. No existe ninguna prop de tamaño para pedir 44 px.
Fix propuesto: subir `group-data-horizontal/tabs:h-8` a `group-data-horizontal/tabs:h-11` en `tabs.tsx:24` (ajustando el `calc()` de `TabsTrigger` si hiciera falta). Un cambio de una línea corrige la lista y la ficha de esta iteración y, previsiblemente, las pestañas de Productos/Categorías de Configuración (Iteración 1) que usan el mismo componente.

**UX2-03 — «Cantidad» no se sincroniza con las piezas marcadas en el odontograma para productos por pieza**
Pantallas: Nuevo trabajo, Ficha (confirmado de punta a punta) · Viewport: 1280 (aplica a todos)
Evidencia: se creó un trabajo con una línea de Zirconio (producto `pricingUnit: 'por_pieza'`), se marcaron las piezas 16 y 26 en el diálogo "Piezas — línea 1" ("2 piezas" en el contador del diálogo), pero el campo "Cantidad" de la línea quedó en 1 sin que nada lo actualizara. Precio unitario $45, descuento 10 % → Total de la línea `$ 40.50` (= 1 × 45 × 0.90), no `$ 81.00` (2 × 45 × 0.90). Al guardar el trabajo y abrir la ficha (`docs/superpowers/reviews/capturas/it2/ficha-1280.png`), se ve el odontograma de solo lectura con las piezas 16 y 26 en teal junto a "Cantidad: 1" — la persona que lee la ficha (recepción para cobrar, técnico para saber cuántas piezas fabricar) ve una contradicción directa entre lo marcado y lo cobrado/producido.
Causa: `apps/web/src/features/cases/case-items-editor.tsx` — "Cantidad" (línea 196-216, campo de formulario libre) y "Piezas" (línea 217-248, abre `TeethDialog`) son dos campos completamente independientes; `TeethDialog.onSave` (línea 237, `onSave={field.onChange}`) solo escribe el arreglo `teeth`, nunca toca `quantity`. `apps/web/src/features/cases/case-totals.ts:8-15` calcula el total con `quantity`, ignorando `teeth.length` por completo.
Fix propuesto: cuando `product.pricingUnit === 'por_pieza'`, derivar "Cantidad" de `teeth.length` en vez de dejarlo como campo libre — la opción más simple y seguras es, en el `onSave` del `TeethDialog` (`case-items-editor.tsx` alrededor de la línea 236), además de `field.onChange(teeth)` hacer `setValue(`items.${index}.quantity`, teeth.length || 1)`; y ocultar/deshabilitar el input de "Cantidad" para estos productos (mostrando el número de piezas como cantidad de solo lectura), igual que ya se hace con "Piezas: Arcada" para `por_arcada`.

### Important

**UX2-04 — En escritorio, la fila de línea de trabajo no muestra ninguna etiqueta visible ni encabezado de columna**
Pantalla: Nuevo trabajo / Editar (sección "Trabajo") · Viewport: 1280
Evidencia: capturas `docs/superpowers/reviews/capturas/it2/nuevo-1280-b.png` (desktop, sin etiquetas) vs. `docs/superpowers/reviews/capturas/it2/nuevo-390-linea-item.png` (móvil, con etiquetas "Producto", "Cantidad", "Piezas", "Precio unitario", "Descuento %", "Material", "Nota" perfectamente visibles). En escritorio la fila muestra 5-6 cajas vacías sin ningún texto que las identifique — "Material" y "Nota" en particular no tienen `placeholder`, solo `aria-label`, así que quien mira la pantalla no puede distinguir cuál caja es cuál sin pasar el cursor o adivinar por la posición. Esto contradice el piso de calidad no negociable de la dirección de diseño: "Etiquetas visibles en todos los campos".
Causa: `apps/web/src/features/cases/case-items-editor.tsx` — cada `FieldLabel` de la fila (líneas 201, 218, 255, 280, 301, 320) usa la clase `text-xs lg:sr-only`, ocultando la etiqueta exactamente en el breakpoint de escritorio (`lg`, ≥1024 px) donde además no existe ninguna fila de encabezados de columna que la reemplace.
Fix propuesto: agregar una fila de encabezados de columna (Producto / Cantidad / Piezas / Precio / Descuento / Material / Nota) visible solo en `lg:` justo encima de la primera línea, replicando el grid de 7 columnas de `CaseItemRow`; o, más simple, quitar `lg:sr-only` de los `FieldLabel` que hoy quedan vacíos de contexto (Material, Nota) y dejarlos como etiqueta compacta sobre el campo también en escritorio.

**UX2-05 — La tabla de Trabajos exige 260 px de scroll horizontal interno a 1280 px, ocultando "Estado" y "Total"**
Pantalla: Trabajos → lista · Viewport: 1280
Evidencia: el contenedor `overflow-x-auto` de la tabla mide `scrollWidth: 1220px` vs `clientWidth: 960px` (260 px de diferencia). Las columnas "Estado" y "Total" — las dos que más importan para escanear la lista de un vistazo — quedan fuera del viewport visible por defecto (`docs/superpowers/reviews/capturas/it2/lista-1280-scroll-derecha.png` muestra el resultado tras desplazar manualmente).
Causa: `apps/web/src/features/cases/cases-table.tsx` define 7 columnas (Código, Clínica/Doctor, Paciente, Trabajo, Entrega, Estado, Total) más badges de urgencia/atraso dentro de la celda de Entrega, sumando más ancho del que caben en los 1200 px máximos de contenido.
Fix propuesto: combinar "Clínica" y "Doctor" en una sola línea más compacta (ya se muestran apiladas, se puede angostar la columna), o mover el badge "Urgente"/"Atrasado" a un icono con `title`/tooltip junto al código en vez de un chip de texto completo dentro de la celda, liberando ancho suficiente para que "Estado" y "Total" queden visibles sin desplazar a 1280 px.

**UX2-06 — En la importación, los errores de resolución (clínica inexistente) no aparecen mientras exista un error de formato en cualquier fila del archivo**
Pantalla: Trabajos → Importar · Viewport: 1280
Evidencia: se subió un CSV con la fila 2 conteniendo solo un error de resolución (clínica `"Clínica Fantasma Que No Existe"`, formato válido) y la fila 3 con el mismo error de resolución más un error de formato (`fecha_deseada` inválida). El resultado de "Validar" mostró **únicamente** el error de formato de la fila 3 (`fecha_deseada: Fecha inválida`) — la fila 2, que no tenía ningún problema de formato, no mostró ningún error pese a referenciar una clínica inexistente. Al corregir el formato de la fila 3 (dejando la clínica inexistente en ambas filas) y volver a validar, **entonces sí** aparecieron los dos errores de resolución (`clinica: La clínica "..." no existe`) para las filas 2 y 3. Esto confirma que el hallazgo ya anotado es real y, además, que el alcance no es por fila sino por **archivo completo**: basta con que una sola fila tenga un error de formato para que ninguna fila del archivo muestre sus errores de resolución, aunque esas otras filas ya tengan el formato correcto.
Causa: `apps/api/src/features/cases/import.ts` valida el esquema de todas las filas primero y solo llega a resolver clínica/doctor/producto (consultas a la base de datos) cuando el archivo completo pasa la validación de formato — un gate de dos fases a nivel de archivo, no de fila.
Fix propuesto: ejecutar la resolución de clínica/doctor/producto para todas las filas independientemente de si otras filas tienen errores de formato, y devolver ambos tipos de error juntos (por fila) en la misma respuesta de "Validar" — así una persona corrige todo en una sola pasada en vez de en varias.

**UX2-07 — Las celdas del odontograma miden menos de 44 px desde 390 px hacia abajo**
Pantallas: Nuevo trabajo/Editar → diálogo "Piezas", Ficha (de solo lectura, no aplica por estar deshabilitadas) · Viewports: 390, 360
Evidencia: `getBoundingClientRect` sobre el botón de la pieza "18" da **41.01 × 41.01 px a 390 px** y **37.26 × 37.26 px a 360 px** — coincide exactamente con el hallazgo ya anotado "Celdas del odontograma de 37 px en 360 px", y añade que el problema ya empieza a 390 px (no solo a 360 px). A 1280 px las celdas miden 44 × 44 px, cumpliendo.
Causa: `apps/web/src/features/cases/teeth-dialog.tsx` fija el tamaño del botón de cada pieza con clases responsivas que no llegan a 44 px por debajo de `sm`/`md`.
Fix propuesto: ajustar el grid de 8 columnas por arcada para que el tamaño mínimo de celda sea 44 px incluso a 360 px (por ejemplo reduciendo el gap entre celdas o el padding del diálogo en vez de las propias celdas), o pasar a 7 columnas visibles con scroll horizontal interno solo dentro del odontograma por debajo de cierto ancho.

**UX2-08 — El pie del diálogo "Piezas" en móvil: Guardar/Cancelar de 32 px y Arcada superior/inferior/Limpiar de 28 px**
Pantalla: Nuevo trabajo/Editar → diálogo "Piezas" · Viewport: 390
Evidencia: con el diálogo abierto, `getBoundingClientRect` sobre los botones del pie da "Guardar" y "Cancelar" apilados a **342 × 32 px** cada uno (el ancho es correcto — ancho completo — pero el alto no llega a 44 px), y los tres botones de selección rápida "Arcada superior" / "Arcada inferior" / "Limpiar" miden **28 px** de alto. Coincide con el hallazgo ya anotado sobre el pie del diálogo apilado en móvil.
Causa: `apps/web/src/features/cases/teeth-dialog.tsx` — el pie del diálogo reutiliza `Button` con `size="sm"` (o el tamaño por defecto `size-8`/`h-7` de `button.tsx`, ya documentado como problema transversal en UX1-01) en vez de `h-11`, y los botones de arcada/limpiar no tienen ninguna clase de alto explícita.
Fix propuesto: aplicar `h-11` (o `size="lg"`) a los botones "Guardar"/"Cancelar"/"Arcada superior"/"Arcada inferior"/"Limpiar" del pie de `teeth-dialog.tsx` — mismo patrón de fix que UX1-01 propuso para las acciones de fila, aplicado aquí a los controles del odontograma.

**UX2-09 — La ficha no tiene ningún elemento de encabezado (ni siquiera h1)**
Pantalla: Ficha · Viewport: 1280 (aplica a todos)
Evidencia: `document.querySelectorAll('h1,h2,h3,h4,h5,h6')` devuelve un arreglo **vacío** en la ficha — no solo falta el `h1`, no hay ningún nivel de encabezado en toda la página, a diferencia de "Nuevo trabajo" que sí expone `<h1>Nuevo trabajo</h1>`. Confirma y agrava el hallazgo ya anotado "La ficha no tiene h1": una persona que navega con lector de pantalla por encabezados no tiene ningún punto de entrada a la ficha.
Causa: `apps/web/src/features/cases/case-header.tsx:51` — el código del trabajo se renderiza como `<span className="font-mono text-2xl font-semibold">{c.code}</span>` en vez de un encabezado.
Fix propuesto: cambiar ese `<span>` por `<h1 className="font-mono text-2xl font-semibold">{c.code}</h1>` (o envolver el código en un `<h1>` que incluya visualmente el mismo contenido), manteniendo el estilo visual actual.

### Minor

**UX2-10 — El contador "Historial (N)" cuenta solo comentarios, no todos los eventos**
Pantalla: Ficha → pestaña Historial · Viewport: 1280
Evidencia: con 2 eventos automáticos ("Trabajo creado", "Adjunto agregado") y 0 comentarios, la pestaña mostraba "Historial (0)"; tras agregar un comentario pasó a "Historial (1)", sin contar los 2 eventos ya presentes. Coincide con el hallazgo ya anotado.
Causa: el contador de la pestaña "Historial" en `apps/web/src/features/cases/case-detail-tab.tsx` (o donde se arme el label de `TabsTrigger`) usa la longitud del arreglo de comentarios, no la del historial combinado (eventos + comentarios).
Fix propuesto: usar el total combinado de eventos y comentarios para el contador, o renombrar a "Historial" sin número si combinar ambos conteos no es trivial por venir de fuentes distintas.

**UX2-11 — El enlace "Descargar plantilla" mide 20 px de alto**
Pantalla: Trabajos → Importar · Viewport: 1280
Evidencia: `getBoundingClientRect` da **20 px** de alto para el enlace "Descargar plantilla" del diálogo de importación. Coincide con el hallazgo ya anotado.
Causa: `apps/web/src/features/cases/import-dialog.tsx` renderiza el enlace como texto simple subrayado (`<a>` sin padding ni altura mínima).
Fix propuesto: envolver el enlace en un botón `variant="link"` con `h-11` y suficiente `padding` vertical, o simplemente agregar `py-3` (o equivalente) para que el área clicable llegue a 44 px sin cambiar el estilo visual de enlace.

**UX2-12 — Los selects de Clínica y Producto en el formulario de trabajo no tienen buscador**
Pantalla: Nuevo trabajo/Editar · Viewport: 1280
Evidencia: el select de "Clínica" lista 48 opciones y el de "Producto" 54, ambos sin campo de filtro — solo el type-ahead nativo del navegador (saltar a la opción cuya primera letra coincide) ayuda parcialmente. Mismo patrón que UX1-04 (precios especiales sin buscador), ahora en el flujo de creación de un trabajo, donde una recepción con un catálogo real de más clínicas lo sentiría más.
Causa: `apps/web/src/features/cases/clinic-patient-fields.tsx` (Clínica) y `case-items-editor.tsx` (Producto) usan `Select`/`SelectItem` planos sin campo de búsqueda.
Fix propuesto: fuera de esta ola por alcance (mismo criterio que UX1-04) — evaluar un combobox con filtro de texto para Clínica y Producto en una iteración posterior, reutilizando el mismo componente si se construye para UX1-04.

## Verificación de "hallazgos ya anotados" (issue #50)

| # | Hallazgo anotado | Estado | Medida / evidencia |
|---|---|---|---|
| 1 | Pie del diálogo de piezas con botones apilados (~120 px) en móvil | **Confirmado** (UX2-08) | Guardar/Cancelar apilados, 342×32 px cada uno; el problema no es solo el alto total del pie sino que cada botón mide 32 px, no 44 |
| 2 | Trigger del Select de producto de 32 px | **Confirmado, y es sistémico** (UX2-01) | 31.99 px en Producto y en todos los demás `<Select>` probados (Clínica, Doctor, Sexo, Prioridad, Sistema, Estado, Técnico) — causa raíz en `select.tsx`, no solo en el select de producto |
| 3 | Celdas del odontograma de 37 px en 360 px | **Confirmado** (UX2-07) | 37.26 px exactos a 360 px; además 41.01 px a 390 px (no cumple tampoco) |
| 4 | Pestañas de la lista y la ficha de 25 px de alto | **Confirmado, y es sistémico** (UX2-02) | 24.99 px en las 6 pestañas de la lista y las 3 de la ficha, en 1280 y 390 — causa raíz en `tabs.tsx` |
| 5 | "Juan Pérez, 0 años" cuando la edad es 0 | **Descartado — ya corregido** | `packages/shared/src/schemas/cases.ts:104` usa `nullableNumber`, con test dedicado `cases.test.ts:84-88` ("patientAge vacío o solo espacios se normaliza a null en vez de a 0"), verificado con `pnpm --filter @dentalware/shared test` (86/86 tests OK); confirmado también en vivo: el trabajo 26-00052 importado sin edad no muestra "0 años" en la ficha |
| 6 | La ficha no tiene h1 | **Confirmado, y es peor** (UX2-09) | No hay ningún elemento de encabezado (h1–h6) en toda la ficha, no solo falta el h1 |
| 7 | El contador "Historial (N)" cuenta solo comentarios | **Confirmado** (UX2-10) | 2 eventos + 0 comentarios mostró "Historial (0)"; al comentar pasó a "(1)" sin sumar los 2 eventos |
| 8 | Enlace "Descargar plantilla" de 20 px | **Confirmado** (UX2-11) | 20 px exactos |
| 9 | En la importación, los errores de resolución no se muestran hasta corregir los errores de formato de la misma fila | **Confirmado, y el alcance es mayor** (UX2-06) | Una fila con error de resolución pero sin error de formato tampoco mostró su error mientras OTRA fila del mismo archivo tuviera un error de formato — el gate es de archivo completo, no de fila |

Todos los 9 hallazgos ya anotados se confirmaron con medición directa salvo el de la edad 0, que ya está corregido y probado en `packages/shared`.

## Aciertos (mantener)

- La pestaña de color del ticket (borde izquierdo 4 px del color de fase) está implementada de forma consistente: en la celda de código de la tabla (1280), en la tarjeta móvil (390/360) y en la cabecera de la ficha — el mismo lenguaje visual en las tres superficies, tal como pide la dirección de diseño.
- El odontograma FDI es el elemento de firma bien resuelto: nombres accesibles completos por pieza ("18 · Tercer molar superior derecho"), selección en `--teal-lab`, contador "N piezas" en vivo, y el mismo componente se reutiliza de solo lectura (deshabilitado) en la ficha para técnicos y admin.
- El panel "Para aceptar falta" en Nuevo trabajo/Editar es un acierto de comprensión: lista en vivo lo que falta para poder aceptar el trabajo y cambia a "Todo listo para aceptar." cuando se completa — reduce fricción sin necesitar enviar el formulario para descubrir errores.
- Los estados (Nuevo, Urgente, Atrasado) usan chip + texto, nunca solo color, en tabla, tarjetas y ficha.
- La conversión tabla→tarjeta en móvil funciona sin scroll horizontal de página en las 3 pantallas principales (lista, ficha, importar) a 390 y 360 px.
- El botón primario "Guardar" ocupa el ancho completo al pie en móvil, con "Cancelar"/"Guardar y nuevo" apilados debajo, cumpliendo la regla de la dirección de diseño; en el formulario de línea de trabajo, las etiquetas de campo sí son visibles en móvil (a diferencia de escritorio, ver UX2-04).
- El control de permisos por rol funciona de punta a punta: como técnico, la ficha oculta precios/total/descuento, oculta "Notas internas", no ofrece "Eliminar" en las fotos propias ni ajenas, y la barra inferior se reduce a Inicio/Trabajos/Entregas (sin Cuentas/Configuración) — verificado creando un usuario técnico real y navegando con él.
- La importación por CSV funciona de punta a punta: plantilla descargable con las columnas correctas, tabla de errores Fila/Columna/Mensaje clara, resumen "N filas → N trabajos" antes de confirmar, y toast "Se importaron N trabajos" al terminar.
- El historial combina eventos automáticos ("Trabajo creado", "Adjunto agregado") y comentarios en una sola línea de tiempo con fechas relativas correctas ("hace 1 minuto", "justo ahora") y atribución al usuario correcto (admin y técnico distinguibles).
- La lista de Trabajos ya tiene paginación con botones de 44 px (`h-11`), a diferencia del hallazgo UX1-07 (sin paginación) de la iteración anterior — mejora real entre iteraciones.
- Datos en JetBrains Mono (códigos de trabajo, montos, piezas) de forma consistente en tabla, tarjetas y ficha.
- Sin errores de consola en ninguna de las ~12 pantallas/rol/viewport recorridas (lista, nuevo trabajo, ficha, fotos, historial, importar, vista técnico) durante toda la sesión.
- El rojo destructivo de los chips "Urgente"/"Atrasado" reutiliza `Badge variant="destructive"` — mismo componente y mismo hallazgo de contraste ya registrado en **UX1-02**; no se duplica aquí.

## Propuesta de ola de fixes

| # | Commit | Hallazgos | Tamaño | Test que lo cubre |
|---|---|---|---|---|
| 1 | `fix(web): el trigger de Select respeta 44px en toda la aplicación` | UX2-01 | S | E2E Playwright: `boundingBox().height >= 44` sobre los triggers de Clínica/Doctor/Estado/Producto/Sistema en Trabajos y Configuración a 1280 y 390; test de componente (Vitest + Testing Library) verificando que `SelectTrigger` sin `size` no incluye `h-8` en sus clases resueltas |
| 2 | `fix(web): las pestañas de la lista y la ficha miden 44px` | UX2-02 | S | E2E Playwright: `boundingBox().height >= 44` sobre `[role=tab]` en Trabajos (lista) y en la Ficha a 1280/390/360 |
| 3 | `fix(web): sincronizar «Cantidad» con las piezas y mostrar etiquetas de la línea en escritorio` | UX2-03, UX2-04 | M | Vitest de `case-items-editor`: al guardar piezas en `TeethDialog` para un producto `por_pieza`, `quantity` pasa a `teeth.length`; test de `case-totals` verificando el total resultante; E2E Playwright a 1280 comprobando que "Cantidad"/"Piezas"/"Material"/"Nota" son visibles (`toBeVisible()`) en la fila de línea |
| 4 | `fix(web): la tabla de Trabajos no exige scroll horizontal a 1280px` | UX2-05 | S | E2E Playwright verificando `scrollWidth === clientWidth` en el contenedor de la tabla a 1280 px, con "Estado" y "Total" visibles sin desplazar |
| 5 | `fix(web): el odontograma y el pie del diálogo «Piezas» cumplen 44px en móvil` | UX2-07, UX2-08 | M | E2E Playwright a 390 y 360: `boundingBox()` de una celda de pieza y de los botones Guardar/Cancelar/Arcada superior/Arcada inferior/Limpiar ≥ 44×44 |
| 6 | `fix(api): reportar errores de resolución de importación por fila, sin bloqueo por archivo; fix(web): h1 en la ficha` | UX2-06, UX2-09 | M | Vitest/API de `import.ts`: CSV con una fila solo con error de resolución y otra fila con error de formato — ambas devuelven su propio error en la misma respuesta; test de componente de `CaseHeader` verificando `getByRole('heading', { level: 1 })` con el código del trabajo |

UX2-10, UX2-11 y UX2-12 quedan fuera de esta ola por alcance (impacto acotado a una pestaña/enlace/buscador puntual) — se registran como mejoras de backlog para cuando se revisite Importar o los selects largos del catálogo.

## Resultado de la ola de fixes (2026-09-07)

Rama `fix/revision-ui-ux-it1-it2`, ejecutada en `docs/superpowers/plans/2026-09-07-ola-fixes-ui-ux-it1-it2.md`. Ledger completo con los rulings: `.superpowers/sdd/2026-09-07-ola-fixes-ui-ux/progress.md`.

| Hallazgo | Estado | Commit / motivo |
|---|---|---|
| UX2-01 — `SelectTrigger` mide 32 px pese a que el código pide `h-11` | Corregido | `e22c3a6` — `data-[size=default]:h-8 → h-11` en `select.tsx` (causa raíz de un selector `data-[size=…]` con más especificidad que `className`) (Task 1) |
| UX2-02 — pestañas (`Tabs`) de la lista y la ficha miden 25 px | Corregido | `e22c3a6` — `TabsList` `h-fit p-1`, `TabsTrigger` `min-h-11` (Task 1) |
| UX2-03 — "Cantidad" no se sincroniza con las piezas marcadas para productos por pieza | Corregido | `09e11b5` — `TeethDialog.onSave` fija `quantity = teeth.length \|\| 1` para `pricingUnit: 'por_pieza'`, campo de solo lectura con ayuda; E2E ampliado en `bd61fb7`/Task 7 para asertar `Cantidad = 2` tras marcar 2 piezas (Task 3) |
| UX2-04 — sin etiqueta visible ni encabezado de columna en la fila de línea en escritorio | Corregido | `09e11b5` — `CaseItemsHeader` con el mismo grid que `CaseItemRow` (Task 3) |
| UX2-05 — tabla de Trabajos con 260 px de scroll horizontal interno a 1280 px | Corregido | `a69d945` — badges "Urgente"/"Atrasado"/"Hoy" como icono accesible con `title`; clínica·doctor/paciente/trabajo compactados a una línea truncada (Task 4) |
| UX2-06 — errores de resolución de importación ocultos por un error de formato en cualquier fila del archivo | Corregido | `70d19a1` — `importCases` resuelve clínica/doctor/producto por fila, agrupadas o no, y combina errores de formato + resolución en la misma pasada (Task 5) |
| UX2-07 — celdas del odontograma < 44 px desde 390 px hacia abajo | Aceptado (ruling del controlador) | A 360 px no caben 8 celdas de 44 px + separación en un diálogo de 344 px sin romper la disposición por cuadrante ni añadir scroll horizontal interno, que empeoraría la usabilidad. Las celdas (41 px a 390, 37 px a 360) superan con holgura el mínimo AA de 24 px (WCAG 2.5.8) y el gap evita toques accidentales. Documentado en el plan (`## Rulings del controlador`); se reevaluará si el laboratorio reporta errores de selección en teléfonos pequeños |
| UX2-08 — pie del diálogo "Piezas" en móvil por debajo de 44 px | Corregido | `e22c3a6` — Guardar/Cancelar/Arcada superior/Arcada inferior/Limpiar heredan la escala nueva de `Button` sin cambios propios en `teeth-dialog.tsx` (Task 1) |
| UX2-09 — la ficha no tiene ningún elemento de encabezado | Corregido | `09e11b5` — el código del trabajo pasa de `<span>` a `<h1>` en `case-header.tsx` (Task 3) |
| UX2-10 — el contador "Historial (N)" cuenta solo comentarios | Corregido | `09e11b5` — `historyTabLabel(total)` usa el total combinado de eventos y comentarios (Task 3) |
| UX2-11 — enlace "Descargar plantilla" de 20 px | Corregido | `e22c3a6` — `Button asChild variant="link"` con `h-11` en `import-dialog.tsx` (Task 1) |
| UX2-12 — selects de Clínica y Producto sin buscador | Backlog | Issue nuevo (Task 7, junto con UX1-07): «Paginación en Clínicas y Precios especiales; combobox con buscador para Clínica y Producto». El `DataGrid` estándar (#53) aporta paginación; el combobox con buscador para catálogos largos queda como mejora aparte |

### Extras de la ola (no listados como hallazgo, encontrados o pedidos durante la revisión de tareas)

| Extra | Commit / motivo |
|---|---|
| Grid de líneas por rol (`itemsGridTemplate`) en 8/7 columnas | `a69d945` — la revisión de la Task 3 encontró que "Nota" bajaba a una segunda fila a 1280 px para admin/recepción (8 columnas) porque cabecera y fila usaban un `grid-cols-7` fijo; `itemsGridTemplate(canEditPrice)` es ahora la única fuente de verdad compartida por `CaseItemsHeader` y `CaseItemRow` (Task 4, ruling de la revisión de Task 3) |
| Paleta `STATUS_COLOR` con contraste AA en todos los estados | `30b9825` — la revisión de la Task 2 encontró (Important, fuera del alcance original de UX1-02) que `en_espera` (2.25:1), `terminado` (1.76:1) y `entregado` (3.72:1) incumplían AA como texto sobre el chip; se oscureció cada color dentro de su propia familia y `cancelado` pasó al token `--destructive`, con `status-chip.test.tsx` recorriendo los `CASE_STATUSES` completos sobre el fondo real del chip (Task 2, ronda de fixes 1) |
