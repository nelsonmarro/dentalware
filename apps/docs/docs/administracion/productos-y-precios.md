---
title: Productos y precios
description: Crear las categorías y los productos del laboratorio, con su precio base, cómo se cobran, sus días hábiles de entrega y el precio propio de una clínica.
sidebar_position: 4
---

# Productos y precios

Los productos son lo que el laboratorio fabrica y cobra, como una corona de zirconio. Cada línea de un trabajo es un producto, y de él salen su precio y la fecha comprometida. Se agrupan en categorías, como Prótesis fija o Prótesis removible.

## Quién puede hacerlo

<Rol roles={['admin']} />

## Pasos para crear las categorías

1. Abre **Configuración**, toca **Productos** y, dentro, la pestaña **Categorías**.
   <Captura nombre="administracion/categorias-lista" alt="Pestaña Categorías con Prótesis fija (orden 1) y Prótesis removible (orden 2), las dos activas, con su lápiz y su interruptor" />
2. Toca <Boton>Nueva categoría</Boton>, o el lápiz de una categoría para cambiarla.
3. Escribe el **Nombre** y el **Orden**: un número; las categorías salen de menor a mayor.
4. Toca <Boton>Guardar</Boton>.

## Pasos para crear un producto

1. En **Productos**, pestaña **Productos**, mira el catálogo: código, nombre, categoría, cómo se cobra, precio base, días y estado. El matraz junto a los días marca los productos que requieren prueba en clínica.
   <Captura nombre="administracion/productos-lista" alt="Productos y precios: el catálogo con Acrílico, Cromo cobalto, Disilicato de litio, Metal porcelana, Prótesis híbrida y Zirconio, cada uno con su código, categoría, cómo se cobra, precio base y días" telefono />
2. Toca <Boton>Nuevo producto</Boton>, o el lápiz de un producto para cambiarlo.
3. Llena el formulario:
   - **Código**: corto y único, como ZR (se escribe en mayúsculas). Con él se busca el producto al crear un trabajo.
   - **Nombre** y **Categoría**.
   - **Se cobra**: **Por pieza** (el precio se multiplica por las piezas marcadas en el odontograma), **Por arcada** o **Por trabajo** (la cantidad la escribe recepción).
   - **Precio base (USD)**: el precio para las clínicas que no tienen uno propio, con punto y hasta dos decimales, como 80.00.
   - **Días hábiles de entrega**: cuántos días de lunes a viernes tarda el laboratorio en hacerlo.
   - **Requiere prueba en clínica**: enciéndelo si el producto suele ir a prueba en boca.
     <Captura nombre="administracion/producto-formulario" alt="Diálogo Editar producto de Metal porcelana: código MP, categoría Prótesis fija, se cobra Por pieza, precio base 80.00, 6 días hábiles de entrega, Requiere prueba en clínica encendido, y los botones Guardar y Cancelar" telefono />
4. Toca <Boton>Guardar</Boton>, o <Boton>Cancelar</Boton> para cerrar sin cambiar nada.

## Pasos para dar a una clínica su propio precio

Si una clínica tiene un precio distinto del base para algún producto, guárdalo en su ficha:

1. En **Configuración**, toca **Clínicas** y luego el nombre de la clínica.
2. Toca la pestaña **Precios especiales**. Cada producto activo muestra su **Precio base** y, en **Precio para esta clínica**, el precio propio. Si el campo está vacío, en gris se ve el precio base, que es el que se usa.
   <Captura nombre="administracion/precio-por-clinica" alt="Precios especiales de Clínica Sonrisa Norte: Metal porcelana a 85.00 y Zirconio a 95.00, con Guardar y Quitar; el resto vacío, con el precio base en gris" telefono />
3. Escribe el precio en la fila del producto y toca <Boton>Guardar</Boton> de esa fila.
4. Para volver al precio base, toca <Boton>Quitar</Boton>.

## Qué pasa después

- **Al crear un trabajo**, cada línea toma el precio de la clínica si lo tiene y, si no, el precio base. Recepción puede cambiarlo en esa línea. El precio queda guardado en el trabajo: si después cambias el precio base o el de la clínica, los trabajos ya creados no cambian.
- **Al aceptar un trabajo**, la fecha comprometida es hoy más los días hábiles del producto más lento del trabajo. Se saltan sábados y domingos; los feriados cuentan como días hábiles. Ver [Crear un trabajo](../recepcion/crear-un-trabajo.md).
- **Requiere prueba en clínica** solo marca el producto en el catálogo (el matraz): no envía nada a prueba por sí solo. La prueba la marca recepción con <Boton>Enviar a prueba</Boton>.
- **Un producto o una categoría inactivos** dejan de salir para elegir: el producto, al crear un trabajo; la categoría, en el formulario del producto. Enciende **Mostrar inactivos** para ver los productos desactivados.

:::info Precios y roles
El técnico y el mensajero nunca ven precios. La copia de la orden para el laboratorio tampoco los lleva.
:::

## Problemas frecuentes

- **El precio no cambia en un trabajo ya creado:** es así a propósito; el precio se guarda en cada trabajo al crearlo. Si hay que corregirlo, recepción lo edita en el trabajo mientras está Por recoger, Nuevo o En proceso. Ya entregado, administración puede registrar un ajuste en la cuenta de la clínica.
- **«El precio debe ser un número con hasta 2 decimales»:** escribe el precio con punto y sin el signo $, como 85.50.
- **No encuentro un producto al crear un trabajo:** puede estar inactivo. En **Productos**, enciende **Mostrar inactivos** y actívalo con su interruptor.
- **Un producto no sale en Precios especiales:** esa pestaña solo muestra los productos activos.
