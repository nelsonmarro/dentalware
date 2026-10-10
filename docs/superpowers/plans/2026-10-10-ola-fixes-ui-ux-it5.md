# Ola de fixes UI/UX de la Iteración 5 (#122)

- **Origen:** `docs/superpowers/reviews/2026-10-10-revision-ui-ux-iteracion-5.md`, con los hallazgos UX5-01 a UX5-20 (0 Critical, 6 Important, 14 Minor).
- **Rama:** `fix/revision-ui-ux-it5`.
- **Ledger:** `.superpowers/sdd/2026-10-10-ola-fixes-ui-ux-it5/progress.md`.
- Cierra #122. Por la regla 6 de `CLAUDE.md`, la ola va antes de construir la Iteración 7.

## Decisiones (no se re-litigan)

- **UX5-04** (Nelson, 2026-10-10): **la API dice qué trabajos cerró** el pago.
  - `POST /api/cuentas/pagos` y `POST /api/cuentas/pagos/:id/asignaciones` devuelven `settled: [{ id, code }]`: los trabajos que pasaron a `cobrado` en esa transacción, según lo que decidió `isSettled`.
  - El aviso los nombra: «Pago registrado: cobrados 26-00101 y 26-00102 · $ 69.50 a favor».
  - La web ya no calcula nada con el «Por cobrar» de cuando se abrió el diálogo, así que `settledCount` desaparece.
- **UX5-01** (Nelson, 2026-10-10): **«Aplicar saldo a favor» en la cabecera de la cuenta** cuando hay saldo a favor aplicable y algo por cobrar.
  - Abre el diálogo del pago vigente más antiguo con `remaining`.
  - Sigue siendo manual: el ADR 35 no cambia y nada se aplica solo al entregar.
- **UX5-02** (Nelson, 2026-10-10): **desglose al pie de «Por cobrar»**, con la misma información en el estado de cuenta impreso:
  - «Trabajos $ X»;
  - «Saldo inicial y ajustes sin trabajo $ Y (desde el dd/mm)», solo si es distinto de 0;
  - «Saldo a favor −$ Z», si hay;
  - «Saldo $ T».

  Los números vienen de la API (`breakdown`, con la regla en `shared`) y la vista no suma nada. Cuadra con el ADR 35: saldo = Σ pendientes + Σ ajustes sin trabajo − saldo a favor.
- **UX5-08** (ruling): bajo cada campo de fecha (pago, ajuste y periodo del estado de cuenta), la fecha escrita en español, del tipo «Lunes, 1 de junio de 2026». Se quita el `lang` que no hace nada. No se construye un selector propio.
- **UX5-10** (ruling): «Más de 90 días» se separa de 61–90 por luminosidad, no solo por tono (ΔE ≥ 20 entre cubos contiguos), y siempre con su rótulo.

## Restricciones globales

Las de `CLAUDE.md`, `docs/conventions.md` y `docs/architecture.md`:
- TDD (RED → GREEN, con mutación sobre código de producción);
- español en sentence case;
- 44 px, AA y nunca solo color;
- `Record` exhaustivos y reglas en `shared`;
- mocks solo de `api.ts`;
- `testPassword()`;
- verificación completa antes de cada commit;
- Chrome DevTools a 1280×800, 390×844 y 360×740 con la consola limpia;
- puertos libres al terminar;
- `Refs #122`;
- un implementador a la vez.

Los DTO nuevos se enmascaran igual que el resto de `accounts`: solo `ACCOUNTS_ROLES` llega a estas rutas.

## Tareas

| # | Tarea | Hallazgos | Tests |
|---|---|---|---|
| 1 | La respuesta de registrar un pago y de aplicar saldo a favor trae `settled` (los trabajos que cerró, en la misma transacción); el aviso los nombra y desaparece `settledCount` | UX5-04 | Servicio con fakes (cierra 2 de 3; pago concurrente que deja uno debiendo); ruta contra Postgres; `use-register-payment`/`use-apply-credit` con la respuesta de la API |
| 2 | El movimiento de pago trae sus asignaciones vigentes (`allocations: [{ caseId, code, amount }]`), y:<br>• la fila dice «Aplicado a 26-00101 ($ X), …» con enlaces;<br>• «Anular pago» nombra los trabajos que vuelven a «Entregado»;<br>• el ajuste que liberó algo lo dice en su movimiento | UX5-03 | Servicio (DTO y anulado sin asignaciones vigentes); `movements-table`; `void-payment-dialog` |
| 3 | Desglose del saldo (`breakdown { openCases, unlinkedAdjustments, unlinkedSince, credit, balance }`) en la cuenta y en el estado de cuenta, con la regla en `shared`; pie de «Por cobrar» y bloque en el impreso | UX5-02 | `shared` con literales (cuadre); servicio con fakes; `open-cases-table`; `account-statement` |
| 4 | Cabecera de la cuenta con una sola lectura del saldo (`accountHeadline` en `shared`): sin el chip duplicado, «Nada pendiente» solo sin trabajos por cobrar, «cubierto por el saldo a favor» y botón «Aplicar saldo a favor» (decisión UX5-01); en móvil, botones en orden de importancia con el foco en el mismo orden | UX5-01, UX5-17 | `shared` con literales (negativo, positivo con crédito, sin nada); `account-summary`; `clinic-account-content` (botón y orden) |
| 5 | Diálogos de reparto y ajuste:<br>• pie fijo en `FormDialog` y lista del reparto con su propio scroll, con «Asignado · Queda a favor» siempre a la vista;<br>• cada fila dice «Queda cobrado» o «Quedará debiendo $ X»;<br>• el descuento sobre un trabajo cobrado avisa antes de que el dinero vuelve al saldo a favor;<br>• un solo término, «Pagado» o «Asignado» | UX5-06, UX5-15 | E2E con 5 trabajos a 1280×800 y 390×844 (estado y botón en la ventana); `allocation-fields`; `adjustment-dialog`; `form-dialog` |
| 6 | Tablas y tarjetas de cuentas:<br>• nombre largo sin scroll horizontal;<br>• un solo «Ordenar» combinado en móvil (DataGrid, para todas las tablas);<br>• sin columna de acciones vacía;<br>• «Anular pago» aparte de «Aplicar saldo a favor» | UX5-05, UX5-09, UX5-12, UX5-18 | `accesibilidad.spec.ts` con clínica de nombre largo; `data-grid` (un control en móvil); `movements-table` |
| 7 | Estado de cuenta:<br>• papel: «Saldo al …» en una línea, títulos que no se quedan solos y código sin partir;<br>• móvil: «Detalle» ancho;<br>• fecha escrita bajo los campos de fecha, también los de pago y ajuste;<br>• `statementRangeFormSchema(today)` en `shared` | UX5-08, UX5-13, UX5-14, UX5-19 | `impresion.spec.ts` (`emulateMedia('print')`, A5); E2E a 360 («Detalle» ≥ 180 px); `shared` con literales (ayer, hoy, mañana); tests de los tres formularios |
| 8 | Pulido:<br>• destructivo sólido en el botón que confirma;<br>• tonos de antigüedad separados;<br>• buscador de trabajos con código en monoespaciada, paciente y estado bien escritos, y ayuda correcta;<br>• la ficha explica los ajustes;<br>• «Anular pago» manda al toast lo que no es «Motivo» | UX5-07, UX5-10, UX5-11, UX5-16, UX5-20 | `theme-tokens.test.ts` (contraste y ΔE); `button`; `combobox`; `adjustment-dialog`; `case-account-line`; `void-payment-dialog` |
| 9 | Cierre:<br>• sección «Resultado de la ola» en el informe (hallazgo → commit);<br>• barridos táctiles de lo nuevo;<br>• docs (`architecture.md` §3 «Cuentas»: `settled`, `allocations`, `breakdown`; `conventions.md` §5);<br>• verificación completa y E2E | — | E2E en escritorio y android |

Orden: 1 → 2 → 3 → 4, que tocan los DTO de `accounts` y la cabecera usa el desglose; después 5 → 6 → 7 → 8 → 9. Luego, revisión final de la rama, ronda de fixes y el PR «Ola de fixes UI/UX de la Iteración 5» con `Closes #122`.
