---
title: Fases
description: Definir las fases de producción del laboratorio, su orden y su color, y qué pasa al desactivar una.
sidebar_position: 3
---

# Fases

Las fases son las etapas por las que pasa un trabajo mientras se hace: por ejemplo Modelo, Diseño o Control de calidad. El técnico marca en la ficha en qué fase va cada trabajo, y así recepción sabe cómo va sin preguntar. Aquí defines cuáles son y en qué orden van.

## Quién puede hacerlo

<Rol roles={['admin']} />

## Pasos para ver y ordenar las fases

1. Abre **Configuración** y toca **Fases**.
2. La lista muestra las fases activas en su orden, con su número, su **Color** y su **Estado**. En el laboratorio de ejemplo son siete: Recepción, Modelo, Diseño, Estructura, Cerámica/Acrílico, Acabado y Control de calidad.
   <Captura nombre="administracion/fases-lista" alt="Fases de producción: la lista numerada de Recepción a Control de calidad, cada una con su color, Activo y los botones para subir, bajar, editar y el interruptor de activa" telefono />
3. Para cambiar el orden, usa las flechas de cada fase: **Subir** la adelanta un puesto y **Bajar** la atrasa uno. El cambio se guarda al momento. El orden cuenta también las fases inactivas: con las inactivas ocultas, un cambio puede no verse; enciende **Mostrar inactivas** para ordenar.

## Pasos para crear o cambiar una fase

1. Toca <Boton>Nueva fase</Boton>, o el lápiz de una fase para editarla.
2. Escribe el **Nombre** y elige el **Color**: con el cuadro de color o escribiendo el código, como #7351BB.
   <Captura nombre="administracion/fase-formulario" alt="Diálogo Editar fase de Diseño, con el nombre, el cuadro de color y el código #7351BB, y los botones Cancelar y Guardar" telefono />
3. Toca <Boton>Guardar</Boton>, o <Boton>Cancelar</Boton> para cerrar sin cambiar nada.
4. Una fase nueva sale arriba, junto a la primera; súbela o bájala a su sitio antes de aceptar trabajos. Mientras sea la primera, los trabajos que se acepten entran en ella.

## Qué pasa después

- **Al aceptar un trabajo**, entra en la **primera fase activa** de la lista.
- **Avanzar fase**, en la ficha, lo pasa a la siguiente fase activa, en el orden de esta lista. En la última, lo que sigue es <Boton>Finalizar</Boton>. Lo cuenta [Avanzar fase](../tecnico/avanzar-fase.md).
- El **color** sirve para distinguir las fases en esta lista.

## Desactivar una fase

Una fase que ya no usas se desactiva con su interruptor; no se borra. Para verla otra vez, enciende **Mostrar inactivas** y vuelve a activarla.

:::warning Trabajos dentro de la fase
Antes de desactivar una fase, comprueba que ningún trabajo esté en ella. Un trabajo que se queda en una fase inactiva no puede avanzar ni retroceder: la ficha avisa «La fase en la que estaba este trabajo ya no está activa…» hasta que la vuelvas a activar.
:::

## Problemas frecuentes

- **El técnico dice que no puede cambiar la fase de un trabajo:** si la ficha dice que la fase ya no está activa, reactívala aquí. Si el trabajo está En espera o En prueba, no es cosa de las fases: ver [Pruebas y espera](../tecnico/pruebas-y-espera.md).
- **La flecha Subir o Bajar está desactivada:** la fase ya es la primera (Subir) o la última (Bajar).
- **«El color debe ser hexadecimal, ej. #0F766E»:** el código del color lleva # y seis cifras o letras de la A a la F.
