---
title: Recogidas y entregas
description: Programar la recogida de un trabajo, marcarlo recibido, enviarlo con el mensajero y seguir las entregas del día.
sidebar_position: 5
---

# Recogidas y entregas

El mensajero va a las clínicas a buscar trabajos (recogidas) y a llevarlos ya terminados (entregas). Recepción las programa, marca lo que llega al laboratorio y sigue en **Entregas** qué queda pendiente cada día.

## Quién puede hacerlo

<Rol roles={['admin', 'recepcion']} />

## Pasos para una recogida

1. Programa la recogida al registrar el trabajo: en el formulario de [Crear un trabajo](./crear-un-trabajo.md), abre <Boton>Programar recogida</Boton> y elige el mensajero y la fecha. El trabajo queda **Por recoger** y aparece en **Entregas** ese día, a nombre de ese mensajero.
2. Cuando el mensajero lo recoge, lo marca en su teléfono. El trabajo sigue **Por recoger**, pero la ficha y **Entregas** dicen **En camino al laboratorio**, quién lo recogió y a qué hora (aquí, «Recogido por Marco Mensajero a las 10:30»).
3. Cuando el trabajo llega al laboratorio, ábrelo y toca <Boton>Recibido</Boton> en el panel **Recogida** (o en su tarjeta de **Entregas**). Pasa a **Nuevo** y entra en producción.
   <Captura nombre="recepcion/ficha-recibido" alt="Panel Recogida del trabajo de T. W.: En camino al laboratorio, recogido por Marco Mensajero a las 10:30, con los botones Recibido y Cancelar trabajo" telefono />

Si la clínica trae el trabajo en mano antes de que pase el mensajero, toca igual <Boton>Recibido</Boton>: la recogida pendiente se cierra sola.

## Pasos para una entrega

1. Abre un trabajo **Terminado** (como el de «P. Q.») y toca <Boton>Marcar enviado</Boton> en el panel **Entrega**.
2. Elige el **Mensajero** y revisa la **Fecha de entrega** (por omisión, hoy). Arriba, el diálogo dice qué va a pasar: «El trabajo sale del laboratorio con Marco Mensajero el 20/10/2026.». Toca <Boton>Marcar enviado</Boton>, o <Boton>Volver</Boton> para no hacer nada.
   <Captura nombre="recepcion/accion-marcar-enviado" alt="Diálogo Marcar enviado con el mensajero Marco Mensajero, la fecha de entrega y los botones Volver y Marcar enviado" telefono />
3. El trabajo pasa a **Enviado** y la entrega aparece en **Entregas** ese día, para ese mensajero.
4. En la clínica, el mensajero toca <Boton>Marcar entregado</Boton> y toma la foto de la constancia. Si te lo pide, puedes marcarlo tú desde la ficha o desde **Entregas**: el diálogo no deja confirmar sin la **Foto de constancia**.

## Las entregas del día

Abre **Entregas** en el menú. Arriba está el día (con las flechas pasas al anterior o al siguiente, y <Boton>Hoy</Boton> vuelve a hoy), el filtro por mensajero y el resumen: «4 pendientes · 1 en camino · 3 hechas · 1 fallida». Debajo van las recogidas y entregas agrupadas por clínica, con la dirección (se abre en el mapa) y el teléfono. Cada tarjeta dice si es **Recogida** o **Entrega**, el código, el paciente y el mensajero, y las pendientes llevan su botón: <Boton>Recibido</Boton> en una recogida, <Boton>Marcar entregado</Boton> en una entrega, y <Boton>No se pudo</Boton>.

<Captura nombre="recepcion/entregas-dia" alt="Pantalla Entregas del martes 20 de octubre: resumen del día y la tarjeta de Centro Dental Los Álamos con una entrega pendiente" telefono />

Hoy salen también las pendientes de días anteriores y las recogidas que siguen en camino al laboratorio.

## Qué pasa después

Al marcar **Recibido**, el trabajo pasa a **Nuevo** y queda listo para <Boton>Aceptar</Boton>. Al marcar **Entregado**, el trabajo pasa a la cuenta de la clínica, que lo debe hasta que se registre su pago (ver [Cuentas y pagos](./cuentas-y-pagos.md)), y la foto queda en sus **Adjuntos** como **Constancia de entrega**.

Si el mensajero no puede recoger o entregar (la clínica estaba cerrada, no había nadie…), toca <Boton>No se pudo</Boton>, elige o escribe el motivo y la **Nueva fecha** (por omisión, el siguiente día hábil). La tarjeta queda **Fallida** con el motivo, y la recogida o entrega se vuelve a programar para esa fecha, como la del trabajo de «G. H.». Normalmente lo marca el propio mensajero desde la calle; recepción también puede hacerlo si él avisa por teléfono. Cómo lo hace el mensajero lo explica [No se pudo](../mensajero/no-se-pudo.md), en su sección de este manual.

:::warning Importante
<Boton>Marcar entregado</Boton> no tiene vuelta: el trabajo pasa a la cuenta de la clínica con la fecha de hoy. Confírmalo solo con el trabajo ya en la clínica.
:::

## Problemas frecuentes

- **No veo una recogida o entrega en Entregas:** revisa el día de arriba y el filtro de mensajero («Todos los mensajeros»).
- **El botón Marcar entregado del diálogo está desactivado:** falta la **Foto de constancia**. Tómala o elígela y se activa.
