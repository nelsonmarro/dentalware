---
title: Estados y acciones
description: Qué significa cada estado de un trabajo y qué acción lo lleva al siguiente.
sidebar_position: 4
---

# Estados y acciones

Cada trabajo está siempre en un estado, que dice en qué punto del flujo va: recibir, producir, entregar y cobrar. El estado cambia con las acciones de la ficha, y cada acción solo aparece cuando tiene sentido.

## Quién puede hacerlo

<Rol roles={['admin', 'recepcion']} />

El técnico también puede <Boton>Finalizar</Boton>, y el mensajero, <Boton>Marcar enviado</Boton> y <Boton>Marcar entregado</Boton>.

## Los estados

En la lista **Trabajos**, cada trabajo lleva su estado con su nombre y su color.

<Captura nombre="recepcion/estados-chips" alt="Trabajos de la lista, cada uno con el chip de su estado" telefono />

En la computadora, junto a la fecha de entrega, un reloj marca el trabajo que vence hoy («A. S.») y un círculo rojo con exclamación, el atrasado («L. T.»); deja el puntero encima para leer «Vence hoy» o «Atrasado».

Cada estado, qué significa y qué acción lo mueve:

- **Por recoger:** está registrado, pero sigue en la clínica y el mensajero va a buscarlo. <Boton>Recibido</Boton> lo pasa a **Nuevo**.
- **Nuevo:** ya está en el laboratorio y espera que lo acepten. <Boton>Aceptar</Boton> lo pasa a **En proceso**.
- **En proceso:** se está haciendo y avanza por sus fases. <Boton>Pausar</Boton> lo pasa a **En espera**; <Boton>Enviar a prueba</Boton>, a **En prueba**, y <Boton>Finalizar</Boton>, a **Terminado**.
- **En espera:** está parado, con un motivo (por ejemplo, falta el antagonista). <Boton>Reanudar</Boton> lo devuelve a **En proceso**.
- **En prueba:** está en la clínica para probarlo en boca. <Boton>Recibir de prueba</Boton> lo devuelve a **En proceso**.
- **Terminado:** está listo para entregar. <Boton>Marcar enviado</Boton> lo pasa a **Enviado**.
- **Enviado:** va con el mensajero hacia la clínica. <Boton>Marcar entregado</Boton> lo pasa a **Entregado**.
- **Entregado:** está en la clínica y ya se suma a la cuenta de la clínica. No tiene acción: pasa solo a **Cobrado** cuando los pagos y los ajustes de la clínica lo cubren. Si no hay nada que cobrar (por ejemplo, una repetición sin cargo), <Boton>Marcar entregado</Boton> lo deja **Cobrado** directamente.
- **Cobrado:** los pagos y los ajustes de la clínica cubren lo que vale. No tiene acción: vuelve solo a **Entregado** si deja de estar cubierto (por ejemplo, si administración anula un pago o registra un recargo).
- **Cancelado:** se canceló y ya no se hace. No hay ninguna acción para retomarlo.

<Boton>Cancelar trabajo</Boton> está en todos los estados salvo **Entregado**, **Cobrado** y **Cancelado**. [Recogidas y entregas](./recogidas-y-entregas.md) explica **Recibido**, **Marcar enviado** y **Marcar entregado**, y [Cuentas y pagos](./cuentas-y-pagos.md), cómo un trabajo llega a **Cobrado**.

## Pasos

1. Abre la [ficha del trabajo](./la-ficha-del-trabajo.md). Las acciones están en el panel de la fase (**Recogida**, **Producción** o **Entrega**): la principal va en verde (en **Producción** suele ser <Boton>Avanzar fase</Boton>; <Boton>Finalizar</Boton> solo en la última fase), y <Boton>Cancelar trabajo</Boton> va al final y aparte, en rojo.
2. Toca la acción. La mayoría, como <Boton>Aceptar</Boton> o <Boton>Enviar a prueba</Boton>, se hace al momento, sin pedir confirmación.
3. <Boton>Pausar</Boton> y <Boton>Cancelar trabajo</Boton> piden el **Motivo**. Escríbelo y toca el botón que nombra la acción (<Boton>Pausar trabajo</Boton> o <Boton>Cancelar trabajo</Boton>); <Boton>Volver</Boton> cierra sin hacer nada.
   <Captura nombre="recepcion/accion-pausar" alt="Diálogo Pausar trabajo: el trabajo queda En espera hasta que lo reanudes; campo Motivo, Volver y Pausar trabajo" telefono />
4. <Boton>Finalizar</Boton> pide confirmación, porque no tiene vuelta: el trabajo pasa a **Terminado** con la fecha de hoy. Toca <Boton>Finalizar</Boton> otra vez para confirmar o <Boton>Volver</Boton> para dejarlo como está.
   <Captura nombre="recepcion/accion-finalizar" alt="Confirmación Finalizar: el trabajo pasará a Terminado con la fecha de hoy y no hay acción para devolverlo a En proceso" telefono />
5. Un aviso confirma lo que pasó, y el estado nuevo sale en la cabecera.

## Qué pasa después

Cada cambio de estado queda en el **Historial** de la ficha, con quién lo hizo y, si lo pidió, el motivo. El trabajo aparece en la vista rápida que le toca: «En curso» (en proceso, en espera o en prueba), «En prueba», «Listos» (terminados y enviados)…

:::warning Importante
<Boton>Finalizar</Boton> y <Boton>Cancelar trabajo</Boton> no tienen vuelta: no hay ninguna acción para devolver un trabajo terminado a **En proceso** ni para retomar uno cancelado. Si no estás seguro, toca <Boton>Volver</Boton>.
:::

## Problemas frecuentes

- **«No se puede "Finalizar": el trabajo está en estado "Terminado". Puede que otra persona lo haya cambiado.»** (u otra acción y otro estado): otra persona cambió el trabajo mientras lo tenías abierto. La ficha se actualiza sola: revisa el estado nuevo antes de seguir.
- **No veo la acción que busco:** solo aparecen las acciones del estado actual. Por ejemplo, para finalizar un trabajo **En espera**, primero toca <Boton>Reanudar</Boton>.
