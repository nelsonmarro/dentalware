---
title: No se pudo
description: Avisar que una recogida o entrega no se pudo hacer, con el motivo y la nueva fecha.
sidebar_position: 4
---

# No se pudo

Si llegas a la clínica y no puedes recoger o entregar (estaba cerrada, no había nadie para recibir, la dirección estaba mal…), lo marcas con el motivo y eliges cuándo volver.

## Quién puede hacerlo

<Rol roles={['admin', 'recepcion', 'mensajero']} />

El mensajero, solo en sus propias recogidas y entregas.

## Pasos

1. En **Entregas** (o en **Inicio**), en la tarjeta del trabajo, toca <Boton>No se pudo</Boton>.
2. El diálogo se titula **No se pudo entregar** (o **No se pudo recoger**) y nombra el trabajo y la clínica. Elige un motivo frecuente: **Clínica cerrada**, **Nadie para recibir**, **Dirección incorrecta** o **Falta pago**. El elegido lleva una marca y su texto pasa al **Motivo**, donde puedes cambiarlo o escribir otro.
3. Revisa la **Nueva fecha**: por omisión, el siguiente día hábil (aquí, el miércoles 21). Puede ser hoy si vas a volver más tarde, pero no un día pasado.
   <Captura nombre="mensajero/no-se-pudo-dialogo" alt="Diálogo No se pudo entregar de 26-00010 en Clínica Sonrisa Norte: motivo Nadie para recibir elegido, nueva fecha 21/10/2026 y los botones Reprogramar y Volver" telefono />
4. Toca <Boton>Reprogramar</Boton>, o <Boton>Volver</Boton> para no hacer nada.

## Qué pasa después

La tarjeta queda **Fallida**, con el motivo y la nueva fecha, y se programa otra recogida o entrega para esa fecha, contigo como mensajero. Si la nueva fecha es hoy, sale en tu ruta de hoy, como la entrega de «G. H.» en Centro Dental Los Álamos. El trabajo no cambia de estado: una entrega sigue **Enviado** y una recogida, **Por recoger**.

<Captura nombre="mensajero/entrega-fallida" alt="Tarjeta Fallida de la entrega de G. H.: motivo La clínica estaba cerrada, nueva fecha 20/10/2026" solo="telefono" />

Recepción lo ve en su pantalla **Entregas** (el resumen del día cuenta la fallida) y en el historial del trabajo. Si avisas a recepción por teléfono, también puede marcarlo por ti: lo explica [Recogidas y entregas](../recepcion/recogidas-y-entregas.md).

## Problemas frecuentes

- **«Escribe el motivo»:** el motivo es obligatorio. Toca un motivo frecuente o escríbelo.
- **No me sale No se pudo:** la recogida o entrega ya está cerrada, o es de otro mensajero.
