---
title: Marcar entregado
description: Cerrar una entrega en la clínica con la foto de la constancia, desde Entregas o desde la ficha corta del trabajo.
sidebar_position: 3
---

# Marcar entregado

Cuando dejas un trabajo terminado en la clínica, lo marcas como entregado con una foto de la constancia (la orden firmada o el sobre recibido). Sin la foto no se puede marcar.

## Quién puede hacerlo

<Rol roles={['admin', 'recepcion', 'mensajero']} />

El mensajero, solo en sus propias entregas.

## Pasos

1. En **Entregas** (o en **Inicio**), busca la tarjeta de **Entrega** del trabajo, como la de «D. F.» en Clínica Sonrisa Norte, y toca <Boton>Marcar entregado</Boton>.

   También puedes tocar el código de la tarjeta: se abre la ficha corta del trabajo, que dice qué hacer y dónde («Entregar hoy en Clínica Sonrisa Norte»), con la dirección, el teléfono y el botón <Boton>Marcar entregado</Boton> en grande. Es la misma pantalla que abre el QR de la orden impresa.
   <Captura nombre="mensajero/ficha-corta" alt="Ficha corta del trabajo 26-00010 de D. F., Enviado: Entregar hoy en Clínica Sonrisa Norte, con la dirección, el teléfono y el botón Marcar entregado" solo="telefono" />

2. En el diálogo, toca <Boton>Tomar foto de constancia</Boton>: se abre la cámara. Toma la foto.
3. Revisa la miniatura: el diálogo dice «Foto lista» y «Se sube al marcar entregado.». Si salió mal, toca <Boton>Cambiar foto</Boton>.
   <Captura nombre="mensajero/marcar-entregado-dialogo" alt="Diálogo Marcar entregado de 26-00010 en Clínica Sonrisa Norte, con la foto lista y los botones Marcar entregado y Volver" telefono />
4. Toca <Boton>Marcar entregado</Boton>, o <Boton>Volver</Boton> para no hacer nada (la foto no se sube).

:::warning Importante
<Boton>Marcar entregado</Boton> no tiene vuelta: no hay ninguna acción para deshacerlo. Márcalo solo con el trabajo ya en manos de la clínica.
:::

## Qué pasa después

La foto se sube y queda en el trabajo como **Constancia de entrega**. El trabajo pasa a **Entregado** (o directamente a **Cobrado**, si no había nada que cobrar) y la tarjeta queda como **Hecha**, al final de su parada. Recepción lo ve en su pantalla **Entregas** y en la ficha del trabajo, con la foto.

## Problemas frecuentes

- **El botón Marcar entregado del diálogo está desactivado:** falta la foto. Toca <Boton>Tomar foto de constancia</Boton>.
- **No me sale Marcar entregado en un trabajo:** la entrega es de otro mensajero o el trabajo no está enviado. La ficha corta lo dice, por ejemplo «Esta entrega la tiene Lucía Mensajera.».
- **No pude dejar el trabajo:** no lo marques entregado. Toca <Boton>No se pudo</Boton> (ver [No se pudo](./no-se-pudo.md)).
- **Estoy sin señal:** márcalo igual y deja la app abierta: se envía al volver la señal (ver [Sin señal](./sin-senal.md)).
