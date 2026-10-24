---
title: Avanzar fase
description: Marcar en qué fase de producción va un trabajo, volver a la anterior con un motivo y subir las fotos del trabajo.
sidebar_position: 3
---

# Avanzar fase

Mientras un trabajo está **En proceso**, pasa por las fases del laboratorio. Cada vez que terminas una, la marcas en la ficha: así recepción sabe en qué va sin preguntarte.

## Quién puede hacerlo

<Rol roles={['admin', 'recepcion', 'tecnico']} />

Las fases las define administración en **Configuración › Fases**. En el laboratorio de ejemplo son Recepción, Modelo, Diseño, Estructura, Cerámica/Acrílico, Acabado y Control de calidad. Un trabajo empieza en la primera cuando recepción lo acepta.

## Pasos para avanzar de fase

1. Abre el trabajo desde **Mis trabajos** (ver [Mis trabajos](./mis-trabajos.md)).
2. Bajo la cabecera está el panel **Producción**: la **Fase** en que va el trabajo, <Boton>Avanzar fase</Boton> (en verde, el botón principal) y <Boton>Retroceder fase</Boton>, el **Técnico responsable** y, al pie, <Boton>Finalizar</Boton>.
   <Captura nombre="tecnico/ficha-produccion" alt="Panel Producción del trabajo de C. V.: fase Diseño con Avanzar fase y Retroceder fase, técnico responsable Diego Técnico y Finalizar al pie" telefono />
3. Toca <Boton>Avanzar fase</Boton>. Se hace al momento, sin confirmación: el panel muestra la fase nueva y un aviso lo confirma, por ejemplo «Fase: Estructura».

## Pasos para volver a la fase anterior

Si hay que rehacer una etapa (por ejemplo, el diseño no encaja con el modelo), vuelve a la fase anterior. Pide un motivo, que queda en el historial.

1. En el panel **Producción**, toca <Boton>Retroceder fase</Boton>.
2. El diálogo dice a qué fase vuelve el trabajo. Escribe el **Motivo**.
   <Captura nombre="tecnico/avanzar-fase-motivo" alt="Diálogo Retroceder fase: el trabajo vuelve a Modelo, con el motivo escrito «El color no coincide con la guía», y los botones Retroceder fase y Volver" telefono />
3. Toca <Boton>Retroceder fase</Boton> para confirmarlo, o <Boton>Volver</Boton> para cerrar sin cambiar nada.

## Pasos para subir fotos del trabajo

1. En la ficha, toca la pestaña **Adjuntos**.
2. Toca <Boton>Añadir foto</Boton> para tomarla con la cámara del teléfono, o <Boton>Subir archivo</Boton> para elegir una foto o un PDF ya guardado.
   <Captura nombre="tecnico/ficha-adjuntos-anadir-foto" alt="Pestaña Adjuntos del trabajo de C. V., todavía sin fotos ni documentos, con los botones Añadir foto y Subir archivo" solo="telefono" />
3. Un aviso confirma la subida («Foto añadida») y la foto queda en **Adjuntos**, a la vista de todos los que abran el trabajo.

## Qué pasa después

Cada cambio de fase queda en el **Historial** de la ficha, con tu nombre y, si retrocediste, el motivo. **Mis trabajos** y la ficha muestran la fase nueva al momento.

En la última fase, <Boton>Avanzar fase</Boton> desaparece y el panel avisa de que es la última: lo que sigue es <Boton>Finalizar</Boton> (ver [Finalizar](./finalizar.md)).

:::tip Consejo
Si algo del trabajo hay que contarlo (una duda sobre el color, una pieza que llegó dañada), deja un comentario en la pestaña **Historial** con <Boton>Comentar</Boton>: recepción lo ve en la ficha.
:::

## Problemas frecuentes

- **No veo Avanzar fase:** la fase solo cambia con el trabajo **En proceso**. Si está **En espera** o **En prueba**, el panel dice por qué (ver [Pruebas y espera](./pruebas-y-espera.md)). Si está en la última fase, lo que sigue es <Boton>Finalizar</Boton>.
- **Retroceder fase está desactivado:** el trabajo está en la primera fase; no hay una anterior.
- **«La fase en la que estaba este trabajo ya no está activa…»:** administración desactivó esa fase con el trabajo dentro. Pide que la reactive en **Configuración › Fases**.
- **No puedo borrar una foto que subí:** borrar adjuntos es de administración y recepción. Pídeselo a recepción.
