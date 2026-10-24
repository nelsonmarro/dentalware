---
title: Pruebas y espera
description: Qué significan En prueba y En espera para el técnico, quién mueve el trabajo y qué dice el panel Producción.
sidebar_position: 4
---

# Pruebas y espera

A veces un trabajo se para: falta algo para seguir (**En espera**) o está en la clínica para probarlo en boca (**En prueba**). Mientras tanto no cambia de fase, y el panel **Producción** dice por qué.

## Quién puede hacerlo

<Rol roles={['admin', 'recepcion']} />

Pausar, reanudar, enviar a prueba y recibir de prueba son de administración y recepción. El técnico ve el estado y el motivo, pero no tiene esos botones: si un trabajo tuyo tiene que pararse o ya puede seguir, avisa a recepción.

## En espera

Un trabajo **En espera** está parado por un motivo, por ejemplo «Falta el antagonista». Recepción lo pausa y, cuando llega lo que faltaba, lo reanuda con <Boton>Reanudar</Boton>.

1. En **Mis trabajos**, la tarjeta dice la fase y «En espera», como la de «R. M.».
2. En la ficha, la cabecera dice desde cuándo está en espera y el motivo, y el panel **Producción** muestra la fase en la que se quedó, sin <Boton>Avanzar fase</Boton> ni <Boton>Retroceder fase</Boton>, con el aviso «El trabajo está en espera: reanúdalo para poder cambiar de fase.».
   <Captura nombre="tecnico/en-espera-panel" alt="Panel Producción del trabajo de R. M.: fase Recepción, el aviso de que el trabajo está en espera y hay que reanudarlo para cambiar de fase, y el técnico responsable Diego Técnico" telefono />
3. Cuando recepción lo reanuda, vuelve a **En proceso** en la misma fase y puedes seguir.

## En prueba

Un trabajo **En prueba** está en la clínica para que el doctor lo pruebe en boca. Recepción lo envía a prueba y, cuando vuelve al laboratorio, lo recibe con <Boton>Recibir de prueba</Boton>.

1. En **Mis trabajos**, la tarjeta dice la fase y «En prueba», como la de «E. G.».
2. En la ficha, el panel **Producción** muestra la fase en la que se quedó, con el aviso «El trabajo está en una prueba en boca: recíbela para poder cambiar de fase.».
   <Captura nombre="tecnico/en-prueba-panel" alt="Panel Producción del trabajo de E. G.: fase Recepción, el aviso de que el trabajo está en una prueba en boca y hay que recibirla para cambiar de fase, y el técnico responsable Diego Técnico" telefono />
3. Cuando recepción lo recibe de la prueba, vuelve a **En proceso** en la misma fase. Si la prueba pide cambios, retrocede la fase con el motivo (ver [Avanzar fase](./avanzar-fase.md)).

## Qué pasa después

Los dos siguen en **Mis trabajos** y cuentan como «En curso». La pausa, la prueba y la vuelta quedan en el **Historial** de la ficha, con quién lo hizo y el motivo de la pausa.

:::info Las fechas no se paran
La fecha de entrega sigue contando mientras el trabajo está en espera o en prueba: un trabajo parado también puede atrasarse.
:::

## Problemas frecuentes

- **El aviso dice «reanúdalo», pero no tengo el botón:** reanudar es de recepción. Avísale cuando ya tengas lo que faltaba.
- **Falta algo para seguir con un trabajo:** deja un comentario en la pestaña **Historial** con <Boton>Comentar</Boton> y avisa a recepción, que lo pone **En espera** con el motivo.
- **No me sale Finalizar en un trabajo en espera o en prueba:** solo se finaliza un trabajo **En proceso**. Primero recepción tiene que reanudarlo o recibirlo de la prueba.
