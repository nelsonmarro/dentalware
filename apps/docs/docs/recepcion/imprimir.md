---
title: Imprimir
description: Imprimir la orden de un trabajo, en su copia del laboratorio y de la clínica, y el estado de cuenta de una clínica.
sidebar_position: 8
---

# Imprimir

Dentalware imprime dos papeles: la **orden de trabajo**, que acompaña al trabajo por el laboratorio y llega a la clínica, y el **estado de cuenta**, con los cargos y pagos de una clínica en un periodo.

## Quién puede hacerlo

<Rol roles={['admin', 'recepcion']} />

El técnico y el mensajero también imprimen la orden, pero solo la copia del laboratorio, sin precios.

## Pasos para imprimir la orden

1. Abre la [ficha del trabajo](./la-ficha-del-trabajo.md) y toca <Boton>Imprimir</Boton>, arriba a la derecha.
2. En **Copia a imprimir**, elige **Ambas**, **Laboratorio** o **Clínica**. La copia del laboratorio va sin precios; la de la clínica, con precios. Con **Ambas** salen dos hojas.
   <Captura nombre="recepcion/imprimir-orden" alt="Orden de trabajo 26-00004: los botones Volver al trabajo e Imprimir, la elección de copia y la copia laboratorio con el código QR" telefono />
3. Toca <Boton>Imprimir</Boton> y elige la impresora en la ventana del navegador. Con <Boton>Volver al trabajo</Boton> regresas a la ficha.

La orden lleva los datos del laboratorio, el código del trabajo con un código QR que lleva al trabajo en Dentalware, el paciente, las fechas, el color, el odontograma con las piezas marcadas, las líneas y espacio para las firmas.

## Pasos para imprimir el estado de cuenta

1. Abre **Cuentas**, entra a la clínica (por ejemplo, **Clínica Sonrisa Norte**) y toca <Boton>Estado de cuenta</Boton>.
2. Elige el periodo con **Desde** y **Hasta** y toca <Boton>Ver periodo</Boton>. Por omisión es el mes en curso, hasta hoy; **Hasta** no puede ser posterior a hoy.
   <Captura nombre="recepcion/estado-de-cuenta" alt="Estado de cuenta de Clínica Sonrisa Norte del 01/10/2026 al 20/10/2026: periodo, botón Imprimir, resumen del periodo y movimientos" telefono />
3. Revisa el estado: el **Resumen del periodo** (saldo al inicio, cargos, ajustes, pagos y saldo al final), los **Movimientos** con el saldo de cada uno y, al final, lo que queda por cobrar. Toca <Boton>Imprimir</Boton>.

## Qué pasa después

Los botones y el periodo no salen en el papel: solo la orden o el estado de cuenta. Para enviarlo por correo o WhatsApp, en la ventana de impresión elige guardar como PDF.

:::info El estado de cuenta va a la clínica
Un pago anulado sale tachado, con «Anulado», y no suma; quién lo anuló y por qué no salen en el papel.
:::

## Problemas frecuentes

- **«La fecha final no puede ser posterior a hoy»:** **Hasta** es una fecha futura. Pon hoy o una fecha anterior.
- **«La fecha final no puede ser anterior a la inicial»:** **Desde** va después de **Hasta**. Cámbialas.
