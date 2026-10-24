---
title: Estados del trabajo
description: El diagrama de los estados de un trabajo, las acciones que los cambian y quién puede hacerlas.
sidebar_position: 2
---

# Estados del trabajo

Cada trabajo está siempre en un estado, que dice en qué punto va: recibir, producir, entregar y cobrar. Usa esta página para ver de un vistazo a qué estado lleva cada acción y quién puede tocarla.

## El recorrido de un trabajo

Cada flecha es una acción de la ficha, con el nombre de su botón. La tabla de abajo dice lo mismo, con quién puede hacer cada acción.

<Estados />

## Qué significa cada estado

- **Por recoger:** está registrado, pero todavía no llegó al laboratorio: el mensajero va a buscarlo o ya lo trae (**En camino al laboratorio**, que explica [Recogidas y entregas](../recepcion/recogidas-y-entregas.md)).
- **Nuevo:** ya está en el laboratorio y espera que lo acepten.
- **En proceso:** se está haciendo y avanza por sus fases.
- **En espera:** está parado, con un motivo (por ejemplo, falta el antagonista).
- **En prueba:** está en la clínica para probarlo en boca.
- **Terminado:** está listo para entregar.
- **Enviado:** va con el mensajero hacia la clínica.
- **Entregado:** está en la clínica y ya se suma a su cuenta. Pasa por sí solo a **Cobrado** cuando los pagos y los ajustes de la clínica lo cubren. Si no hay nada que cobrar (por ejemplo, una repetición sin cargo), <Boton>Marcar entregado</Boton> lo deja **Cobrado** directamente.
- **Cobrado:** los pagos y los ajustes de la clínica cubren lo que vale. Vuelve por sí solo a **Entregado** si deja de estar cubierto, por ejemplo por un ajuste o un pago anulado.
- **Cancelado:** se canceló y ya no se hace. No hay ninguna acción para retomarlo.

De **Entregado** a **Cobrado**, y de vuelta, no se pasa con un botón: lo deciden los pagos y los ajustes de la clínica. Lo explica [Cuentas y pagos](../recepcion/cuentas-y-pagos.md).

## Quién hace qué

La columna «Quién» de la tabla de arriba dice qué roles pueden hacer cada acción. Cómo se hace cada acción desde la ficha, qué pide y qué no tiene vuelta lo explica [Estados y acciones](../recepcion/estados-y-acciones.md).
