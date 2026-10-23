---
title: Crear un trabajo
description: Registrar en Dentalware la orden que llega de la clínica, con sus piezas, su fecha y, si hace falta, la recogida.
sidebar_position: 2
---

# Crear un trabajo

Cada orden que llega de una clínica se registra como un trabajo: quién lo pide, para qué paciente, qué hay que hacer y para cuándo. Desde ahí el laboratorio lo produce, lo entrega y lo cobra.

## Quién puede hacerlo

<Rol roles={['admin', 'recepcion']} />

## Pasos

1. Abre **Trabajos**. Arriba están las vistas rápidas («Nuevos», «En curso», «Vencen hoy», «Vencen mañana», «Atrasados», «En prueba», «Listos» y «Todos») y, debajo, la lista. Toca <Boton>Nuevo trabajo</Boton>.
   <Captura nombre="recepcion/trabajos-lista" alt="Lista Trabajos con las vistas rápidas, el buscador, los filtros y los botones Importar y Nuevo trabajo" telefono />
2. En **Clínica y paciente**, elige la **Clínica**: escribe parte del nombre para buscarla. Después elige el **Doctor**, que solo se activa con la clínica elegida.
3. Escribe la **Referencia del paciente**: sus iniciales o un código, como «A. S.». Edad, sexo y número de caja son opcionales.
4. Revisa la **Fecha de ingreso** (por omisión, hoy) y pon la **Fecha deseada**, la que pide la clínica. El recuadro **Para aceptar falta** dice qué datos faltan todavía para poder aceptar el trabajo.
   <Captura nombre="recepcion/nuevo-trabajo-formulario" alt="Formulario Nuevo trabajo: clínica, doctor, referencia del paciente, fechas y el recuadro Para aceptar falta" telefono />
5. En **Trabajo**, toca <Boton>Agregar línea</Boton> y elige el **Producto**. El precio sale solo, con el de la clínica si tiene uno propio.
6. Si el producto se cobra por pieza (como el zirconio), toca <Boton>Piezas (0)</Boton>: se abre el odontograma. Toca cada pieza para marcarla (se pinta en verde) y otra vez para quitarla; <Boton>Arcada superior</Boton> y <Boton>Arcada inferior</Boton> marcan la arcada entera. Abajo dice cuántas piezas llevas. Toca <Boton>Guardar</Boton>: la cantidad de la línea es la de las piezas marcadas.
   <Captura nombre="recepcion/nuevo-trabajo-odontograma" alt="Odontograma de la línea 1 con las piezas 11 y 21 marcadas: 2 piezas" telefono />
7. Completa el **Color**, la **Lista de verificación** (lo que trajo la clínica: antagonista, mordida, color, fotos) y la **Prescripción**, que hace falta para aceptar. Lo que escribas en **Notas internas** no lo ven el técnico ni el mensajero.
8. Si el mensajero tiene que ir a buscar el trabajo a la clínica, toca <Boton>Programar recogida</Boton> y elige el **Mensajero** y la **Fecha de recogida** (por omisión, hoy). Si la clínica lo trae, no la abras.
   <Captura nombre="recepcion/nuevo-trabajo-recogida" alt="Sección Programar recogida abierta: mensajero Marco Mensajero y fecha de recogida" telefono />
9. Toca <Boton>Guardar</Boton>. Con <Boton>Guardar y nuevo</Boton> el formulario queda vacío para registrar la orden siguiente.

## Qué pasa después

Al guardar, un aviso dice «Trabajo creado» (o «Recogida programada») y se abre la [ficha del trabajo](./la-ficha-del-trabajo.md), con su código (por ejemplo, 26-00004). El trabajo nace **Nuevo**; con la recogida programada nace **Por recoger** y sale en **Entregas** el día de la recogida, para el mensajero que elegiste.

Cuando ya no falta nada, toca <Boton>Aceptar</Boton> en la ficha: el trabajo pasa a **En proceso** y Dentalware fija la **fecha comprometida**, la que el laboratorio promete. Se cuenta en días hábiles desde el día en que lo aceptas, según el producto: los sábados y domingos no cuentan (los feriados, sí). Las vistas «Vencen hoy», «Vencen mañana» y «Atrasados» miran esa fecha (o la deseada, mientras el trabajo no se acepta): por ejemplo, el trabajo de «A. S.» tiene la comprometida el 20/10/2026 y sale en «Vencen hoy».

:::info Datos del paciente
Dentalware guarda lo mínimo del paciente: una referencia (iniciales o un código), y la edad y el sexo si hacen falta. No escribas su nombre completo ni otros datos personales.
:::

:::tip Consejo
Si tienes muchas órdenes en una planilla (CSV), <Boton>Importar</Boton> en **Trabajos** las carga de una vez.
:::

## Problemas frecuentes

- **No puedo elegir el doctor:** elige antes la clínica; el doctor se activa con ella.
- **No aparece el botón Piezas:** el producto de la línea no se cobra por pieza; pon la **Cantidad** a mano.
- **El botón Aceptar está desactivado:** falta algo de la lista **Para aceptar falta** (por ejemplo, la prescripción o la fecha deseada). Toca <Boton>Editar</Boton> en la ficha y complétalo.
