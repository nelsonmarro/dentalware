# Ola de fixes UI/UX de la Iteración 3 (#101)

Origen: `docs/superpowers/reviews/2026-10-03-revision-ui-ux-iteracion-3.md` (UX3-01..28: 1 Critical, 13 Important, 14 Minor). Rama `fix/revision-ui-ux-it3`. Ledger: `.superpowers/sdd/2026-10-03-revision-ui-ux-it3/progress.md`. Cierra #101 (regla 6 de `CLAUDE.md`: la ola va antes de construir la Iteración 4).

## Decisiones (no se re-litigan)

- **UX3-21** (Nelson): la pantalla de impresión ofrece **dos copias**: «Copia clínica» con precios (solo admin y recepción, que ya los reciben) y «Copia laboratorio» sin precios, la que va al banco. Técnico y mensajero solo ven la copia laboratorio.
- **UX3-09** (Nelson): mensajero en `/t/:code` e inicio → Iteración 4, issue #105. Fuera de esta ola.
- **UX3-06**: el porcentaje a cobrar se deriva de la responsabilidad mientras no se edite a mano (laboratorio → 0, clínica → 100, compartida → 50), con sufijo «%» y ayuda con el importe para admin/recepción.
- **UX3-15**: sin cambio de código; se documenta en `docs/conventions.md` §5 que el modo oscuro no está activo en el MVP (el bloque `.dark` queda como reserva y su contraste no se garantiza).
- **UX3-28**: el inicio del técnico abre con «Mis trabajos» antes que los contadores del laboratorio.

## Restricciones globales

Las de `CLAUDE.md`, `docs/conventions.md` y `docs/architecture.md`: TDD (RED → GREEN, mutación sobre código de producción), español en sentence case, 44 px, contraste AA (nunca solo color), `Record` exhaustivos, reglas en `shared`, mocks solo de `api.ts`, verificación completa antes de cada commit (`pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`), Chrome DevTools a 1280×800, 390×844 y 360×740 con consola limpia en toda tarea de UI, puertos 3000/5173 libres al terminar, commits pequeños con `Refs #101`. Un implementador a la vez.

## Tareas

| # | Tarea | Hallazgos | Tests |
|---|---|---|---|
| 1 | Iconos de vencimiento y urgencia legibles (≥ 3:1) y con texto en móvil | UX3-01 | `theme-tokens.test.ts` (tinta sobre blanco), tests de tabla/tarjeta |
| 2 | Errores de red distintos de «no existe»: `errorComponent` en español en el router, estados de error en ficha, `/t/:code`, «Mis trabajos», contadores del inicio y login sin red; login distingue credenciales de fallo de red y valida el vacío con «Escribe tu correo» | UX3-02, UX3-10 | tests por pantalla con mocks de `api.ts` (red frente a 404), test del `errorComponent` |
| 3 | Mensajes 409 legibles (rótulos de acción y estado desde `shared`), toasts con el nombre de la acción y diálogos que nombran la acción y su efecto | UX3-03, UX3-11, UX3-12 | `shared` (mensaje sin claves crudas), servicio con fakes, `use-cases`, diálogos |
| 4 | Panel «Producción» bajo la cabecera y antes de las pestañas (fase con «Avanzar»/«Retroceder», técnico, barra de estado), un solo primario por contexto («Finalizar» primario solo en la última fase), «Repetir» en la barra, sin técnico duplicado, sin huecos y con encabezados reales | UX3-04, UX3-05, UX3-18, UX3-25 | componente (un primario según fase), E2E avanzar fase con «Historial» activo |
| 5 | Ficha corta: entrega y urgencia (misma lógica que `dueBadge`), fase oculta fuera de producción (`isStageVisible`), confirmación de foto («Foto añadida» y «Fotos: N»), «No encontrado» con salida a la lista y «Avanzar a {fase siguiente}» | UX3-08, UX3-22, UX3-23, UX3-27 | `quick-case.test.tsx`, `use-photo-upload` |
| 6 | Orden impresa: marca «URGENTE» con texto, escala A4 propia, dos copias (clínica con precios / laboratorio sin precios) | UX3-07, UX3-20, UX3-21 | `print-order.test.tsx`, `print-case-page.test.tsx`, E2E A4/A5 una página |
| 7 | La repetición propone el cobro según la responsabilidad | UX3-06 | `remake-dialog.test.tsx` |
| 8 | Pulido: nombres de técnicos en el historial, filtro de clínica con `Combobox`, roles desde `CASE_WRITE_ROLES`, tarjeta «En curso» con «de ellos N en prueba», login del QR que dice qué trabajo se abrirá, técnicos ordenados por nombre, historial más reciente primero y comentario con etiqueta, inicio del técnico con «Mis trabajos» primero, nota del modo oscuro en convenciones | UX3-13, UX3-14, UX3-15, UX3-16, UX3-17, UX3-19, UX3-24, UX3-26, UX3-28 | test por punto |
| 9 | Cierre: sección «Resultado de la ola» en el informe (hallazgo → commit), barridos táctiles y E2E de lo nuevo, docs, verificación completa y E2E | — | E2E escritorio + android |

Después: revisión final de rama, ola de fixes, PR «Ola de fixes UI/UX de la Iteración 3» con `Closes #101`.
