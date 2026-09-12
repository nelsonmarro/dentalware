# Historias de usuario del MVP — Dentalware

Fuente de verdad de **qué** construye cada feature del MVP, escrita desde el punto de vista de quien la usa. Complementa la spec de diseño (`2026-09-01-dentalware-mvp-design.md`: modelo, pantallas, reglas) y manda sobre el alcance: si algo no está en una historia, no está en el MVP.

**Regla de trabajo (Nelson, 2026-09-12):** todo desarrollo parte de la historia que lo justifica. El plan de cada iteración se arma a partir de sus historias y de las tareas técnicas enlazadas; una tarea sin historia detrás es deuda técnica o infraestructura, no funcionalidad. Las historias pendientes viven también como issues en GitHub (etiqueta `historia`, sub-issue de la épica de su iteración); las de features ya hechas solo viven aquí, como referencia al tocar esas pantallas.

**Formato.** Como [tipo de usuario], quiero [acción o necesidad] para [beneficio o resultado]. Cada historia trae su **versión mínima aceptable** (lo más pequeño que ya resuelve la necesidad) y sus **criterios de aceptación** (lo que se prueba). Roles: administrador, recepción, técnico, mensajero. No hay historias «como sistema»: lo técnico va en tareas enlazadas a la historia.

**Código.** `<FEATURE>-<n>` (p. ej. `CIC-1`). El título del issue es «`CIC-1` · aceptar un trabajo con los datos obligatorios completos».

Prioridad del backlog: Iteración 3 = alta, 4 y 5 = media, 6 y 7 = baja. Dentro de una iteración, el orden de las historias en este documento es el orden sugerido de desarrollo.

---

## Features hechas (referencia; sin issues)

### ACC — Acceso y roles (Iteración 0)

**ACC-1.** Como cualquier usuario del laboratorio, quiero iniciar sesión con mi correo y contraseña para trabajar solo con lo que corresponde a mi rol.
- Versión mínima aceptable: pantalla de login con correo y contraseña; sesión de 14 días; cerrar sesión desde el menú.
- Criterios:
  - Sin sesión, cualquier ruta redirige a `/login` y vuelve a la ruta pedida tras entrar.
  - Correo o contraseña inválidos muestran un mensaje en español sin revelar cuál falló.
  - El menú solo muestra las secciones permitidas al rol; una URL prohibida redirige al inicio.

**ACC-2.** Como administrador, quiero que técnicos y mensajeros nunca vean precios ni notas internas para proteger la información comercial del laboratorio.
- Versión mínima aceptable: la API omite precios, totales y notas internas para esos roles; la UI no los renderiza.
- Criterios:
  - Un técnico abre una ficha y no aparece ningún monto ni «Total»; la lista devuelve `total` vacío.
  - Los eventos de cambio de precio se muestran sin valores a técnico y mensajero.
  - Las rutas de precios y productos responden 403 a técnico y mensajero.

**ACC-3.** Como administrador, quiero que solo yo cree usuarios para que nadie se registre por su cuenta.
- Versión mínima aceptable: registro público bloqueado; alta de usuarios desde Configuración.
- Criterios:
  - Un registro anónimo o de un rol distinto de administrador responde 403.
  - El usuario nuevo nace con el rol elegido por el administrador (por defecto técnico).

### CFG — Configuración del laboratorio (Iteración 1)

**CFG-1.** Como administrador, quiero registrar los datos del laboratorio (nombre, RUC, dirección, teléfonos, logo) para que aparezcan en la ficha impresa y en los estados de cuenta.
- Versión mínima aceptable: formulario único con validación; logo opcional.
- Criterios:
  - Los cambios se guardan y se reflejan al recargar.
  - Campos obligatorios (nombre) con mensaje en español; RUC con formato válido si se llena.
  - Solo el administrador escribe; cualquier rol con sesión puede leer.

**CFG-2.** Como administrador, quiero gestionar los usuarios y sus roles para que cada persona use la app según su función.
- Versión mínima aceptable: lista, alta, edición de nombre y rol, activar/desactivar.
- Criterios:
  - Un usuario desactivado no puede iniciar sesión y se muestra como inactivo.
  - El administrador no puede desactivarse ni quitarse el rol a sí mismo.
  - Correo único; mensaje claro si ya existe.

**CFG-3.** Como recepción, quiero registrar clínicas con sus datos de contacto y plazo de pago para asociarlas a los trabajos y a su cuenta.
- Versión mínima aceptable: lista con búsqueda, alta y edición, activar/desactivar; campos de WhatsApp, correo y `payment_terms_days`.
- Criterios:
  - Nombre obligatorio; teléfono y WhatsApp con formato válido.
  - Una clínica inactiva no aparece al crear trabajos pero conserva su historial.
  - Cualquier rol con sesión puede leer la lista; solo el administrador escribe.

**CFG-4.** Como recepción, quiero registrar los doctores de cada clínica para indicar quién pidió cada trabajo.
- Versión mínima aceptable: pestaña de doctores dentro de la clínica; alta, edición y activar/desactivar.
- Criterios:
  - Un doctor pertenece a una sola clínica y aparece solo al elegir esa clínica en un trabajo.
  - Nombre obligatorio; correo válido si se llena.

### CAT — Catálogo, precios y fases (Iteración 1)

**CAT-1.** Como administrador, quiero mantener categorías y productos con su precio base, unidad de cobro y días de elaboración para que los trabajos se coticen y se programen solos.
- Versión mínima aceptable: categorías con orden; productos con código único, categoría, `por_pieza | por_arcada | por_trabajo`, precio base, `turnaround_days`, `requires_try_in`.
- Criterios:
  - Código de producto único; mensaje «Ya existe un producto con ese código».
  - Un producto inactivo no se ofrece en trabajos nuevos pero se conserva en los existentes.
  - Semillas iniciales: Prótesis fija (Zirconio, Disilicato de litio, Metal porcelana) y Prótesis removible (Acrílico, Cromo cobalto, Prótesis híbrida).

**CAT-2.** Como administrador, quiero fijar precios especiales por clínica para respetar los acuerdos comerciales sin recalcular a mano.
- Versión mínima aceptable: tabla por clínica con buscador de producto y precio editable por fila; vacío = precio base.
- Criterios:
  - Al crear un trabajo, la línea toma el precio especial si existe y el base si no.
  - Borrar el precio especial vuelve al precio base en trabajos nuevos, no en los ya guardados.
  - Técnico y mensajero no pueden leer esta pantalla ni su API (403).

**CAT-3.** Como administrador, quiero definir las fases de producción con su orden y color para que el equipo avance los trabajos con el mismo vocabulario.
- Versión mínima aceptable: lista ordenable, alta, edición, activar/desactivar; semillas Recepción, Modelo, Diseño, Estructura, Cerámica/Acrílico, Acabado, Control de calidad.
- Criterios:
  - El orden se guarda y se respeta al avanzar fase.
  - Una fase inactiva no se ofrece al avanzar pero se conserva en el historial.

**CAT-4.** Como administrador, quiero que Configuración sea una sección propia y solo mía para que recepción y técnicos no cambien catálogos por error.
- Versión mínima aceptable: entrada «Configuración» en el menú solo para administrador; navegación por pestañas.
- Criterios:
  - Un técnico no ve el enlace y, si entra por URL, vuelve al inicio.
  - Todas las escrituras de Configuración responden 403 a cualquier rol que no sea administrador.

### TRA — Trabajos: registro y edición (Iteración 2)

**TRA-1.** Como recepción, quiero registrar un trabajo con la clínica, el doctor, la referencia del paciente y sus líneas para tener la orden digital desde que entra al laboratorio.
- Versión mínima aceptable: formulario con cabecera, líneas (producto, cantidad, piezas, precio automático), color VITA, observaciones y notas internas; «Guardar».
- Criterios:
  - Se genera el código `AA-NNNNN` único por año.
  - Clínica, doctor, referencia y al menos una línea son obligatorios; errores bajo cada campo en español.
  - El total se calcula con precios por clínica y descuentos; el evento «creado» queda en el historial.

**TRA-2.** Como recepción, quiero marcar las piezas en un odontograma FDI tocando cada diente para registrar el trabajo igual que en la orden en papel.
- Versión mínima aceptable: odontograma SVG con numeración FDI, selección múltiple por toque, botones de arcada; sin arrastre.
- Criterios:
  - En productos «por pieza» la cantidad se deriva de las piezas marcadas y no se edita a mano.
  - Funciona con el dedo a 390 px sin scroll horizontal; cada diente tiene nombre accesible y `aria-pressed`.
  - Las piezas se guardan como números FDI válidos.

**TRA-3.** Como recepción, quiero editar un trabajo mientras está nuevo o en proceso para corregir datos sin crear otro.
- Versión mínima aceptable: mismo formulario en modo edición; cambios de precio registrados como evento.
- Criterios:
  - Solo `nuevo` y `en_proceso` se editan; otros estados muestran la ficha sin botón de editar.
  - Un cambio de precio o de líneas deja un evento «editado» con antes y después.
  - Técnico y mensajero no pueden editar (redirección y 403).

**TRA-4.** Como recepción, quiero adjuntar fotos y documentos al trabajo desde el celular o la PC para guardar la prescripción y el estado en que llegó.
- Versión mínima aceptable: subida de imagen (comprimida en el cliente) y PDF; miniaturas; solo con sesión.
- Criterios:
  - Tipo real verificado (imágenes y PDF); tamaño máximo con mensaje 413/415 en español.
  - El archivo se sirve solo con sesión y nunca por su nombre original.
  - Cada adjunto deja el evento «adjunto agregado».

### SEG — Trabajos: seguimiento (Iteración 2)

**SEG-1.** Como recepción, quiero ver la lista de trabajos con vistas rápidas (Nuevos, En curso, Deben salir hoy, Listos, Todos) y filtros para encontrar cualquier trabajo en segundos.
- Versión mínima aceptable: tabla en PC y tarjetas en móvil; búsqueda por código, paciente o caja; filtros por clínica y estado; paginación; vista y filtros en la URL.
- Criterios:
  - Cada vista rápida devuelve solo los estados que le corresponden.
  - El estado se muestra como chip con texto y color; a 1280 px no hay scroll horizontal.
  - Al volver atrás se conservan vista, filtros y página.

**SEG-2.** Como técnico, quiero abrir la ficha de un trabajo y ver sus piezas, productos y observaciones para saber exactamente qué fabricar.
- Versión mínima aceptable: ficha con cabecera (código, clínica, doctor, paciente, estado, fecha comprometida) y pestañas Detalle, Fotos, Historial.
- Criterios:
  - El técnico ve piezas, productos, color y observaciones, sin precios ni notas internas.
  - La ficha carga en móvil con pestañas de 44 px.

**SEG-3.** Como técnico, quiero comentar en el trabajo para dejar constancia de dudas o avances sin salir de la ficha.
- Versión mínima aceptable: campo de comentario en Historial; comentario con autor y fecha.
- Criterios:
  - El comentario aparece de inmediato en el historial con el nombre del autor.
  - Comentario vacío se rechaza con mensaje en español.
  - Cualquier rol con sesión comenta; nadie edita ni borra comentarios.

**SEG-4.** Como recepción, quiero ver el historial completo del trabajo (creación, cambios, adjuntos, comentarios) para responder a la clínica con datos.
- Versión mínima aceptable: lista cronológica de eventos con tipo, actor, fecha y detalle.
- Criterios:
  - Toda mutación del trabajo aparece como evento en el mismo instante en que se guarda.
  - Los eventos de precio muestran el valor a administrador y recepción; a los demás, solo que hubo cambio.

### IMP — Importación desde CSV (Iteración 2)

**IMP-1.** Como recepción, quiero descargar una plantilla CSV para cargar pedidos que las clínicas envían en hoja de cálculo.
- Versión mínima aceptable: enlace de descarga con las columnas fijas y una fila de ejemplo.
- Criterios:
  - Las columnas coinciden con `IMPORT_COLUMNS` de shared.
  - Excel abre el archivo con acentos correctos (UTF-8 con BOM).

**IMP-2.** Como recepción, quiero validar el archivo antes de importar y ver los errores por fila para corregirlos en la hoja y no crear trabajos a medias.
- Versión mínima aceptable: diálogo con selección de archivo, botón «Validar», resumen «N filas → M trabajos» y tabla de errores por fila.
- Criterios:
  - Ninguna fila se guarda si hay al menos un error.
  - Cada error indica fila, columna y mensaje en español (clínica inexistente, producto desconocido, pieza inválida, fecha inválida).
  - Filas del mismo paciente y clínica se agrupan en un solo trabajo con varias líneas.

**IMP-3.** Como recepción, quiero confirmar la importación y ver los códigos creados para localizar los trabajos nuevos.
- Versión mínima aceptable: botón «Importar N trabajos» tras la validación; informe con los códigos.
- Criterios:
  - Los trabajos nacen en `nuevo` con precios por clínica y evento «creado».
  - Los códigos aparecen en la lista con la vista «Nuevos».

---

## Iteración 3 — Trabajos II (prioridad alta)

### CIC — Ciclo de vida del trabajo

**CIC-1.** Como recepción, quiero aceptar un trabajo cuando ya tengo todo lo que la clínica debía entregar para que entre a producción con fecha comprometida.
- Versión mínima aceptable: acción «Aceptar» en `nuevo`; lista de verificación (antagonista, mordida, color, fotos) marcable; `promised_date` calculada en días hábiles con el mayor `turnaround_days`; fase inicial asignada.
- Criterios:
  - Si falta un dato obligatorio (§7 de la spec) la acción se deshabilita y la ficha lista qué falta; la API responde 422 con el detalle.
  - Al aceptar, el estado pasa a `en_proceso`, se fija `promised_date` y la fase inicial, y queda el evento.
  - Solo administrador y recepción aceptan; técnico y mensajero reciben 403.

**CIC-2.** Como técnico, quiero avanzar la fase del trabajo desde la ficha para que recepción sepa en qué punto está sin preguntarme.
- Versión mínima aceptable: botón «Avanzar fase» que pasa a la siguiente fase activa; retroceder exige motivo; «Finalizar» desde la última fase.
- Criterios:
  - Cada cambio deja un evento con fase anterior, fase nueva, actor y motivo si retrocede.
  - «Finalizar» pasa a `terminado` y fija `finished_at`; si no está en la última fase pide confirmación.
  - Un trabajo `en_espera` o `en_prueba` no permite avanzar fase.

**CIC-3.** Como recepción, quiero pausar un trabajo con motivo y enviarlo a prueba en boca para reflejar las esperas reales de la clínica.
- Versión mínima aceptable: acciones «Pausar» / «Reanudar» (`en_espera`) y «Enviar a prueba» / «Recibir de prueba» (`en_prueba`) con motivo obligatorio y registro de `case_tryins`.
- Criterios:
  - Pausar sin motivo se rechaza con 422; la ficha muestra el motivo y desde cuándo.
  - Enviar a prueba crea una prueba con fecha; recibirla la cierra y vuelve a `en_proceso`.
  - Las transiciones inválidas responden 409 y la UI solo muestra las acciones válidas para el estado y el rol.

**CIC-4.** Como recepción, quiero cancelar un trabajo o crear una repetición (remake) para cerrar correctamente los casos que no salen a la primera.
- Versión mínima aceptable: «Cancelar» con motivo desde cualquier estado salvo `entregado`; «Repetir» desde `terminado`, `enviado` o `entregado` crea un trabajo hijo con líneas y odontograma copiados, motivo, responsable y porcentaje de cobro.
- Criterios:
  - El trabajo cancelado conserva su historial y no aparece en «En curso».
  - El remake enlaza al original en ambas fichas y queda el evento «repetición creada».
  - Solo administrador y recepción; los demás 403.

**CIC-5.** Como recepción, quiero asignar un técnico responsable a cada trabajo para que cada quien vea lo suyo.
- Versión mínima aceptable: selector de técnico en la ficha; evento «asignado».
- Criterios:
  - Solo usuarios activos con rol técnico aparecen en el selector.
  - El cambio de técnico deja evento con antes y después.
  - El técnico asignado ve el trabajo en «Mis trabajos» (INI-2).

### INI — Panel de inicio

**INI-1.** Como recepción, quiero ver al entrar los contadores del día (nuevos, en proceso, vencen hoy, atrasados, en prueba, listos) para saber por dónde empezar.
- Versión mínima aceptable: tarjetas con número y enlace a la vista rápida correspondiente.
- Criterios:
  - Cada contador coincide con el total de su vista rápida en Trabajos.
  - «Atrasados» cuenta `promised_date` anterior a hoy y estado activo.
  - Se ve completo a 390 px sin scroll horizontal.

**INI-2.** Como técnico, quiero ver mis trabajos asignados ordenados por fecha comprometida para atender primero lo que vence antes.
- Versión mínima aceptable: lista «Mis trabajos» en el inicio del técnico con código, paciente, fase y fecha; sin precios.
- Criterios:
  - Solo trabajos activos asignados al usuario; los vencidos se marcan.
  - Tocar un trabajo abre su ficha.

**INI-3.** Como mensajero, quiero ver en el inicio las entregas y recogidas de hoy para organizar mi ruta.
- Versión mínima aceptable: lista de hoy agrupada por clínica con dirección; enlace a Entregas (ENT-5).
- Criterios:
  - Solo entregas pendientes con fecha de hoy; sin precios.
  - Vacío muestra «No tienes entregas hoy».

### FIC — Ficha imprimible y acceso por QR

**FIC-1.** Como recepción, quiero imprimir la orden de trabajo con el mismo formato que la hoja en papel para entregar una copia a la clínica y otra al laboratorio.
- Versión mínima aceptable: vista de impresión A5/A4 con encabezado del laboratorio, código, QR, datos del paciente, odontograma marcado, líneas, color y observaciones; botón «Imprimir».
- Criterios:
  - Reproduce los bloques y el orden de la orden en papel (spec §5).
  - Sin precios cuando la imprime un técnico; con precios para administrador y recepción.
  - Se ve correcta en la vista previa de impresión de Chrome en A4 y A5.

**FIC-2.** Como técnico, quiero escanear el QR de la orden con el celular y ver la ficha para no buscar el trabajo a mano.
- Versión mínima aceptable: ruta `/t/:code` que abre la ficha móvil tras iniciar sesión.
- Criterios:
  - Sin sesión pide login y vuelve a `/t/:code`.
  - Un código inexistente muestra «No encontrado».

**FIC-3.** Como técnico, quiero avanzar la fase y subir una foto desde la ficha del QR para registrar el avance en el puesto de trabajo.
- Versión mínima aceptable: botones «Avanzar fase» y «Añadir foto» (cámara) en `/t/:code`.
- Criterios:
  - Mismas reglas y eventos que CIC-2 y TRA-4.
  - Botones de 44 px y flujo completo con guantes (sin gestos finos).

---

## Iteración 4 — Entregas y calendario (prioridad media)

### ENT — Recogidas y entregas

**ENT-1.** Como recepción, quiero programar la recogida de un trabajo en la clínica y asignarla al mensajero para coordinar el traslado antes de recibirlo.
- Versión mínima aceptable: «Programar recogida» crea el trabajo en `por_recoger` con `delivery` tipo recogida, mensajero y fecha.
- Criterios:
  - La recogida aparece en la lista del mensajero en la fecha indicada.
  - Fecha obligatoria y no anterior a hoy; mensajero obligatorio.
  - El trabajo no puede aceptarse hasta ser recibido.

**ENT-2.** Como mensajero, quiero marcar la recogida como hecha para que el laboratorio sepa que el trabajo ya viene en camino.
- Versión mínima aceptable: «Recibido» en la recogida pasa el trabajo a `nuevo` y cierra la `delivery`.
- Criterios:
  - Queda evento con actor y hora; la recogida desaparece de pendientes.
  - Recepción y administrador también pueden hacerlo.

**ENT-3.** Como recepción, quiero marcar un trabajo terminado como enviado y asignar la entrega al mensajero para que salga del laboratorio con seguimiento.
- Versión mínima aceptable: «Marcar enviado» desde `terminado` crea `delivery` tipo entrega con mensajero y fecha; estado `enviado`.
- Criterios:
  - Solo desde `terminado`; otras transiciones 409.
  - Se fija `shipped_at` y queda el evento.

**ENT-4.** Como mensajero, quiero marcar la entrega como hecha con una foto de constancia para que quede prueba de que la clínica la recibió.
- Versión mínima aceptable: «Entregado» con foto obligatoria; estado `entregado`, `delivered_at` y `proof_attachment_id`.
- Criterios:
  - Sin foto no se puede confirmar; la foto se comprime en el cliente.
  - Se puede marcar «fallida» con motivo y reprogramar.
  - El trabajo entregado pasa a ser cargo en la cuenta de la clínica (CTA-1).

**ENT-5.** Como mensajero, quiero ver mis entregas y recogidas por día agrupadas por clínica con dirección y teléfono para hacer la ruta sin preguntar.
- Versión mínima aceptable: pantalla «Entregas» con selector de día, grupos por clínica, acciones de ENT-2 y ENT-4; sin precios.
- Criterios:
  - Solo las asignadas al mensajero con sesión; administrador y recepción ven todas.
  - Enlaces `tel:` y de mapa desde la dirección.
  - Usable a 390 px con objetivos de 44 px.

### CAL — Calendario de entregas

**CAL-1.** Como recepción, quiero ver un calendario semanal y mensual con las entregas y recogidas para anticipar los días cargados.
- Versión mínima aceptable: vista mensual y semanal con un evento por trabajo aceptado en su `promised_date` y por `delivery` programada; filtro por clínica y mensajero.
- Criterios:
  - Aceptar un trabajo crea su evento; cambiar la fecha comprometida lo mueve.
  - Tocar un evento abre la ficha.
  - Los colores de estado son los mismos de la lista.

**CAL-2.** Como recepción, quiero un aviso interno un día antes de cada fecha comprometida para reaccionar antes de que se atrase.
- Versión mínima aceptable: sección «Vencen mañana» en el inicio y marca en el calendario.
- Criterios:
  - Incluye trabajos activos con `promised_date` = mañana (días hábiles).
  - Desaparece cuando el trabajo pasa a `terminado` o posterior.

**CAL-3.** Como doctor de una clínica, quiero suscribirme a un calendario (ICS) con mis entregas para verlas en mi propio calendario sin entrar a la app.
- Versión mínima aceptable: URL ICS por clínica con token, generada y revocable desde la ficha de la clínica.
- Criterios:
  - El feed lista entregas programadas y fechas comprometidas de esa clínica, sin precios ni datos de otras clínicas.
  - Revocar el token invalida la URL anterior.

---

## Iteración 5 — Cuentas y cobro (prioridad media)

### CTA — Cuentas y cobro

**CTA-1.** Como administrador, quiero ver el saldo de cada clínica y cuántos días tiene vencido para saber a quién cobrar.
- Versión mínima aceptable: pantalla «Cuentas» con lista de clínicas, saldo (Σ entregados + Σ ajustes − Σ pagos) y antigüedad 0-30 / 31-60 / 61-90 / 90+.
- Criterios:
  - El saldo cambia al entregar un trabajo, registrar un pago o un ajuste.
  - Técnico y mensajero no acceden (403 y sin enlace).

**CTA-2.** Como recepción, quiero registrar un pago de una clínica y repartirlo entre sus trabajos entregados para que los trabajos cobrados se cierren solos.
- Versión mínima aceptable: formulario de pago (monto, método, fecha, referencia) con asignación automática a los más antiguos primero, editable; `payment_allocations`.
- Criterios:
  - Cuando lo asignado a un trabajo alcanza su total, pasa a `cobrado` con `paid_at`.
  - No se puede asignar más que el monto del pago ni más que el saldo del trabajo.
  - Queda el evento en cada trabajo afectado.

**CTA-3.** Como administrador, quiero registrar ajustes (descuentos, recargos, notas de crédito) con motivo para que la cuenta refleje los acuerdos con la clínica.
- Versión mínima aceptable: ajuste con signo, monto, motivo y trabajo opcional.
- Criterios:
  - Motivo obligatorio; el ajuste aparece en los movimientos con quién lo registró.
  - Solo administrador.

**CTA-4.** Como recepción, quiero anotar el número de factura del SRI y los trabajos que incluye para cruzar la cuenta con la facturación externa.
- Versión mínima aceptable: registro de `invoice_refs` con número, fecha, monto y trabajos.
- Criterios:
  - Un trabajo no puede estar en dos facturas.
  - La ficha del trabajo muestra su número de factura.

**CTA-5.** Como administrador, quiero imprimir el estado de cuenta de una clínica por rango de fechas para enviárselo con el cobro.
- Versión mínima aceptable: vista imprimible con saldo inicial, movimientos (cargos, ajustes, pagos), saldo final y antigüedad; vista «Por cobrar» por trabajo con días desde la entrega.
- Criterios:
  - Los totales cuadran con el saldo de CTA-1.
  - Usa los datos del laboratorio de CFG-1 en el encabezado.

---

## Iteración 6 — Avisos por correo (prioridad baja)

### AVI — Notificaciones

**AVI-1.** Como recepción, quiero que la clínica reciba un correo al recibir, enviar y entregar su trabajo para que no tenga que llamarnos a preguntar.
- Versión mínima aceptable: correo automático (Resend) al correo de la clínica o del doctor en esos tres eventos, con código, paciente y estado.
- Criterios:
  - Sin correo registrado no se envía y la ficha lo indica.
  - Cada envío queda en `notifications` con destinatario, plantilla y estado (enviado/fallido).
  - Los correos no incluyen precios.

**AVI-2.** Como mensajero, quiero recibir un correo al asignarme una recogida o entrega para enterarme aunque no tenga la app abierta.
- Versión mínima aceptable: correo al mensajero al crear o reprogramar una `delivery` asignada a él.
- Criterios:
  - Incluye clínica, dirección, fecha y enlace a la entrega.
  - Queda en `notifications`.

**AVI-3.** Como recepción, quiero que la clínica reciba un recordatorio un día antes de la fecha comprometida para que esté lista para recibir el trabajo.
- Versión mínima aceptable: envío diario programado que avisa los trabajos activos con `promised_date` = mañana.
- Criterios:
  - Un trabajo se avisa una sola vez por fecha comprometida; si la fecha cambia, se vuelve a avisar.
  - Registro en `notifications`.

**AVI-4.** Como recepción, quiero ver los avisos enviados de un trabajo y reenviar uno fallido, y abrir WhatsApp con el mensaje listo, para atender a la clínica por el canal que prefiera.
- Versión mínima aceptable: pestaña «Avisos» en la ficha con lista de `notifications` y botón «Reenviar»; enlace `wa.me` con el texto prellenado (sin integración).
- Criterios:
  - Reenviar crea un registro nuevo; el fallido conserva su error.
  - El enlace `wa.me` usa el WhatsApp de la clínica y no envía nada por sí solo.

---

## Iteración 7 — Puesta en marcha (prioridad baja)

### PEM — Puesta en marcha

**PEM-1.** Como técnico, quiero instalar Dentalware en mi celular como una app para abrirla con un toque y usar la cámara sin buscar la web.
- Versión mínima aceptable: PWA instalable en Android e iPhone con icono, nombre y pantalla de inicio; funciona en línea.
- Criterios:
  - Chrome en Android ofrece «Instalar»; Safari permite «Añadir a pantalla de inicio» y abre a pantalla completa.
  - Probado en un teléfono real de cada plataforma (absorbe #25).
  - Sin sesión abre en `/login`; las actualizaciones se aplican al reabrir.

**PEM-2.** Como administrador, quiero cargar el histórico de trabajos de VEVI con la plantilla CSV para consultar trabajos anteriores desde el primer día.
- Versión mínima aceptable: importación CSV (IMP-2/IMP-3) con columnas opcionales de estado final y fechas para crear trabajos ya `entregado` o `cobrado` sin pasar por producción.
- Criterios:
  - Los trabajos históricos no aparecen en vistas activas ni en «Vencen hoy».
  - Los cargos históricos no alteran el saldo actual salvo que se indique explícitamente.
  - El informe de importación distingue histórico de trabajos nuevos.

**PEM-3.** Como administrador, quiero que las fotos y documentos del laboratorio queden respaldados fuera del servidor para no perderlos si el VPS falla.
- Versión mínima aceptable: adjuntos en almacenamiento S3 compatible con réplica (decisión #48) o respaldo diario verificado del volumen; restauración probada una vez.
- Criterios:
  - Un adjunto subido hoy existe en el respaldo al día siguiente.
  - Restaurar un respaldo en un entorno limpio devuelve las fotos accesibles desde las fichas.

---

## Mapa historia → issue

Issues creados el 2026-09-12 (etiqueta `historia`, sub-issue de la épica de su iteración: #4, #5, #6, #7, #9). Las tareas técnicas relacionadas (`tarea`) se enlazan desde la historia.

| Historia | Issue | Tareas relacionadas |
|---|---|---|
| CIC-1 · CIC-2 · CIC-3 · CIC-4 · CIC-5 | #63, #64, #65, #66, #67 | #34 (E2E It. 3), #22 (días hábiles) |
| INI-1 · INI-2 · INI-3 | #68, #69, #70 | #53 (DataGrid) |
| FIC-1 · FIC-2 · FIC-3 | #71, #72, #73 | — |
| ENT-1 · ENT-2 · ENT-3 · ENT-4 · ENT-5 | #74, #75, #76, #77, #78 | #35 (E2E It. 4) |
| CAL-1 · CAL-2 · CAL-3 | #79, #80, #81 | — |
| CTA-1 · CTA-2 · CTA-3 · CTA-4 · CTA-5 | #82, #83, #84, #85, #86 | #36 (E2E It. 5) |
| AVI-1 · AVI-2 · AVI-3 · AVI-4 | #87, #88, #89, #90 | #37 (E2E It. 6) |
| PEM-1 · PEM-2 · PEM-3 | #91, #92, #93 | #48 (driver S3), #23 (imagen API); #25 cerrado en PEM-1 |
