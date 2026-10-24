---
title: Ajustes y anular pagos
description: Registrar descuentos y recargos en la cuenta de una clínica, cargar su saldo inicial y anular un pago mal registrado.
sidebar_position: 7
---

# Ajustes y anular pagos

Un **ajuste** cambia lo que debe una clínica sin que haya un pago: un descuento acordado, una nota de crédito, un recargo o la deuda que ya traía antes de usar Dentalware. **Anular un pago** deshace uno mal registrado. Las dos cosas son solo de administración y quedan escritas en la cuenta, con su motivo.

## Quién puede hacerlo

<Rol roles={['admin']} />

Recepción ve los ajustes y los pagos anulados en la cuenta, pero no los registra. Lo básico de las cuentas (ver el saldo, registrar un pago y aplicar el saldo a favor) está en [Cuentas y pagos](../recepcion/cuentas-y-pagos.md).

## Pasos para registrar un ajuste

1. Abre **Cuentas** y toca el nombre de la clínica, por ejemplo **Clínica Sonrisa Norte**.
2. Toca <Boton>Registrar ajuste</Boton>.
3. En **Tipo**, elige **Descuento o nota de crédito** (baja lo que debe la clínica) o **Recargo** (lo sube).
4. Escribe el **Monto**, sin signo. Revisa la **Fecha**: es hoy y no puede ser posterior.
5. En **Trabajo**, elige a qué trabajo va, o déjalo en **Sin trabajo: solo la clínica**. La lista tiene los trabajos entregados o cobrados de esa clínica: cada uno con su código, su paciente y lo que debe («Debe $ 35.00») o «Cobrado». Puedes buscar por código o por paciente.
6. Escribe el **Motivo**: es obligatorio y sale en los movimientos de la cuenta.
   <Captura nombre="administracion/registrar-ajuste" alt="Diálogo Registrar ajuste de Clínica Sonrisa Norte: descuento de $ 40.00 con fecha 20/10/2026 al trabajo 26-00012 S. L., que debe $ 35.00, y al pie el aviso «$ 5.00 de lo ya pagado por este trabajo vuelven al saldo a favor.»" telefono />
7. Toca <Boton>Registrar ajuste</Boton>.

## Con trabajo o sin trabajo

- **Con trabajo**, el ajuste cambia lo que se debe por ese trabajo. Su ficha lo explica: «Incluye ajustes de − $ 40.00: se cobra $ 55.00 en vez de $ 95.00».
  - Un **descuento** que cubre lo que faltaba deja el trabajo **Cobrado**.
  - Un **recargo** a un trabajo **Cobrado** lo devuelve a **Entregado**, y vuelve a salir en **Por cobrar**.
- **Sin trabajo**, el ajuste solo mueve el saldo de la clínica. Cuenta en la antigüedad desde su fecha.

### Un descuento sobre lo ya pagado

Si el trabajo ya tiene pagos y el descuento es mayor que lo que debe, sobra dinero. El diálogo lo dice antes de confirmar: «$ 5.00 de lo ya pagado por este trabajo vuelven al saldo a favor.». En el ejemplo, el trabajo debía $ 35.00 y el descuento es de $ 40.00.

Ese dinero no se pierde: vuelve al pago de donde salió, como saldo a favor de la clínica. Dentalware no lo aplica solo: aplícalo a otro trabajo con <Boton>Aplicar saldo a favor</Boton>, como cuenta [Cuentas y pagos](../recepcion/cuentas-y-pagos.md#pasos-para-aplicar-el-saldo-a-favor).

## Pasos para cargar el saldo inicial

El saldo inicial es lo que una clínica ya debía antes de empezar a usar Dentalware. Se registra una sola vez, como un recargo sin trabajo.

1. En la cuenta de la clínica, toca <Boton>Registrar ajuste</Boton>.
2. Toca <Boton>Saldo inicial</Boton>, junto a **Motivo**. Elige **Recargo**, deja **Sin trabajo: solo la clínica** y escribe «Saldo inicial» en el motivo.
3. Escribe el **Monto**: lo que debía la clínica.
4. Cambia la **Fecha** a la de esa deuda, si la sabes: la antigüedad de la cuenta cuenta los días desde ahí.
   <Captura nombre="administracion/saldo-inicial" alt="Diálogo Registrar ajuste tras tocar Saldo inicial: Recargo elegido, monto $ 120.00, fecha 20/10/2026, Trabajo «Sin trabajo: solo la clínica» y motivo «Saldo inicial»" telefono />
5. Toca <Boton>Registrar ajuste</Boton>.

## Pasos para anular un pago

Si un pago se registró mal (otro monto, otra clínica, registrado dos veces), anúlalo y registra después el correcto. Un pago nunca se edita ni se borra.

1. En la cuenta de la clínica, abre la pestaña **Movimientos**.
2. En el pago, toca <Boton>Anular pago</Boton>.
3. Lee qué va a pasar. Arriba, el pago («$ 80.00 · Transferencia del 20/10/2026»). Debajo, qué se les quita a sus trabajos: «Se quita lo aplicado a 26-00012 ($ 60.00).». Si alguno estaba **Cobrado**, también dice «Vuelve a «Entregado»: …». Si el pago no estaba aplicado a ningún trabajo, lo dice.
4. Escribe el **Motivo**: es obligatorio.
   <Captura nombre="administracion/anular-pago" alt="Diálogo Anular pago de $ 80.00 por transferencia del 20/10/2026 de Clínica Sonrisa Norte: se quita lo aplicado a 26-00012 ($ 60.00), con el motivo «Se registró con el monto equivocado» y el botón rojo Anular pago" telefono />
5. Toca <Boton>Anular pago</Boton>, el botón rojo.

:::warning Importante
Anular un pago no tiene vuelta atrás. Si te equivocaste de pago, registra uno nuevo con <Boton>Registrar pago</Boton>.
:::

## Qué pasa después

- **El ajuste** sale en **Movimientos** con su motivo, el código del trabajo si lo tiene y quién lo registró. Si devolvió dinero al saldo a favor, el motivo lo dice al final. El trabajo lo cuenta en su **Historial**, con el monto y el motivo.
- **El pago anulado** sigue en **Movimientos**, tachado y con «Anulado por …» y el motivo. Ya no cuenta: el saldo sube por su monto y sus trabajos vuelven a deber lo que tenían aplicado. Lo que le quedaba a favor también se va. Cada trabajo lo cuenta en su **Historial**.
- **En el estado de cuenta**, el pago anulado sale tachado, con «Anulado» y «No suma», sin quién lo anuló ni por qué. Ver [Imprimir](../recepcion/imprimir.md).

:::info Ajustes sin vuelta atrás
Un ajuste tampoco se edita ni se borra. Si te equivocaste, registra otro al revés: un recargo por el mismo monto deshace un descuento, y al revés. Usa el motivo para decir qué corrige.
:::

:::info Estados de cuenta ya impresos
Un pago anulado deja de sumar también en las fechas pasadas. Si ya imprimiste un estado de cuenta que lo incluía, el saldo de ese periodo cambia: vuelve a imprimirlo antes de mandarlo.
:::

## Problemas frecuentes

- **«Elige si es un descuento o un recargo»:** falta el **Tipo**.
- **«Escribe el motivo»:** el motivo es obligatorio, tanto en un ajuste como al anular un pago.
- **«La fecha no puede ser posterior a hoy»:** un ajuste se registra cuando ya pasó. Cambia la **Fecha** a hoy o antes.
- **«El descuento supera lo que vale el trabajo; regístralo sin trabajo»:** un descuento ligado a un trabajo no puede dejarlo valiendo menos de cero. Descuenta como mucho lo que vale y registra el resto sin trabajo.
- **No encuentro el trabajo en la lista:** solo salen los trabajos entregados o cobrados de esa clínica. Un trabajo que aún no se entrega no carga a la cuenta.
- **«El pago ya está anulado»:** otra persona lo anuló antes. La cuenta se actualiza sola.
- **No veo Registrar ajuste ni Anular pago:** son solo del rol Administrador. Recepción no los ve.
