---
title: Usuarios y roles
description: Crear la cuenta de cada persona del laboratorio, darle su rol y su contraseña, cambiarlos y bloquear o restablecer el acceso.
sidebar_position: 6
---

# Usuarios y roles

Cada persona del laboratorio entra a Dentalware con su propio usuario: su correo y su contraseña. El rol decide qué pantallas ve y qué puede hacer. Las cuentas las crea administración; nadie se registra solo.

## Quién puede hacerlo

<Rol roles={['admin']} />

## Los cuatro roles

- **Administrador:** todo, incluida **Configuración**. Es el único que registra ajustes y anula pagos en **Cuentas**.
- **Recepción:** crea y lleva los trabajos, las recogidas y entregas, y las cuentas y pagos de las clínicas.
- **Técnico:** ve los trabajos (los suyos, primero en **Inicio**), avanza sus fases y los finaliza. Nunca ve precios, saldos ni notas internas.
- **Mensajero:** ve sus recogidas y entregas del día y las marca. Tampoco ve precios ni notas internas.

El detalle de qué pantallas ve cada uno está en [Qué ve cada rol](../primeros-pasos/que-ve-cada-rol.md).

## Pasos para crear un usuario

1. Abre **Configuración** y toca **Usuarios**. La lista muestra a cada persona con su **Correo**, su **Rol** y su **Estado**.
   <Captura nombre="administracion/usuarios-lista" alt="Lista Usuarios con Administrador, Carla Recepción, Diego Técnico, Lucía Mensajera y Marco Mensajero, cada uno con su correo, su rol, Activo, el lápiz y Bloquear" telefono />
2. Toca <Boton>Nuevo usuario</Boton>.
3. Escribe el **Nombre** y el **Correo** con que entrará la persona.
4. En **Contraseña**, escribe una contraseña inicial de al menos 8 caracteres.
5. Elige el **Rol**.
   <Captura nombre="administracion/usuario-formulario" alt="Diálogo Nuevo usuario vacío con Nombre, Correo, Contraseña y Rol (Técnico por omisión), y los botones Cancelar y Guardar" telefono />
6. Toca <Boton>Guardar</Boton>.
7. Dale a la persona su correo y su contraseña de forma privada, nunca en un grupo de chat. Con ellos entra como cuenta [Entrar y salir](../primeros-pasos/entrar-y-salir.md).

## Pasos para cambiar el rol, el nombre o la contraseña

1. En **Usuarios**, toca el lápiz de la persona.
2. Cambia el **Nombre** o el **Rol**. El correo no se puede cambiar.
3. Para darle una contraseña nueva (si la olvidó), escríbela en **Nueva contraseña (opcional)**. Si lo dejas vacío, la contraseña no cambia.
4. Toca <Boton>Guardar</Boton>. Pide a la persona que cierre sesión y vuelva a entrar para ver el menú de su nuevo rol.

## Pasos para bloquear o restablecer el acceso

Cuando alguien deja el laboratorio, bloquea su acceso. Su usuario no se borra: su nombre sigue en el historial de los trabajos.

1. En **Usuarios**, toca <Boton>Bloquear</Boton> en la fila de la persona.
2. El diálogo avisa de lo que pasa. Toca <Boton>Bloquear</Boton> para confirmarlo, o <Boton>Volver</Boton> para no hacer nada.
   <Captura nombre="administracion/usuario-bloquear" alt="Diálogo Bloquear acceso: la persona no podrá iniciar sesión y sus sesiones abiertas se cerrarán, con los botones Volver y Bloquear" telefono />
3. En la lista, su estado pasa a **Bloqueado** y el botón dice <Boton>Desbloquear</Boton>. Para que vuelva a entrar, toca <Boton>Desbloquear</Boton> y confirma con <Boton>Restablecer acceso</Boton>.

## Qué pasa después

- Un usuario nuevo puede entrar al momento con su correo y su contraseña.
- Un usuario bloqueado no puede iniciar sesión y sus sesiones abiertas se cierran. Al intentar entrar, ve «Tu usuario está bloqueado: pide a administración que lo reactive.».

:::warning Tu propio usuario
No puedes cambiar tu propio rol ni bloquearte: el botón <Boton>Bloquear</Boton> de tu fila está desactivado. Así el laboratorio nunca se queda sin administrador por error.
:::

## Problemas frecuentes

- **«Ya existe un usuario con ese correo»:** cada correo es de una sola persona. Si esa persona ya tenía usuario, búscalo en la lista: puede estar bloqueado.
- **«La contraseña debe tener al menos 8 caracteres»:** escribe una más larga.
- **Un usuario bloqueado no puede entrar:** es lo esperado. Si tiene que volver, toca <Boton>Desbloquear</Boton> en su fila.
- **Alguien olvidó su contraseña:** dale una nueva en **Nueva contraseña (opcional)**, con el lápiz de su fila.
