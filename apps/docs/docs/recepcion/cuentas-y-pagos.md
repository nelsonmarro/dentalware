---
title: Cuentas y pagos
description: Ver cuánto debe cada clínica y desde cuándo, registrar sus pagos y aplicar el saldo a favor.
sidebar_position: 7
---

# Cuentas y pagos

Cada trabajo entregado pasa a la cuenta de su clínica. En **Cuentas** ves cuánto debe cada una y desde cuándo, registras los pagos que llegan y repartes cada pago entre los trabajos que cubre.

## Quién puede hacerlo

<Rol roles={['admin', 'recepcion']} />

## Pasos para ver lo que debe una clínica

1. Abre **Cuentas** en el menú. Salen las clínicas con movimientos, de la que más debe a la que menos, con su **Saldo**, cuánto de él tiene cada antigüedad (0–30, 31–60, 61–90 y más de 90 días) y los días de lo **Más antiguo**. Con **Ver todas las clínicas** aparecen también las que no tienen nada.
   <Captura nombre="recepcion/cuentas-lista" alt="Lista Cuentas: Clínica Sonrisa Norte debe $ 185.00, Centro Dental Los Álamos $ 35.00 con 40 días, y Consultorio Dra. Paredes $ 0.00" telefono />
2. Toca el nombre de la clínica, por ejemplo **Clínica Sonrisa Norte**. Arriba están sus botones y el **Saldo**: lo que debe en total, ya descontado lo que tiene a favor («Ya descuenta $ 20.00 a favor sin aplicar»), los días de lo más antiguo y la barra de antigüedad.
   <Captura nombre="recepcion/cuenta-cabecera" alt="Saldo de Clínica Sonrisa Norte: $ 185.00, ya descuenta $ 20.00 a favor sin aplicar, más antiguo 0 días, todo en 0–30 días" telefono />
3. Debajo, la pestaña **Por cobrar** lista los trabajos entregados que no están pagados del todo, con lo **Pagado** y lo **Pendiente** de cada uno, y cierra con el desglose del saldo. **Movimientos** tiene cada cargo, pago y ajuste de la clínica.

## Pasos para registrar un pago

1. En la cuenta de la clínica, toca <Boton>Registrar pago</Boton>.
2. Escribe el **Monto** y elige el **Método** (Efectivo, Transferencia, Tarjeta, Cheque u Otro). Revisa la **Fecha**, que no puede ser posterior a hoy, y, si quieres, la **Referencia** (el número de la transferencia o del cheque) y unas **Notas**.
3. En **A qué trabajos se aplica**, Dentalware reparte el monto solo, de la entrega más antigua a la más nueva. Bajo cada monto dice qué le pasará a ese trabajo: «Queda cobrado», «Quedará debiendo $ …» o «Supera lo que debe en $ …». Puedes cambiar cada monto. Al pie, «Aplicado $ … · Queda a favor $ …» suma lo repartido.
   <Captura nombre="recepcion/registrar-pago" alt="Diálogo Registrar pago de $ 100.00 por transferencia: 26-00012 recibe $ 35.00 y queda cobrado; 26-00013 recibe $ 65.00 y quedará debiendo $ 105.00" telefono />
4. Toca <Boton>Registrar pago</Boton>. Un aviso dice qué trabajos quedaron cobrados («Pago registrado: cobrado 26-00012») y, si sobró, cuánto queda a favor.

## Pasos para aplicar el saldo a favor

1. Si la clínica tiene saldo a favor y trabajos por cobrar, toca <Boton>Aplicar saldo a favor</Boton> en su cuenta. Se abre con el pago más antiguo al que le queda algo; también lo encuentras en ese pago, en **Movimientos**.
2. El diálogo dice de qué pago sale («$ 80.00 · Transferencia del 20/10/2026») y cuánto le queda («Le quedan $ 20.00 a favor»), y reparte lo que queda como al registrar un pago. Cambia los montos si hace falta.
   <Captura nombre="recepcion/aplicar-saldo" alt="Diálogo Aplicar saldo a favor: al pago de $ 80.00 le quedan $ 20.00, que van a 26-00012, que quedará debiendo $ 15.00" telefono />
3. Toca <Boton>Aplicar saldo a favor</Boton>.

## Qué es el saldo a favor

Es la parte de un pago que no se aplicó a ningún trabajo: un anticipo, o una clínica que pagó de más. No se pierde: el saldo de la clínica ya lo descuenta, y queda guardado en ese pago hasta que lo apliques a un trabajo con <Boton>Aplicar saldo a favor</Boton>. Dentalware no lo aplica solo.

## Qué pasa después

Un trabajo cuyo pendiente llega a cero pasa solo a **Cobrado**: no hay un botón para cobrarlo a mano. El pago queda en **Movimientos** con los trabajos a los que se aplicó («Aplicado a 26-00012 ($ 35.00)…»), y cada trabajo lo cuenta en su **Historial**. La ficha de cada trabajo entregado dice cuánto falta por cobrar o cuándo se cobró.

Para enviar a la clínica el detalle de un periodo, toca <Boton>Estado de cuenta</Boton>: lo explica [Imprimir](./imprimir.md).

:::info Ajustes y pagos anulados
<Boton>Registrar ajuste</Boton> (descuentos, recargos y el saldo inicial de una clínica) y <Boton>Anular pago</Boton> son solo de administración. Si un pago se registró mal, pídele a administración que lo anule: un pago nunca se edita ni se borra.
:::

## Problemas frecuentes

- **«Lo aplicado no puede superar el monto del pago»:** los montos del reparto suman más que el pago. Baja alguno.
- **«Elige un método de pago»:** falta el **Método**.
- **No aparece Aplicar saldo a favor:** la clínica no tiene saldo a favor sin aplicar, o no tiene trabajos por cobrar.
