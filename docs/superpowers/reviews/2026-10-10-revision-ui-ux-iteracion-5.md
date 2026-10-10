# Revisión UI/UX — Iteración 5 (Cuentas y cobro)

Fecha: 2026-10-10 · Revisor: Claude (frontend-design + chrome-devtools-mcp) · Issue: #122 · Rama: `fix/revision-ui-ux-it5`

## Alcance y método

Recorrido en Chrome DevTools a 1280×800, 390×844 y 360×740 con la BD de desarrollo. Todos los datos creados para la revisión llevan «UX It5» en el nombre:

- clínicas:
  - «Clínica UX It5 Norte», con RUC, dirección, teléfono y cinco trabajos;
  - «Clínica UX It5 Sur», con un pago de $ 200 registrado antes de su único trabajo, para tener saldo a favor y algo por cobrar a la vez;
  - «Centro Odontológico Integral UX It5 Valle de los Chillos», con nombre y dirección largos y saldo en los cuatro cubos;
- un doctor por clínica;
- trabajos `26-00101` a `26-00107`, llevados a `entregado` por la API de desarrollo con la sesión del navegador (crear, aceptar, finalizar, marcar enviado, subir constancia y marcar entregado);
- ajustes «Saldo inicial» con fechas pasadas (01/06, 01/08, 31/08, 15/05 y 20/07), para que los cubos 31–60, 61–90 y «Más de 90 días» tengan monto;
- el usuario «Recepción UX It5», creado desde Configuración → Usuarios con una contraseña generada en el momento que no se guardó en ningún archivo.

**Ninguna escritura pasó fuera de la API**: no hubo `UPDATE` directo en la BD.

La sesión de admin ya estaba abierta en el Chrome del MCP y no se cerró. Recepción entró en un contexto aislado (`isolatedContext`). Las medidas salen de `getBoundingClientRect`/`getComputedStyle`, y los contrastes se calcularon sobre el color compuesto real (alfa resuelto sobre el fondo de cada antecesor). La causa de cada hallazgo se localizó leyendo el código.

**Flujos ejecutados de verdad**:

| Flujo | Quién | Resultado |
|---|---|---|
| «Registrar pago» de $ 300 con el reparto sugerido cambiado a mano (tres trabajos y $ 49.50 a favor) | admin | Antes, el 422 de cliente «Lo asignado no puede superar el monto del pago». Después, el pago: «Pago registrado: 3 trabajos cobrados y $ 49.50 a favor» |
| «Aplicar saldo a favor» ($ 49.50 a `26-00103`) | admin | Aplicado |
| «Aplicar saldo a favor» ($ 75 de los $ 200 de Sur) | recepción | Aplicado |
| «Registrar ajuste»: descuento de $ 20 sobre `26-00101`, ya cobrado | admin | Primero, un 422 en vivo con $ 130 («El descuento supera lo que vale el trabajo; regístralo sin trabajo», bajo «Monto»). Después, el ajuste: «Ajuste registrado: $ 20.00 vuelven al saldo a favor» |
| «Saldo inicial» con fecha del 01/06 | admin, a 390 | Registrado |
| «Anular pago» | admin, a 390 | 409 provocado en vivo: con el diálogo abierto y el motivo escrito, el mismo pago se anuló por la API. El diálogo se cierra, refresca y avisa «El pago ya está anulado» |
| «Registrar pago» de $ 600 con un recargo concurrente | recepción | Con el diálogo abierto, admin registró por la API un recargo de $ 10 sobre `26-00107` (UX5-04) |

**Papel**: el estado de cuenta se midió con un script de Playwright fuera del repo (en el scratchpad de la sesión), con la sesión de recepción. El script usa `emulateMedia({ media: 'print' })` al ancho útil de cada hoja (A5 468 px, A4 702 px, Carta 725 px, con el margen de 12 mm de `@page`). Los PDF salen de `page.pdf()` en A4, A5 y Carta, y las capturas en PNG, de `pdftoppm`.

**Límites del recorrido** (cada hallazgo afectado lo dice):

- **Hoy es sábado 10 de octubre.** Todos los trabajos se entregaron hoy («0 días»). La antigüedad vieja sale de los «Saldo inicial» con fecha pasada, que es la vía que el producto ofrece para eso.
- El Chrome del MCP está en inglés: los `input type="date"` se ven como mm/dd/aaaa (UX5-08).
- El clic del MCP es de ratón, no un toque real. El anillo de foco «al tocar» del hallazgo anotado n.º 4 no se pudo reproducir así (ver la tabla de anotados).
- Técnico y mensajero no se crearon. Que no lleguen a «Cuentas» se verificó por código y por pruebas:
  - `beforeLoad` en `routes/_app/cuentas.tsx:7-9`, que cubre también `/estado` por ser ruta hija;
  - `ACCOUNTS_ROLES` en la navegación (`app-shell.tsx:16`, `app-shell.test.tsx:49-53`);
  - el E2E «técnico y mensajero no ven «Cuentas» ni entran por URL» (`e2e/cuentas.spec.ts:245-270`);
  - el 403 de la API (`accounts.test.ts:146-151, 276-277`);
  - `accountOf` devuelve `null` para ellos sin consultar la cuenta (`cases/service.ts:219-220`).

## Resumen ejecutivo

La Iteración 5 deja el cobro **operable y seguro**:

- **Se ve cuánto debe cada clínica y desde cuándo**, con texto: los cubos de antigüedad llevan rótulo y monto, el saldo negativo dice «A favor» y el pago anulado sale tachado con el chip «Anulado».
- **El reparto sugerido acierta**: de la entrega más antigua a la más nueva, editable fila a fila, con «Asignado $ X · Queda a favor $ Y» en vivo (`role="status"`).
- **Los errores caen donde se leen**: el 422 bajo su campo y el 409 cierra, refresca y avisa.
- **Los diálogos nombran sobre qué actúan** («$ 300.00 · Transferencia del 10/10/2026 · Clínica UX It5 Norte»), cierran con «Volver» y devuelven el foco.
- **Los permisos se cumplen**: recepción registra pagos y aplica saldo a favor, pero no ve «Registrar ajuste», «Anular pago» ni «Configuración». Técnico y mensajero quedan fuera (código y pruebas).
- **Sin objetivos táctiles por debajo de 44 px** en móvil en «Cuentas», la cuenta, sus diálogos y la ficha.
- **Sin scroll horizontal de página** a 1280, 390 y 360 px.
- **Consola limpia**: solo aparece el 409 provocado.

Los problemas son de **lectura del dinero**: la pantalla da los números, pero no siempre los explica.

1. **La cabecera de la cuenta se contradice** cuando hay saldo a favor y algo por cobrar. En Sur dice «Nada pendiente» con un trabajo de $ 75 en «Por cobrar». Además da dos «a favor» distintos ($ 125 y $ 200), y la acción que lo resuelve está escondida en la otra pestaña (UX5-01).
2. **El saldo no cuadra a la vista con «Por cobrar»**: $ 795.50 frente a $ 550.50. El «Saldo inicial» no aparece en ninguna lista de pendientes (UX5-02).
3. **Un pago no dice a qué trabajos se aplicó**, y «Anular pago» no dice qué trabajos vuelven a «Entregado» (UX5-03).
4. **El aviso «N trabajos cobrados» puede mentir**: dijo «5 trabajos cobrados» cuando uno seguía debiendo $ 10 (UX5-04, decisión de producto).
5. **Dos problemas de espacio**:
   - la tabla de «Cuentas» se desplaza en horizontal a 1280 con un nombre largo y corta «Más antiguo» (UX5-05);
   - en «Registrar pago» con cinco trabajos, el total en vivo y el botón quedan bajo el pliegue a 1280×800 (UX5-06).

No hay ningún Critical ni ningún problema de permisos. Lo más grave (UX5-01 a UX5-03) se arregla dando a la vista el desglose que la API ya calcula.

## Pantallas × viewport

| Pantalla | 1280×800 | 390×844 | 360×740 |
|---|---|---|---|
| «Cuentas»: buscador, orden, «Ver todas las clínicas», tabla y tarjetas | UX5-05, UX5-10 · orden por «Más antiguo» OK | UX5-09 · sin scroll · 0 controles < 44 px | UX5-09 · sin scroll |
| Cuenta de una clínica: cabecera, «Por cobrar», «Movimientos», pago anulado | UX5-01, UX5-02, UX5-03, UX5-12 | UX5-17, UX5-18 · sin scroll · 0 controles < 44 px | — |
| Cuenta como recepción | UX5-01, UX5-04, UX5-12 | 0 controles < 44 px, sin scroll | — |
| «Registrar pago» | UX5-06, UX5-15 | — | — |
| «Aplicar saldo a favor» | UX5-15 | — | — |
| «Registrar ajuste» con «Saldo inicial» y buscador de trabajos | UX5-11, UX5-15 | UX5-08 · foco inicial (anotado n.º 4) | — |
| «Anular pago» | UX5-03 | UX5-07 | — |
| Ficha del trabajo: línea de cobro e historial | UX5-16 · historial OK | OK («Cobrado el 10/10») | — |
| Estado de cuenta en pantalla | UX5-08 | — | UX5-14 · sin scroll |
| Estado de cuenta en papel (A4, A5, Carta) | UX5-13 | — | — |

`—` = no recorrida a ese ancho porque repite un patrón ya verificado sin diferencias nuevas.

## Hallazgos

### Critical

Ninguno.

### Important

**UX5-01 — Con saldo a favor y algo por cobrar, la cabecera de la cuenta se contradice y no ofrece aplicarlo**
Pantalla: cuenta de una clínica (recepción y admin) · Viewport: 1280 (`capturas/it5/recepcion-cuenta-sur-a-favor-1280.png`, `capturas/it5/recepcion-cuenta-sur-a-favor-repetido-1280.png`)
Evidencia (en vivo, «Clínica UX It5 Sur»: pago de $ 200 sin asignar y `26-00106` entregado por $ 75):
- la cabecera dice a la vez «Saldo: **A favor $ 125.00**», «**Nada pendiente**» y el chip «**Saldo a favor $ 200.00**»: dos montos «a favor» distintos;
- la pestaña de al lado dice «Por cobrar (1)», con `26-00106` y «Pendiente $ 75.00»;
- los cuatro cubos dicen «—»;
- «Aplicar saldo a favor», la acción que lo resuelve, solo está dentro de la pestaña «Movimientos», en la fila del pago;
- tras aplicarlo, la cabecera repite el mismo dato dos veces: «A favor $ 125.00» y «Saldo a favor $ 125.00» (hallazgo anotado n.º 3);
- en Norte pasa lo mismo con saldo positivo: «Saldo $ 245.50», «Saldo a favor $ 69.50» y `26-00107` por cobrar con $ 10. Recepción no sabe si la clínica debe $ 245.50 o $ 315, ni por qué los $ 69.50 no cubren los $ 10.

Causa:
- `apps/web/src/features/accounts/account-summary.tsx:45-53`: `BalanceAmount` pinta «A favor» si el saldo es negativo y el chip pinta `credit` aparte, sin relacionarlos;
- `account-summary.tsx:47`: «Nada pendiente» sale de `oldestDays === null`, que es nulo porque el saldo a favor neta toda la antigüedad, aunque haya trabajos «Por cobrar»;
- `clinic-account-content.tsx:119-150`: las acciones de pago solo viven en `MovementsTable`.

Fix propuesto:
- una sola lectura del saldo, derivada en `shared` (p. ej. `accountHeadline(balance, credit, openCases)`):
  - con saldo negativo: «A favor $ 125.00», sin chip;
  - con saldo positivo y crédito: «Debe $ 245.50 (ya descuenta $ 69.50 a favor sin aplicar)»;
- «Nada pendiente» solo si no hay trabajos «Por cobrar»; si los hay y el crédito los cubre: «1 trabajo por cobrar ($ 75.00), cubierto por el saldo a favor»;
- con crédito y trabajos por cobrar, un botón «Aplicar saldo a favor» en la cabecera, que abre el diálogo del pago más antiguo con `remaining`.

Tests: la función de `shared` con literales (negativo, positivo con crédito, sin nada) y `clinic-account-content.test.tsx` con la cuenta de Sur.

**UX5-02 — El saldo no cuadra a la vista con «Por cobrar», y lo más antiguo no está en ninguna lista**
Pantalla: cuenta de una clínica · Viewport: 1280 (`capturas/it5/cuenta-norte-por-cobrar-1280.png`)
Evidencia (en vivo, Norte antes del primer pago):
- la cabecera dice «Saldo $ 795.50 · Más antiguo: 70 días», pero «Por cobrar (5)» suma $ 550.50 y sus cinco trabajos tienen «0 días»;
- los $ 245 que faltan, y los 70 días, son dos «Saldo inicial» (ajustes sin trabajo). Solo se ven en «Movimientos», mezclados con los cargos;
- «Por cobrar» no tiene total.

Recepción, que contesta a la clínica «¿cuánto le debo y de qué?», tiene que sumar a mano y deducir el resto. El estado de cuenta tampoco lo desglosa: su «Por cobrar al…» lista solo trabajos.
Causa: `apps/web/src/features/accounts/open-cases-table.tsx` (sin fila de ajustes sin trabajo ni total) y `ClinicAccount` de `apps/api/src/features/accounts/service.ts:104-114`, que no expone el desglose. La convención prohíbe que la vista sume (`docs/conventions.md` §5, «la vista no suma nada»).
Fix propuesto: la API devuelve el desglose del saldo (`breakdown { openCases, unlinkedAdjustments, credit }`, con la regla en `shared`, que ya cuadra: «Σ pendientes + Σ ajustes sin trabajo − saldo a favor», ADR 35). La pestaña «Por cobrar» cierra con «Trabajos $ 550.50 · Saldo inicial y ajustes sin trabajo $ 245.00 (desde el 01/08) · Saldo $ 795.50». Lo mismo, en papel. Tests: servicio de cuentas con fakes, `open-cases-table` y `account-statement`.

**UX5-03 — Un pago no dice a qué trabajos se aplicó, y «Anular pago» no dice qué trabajos reabre**
Pantalla: «Movimientos» y diálogo «Anular pago» · Viewports: 1280 y 390 (`capturas/it5/cuenta-norte-movimientos-1280.png`, `capturas/it5/dialogo-anular-pago-390.png`)
Evidencia (en vivo):
- el pago de $ 300 dice «Transferencia · TRX-UXIT5-NORTE-01 · Registrado por Administrador · Le quedan $ 49.50 a favor». No dice que cubrió `26-00101`, `26-00102` y `26-00107`;
- los «Cargo» de esos trabajos no dicen «Cobrado»;
- «Anular pago» avisa «Los trabajos que cerró este pago vuelven a «Entregado»», sin decir cuáles. Al anularlo, volvieron tres trabajos y la cuenta pasó de «Por cobrar (2)» a «Por cobrar (5)»;
- el descuento de $ 20 sobre `26-00101` liberó $ 20 del pago, pero el movimiento «Ajuste» no lo dice (solo el toast y el historial del trabajo).

Esto contradice el criterio de la checklist: «registrar un pago y repartirlo, aplicar un saldo a favor y anular un pago sin dudar de qué pasa con cada trabajo».
Causa: `AccountMovement` (`apps/api/src/features/accounts/service.ts:86-102`) no lleva las asignaciones, y `movementsOf` (`service.ts:322-370`) solo calcula `remaining`. En la web, `movements-table.tsx:64-83` y `void-payment-dialog.tsx:74`.
Fix propuesto:
- `allocations: [{ caseId, code, amount }]` en el movimiento de pago (las asignaciones ya se leen con `AccountsRepository.allocations`);
- en la fila: «Aplicado a 26-00101 ($ 120.00), 26-00102 ($ 85.50) y 26-00107 ($ 45.00)», con enlaces de 44 px en móvil;
- en «Anular pago»: «Vuelven a «Entregado»: 26-00101, 26-00102, 26-00107»;
- en el ajuste que liberó algo: «$ 20.00 volvieron al saldo a favor del pago del 10/10».

Tests: servicio (el DTO), `movements-table` y `void-payment-dialog`.

**UX5-04 — El aviso «N trabajos cobrados» puede contar trabajos que siguen debiendo**
Pantalla: «Registrar pago» y «Aplicar saldo a favor» · Viewport: 1280 (`capturas/it5/recepcion-aviso-5-cobrados-1280.png`)
Evidencia (en vivo, recepción):
1. con «Registrar pago» abierto ($ 600, reparto sugerido: `26-00107` recibe sus $ 45), admin registra por la API un recargo de $ 10 sobre `26-00107`;
2. recepción confirma, y el toast dice «Pago registrado: **5 trabajos cobrados** y $ 69.50 a favor»;
3. la cuenta refrescada muestra «Por cobrar (1)»: `26-00107`, con un pendiente de $ 10.00. El aviso cuenta cinco y son cuatro.

El diálogo además seguía diciendo «Debe $ 45.00» de `26-00107` (las filas se congelan al abrir, I-1).
Hallazgo ya anotado, confirmado en vivo.
Causa: `apps/web/src/features/accounts/use-register-payment.ts:24` y `use-apply-credit.ts:24` calculan con `settledCount(open, …)` (`allocation.ts:50`) sobre el «Por cobrar» de cuando se abrió el diálogo; la API solo devuelve el pago.
Fix propuesto (**decisión de producto**): que la API devuelva los trabajos que cerró (`settled: [{ id, code }]` en la respuesta de `POST /api/cuentas/pagos` y de `…/asignaciones`, calculado con `isSettled` en la misma transacción), y el aviso diga «Pago registrado: cobrados 26-00101, 26-00102… · $ 69.50 a favor». La alternativa barata es quitar el conteo: «Pago registrado · $ 69.50 a favor». Tests: servicio de pagos (la respuesta) y `use-account-mutations.test.tsx` con la respuesta de la API, no con el «Por cobrar» previo.

**UX5-05 — «Cuentas» a 1280 se desplaza en horizontal con un nombre largo y corta «Más antiguo»**
Pantalla: «Cuentas» · Viewport: 1280 (`capturas/it5/cuentas-lista-1280.png`)
Evidencia (en vivo): con «Centro Odontológico Integral UX It5 Valle de los Chillos», el contenedor de la tabla mide `scrollWidth` **1031** frente a `clientWidth` 975. La columna «Más antiguo» queda cortada («14…»), con barra de scroll horizontal. La columna «Clínica» mide 373 px porque el nombre no se parte. El nombre largo cabe de sobra en dos líneas. La página no se desplaza, pero la tabla sí, y la regla es «sin scroll horizontal a 1280» (`docs/conventions.md` §5).
Causa: `apps/web/src/components/ui/table.tsx:70` (`whitespace-nowrap` en toda celda) y la columna `clinica` de `apps/web/src/features/accounts/accounts-table.tsx:40-54`, sin `whitespace-normal`.
Fix propuesto: `meta.cellClassName: 'border-l-4 whitespace-normal min-w-48'` en la columna de la clínica (y repasar las demás tablas con nombres libres). Test: E2E en `accesibilidad.spec.ts` con una clínica de nombre largo, que compruebe que ningún `[data-slot=table-container]` tiene `scrollWidth > clientWidth` a 1280.

**UX5-06 — En «Registrar pago», el total en vivo y el botón quedan bajo el pliegue**
Pantalla: «Registrar pago» con cinco trabajos por cobrar · Viewport: 1280×800 (`capturas/it5/dialogo-registrar-pago-sugerido-1280.png`)
Evidencia (en vivo):
- el diálogo tiene `scrollHeight` 856 en un alto visible de 720, porque todo él se desplaza;
- «Asignado $ … · Queda a favor $ …» empieza en y = 783, por debajo del borde del diálogo (760), y «Registrar pago» en y = 836, fuera de la ventana;
- mientras se edita una fila, no se ve lo que queda;
- con una clínica de 15 trabajos por cobrar, la lista crece sin límite.

Causa: `apps/web/src/components/form-dialog.tsx:50,74` (todo el contenido, pie incluido, dentro de un solo `overflow-y-auto`) y `allocation-fields.tsx`, donde el estado va al final de la lista.
Fix propuesto: en `FormDialog`, pie fijo (`DialogFooter` fuera del área que se desplaza, o `sticky bottom-0` con fondo), y en `AllocationFields` la lista con su propio `max-h` y `overflow-y-auto`, con «Asignado · Queda a favor» fuera de ella, siempre a la vista. Test: E2E que, con cinco trabajos, compruebe que el `role="status"` y el botón principal están dentro de la ventana a 1280×800 y a 390×844.

### Minor

**UX5-07 — El destructivo de «Anular pago» (y de «Cancelar trabajo») se ve pálido**
Evidencia (en vivo, `capturas/it5/dialogo-anular-pago-390.png`): el botón principal usa `bg-destructive/10` con texto rojo. Su contraste es AA (~5,1:1 sobre el pie), pero pesa menos que «Volver» (contorno) y parece deshabilitado junto al primario sólido del resto de la app. Hallazgo ya anotado, confirmado.
Causa: variante `destructive` de `apps/web/src/components/ui/button.tsx:19-20`.
Fix propuesto: `destructive` sólido (`bg-destructive text-white`, que da ≈ 6,5:1), o una variante `destructive-solid` para los botones que confirman, como pide `ACTION_EMPHASIS` (UX3-04/05). Test: `theme-tokens.test.ts` con el par texto/fondo y un test de la variante.

**UX5-08 — Las fechas de los formularios se ven en mm/dd/aaaa con el navegador en inglés**
Evidencia (en vivo, Chrome en inglés):
- «Desde 08/15/2026» en el periodo del estado de cuenta, con el título de al lado en «Del 15/08/2026» (`capturas/it5/estado-cuenta-pantalla-1280.png`);
- en «Registrar ajuste», el «Saldo inicial» del 1 de junio se ve como «**06/01/2026**», que en Ecuador se lee 6 de enero (`capturas/it5/dialogo-ajuste-saldo-inicial-390.png`);
- `lang="es-EC"` en `statement-range-form.tsx:55,68` no cambia nada: Chrome formatea el `input type="date"` con el idioma de su interfaz, no con `lang`. Así que el fix de UX4-23 tampoco tuvo efecto. Los de pago y ajuste (`payment-dialog.tsx:199`, `adjustment-dialog.tsx:184`) ni lo llevan.

Hallazgo ya anotado, confirmado y ampliado a los diálogos. En un navegador en español se ve dd/mm/aaaa: afecta a quien tenga Chrome en inglés.
Fix propuesto (**decisión de producto**): bajo cada fecha, una descripción con la fecha larga que se va a guardar («Lunes, 1 de junio de 2026», `formatLongDate` de la web), o un selector propio en es-EC. Quitar el `lang` que no hace nada. Test: los tres formularios muestran la fecha larga al cambiar el valor.

**UX5-09 — «Cuentas» en móvil: «Ordenar por / Dirección» empuja las tarjetas**
Evidencia (en vivo, `capturas/it5/cuentas-lista-390.png`): a 390×844 y a 360×740, la primera tarjeta empieza en **y = 453**. Antes van el interruptor, el buscador y dos `select` de 44 px con sus rótulos. A 360×740 solo se ve una tarjeta y media. «Dirección» se muestra («Ascendente», deshabilitado) aunque no haya orden. Hallazgo ya anotado, confirmado.
Causa: `MobileSortControls` (`apps/web/src/components/data-grid/features/sorting.tsx:53-84`, `lg:hidden`), que la lista activa con `sorting()` en `accounts-table.tsx:17-23`.
Fix propuesto: en móvil, un solo `select` «Ordenar» con las opciones ya combinadas («Saldo: mayor a menor», «Más antiguo primero», «Clínica A–Z»), sin «Dirección» suelto, y opcional plegado tras un botón «Ordenar». Así vale para todas las tablas. Test: `data-grid.test.tsx` (un solo control en móvil).

**UX5-10 — Los tonos de 61–90 y «Más de 90 días» se confunden**
Evidencia (medida): `--articulating-red` #d6453d frente a `--destructive` #b3261e: ΔE76 = **11,5** y contraste entre sí de **1,49:1**, el mismo tono más oscuro. En la regleta de la cabecera son dos rojos contiguos casi iguales (`capturas/it5/cuenta-norte-movimientos-390.png`), y para un daltónico protán son el mismo. El texto lo salva (cada cubo lleva su rótulo), así que es Minor. Hallazgo ya anotado, confirmado.
Causa: `apps/web/src/features/accounts/aging-tab.ts:17-18`.
Fix propuesto: separar por luminosidad, no solo por tono. Por ejemplo, 61–90 en naranja quemado y «Más de 90» en vino casi negro (`--foreground` con tinte), o un rayado para «Más de 90» en la regleta. Test: `theme-tokens.test.ts` con ΔE ≥ 20 entre cubos contiguos.

**UX5-11 — El buscador de trabajos de «Registrar ajuste»: sin monoespaciada, sin paciente y con el rótulo equivocado**
Evidencia (en vivo, `capturas/it5/dialogo-ajuste-buscador-trabajos-1280.png`):
- las opciones dicen «26-00101 · cobrado» y «26-00103 · debe $ 190.50» en la fuente del texto, cuando el código va en monoespaciada en toda la app. Hallazgo ya anotado, confirmado;
- «cobrado» va en minúscula, cuando el estado se escribe «Cobrado» en el chip;
- no hay paciente: con 30 trabajos, el código solo no basta;
- la ayuda dice «Solo trabajos entregados de esta clínica.», pero la lista incluye los cobrados.

Causa: `apps/web/src/features/accounts/adjustment-dialog.tsx:80-86` (la etiqueta es un `string`), `Combobox` (`components/combobox.tsx:175-188`, que pinta `item.label` en un `span` sin variante) y la descripción de `adjustment-dialog.tsx:210`.
Fix propuesto: `ComboboxItem` con `code?` y `detail?` (código en `font-mono` y detalle «Paciente UX It5 A · Debe $ 190.50» o «Cobrado»), filtrando también por paciente. Ayuda: «Trabajos entregados o cobrados de esta clínica.». Test: `adjustment-dialog.test.tsx` y `combobox`.

**UX5-12 — «Movimientos» reserva la columna de acciones aunque no haya ninguna**
Evidencia (en vivo, recepción, `capturas/it5/recepcion-movimientos-sin-acciones-1280.png`): en la cuenta de Valle (sin pagos), el `th` «Acciones» mide **67 px** y deja un hueco a la derecha de «Monto». Pasa lo mismo en Sur después de aplicar todo el saldo. Hallazgo ya anotado, confirmado.
Causa: la columna `acciones` siempre está (`apps/web/src/features/accounts/movements-table.tsx:175-180`).
Fix propuesto: ocultarla con `columnVisibility` cuando ninguna fila tiene acciones para ese rol y esos datos (la misma condición de `MovementActions`, extraída a una función). Test: `movements-table` sin pagos vigentes no tiene `columnheader` «Acciones».

**UX5-13 — Estado de cuenta en papel: «Saldo al dd/mm/aaaa» partido, «Por cobrar» huérfano y códigos cortados**
Evidencia (medida en print y en el PDF, `capturas/it5/estado-papel-norte-A5-1.png`, `capturas/it5/estado-papel-norte-A4-1.png`, `capturas/it5/estado-papel-norte-A4-2.png`):
- en el resumen del periodo, «Saldo al 30/04/2026» ocupa **2 líneas** en A5, A4 y Carta, y «Saldo al 10/10/2026», 2 en A5. Hallazgo ya anotado, confirmado;
- en A4, el título «Por cobrar al 10/10/2026» queda solo al pie de la hoja 1 y su tabla pasa a la hoja 2 (nuevo);
- «Trabajo 26-\n00107» se parte en el guion en A4 (nuevo).

Causa: `apps/web/src/features/accounts/account-statement.tsx`:
- `:87-110`: cinco columnas `minmax(0,1fr)…1.4fr` con el rótulo en una línea sin `whitespace-nowrap`;
- `:260-262`: la sección no lleva `break-inside-avoid` ni el `h2` `break-after-avoid`;
- `:54`: el código va sin `whitespace-nowrap`.

Fix propuesto: rótulo y fecha en `whitespace-nowrap` (o «Saldo inicial» / «Saldo final» con la fecha debajo), columnas `auto` para los saldos, `break-after-avoid` en los `h2` de sección y `whitespace-nowrap` en el código. Test: en `e2e/impresion.spec.ts`, con `emulateMedia('print')` al ancho de A5, cada `li` del resumen en una sola línea, y un estado con «Por cobrar» al final que no deje el título solo.

**UX5-14 — Estado de cuenta en móvil: la columna «Detalle» queda estrecha**
Evidencia (medida, `capturas/it5/estado-cuenta-detalle-estrecho-360.png`):
- a 360, «Detalle» mide **102 px**, frente a 104 de «Monto» y 88 de «Saldo»; a 390, 132 px;
- «Trabajo 26-00105» se parte en «26-» / «00105», y «Saldo al 30/04/2026» en dos líneas.

Hallazgo ya anotado, confirmado.
Causa: `account-statement.tsx:25` (`NUM` con `w-px whitespace-nowrap` en dos columnas de montos) y `:54`.
Fix propuesto: en móvil, Monto y Saldo apilados en una sola celda («+ $ 1250.75» y debajo «Saldo $ 1760.75»), o el saldo corrido solo desde `sm`. Con eso «Detalle» pasa de ~100 a ~200 px. Código en `whitespace-nowrap`. Test: E2E a 360 con el ancho de «Detalle» ≥ 180 px.

**UX5-15 — Los diálogos de reparto y de ajuste no dicen qué le pasará a cada trabajo**
Evidencia (en vivo, `capturas/it5/dialogo-aplicar-saldo-1280.png`, `capturas/it5/dialogo-registrar-ajuste-1280.png`):
- «Aplicar saldo a favor» propone $ 49.50 para `26-00103`, que debe $ 240. La fila no dice «Quedará debiendo $ 190.50»; solo la descripción general habla de «los que queden cubiertos». Lo mismo en «Registrar pago»;
- en «Registrar ajuste», un descuento sobre `26-00101`, ya cobrado, no avisa antes de que el dinero vuelve al saldo a favor del pago; se entera por el toast;
- vocabulario: la tabla «Por cobrar» llama «Pagado» a lo que los diálogos llaman «Asignado» (`open-cases-table.tsx:62`).

Causa: `allocation-fields.tsx:58-79` (fila sin consecuencia) y `adjustment-dialog.tsx:96-240`.
Fix propuesto:
- bajo cada monto, «Queda cobrado» o «Quedará debiendo $ X», calculado con `caseOutstandingCents`/`isSettled` de `shared` (la vista no suma: la función ya existe);
- en el ajuste con trabajo cobrado y signo «Descuento», la línea «Este trabajo ya está cobrado: el descuento vuelve como saldo a favor del pago»;
- un solo término: «Pagado» o «Asignado».

Tests: `allocation-fields`, `adjustment-dialog`.

**UX5-16 — La ficha dice «Total $ 45.00» y «Pendiente $ 10.00 de $ 55.00» sin explicar la diferencia**
Evidencia (en vivo, `capturas/it5/ficha-linea-pendiente-1280.png`, `26-00107` con recargo de $ 10): el «Total» de la cabecera y el «de $ 55.00» de la línea de cobro no coinciden y nada dice por qué. La repetición sí tiene su línea aclaratoria.
Causa: `apps/web/src/features/cases/case-account-line.tsx:60-70` (solo explica `reducedRemake`).
Fix propuesto: si `account.adjustments ≠ 0`, «Incluye ajustes: + $ 10.00» (con signo, `signedAmountText`). Test: `case-account-line.test.tsx`.

**UX5-17 — Cabecera de la cuenta en móvil: tres botones apilados y orden de foco al revés**
Evidencia (en vivo, `capturas/it5/cuenta-norte-cabecera-390.png`):
- a 390, «Registrar pago», «Registrar ajuste» y «Estado de cuenta» van a ancho completo (≈ 150 px), y la primera tarjeta de «Por cobrar» empieza en y ≈ 760;
- el orden visual es pago, ajuste y estado (`flex-col-reverse`), pero el DOM y el foco van al revés: «Estado de cuenta», «Registrar ajuste», «Registrar pago» (WCAG 2.4.3).

Causa: `apps/web/src/features/accounts/clinic-account-content.tsx:84`.
Fix propuesto: DOM en el orden de importancia (pago primero) y `sm:flex-row-reverse` solo en escritorio. En móvil, «Registrar pago» a ancho completo, y «Registrar ajuste» y «Estado de cuenta» en una fila de dos. Test: el orden de los botones en `clinic-account-content.test.tsx`.

**UX5-18 — En la tarjeta del pago, «Anular pago» va pegado a «Aplicar saldo a favor»**
Evidencia (en vivo, `capturas/it5/cuenta-norte-movimientos-pago-390.png`): los dos botones van juntos, alineados a la derecha, con 8 px entre ellos. Lo destructivo es un `ghost` rojo al lado de la acción habitual. La convención pide «lo destructivo al final y aparte».
Causa: `apps/web/src/features/accounts/movements-table.tsx:131-157`.
Fix propuesto: separar «Anular pago» (`ms-auto` en el destructivo, o una línea divisoria propia en la tarjeta) y, en móvil, «Aplicar saldo a favor» a ancho completo. Test: `movements-table`.

**UX5-19 — La regla «hasta no pasa de hoy» vive en el componente del periodo**
Evidencia (código): `apps/web/src/features/accounts/statement-range-form.tsx:39-41` repite con un `if` la regla de `statementRange` (web) y la del servicio, con el mensaje importado aparte. Comentario de #122, confirmado.
Fix propuesto: `statementRangeFormSchema(today)` en `shared`, con fábrica como `applyCreditFormSchema(available)` y el mensaje dentro del schema. El formulario usa solo el `zodResolver`. Test: el schema en `shared` con literales (ayer, hoy, mañana).

**UX5-20 — «Anular pago» pinta cualquier issue del 422 bajo «Motivo»**
Evidencia (código): `apps/web/src/features/accounts/void-payment-dialog.tsx:59-61` usa `applyIssues` del reparto y su callback ignora el campo: un issue en `asignaciones…` acabaría bajo «Motivo». Comentario de #122, confirmado.
Fix propuesto: mapeo directo: el issue con `path === 'motivo'` va al campo y el resto, al toast. Test: `void-payment-dialog.test.tsx` con un 422 sin `motivo`.

## Verificación de los hallazgos ya anotados en #122

| # | Hallazgo anotado | Estado | Id / evidencia |
|---|---|---|---|
| 1 | «Cuentas» en móvil: «Ordenar por / Dirección» antes de las tarjetas | **Confirmado en vivo** | UX5-09: primera tarjeta en y = 453 a 390 y a 360 |
| 2 | Tonos de 61–90 y «Más de 90 días» parecidos | **Confirmado (medido)** | UX5-10: ΔE 11,5; 1,49:1 entre sí |
| 3 | «A favor» y el chip «Saldo a favor» se repiten | **Confirmado y peor**: con algo por cobrar dan montos distintos ($ 125 y $ 200) junto a «Nada pendiente» | UX5-01 |
| 4 | En móvil, «Registrar ajuste» abre con el anillo de foco sobre «Descuento…» | **No reproducido con puntero**: a 390 el foco inicial cae en ese botón, pero sin `:focus-visible` ni anillo (con teclado sí sale, y es lo correcto). El clic del MCP es de ratón: queda para comprobarlo con un toque real en PEM-1 | `capturas/it5/dialogo-ajuste-foco-inicial-390.png` |
| 5 | Opciones del buscador de trabajos sin monoespaciada | **Confirmado en vivo** | UX5-11 (más: sin paciente, «cobrado» en minúscula, ayuda que no cuadra) |
| 6 | «Movimientos» guarda el ancho de la columna de acciones vacía | **Confirmado en vivo con recepción** | UX5-12: `th` de 67 px |
| 7 | El destructivo de «Anular pago» (y de «Cancelar trabajo») se ve pálido | **Confirmado**: AA (~5,1:1), pero con menos peso que «Volver» | UX5-07 |
| 8 | La cuenta con sesión de recepción no se verificó en Chrome | **Verificada en vivo**: recepción ve «Cuentas» y la cuenta, registra pagos y aplica saldo a favor; no ve «Registrar ajuste», «Anular pago» ni «Configuración». Sin scroll y sin objetivos < 44 px a 390 | UX5-01, UX5-04, UX5-12 vistos con su sesión |
| 9 | El aviso «N trabajos cobrados» usa el «Por cobrar» previo | **Confirmado en vivo**: «5 trabajos cobrados» con `26-00107` aún debiendo $ 10 | UX5-04 (decisión de producto) |
| 10 | Estado impreso: «Saldo al dd/mm/aaaa» en dos líneas | **Confirmado (print y PDF)**: el inicial en A5, A4 y Carta; el final, en A5 | UX5-13 |
| 11 | Estado de cuenta en móvil: «Detalle» estrecho | **Confirmado (medido)**: 102 px a 360 y 132 a 390 | UX5-14 |
| 12 | El periodo muestra mm/dd/aaaa según el idioma del navegador | **Confirmado**, también en «Registrar pago» y «Registrar ajuste»; el `lang="es-EC"` no tiene efecto en Chrome | UX5-08 |
| 13 | Comentario: regla «hasta ≤ hoy» en el componente | **Confirmado por código** | UX5-19 |
| 14 | Comentario: `void-payment-dialog` pinta cualquier issue bajo «Motivo» | **Confirmado por código** | UX5-20 |

## Aciertos (mantener)

- **El reparto sugerido es correcto y editable**: $ 300 se repartió 120 + 85.50 + 94.50, de la entrega más antigua a la más nueva y por código, y cada fila se puede cambiar con `inputmode="decimal"` en 44 px. El estado en vivo dice «Supera el pago en $ 60.00» en rojo, con texto, antes de enviar.
- **Los errores, en su sitio**:
  - el 422 de cliente, al pie del reparto;
  - el 422 de la API, bajo «Monto» («El descuento supera lo que vale el trabajo; regístralo sin trabajo»);
  - el 409, que cierra el diálogo, espera el refresco y avisa «El pago ya está anulado».
- **Cada diálogo dice sobre qué actúa** («$ 300.00 · Transferencia del 10/10/2026 · Clínica UX It5 Norte»), nombra la acción en su botón y cierra con «Volver». Con teclado, Escape cierra y devuelve el foco a «Registrar pago», con anillo visible.
- **Los toasts dicen qué pasó**: «Ajuste registrado: $ 20.00 vuelven al saldo a favor» y «Saldo a favor aplicado: 1 trabajo cobrado».
- **Nunca solo color**:
  - «A favor» con texto;
  - signos «+ / −» en los montos;
  - el pago anulado, con el chip «Anulado», tachado y «Anulado por {quién}: {motivo}» en pantalla;
  - en papel, «No suma», sin quién ni por qué;
  - cada cubo, con su rótulo y su monto.
- **El historial de la ficha cuenta el cobro**: «Pago aplicado $ 45.00 · Transferencia · TRX…», «Pago anulado · Se devolvieron $ 45.00 · Motivo…», «Ajuste registrado · Recargo de $ 10.00 · Motivo…» y «Nuevo estado: Cobrado».
- **La línea de cobro de la ficha** («Cobrado el 10/10», «Pendiente $ 10.00 de $ 55.00») enlaza a la cuenta con un objetivo de 44 px, y técnico y mensajero no la reciben (`accountOf`).
- **«Saldo inicial»** rellena motivo, signo y «Sin trabajo» de un toque, y su fecha pasada entra en la antigüedad correcta.
- **El estado de cuenta cuadra**: el saldo inicial más los movimientos da el final, y el final coincide con la cuenta ($ 245.50). Cabe en una hoja A4, A5 y Carta con pocos movimientos, y en dos sin cortar filas (`break-inside-avoid`). Los controles no salen en papel.
- **Permisos por rol** en la ruta, la navegación, la API y el servicio, con pruebas en las tres capas.
- **Sin scroll horizontal de página** (`scrollWidth === clientWidth`) en «Cuentas», la cuenta, el estado de cuenta y la ficha, a 1280, 390 y 360. La única excepción es el contenedor de la tabla de UX5-05.
- **Objetivos táctiles**: 0 controles por debajo de 44 px en móvil en «Cuentas», la cuenta (admin y recepción) y los diálogos («Saldo inicial» 96×44, tipo de ajuste 326×44, acciones de la tarjeta de pago 44 px).
- **Consola limpia** en todo el recorrido. Solo aparece el 409 provocado a propósito.

## Propuesta de ola de fixes

| # | Commit / tarea | Hallazgos | Tamaño | Test que lo cubre |
|---|---|---|---|---|
| 1 | `feat: la cuenta explica su saldo (desglose y asignaciones de cada pago)` | UX5-02, UX5-03 | M | Servicio de cuentas con fakes (desglose y `allocations` en el DTO); ruta contra Postgres; `open-cases-table`, `movements-table`, `void-payment-dialog` |
| 2 | `fix(web): cabecera de la cuenta sin contradicciones y con «Aplicar saldo a favor» a mano` | UX5-01, UX5-17 | M | Función de lectura del saldo en `shared` con literales; `clinic-account-content.test.tsx` (cuenta de Sur; orden de botones) |
| 3 | Decisión de producto + `fix: el aviso del pago lo dan los trabajos que cerró la API` | UX5-04 | S | Servicio de pagos (respuesta con `settled`); `use-account-mutations.test.tsx` |
| 4 | `fix(web): tablas y diálogos de cuentas que caben` | UX5-05, UX5-06, UX5-12 | M | E2E en `accesibilidad.spec.ts` (sin scroll en la tabla con nombre largo; estado y botón a la vista con cinco trabajos); `form-dialog`; `movements-table` |
| 5 | `fix(web): los diálogos de reparto y de ajuste dicen qué pasa con cada trabajo` | UX5-15, UX5-11, UX5-16 | M | `allocation-fields`, `adjustment-dialog`, `combobox`, `case-account-line` |
| 6 | `fix(web): estado de cuenta en papel y en móvil` | UX5-13, UX5-14 | S | `e2e/impresion.spec.ts` (resumen en una línea en A5, sin título huérfano); E2E a 360 con «Detalle» ≥ 180 px |
| 7 | `fix(web): pulido visual de cuentas` | UX5-07, UX5-09, UX5-10, UX5-18 | S | `theme-tokens.test.ts` (destructivo sólido; ΔE entre cubos); `data-grid.test.tsx` (un control de orden en móvil); `movements-table` |
| 8 | `refactor: reglas de los formularios de cuentas en shared` | UX5-19, UX5-20 | S | Schema `statementRangeFormSchema(today)` con literales; `void-payment-dialog.test.tsx` |
| 9 | Decisión de producto + tarea | UX5-08 | S | Los tres formularios muestran la fecha larga |

**Decisiones de producto para Nelson**:

1. **UX5-04, el aviso «N trabajos cobrados»**: ¿la API devuelve los trabajos que cerró el pago (recomendado: es la única forma de que el aviso diga la verdad con varias personas cobrando a la vez), o se quita el conteo y el aviso queda en «Pago registrado · $ X a favor»?
2. **UX5-01, el saldo a favor con trabajos por cobrar**: ¿basta con proponerlo en la cabecera («Aplicar saldo a favor»), o el saldo a favor se aplica solo al entregar un trabajo de una clínica que lo tiene? Hoy, por ADR 35, se aplica a mano después, y Sur se queda con $ 200 a favor y $ 75 «por cobrar» hasta que alguien entra a «Movimientos».
3. **UX5-02, cómo se muestran el «Saldo inicial» y los ajustes sin trabajo**: ¿como fila propia en «Por cobrar» (con su fecha y sus días, porque cuentan en la antigüedad), o como línea de desglose bajo la tabla? Vale igual para el estado de cuenta en papel, que va a la clínica.
4. **UX5-08, las fechas**: ¿descripción con la fecha larga bajo cada campo (barato y sin dependencias) o un selector propio en es-EC?
5. **UX5-10, el color de «Más de 90 días»**: ¿vino casi negro, o rayado en la regleta?

## Capturas

Todas en `capturas/it5/`. Ninguna muestra credenciales: el formulario de usuario y el login no se capturaron.

- «Cuentas»: `cuentas-lista-1280.png`, `cuentas-lista-390.png`, `cuentas-lista-tarjetas-360.png`
- Cuenta de una clínica:
  - admin: `cuenta-norte-por-cobrar-1280.png`, `cuenta-norte-tras-pago-1280.png`, `cuenta-norte-movimientos-1280.png`, `cuenta-norte-tras-ajuste-1280.png`;
  - móvil: `cuenta-norte-cabecera-390.png`, `cuenta-norte-movimientos-390.png`, `cuenta-norte-movimientos-pago-390.png`, `cuenta-norte-pago-anulado-390.png`;
  - recepción: `recepcion-cuenta-sur-a-favor-1280.png`, `recepcion-cuenta-sur-a-favor-repetido-1280.png`, `recepcion-aviso-5-cobrados-1280.png`, `recepcion-movimientos-sin-acciones-1280.png`, `recepcion-cuenta-sur-390.png`.
- Diálogos:
  - «Registrar pago»: `dialogo-registrar-pago-sugerido-1280.png`, `dialogo-registrar-pago-supera-1280.png`;
  - «Aplicar saldo a favor»: `dialogo-aplicar-saldo-1280.png`;
  - «Registrar ajuste»: `dialogo-registrar-ajuste-1280.png`, `dialogo-ajuste-buscador-trabajos-1280.png`, `dialogo-ajuste-buscar-101-1280.png`, `dialogo-ajuste-422-supera-1280.png`, `dialogo-ajuste-foco-inicial-390.png`, `dialogo-ajuste-saldo-inicial-390.png`;
  - «Anular pago»: `dialogo-anular-pago-390.png`.
- Ficha: `ficha-linea-pendiente-1280.png`, `ficha-historial-cobro-1280.png`, `ficha-linea-cobrado-390.png`
- Estado de cuenta:
  - en pantalla: `estado-cuenta-pantalla-1280.png`, `estado-cuenta-detalle-estrecho-360.png`;
  - en papel (PDF a PNG): `estado-papel-norte-A5-1.png`, `estado-papel-norte-A5-2.png`, `estado-papel-norte-A4-1.png`, `estado-papel-norte-A4-2.png`, `estado-papel-valle-carta-1.png`.

## Resultado de la ola

Ola de fixes en la rama `fix/revision-ui-ux-it5` (plan `docs/superpowers/plans/2026-10-10-ola-fixes-ui-ux-it5.md`, 9 tareas, `61492b3..HEAD`). Los 20 hallazgos quedan resueltos.

| Hallazgo | Qué se hizo | Commit(s) |
|---|---|---|
| UX5-01 | La cabecera lee el saldo una sola vez (`accountHeadline` de shared) y ofrece «Aplicar saldo a favor» con el pago vigente más antiguo (`paymentToApply`); sigue siendo manual | `e291386`, `f2a7407` |
| UX5-02 | La API trae el `breakdown` del saldo y «Por cobrar» y el estado de cuenta cierran con su desglose (`BalanceBreakdown`) | `7f5fc67`, `99636ad` |
| UX5-03 | El pago trae `allocations` con `reopens`: «Aplicado a …» con enlaces, y «Anular pago» nombra lo que quita y lo que reabre, sin partir los códigos | `ee50326`, `be9a5ea`, `d8fd852` |
| UX5-04 | La API devuelve `settled` y el aviso nombra los trabajos que cerró; desaparece `settledCount` | `429c034` |
| UX5-05 | La columna de la clínica en «Cuentas» parte el nombre en vez de ensanchar la tabla | `d744963`, `cd5cfcd` |
| UX5-06 | `FormDialog` con cabecera y pie fijos; lo aplicado en vivo va en el `summary` del pie y el reparto tiene su propio scroll | `5f8b1be`, `85e38ee` |
| UX5-07 | Variante `destructive-solid` para el botón que confirma lo destructivo | `8e4e5d0` |
| UX5-08 | `DateField` con la fecha escrita en español debajo (`formatLongDate`) y sin el `lang` que no hacía nada | `79d6c29` |
| UX5-09 | Un solo «Ordenar» en móvil para todas las tablas del `DataGrid`, con `meta.sortLabels` | `d744963`, `cd5cfcd` |
| UX5-10 | «Más de 90 días» en `--overdue-wine`, con ΔE ≥ 20 y ≥ 3:1 frente a 61–90 | `1c0d5e7` |
| UX5-11 | El buscador de trabajos del ajuste dice código en monoespaciada, paciente (`CaseRef` con `patientRef`) y estado, sin partir los montos | `80614ce`, `dca3f84` |
| UX5-12 | «Movimientos» solo tiene la columna «Acciones» si alguna fila tiene una acción (`movementActions`) | `34be4e5` |
| UX5-13 | En papel, «Saldo al …» en una línea, títulos que no se quedan solos y código sin partir | `eeb41ae` |
| UX5-14 | En móvil, el saldo corrido va bajo el monto y «Detalle» pasa de 102 a 186 px a 360 | `eeb41ae` |
| UX5-15 | Cada fila del reparto dice qué le pasará al trabajo (`allocationOutcome`), el descuento avisa de lo que vuelve al saldo a favor (`discountReleaseCents`) y el vocabulario queda en «Pagado»/«Aplicado» | `26d3028`, `5f8b1be`, `85e38ee` |
| UX5-16 | La ficha explica los ajustes del trabajo: «Incluye ajustes de + $ X: se cobra $ Y en vez de $ Z» | `9152a52`, `dca3f84` |
| UX5-17 | Botones de la cabecera en el DOM en orden de importancia, que es el del foco; en móvil, el primario a ancho completo | `f2a7407` |
| UX5-18 | «Anular pago» va aparte, bajo «Aplicar saldo a favor» | `34be4e5`, `cd5cfcd` |
| UX5-19 | El periodo del estado de cuenta valida con `statementRangeFormSchema(today)` de shared | `63cbaef` |
| UX5-20 | «Anular pago» pinta bajo «Motivo» solo el issue del motivo y el resto va al toast | `f39fe8a` |

El cierre (Tarea 9) añade los barridos táctiles de lo nuevo (`c703f2b`: cabecera con «Aplicar saldo a favor», desglose, `DateField` con su fecha escrita, pie fijo del reparto y «Ordenar» de trabajos) y pone al día `docs/architecture.md` y `docs/conventions.md`.

La revisión final de la rama (0 Critical, 0 Important, 4 Minor) dejó una ronda de fixes antes del PR:

| Hallazgo | Qué se hizo | Commit |
|---|---|---|
| M-1 | El aviso del descuento en «Registrar ajuste» se anuncia por una región `role="status"` `sr-only` siempre en el árbol (sin `empty:hidden`) y con un texto sin el monto, que no se repite con cada tecla | `aefa2e7` |
| M-2 | La cuenta trae `billedCases` (estado, lo que debe y lo pagado de cada trabajo que carga) y el aviso del descuento usa `discountReleaseCents` también en los cobrados: dice cuánto vuelve y no lo promete en un cobrado sin nada pagado | `737808b` |
| M-3 | `GET /api/cuentas` trae el saldo a favor y los trabajos por cobrar de cada clínica, y la tarjeta de «Cuentas» lee el saldo con `accountHeadline`, como la cabecera: ya no dice «Nada pendiente» con trabajos por cobrar | `53eea3f` |
| M-3 (impreso) | El estado de cuenta lee lo pendiente bajo la antigüedad con la misma `accountHeadline`: no dice «Nada pendiente» si el saldo a favor cubre trabajos por cobrar | «fix: el estado de cuenta no dice «Nada pendiente» con trabajos por cobrar» |

**Queda fuera de la ola**:

- Los campos de fecha fuera de cuentas (`ship-dialog`, `fail-dialog`, `day-picker`, `pickup-fields`, `clinic-patient-fields`, `cases-filters`) siguen sin la fecha escrita: issue aparte.
- Solo «Cuentas» tiene `sortLabels` propios; las demás tablas dicen «<Columna>: ascendente/descendente» (valorar «Entrega» y «Estado» en trabajos).
- La mutación de `timeZone` del test de `formatLongDate` solo muere fuera de UTC, y CI corre en UTC.
- `adjustment-dialog` sigue usando `applyIssues` del reparto: un issue que no sea de sus campos se perdería (hoy la API de ajustes no lo devuelve; mismo patrón que UX5-20).
- A 1280, el reparto con muchos trabajos tiene doble scroll (cuerpo y lista); aceptado.
- A 390 con admin, la cabecera de la cuenta tiene 3 filas de botones y la primera tarjeta empieza en y ≈ 735.
- En «Cuentas», «Más reciente primero» pone arriba las clínicas sin nada pendiente (ordena `oldestDays ?? -1`).
- `paymentToApply` desempata los pagos del mismo día por id (UUID), no por orden de registro: con dos pagos del mismo día, el botón de la cabecera puede elegir el más nuevo.
- A 360, en la tarjeta de un pago, «Aplicado a» queda solo en su línea y los enlaces de 44 px separan mucho las líneas.
