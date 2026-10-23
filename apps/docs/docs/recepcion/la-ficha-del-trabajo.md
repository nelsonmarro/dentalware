---
title: La ficha del trabajo
description: Qué hay en la ficha de un trabajo (cabecera, panel de la fase, detalle, adjuntos e historial) y cómo editarlo.
sidebar_position: 3
---

# La ficha del trabajo

La ficha reúne todo lo de un trabajo: de quién es, en qué estado y fase está, quién lo hace, sus fotos y todo lo que le ha pasado. Se abre tocando el código del trabajo en cualquier lista.

## Quién puede hacerlo

<Rol roles={['admin', 'recepcion']} />

El técnico y el mensajero también abren la ficha, pero sin precios ni notas internas, y solo con las acciones de su rol.

## Pasos

1. Abre **Trabajos** y toca el código del trabajo (por ejemplo, 26-00004, del paciente «A. S.»). Puedes buscarlo por código, paciente o caja.
2. Arriba está la **cabecera**: el código, el estado (aquí, «En proceso»), la clínica y el doctor, el botón <Boton>Avisar por WhatsApp</Boton> y, a la derecha, <Boton>Imprimir</Boton> y <Boton>Editar</Boton>. Debajo, el paciente y las fechas: **Ingreso** (cuando llegó), **Deseada** (la que pidió la clínica) y **Comprometida** (la que fijó el laboratorio al aceptarlo), y el **Total**.
   <Captura nombre="recepcion/ficha-cabecera" alt="Cabecera de la ficha 26-00004 En proceso, de Clínica Sonrisa Norte, con paciente, fechas y total" telefono />
3. Debajo está el panel de la fase en que va el trabajo. Se llama **Recogida** mientras el trabajo no llega al laboratorio, **Producción** mientras se hace y **Entrega** desde que se termina. En **Producción** se ve la **Fase** (Recepción, Modelo…) con <Boton>Avanzar fase</Boton> y <Boton>Retroceder fase</Boton>, el **Técnico responsable** y, al pie, las acciones del estado: <Boton>Pausar</Boton>, <Boton>Enviar a prueba</Boton>, <Boton>Finalizar</Boton> y, aparte, <Boton>Cancelar trabajo</Boton>. Qué hace cada una lo explica [Estados y acciones](./estados-y-acciones.md).
   <Captura nombre="recepcion/ficha-acciones" alt="Panel Producción: fase Recepción con Avanzar fase, técnico responsable Diego Técnico y las acciones Pausar, Enviar a prueba, Finalizar y Cancelar trabajo" telefono />
4. Más abajo hay tres pestañas. **Detalle** tiene las líneas con sus piezas en el odontograma, el color, la lista de verificación y la prescripción.
5. **Historial** cuenta todo lo que le ha pasado al trabajo, del más reciente al más antiguo: quién lo hizo y hace cuánto (deja el puntero sobre el tiempo para ver la fecha y la hora exactas). Arriba puedes dejar un **Comentario** para el equipo y tocar <Boton>Comentar</Boton>.
   <Captura nombre="recepcion/ficha-historial" alt="Pestaña Historial: campo Comentario, botón Comentar y los eventos Estado cambiado y Trabajo creado" telefono />
6. **Adjuntos** guarda las fotos y los documentos del trabajo. <Boton>Añadir foto</Boton> abre la cámara en el teléfono; <Boton>Subir archivo</Boton> sube una foto o un documento ya guardado. Aquí también queda la foto de la **Constancia de entrega** que tomó el mensajero, como en el trabajo de «S. L.».
   <Captura nombre="recepcion/ficha-adjuntos" alt="Pestaña Adjuntos con los botones Añadir foto y Subir archivo, y la foto marcada Constancia de entrega" telefono />
7. Para corregir los datos, toca <Boton>Editar</Boton>: se abre el mismo formulario con el que [se creó](./crear-un-trabajo.md). Toca <Boton>Guardar</Boton> al terminar.

## Qué pasa después

Lo que cambies en la ficha (fase, técnico, estado, comentarios, adjuntos) queda en el **Historial** con tu nombre, y lo ven al momento las demás personas que abran el trabajo.

Cuando el trabajo ya está entregado, la cabecera dice además cuánto falta por cobrar («Pendiente $ 35.00 de $ 95.00») o cuándo se cobró, con <Boton>Ver cuenta de la clínica</Boton>. Desde **Terminado** en adelante aparece también <Boton>Repetir</Boton>: crea un trabajo nuevo con las mismas líneas y piezas, y pide el motivo y cuánto se le cobra a la clínica.

:::info Precios
El técnico y el mensajero no ven el total, los precios ni las notas internas en la ficha. Tampoco ven el botón <Boton>Editar</Boton>.
:::

## Problemas frecuentes

- **No aparece el botón Editar:** solo se edita un trabajo **Por recoger**, **Nuevo** o **En proceso**. Después, los cambios se cuentan con un comentario en el **Historial**.
- **No aparece Avanzar fase:** la fase solo cambia con el trabajo **En proceso**, y el panel dice por qué no, por ejemplo «El trabajo está en espera: reanúdalo para poder cambiar de fase.». En la última fase, <Boton>Avanzar fase</Boton> se desactiva: lo que sigue es <Boton>Finalizar</Boton>.
