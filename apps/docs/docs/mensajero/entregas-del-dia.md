---
title: Las entregas del día
description: Ver la ruta del día por clínica, abrir la dirección en el mapa, llamar a la clínica y marcar lo que recoges.
sidebar_position: 2
---

# Las entregas del día

**Entregas** es la ruta del día: las recogidas y entregas que te tocan, agrupadas por clínica. Desde ahí llegas a cada clínica, la llamas y marcas lo que recoges.

## Quién puede hacerlo

<Rol roles={['admin', 'recepcion', 'mensajero']} />

El mensajero solo ve las suyas. Recepción ve las de todos los mensajeros (lo explica [Recogidas y entregas](../recepcion/recogidas-y-entregas.md)).

## Pasos para ver la ruta

1. Toca **Entregas** en la barra de abajo. Arriba está el día («Hoy · martes, 20 de octubre»): con las flechas pasas al día anterior o al siguiente, y <Boton>Hoy</Boton> vuelve a hoy. Debajo, el resumen del día: «3 pendientes · 1 en camino · 2 hechas · 1 fallida».
   <Captura nombre="mensajero/entregas-del-dia" alt="Pantalla Entregas de Marco Mensajero del martes 20 de octubre: resumen del día y las paradas de Centro Dental Los Álamos, Clínica Sonrisa Norte y Consultorio Dra. Paredes" telefono />
2. Cada clínica es una parada, en orden alfabético. Toca la dirección para abrirla en el mapa (se abre en otra pestaña) y el teléfono para llamar a la clínica.
3. Debajo van sus trabajos. Cada tarjeta dice si es **Recogida** o **Entrega**, el código del trabajo y el paciente, y las pendientes llevan sus botones: <Boton>Recogido</Boton> o <Boton>Marcar entregado</Boton>, y <Boton>No se pudo</Boton>. Lo que queda por hacer va primero y lo ya hecho, al final.
   <Captura nombre="mensajero/tarjeta-recogida" alt="Parada de Clínica Sonrisa Norte: dirección, teléfono, la recogida de M. P. con Recogido y No se pudo, la entrega de D. F. con Marcar entregado y No se pudo, y la entrega hecha de S. L." solo="telefono" />

En **Inicio** tienes lo mismo en corto: solo lo que te queda por hacer hoy, con los mismos botones, y **Ver todas** para abrir **Entregas**. Las pendientes de días anteriores también salen hoy, con **Atrasada**.

Tocar el código de una tarjeta abre la ficha corta del trabajo (ver [Marcar entregado](./marcar-entregado.md)).

## Pasos para marcar una recogida

1. En la clínica, con el trabajo en la mano, busca su tarjeta de **Recogida** (aquí, la de «M. P.» en Clínica Sonrisa Norte).
2. Toca <Boton>Recogido</Boton>. Es un solo toque: no pide foto ni confirmación.
   <Captura nombre="mensajero/recogido-boton" alt="Botón Recogido de la tarjeta de M. P." solo="telefono" />
3. La tarjeta pasa a **En camino al laboratorio** y dice quién lo recogió y a qué hora, como la de «T. W.»: «Recogido por Marco Mensajero a las 10:30».
   <Captura nombre="mensajero/en-camino" alt="Tarjeta de la recogida de T. W.: En camino al laboratorio, recogido por Marco Mensajero a las 10:30; recepción lo marca como recibido al llegar al laboratorio" solo="telefono" />

## Qué pasa después

El trabajo sigue **Por recoger** mientras va en camino. Cuando llega al laboratorio, recepción toca **Recibido** y el trabajo pasa a **Nuevo**: tú no tienes que hacer nada más. Hasta entonces la tarjeta sigue en **Entregas** (también al día siguiente, si no llegó), con la nota «Recepción lo marca como recibido al llegar al laboratorio.».

:::info Precios
El mensajero nunca ve precios, saldos ni notas internas: ni en **Entregas**, ni en la ficha del trabajo.
:::

## Problemas frecuentes

- **No me sale una recogida o entrega:** revisa el día de arriba (<Boton>Hoy</Boton> vuelve a hoy). Si sigue sin salir, es de otro mensajero o recepción aún no la programó: pregunta a recepción.
- **No me sale el botón Recibido:** es de recepción. Tú marcas <Boton>Recogido</Boton> en la clínica; recepción marca **Recibido** cuando el trabajo llega.
- **La clínica no estaba o no tenía el trabajo:** toca <Boton>No se pudo</Boton> (ver [No se pudo](./no-se-pudo.md)).
