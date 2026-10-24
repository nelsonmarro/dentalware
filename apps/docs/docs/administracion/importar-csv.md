---
title: Importar trabajos desde un CSV
description: Cargar de una vez muchos trabajos desde una planilla con la plantilla de Dentalware, validarla y crearlos.
sidebar_position: 8
---

# Importar trabajos desde un CSV

Si tienes muchas órdenes en una planilla (por ejemplo, las pendientes al empezar a usar Dentalware), puedes cargarlas de una vez en vez de crearlas una a una. Se llenan en la plantilla, se guardan como CSV y Dentalware las revisa antes de crear nada.

## Quién puede hacerlo

<Rol roles={['admin', 'recepcion']} />

## Pasos para preparar el archivo

1. Abre **Trabajos** y toca <Boton>Importar</Boton>. Se abre **Importar trabajos**.
   <Captura nombre="administracion/importar-dialogo" alt="Diálogo Importar trabajos con el enlace Descargar plantilla, el campo Archivo CSV sin archivo y los botones Cancelar y Validar" telefono />
2. Toca <Boton>Descargar plantilla</Boton>. Se descarga `plantilla-trabajos.csv`, con la fila de títulos y una fila de ejemplo.
3. Ábrela en tu programa de planillas (Excel, LibreOffice Calc o Google Sheets). Borra la fila de ejemplo y escribe una fila por cada producto de cada trabajo.
4. No cambies la primera fila ni el orden de las columnas. Guarda el archivo como CSV.

## Las columnas

Van en este orden. Las cuatro primeras son obligatorias:

- `clinica`: el nombre de la clínica, como está en **Configuración**. No importan las mayúsculas ni las tildes.
- `doctor`: el nombre del doctor, que tiene que ser de esa clínica.
- `paciente`: la referencia del paciente, sus iniciales, como al crear un trabajo. Hasta 120 caracteres.
- `producto`: el código del producto (por ejemplo, ZR) o su nombre.

Las demás puedes dejarlas vacías:

- `piezas`: las piezas en notación FDI, separadas por comas: `11,21`. Vacía si el producto no lleva piezas.
- `cantidad`: de 1 a 99. Vacía, es 1.
- `color`: el color, por ejemplo A2.
- `fecha_deseada`: la fecha que pide el doctor, como `30/10/2026` o `2026-10-30`.
- `caja`: el número de caja.
- `observaciones`: lo que haya que saber del trabajo.

La clínica, el doctor y el producto tienen que existir y estar activos: Dentalware no los crea. Si falta alguno, créalo antes en **Configuración** ([Clínicas y doctores](./clinicas-y-doctores.md), [Productos y precios](./productos-y-precios.md)).

:::info Un trabajo con varios productos
Las filas **seguidas** con la misma clínica, el mismo doctor, el mismo paciente, la misma fecha deseada y la misma caja forman un solo trabajo, con un producto por fila. El color y las observaciones del trabajo se toman de la primera de esas filas: en las demás no cuentan. Si las separas con otra fila en medio, salen dos trabajos.
:::

## Pasos para importar

1. En **Importar trabajos**, toca el campo **Archivo CSV** y elige tu archivo. El botón de ese campo lo dibuja el navegador en su idioma: en un Chrome en español dice «Seleccionar archivo» (en las capturas sale en inglés por el navegador con que se tomaron).
2. Toca <Boton>Validar</Boton>. Dentalware revisa todo el archivo, sin crear nada todavía.
3. Si hay errores, salen en una tabla: la **Fila** del archivo (la 1 es la de los títulos), la **Columna** y el **Mensaje**. Con un solo error no se crea ningún trabajo. Corrige el archivo, guárdalo, vuelve a elegirlo en **Archivo CSV** y toca <Boton>Validar</Boton> otra vez.
   <Captura nombre="administracion/importar-errores" alt="Importar trabajos con trabajos.csv validado y cuatro errores: fila 3, doctor «Dr. Tomás Herrera» no existe en la clínica «Centro Dental Los Álamos»; fila 4, la clínica «Clínica Ejemplo Sur» no existe; fila 5, pieza dental FDI inválida y fecha inválida" />
4. Sin errores, dice cuántas filas y cuántos trabajos salen («3 filas → 2 trabajos») y el botón cambia a **Importar 2 trabajos**.
   <Captura nombre="administracion/importar-listo" alt="Importar trabajos con trabajos.csv validado sin errores: 3 filas → 2 trabajos, y los botones Cancelar e Importar 2 trabajos" />
5. Toca <Boton>Importar 2 trabajos</Boton> (el número es el de tu archivo). El diálogo se cierra y un aviso dice cuántos se importaron: «Se importaron 2 trabajos».

## Qué pasa después

Los trabajos se crean todos juntos y salen en **Trabajos** como **Nuevo**, recibidos hoy, igual que si los hubieras creado uno a uno con <Boton>Nuevo trabajo</Boton>. Desde ahí siguen el camino de siempre: [Estados y acciones](../recepcion/estados-y-acciones.md).

- **El precio** de cada producto es el de la clínica, si tiene uno propio, o el precio base. No se importan descuentos ni precios escritos a mano.
- **Lo que no trae el CSV** se completa en la ficha de cada trabajo, si hace falta: el técnico responsable, las fotos y los archivos.

## Problemas frecuentes

- **Al validar sale el aviso «Datos inválidos» y no aparece la tabla de errores:** Dentalware no reconoce la primera fila del archivo. Pasa por dos motivos: cambiaste o borraste el título de alguna columna, o el archivo no usa comas. Algunas versiones de Excel en español, según la configuración de la computadora, guardan el CSV con punto y coma (;) entre las columnas, y Dentalware solo lee comas. Vuelve a partir de la plantilla y guarda el CSV separado por comas; si Excel insiste en el punto y coma, guárdalo desde Google Sheets o LibreOffice Calc.
- **«La clínica "…" no existe»** o **«El producto "…" no existe»:** el nombre no es el de **Configuración**, o está desactivado. Revisa cómo está escrito allí.
- **«El doctor "…" no existe en la clínica "…"»:** el doctor existe, pero en otra clínica, o está escrito distinto.
- **«Pieza dental FDI inválida»** o **«Piezas repetidas»:** revisa las piezas de esa fila. Van en FDI, de la 11 a la 18, de la 21 a la 28, de la 31 a la 38 y de la 41 a la 48, separadas por comas y sin repetir.
- **«Fecha inválida (usa AAAA-MM-DD o DD/MM/AAAA)»:** la fecha no existe (como el 31/02) o está escrita de otra forma.
- **«La cantidad mínima es 1»** o **«La cantidad máxima es 99»:** corrige la cantidad, o déjala vacía para 1.
- **«El archivo supera los 2 MB»:** divide la planilla en varios archivos e impórtalos uno a uno.
- **Los acentos salen raros:** guarda el CSV como «UTF-8». La plantilla ya viene así: parte de ella.
