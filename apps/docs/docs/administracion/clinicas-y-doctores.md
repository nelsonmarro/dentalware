---
title: Clínicas y doctores
description: Crear, editar y desactivar las clínicas del laboratorio y sus doctores, con el WhatsApp para los avisos.
sidebar_position: 5
---

# Clínicas y doctores

Las clínicas son los clientes del laboratorio: mandan los trabajos, los reciben y los pagan. Cada clínica tiene sus doctores, que son quienes piden cada trabajo. Recepción los elige al crear un trabajo, así que tienen que estar aquí antes.

## Quién puede hacerlo

<Rol roles={['admin']} />

## Pasos para crear o editar una clínica

1. Abre **Configuración** y toca **Clínicas**. La lista muestra cada clínica con su **Ciudad**, su **WhatsApp** y su **Estado**; en la computadora, la tabla muestra también sus días de **Crédito**.
   <Captura nombre="administracion/clinicas-lista" alt="La lista de clínicas, empezando por Centro Dental Los Álamos y Clínica Sonrisa Norte, cada una con su ciudad, su WhatsApp si lo tiene, Activo, el lápiz y el interruptor" telefono />
2. Toca <Boton>Nueva clínica</Boton>, o el lápiz de una clínica para cambiar sus datos.
3. Llena el formulario. Solo el **Nombre** es obligatorio:
   - **RUC**, **Ciudad**, **Dirección** y **Teléfono**. La dirección y la ciudad son las que abre el mapa del mensajero.
   - **WhatsApp**: el número al que recepción manda los avisos. Escríbelo como se marca en Ecuador, 099 123 4567, o con el código del país, +593 99 123 4567.
   - **Correo**, **Días de crédito** y **Notas**.
     <Captura nombre="administracion/clinica-formulario" alt="Diálogo Nueva clínica vacío con Nombre, RUC, Ciudad, Dirección, Teléfono y WhatsApp con su ejemplo, y los botones Cancelar y Guardar" telefono />
4. Toca <Boton>Guardar</Boton>, o <Boton>Cancelar</Boton> para cerrar sin guardar. El formulario es largo: desliza dentro de él para ver los últimos campos; los botones quedan siempre a la vista.

## Pasos para añadir los doctores

1. En la lista de **Clínicas**, toca el nombre de la clínica. Se abre su ficha, con sus datos arriba y las pestañas **Doctores** y **Precios especiales**.
   <Captura nombre="administracion/clinica-ficha" alt="Ficha de Clínica Sonrisa Norte: Quito, la dirección, el teléfono y el WhatsApp, la pestaña Doctores con Dr. Tomás Herrera y Dra. Valeria Andrade activos, y el botón Nuevo doctor" telefono />
2. Toca <Boton>Nuevo doctor</Boton>, o el lápiz de un doctor para cambiarlo.
3. Escribe el **Nombre** (obligatorio) y, si los tienes, el **Teléfono**, el **Correo** y las **Notas**.
   <Captura nombre="administracion/doctor-formulario" alt="Diálogo Nuevo doctor vacío con Nombre, Teléfono, Correo y Notas, y los botones Cancelar y Guardar" telefono />
4. Toca <Boton>Guardar</Boton>.

La pestaña **Precios especiales** guarda los precios propios de esta clínica: lo explica [Productos y precios](./productos-y-precios.md#pasos-para-dar-a-una-clínica-su-propio-precio).

## Desactivar una clínica o un doctor

Una clínica o un doctor no se borran: se desactivan con su interruptor, en la lista. Desactivados, ya no salen para elegir al crear un trabajo. Sus trabajos y la cuenta de la clínica siguen como estaban, y lo que deba la clínica sigue en **Cuentas**.

Para ver las clínicas desactivadas, enciende **Mostrar inactivas**. Los doctores desactivados siguen en la ficha de su clínica, con el estado **Inactivo**.

## El WhatsApp desde la ficha del trabajo

Si una clínica no tiene WhatsApp, la ficha de sus trabajos dice «Sin WhatsApp registrado.». Administración ve ahí el enlace <Boton>Añadir WhatsApp</Boton>:

1. Toca <Boton>Añadir WhatsApp</Boton>. Se abre **Clínicas** con el formulario de esa clínica y el cursor en **WhatsApp**.
2. Escribe el número y toca <Boton>Guardar</Boton>.
3. Vuelves a la ficha del trabajo, ya con <Boton>Avisar por WhatsApp</Boton>. Si tocas <Boton>Cancelar</Boton>, también vuelves, sin cambios.

Cómo se manda el aviso lo cuenta [Avisar por WhatsApp](../recepcion/avisar-por-whatsapp.md).

## Qué pasa después

La clínica y sus doctores activos salen en **Nuevo trabajo** al momento. El WhatsApp guardado es el que abre <Boton>Avisar por WhatsApp</Boton> en la ficha de sus trabajos.

:::info Días de crédito
Los **Días de crédito** salen en la lista de clínicas, como dato para recepción. Por ahora no cambian cómo se calcula la cuenta ni su antigüedad.
:::

## Problemas frecuentes

- **No puedo borrar una clínica:** no se borran, porque sus trabajos y su cuenta tienen que seguir. Desactívala con su interruptor.
- **Una clínica no sale al crear un trabajo:** está inactiva. Enciende **Mostrar inactivas** y actívala.
- **«Escribe el WhatsApp como 099 123 4567 o +593 99 123 4567»:** al número le faltan o le sobran cifras. Revísalo.
- **«Correo inválido»:** revisa el correo de la clínica o del doctor, o déjalo vacío.
