---
title: Datos del laboratorio
description: El nombre, la dirección, los teléfonos, el RUC y el logo que salen en la orden impresa, en el estado de cuenta y en el aviso por WhatsApp.
sidebar_position: 2
---

# Datos del laboratorio

Los datos del laboratorio son la cabecera de todo lo que sale hacia las clínicas: la orden de trabajo impresa, el estado de cuenta y el aviso por WhatsApp. Conviene llenarlos antes de imprimir la primera orden.

## Quién puede hacerlo

<Rol roles={['admin']} />

## Pasos

1. En el menú, abre **Configuración**. Se abre en la sección **Laboratorio**.
2. Revisa o escribe los datos del formulario:
   - **Nombre del laboratorio** (obligatorio).
   - **RUC**.
   - **Dirección**.
   - **Teléfonos**: puedes poner más de uno en el mismo campo.
   - **Prefijo del código de trabajo** e **IVA informativo (%)** (ver la nota de abajo).
   - **URL del logo**: la dirección de internet de una imagen con el logo del laboratorio.
     <Captura nombre="administracion/laboratorio-formulario" alt="Formulario Laboratorio con el nombre Laboratorio Demo, el RUC vacío, la dirección, el teléfono 02 000 0000, el prefijo vacío, IVA informativo 15, la URL del logo vacía y el botón Guardar cambios" />
3. Toca <Boton>Guardar cambios</Boton>.

## Qué pasa después

Lo que guardes sale desde ese momento:

- **En la orden de trabajo impresa y en el estado de cuenta**, arriba: el logo (si hay URL), el nombre, la dirección, los teléfonos («Cel.: …») y el RUC. Los campos vacíos no salen. Ver [Imprimir](../recepcion/imprimir.md).
- **En el aviso por WhatsApp**, el nombre: «Hola, les escribimos de Laboratorio Demo…». Si no hay nombre, dice «del laboratorio». Ver [Avisar por WhatsApp](../recepcion/avisar-por-whatsapp.md).

Las órdenes ya impresas no cambian: vuelve a imprimirlas si hace falta.

:::info Prefijo e IVA
El **Prefijo del código de trabajo** y el **IVA informativo (%)** se guardan, pero por ahora no cambian nada: los códigos siguen como 26-00004 (año y número) y Dentalware no calcula IVA ni emite facturas.
:::

## Problemas frecuentes

- **El logo no sale en la orden:** la URL del logo tiene que llevar directo a una imagen pública (que se abra sola en el navegador). Si la imagen se borra o cambia de dirección, deja de salir.
- **«El nombre es obligatorio»:** el nombre del laboratorio no puede quedar vacío.
- **«Máximo 13 caracteres» en el RUC:** el RUC se escribe solo con sus 13 cifras, sin guiones ni espacios de más.
