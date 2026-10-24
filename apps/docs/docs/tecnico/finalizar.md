---
title: Finalizar
description: Terminar un trabajo en su última fase, qué pide la confirmación y cómo imprimir la orden del laboratorio.
sidebar_position: 5
---

# Finalizar

Cuando el trabajo pasó por todas sus fases y está listo para entregar, lo finalizas: pasa a **Terminado** y recepción organiza la entrega.

## Quién puede hacerlo

<Rol roles={['admin', 'recepcion', 'tecnico']} />

## Pasos

1. Abre el trabajo desde **Mis trabajos**. En la última fase, el panel **Producción** avisa de que es la última y <Boton>Finalizar</Boton> es el botón principal, en verde, como en el trabajo de «L. T.» en Control de calidad.
   <Captura nombre="tecnico/finalizar-ultima-fase" alt="Panel Producción del trabajo de L. T.: fase Control de calidad, el aviso «Es la última fase», Retroceder fase, técnico responsable Diego Técnico y Finalizar en verde" telefono />
2. Toca <Boton>Finalizar</Boton>. Pide confirmación, porque no tiene vuelta: el trabajo pasará a **Terminado** con la fecha de hoy.
   <Captura nombre="tecnico/finalizar-confirmacion" alt="Confirmación Finalizar: el trabajo pasará a Terminado con la fecha de hoy y no hay ninguna acción para devolverlo a En proceso; botones Finalizar y Volver" telefono />
3. Toca <Boton>Finalizar</Boton> otra vez para confirmar, o <Boton>Volver</Boton> para dejarlo como está. Un aviso dice «Trabajo finalizado».

<Boton>Finalizar</Boton> también está en las fases anteriores, al pie del panel, como botón secundario (sin relleno): solo úsalo si el trabajo de verdad está terminado, porque las fases que faltaban ya no se marcan.

## Pasos para imprimir la orden

La orden impresa acompaña al trabajo por el laboratorio. Puedes imprimirla en cualquier momento, no solo al finalizar.

1. En la ficha, toca <Boton>Imprimir</Boton>, arriba.
2. Sale la **Copia laboratorio**: los datos del laboratorio, el código con su código QR, el paciente, las fechas, el color, el odontograma con las piezas marcadas, las líneas y las firmas. No lleva precios.
   <Captura nombre="tecnico/imprimir-laboratorio" alt="Orden de trabajo 26-00005 de L. T., Copia laboratorio: Laboratorio Demo, código QR, paciente, fechas, color, odontograma con la pieza 46 marcada y líneas, sin precios" />
3. Toca <Boton>Imprimir</Boton> y elige la impresora. Con <Boton>Volver al trabajo</Boton> regresas a la ficha.

## Qué pasa después

El trabajo sale de **Mis trabajos** y aparece en la vista «Listos» de **Trabajos**. Recepción lo envía a la clínica con el mensajero (ver [Recogidas y entregas](../recepcion/recogidas-y-entregas.md)). El cambio queda en el **Historial** con tu nombre.

:::warning Importante
<Boton>Finalizar</Boton> no tiene vuelta: no hay ninguna acción para devolver un trabajo **Terminado** a **En proceso**. Si no estás seguro, toca <Boton>Volver</Boton>.
:::

:::info Solo la copia del laboratorio
Administración y recepción eligen entre la copia del laboratorio y la de la clínica, que lleva precios. El técnico imprime solo la del laboratorio (ver [Imprimir](../recepcion/imprimir.md)).
:::

## Problemas frecuentes

- **No me sale Finalizar:** el trabajo no está **En proceso**. Si está **En espera** o **En prueba**, recepción tiene que reanudarlo o recibirlo de la prueba primero (ver [Pruebas y espera](./pruebas-y-espera.md)).
- **Finalicé un trabajo por error:** queda **Terminado** y sigue su camino a la entrega. No crees otro: deja un comentario en el **Historial** y avisa a recepción.
- **No veo el total en la orden:** la copia del laboratorio nunca lleva precios. La de la clínica la imprime recepción.
