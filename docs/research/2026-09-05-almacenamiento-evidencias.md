# Almacenamiento de evidencias (fotos/PDF/STL) para Dentalware

Fecha de la investigación: **2026-09-05**. Todos los precios se verificaron ese día contra las páginas oficiales indicadas en cada sección; cuando no fue posible extraer una cifra exacta de la página oficial (contenido renderizado por JavaScript) se usó una fuente secundaria confiable y se marca explícitamente como **[no verificado en página oficial]**.

## Resumen ejecutivo

**Recomendación principal: Cloudflare R2** como bucket S3-compatible primario para los archivos adjuntos de `attachments`.

Motivos clave:
- **Cero costo de egreso** (descargas), lo cual es crítico porque el flujo de Dentalware es "subir pocas veces, ver muchas veces" (galerías de fotos por orden de trabajo, vistas repetidas en PWA/móvil). Con proveedores que cobran por descarga, ese patrón de uso puede volverse impredecible; con R2 nunca lo será.
- Capa gratuita generosa (10 GB-mes de almacenamiento, 1M operaciones de escritura y 10M de lectura al mes) que cubre casi por completo el escenario de 20 GB y buena parte del de 100 GB.
- Precio de almacenamiento bajo ($0.015/GB-mes) y sin cargo mínimo mensual ni retención mínima obligatoria (a diferencia de Wasabi).
- 100% compatible con S3 (`@aws-sdk/client-s3` funciona sin cambios), lo que preserva la portabilidad hacia otro proveedor si el laboratorio crece o cambia de estrategia.
- Cloudflare es una empresa grande y estable (bajo riesgo de que el servicio desaparezca), con red global (anycast) que ayuda a la latencia de descarga desde Ecuador aunque el bucket se ubique en Norteamérica.

**Alternativa recomendada: Backblaze B2** como segundo proveedor para respaldo/replicación cruzada (regla 3-2-1: base de datos + bucket primario con versionado + copia en un proveedor distinto). B2 es igual de maduro, S3-compatible, muy barato a mayor escala ($6.95/TB-mes) y con egreso gratuito hasta 3x el almacenamiento promedio mensual (más que suficiente para 1 GB/mes de descargas de verificación). Mantener R2 y B2 simultáneamente cuesta centavos de dólar al mes en los escenarios de Dentalware y elimina el riesgo de depender de un solo proveedor.

Para el escenario de **100 GB almacenados + ~1 GB/mes de egreso**, el costo estimado es de aproximadamente **US$1.35/mes en Cloudflare R2** (o ~US$1.96/mes si además se replica una copia completa a Backblaze B2 como respaldo, sumando ~US$0.63/mes de B2). Ambos números son órdenes de magnitud más baratos que expandir el disco de la VPS de Hostinger (que además no ofrece almacenamiento de objetos distribuido) o que Wasabi/Hetzner, que aplican un piso mínimo de facturación cercano a US$7-8/mes independientemente del uso real por debajo de 1 TB.

---

## Requisitos

- App: PWA React + API Hono, autoalojada con Docker en una única VPS de Hostinger (disco tope de 100 GB) en Ecuador.
- Usuarios: técnicos de laboratorio, recepcionistas, un mensajero/courier; suben evidencia por orden de trabajo.
- Tipos de archivo: fotos de celular (JPEG/HEIC comprimidas en cliente a ≤1600px, ~200-600 KB c/u), PDFs y escaneos ocasionales, archivos pequeños de texto/gráficos, y a futuro archivos STL/3D pequeños.
- Volumen esperado: 50-200 órdenes de trabajo/mes × 3-8 fotos → decenas de GB por año, con crecimiento sostenido.
- Requisitos del dueño (Nelson): flexible, distribuido/duradero (no depender del disco único de la VPS), lo más barato posible; laboratorio en Ecuador, facturación en USD.
- Diseño de datos ya planificado: tabla `attachments` con `storage_path`, URLs firmadas (presigned) servidas a través de la API, respaldos diarios.

---

## Tabla comparativa

Todas las cifras verificadas el **2026-09-05** salvo que se indique lo contrario.

| Proveedor | Almacenamiento | Egreso / API | Free tier | Mínimo mensual / retención mínima | S3-compatible | Regiones cercanas a Ecuador | Durabilidad / replicación | Lock-in |
|---|---|---|---|---|---|---|---|---|
| **Cloudflare R2** | $0.015/GB-mes (Standard); $0.01/GB-mes (Infrequent Access) | Egreso **gratis siempre** (todas las clases). Class A (escritura/list) $4.50/millón; Class B (lectura) $0.36/millón | 10 GB-mes almacenamiento, 1M Class A, 10M Class B por mes | Sin mínimo mensual. Sin retención mínima documentada | Sí (API S3 nativa) | Colocación automática (elige la más cercana al request) o "location hints" (`enam` = Norteamérica Este es la opción más cercana a Ecuador; no hay hint de Sudamérica) | Replicación automática dentro de la red de Cloudflare (multi-AZ/multi-región gestionada por Cloudflare; no documentan cifra de "9s" pública) | Bajo: API S3 estándar, exportable con cualquier herramienta S3 |
| **Backblaze B2** | $6.95/TB-mes (~$0.0068-0.0070/GB-mes) | Egreso gratis hasta 3x el almacenamiento promedio mensual; excedente $0.01/GB. Egreso ilimitado gratis vía CDNs partner (Cloudflare, Fastly, bunny.net, etc.) | Primeros 10 GB de almacenamiento gratis; llamadas API clase A/B/C gratis | Sin mínimo mensual, sin retención mínima ("no minimum file size or storage duration fees") | Sí | US East (Reston, VA), US West (Sacramento/Phoenix), EU Central (Ámsterdam), CA East (Toronto). La más cercana es **US East (Virginia)** | Replicación dentro del datacenter regional elegido; replicación cross-región disponible como feature de "Groups" (pagada por separado) | Bajo |
| **Hetzner Object Storage** | Precio base €6.49/mes incluye 1 TB de almacenamiento + 1 TB de egreso; excedente de almacenamiento ≈€8.70/TB-mes (~€0.0085/GB-mes), excedente de egreso ≈€1/TB (~€0.001/GB) [precio base confirmado en hetzner.com/pressroom (lanzamiento, $5.99/€4.99) y actualizado a €6.49 según benchmark de terceros de abril 2026 y guía de julio 2026 — **cifra de €6.49 no verificada directamente en la página oficial** porque el precio se renderiza vía JavaScript y no aparece en el HTML estático; se recomienda confirmar en el panel de Hetzner antes de decidir] | Incluido hasta 1 TB, luego ~€1/TB | Ninguno explícito, pero el precio base ya cubre 1 TB | Cargo por hora con tope mensual (el "mínimo" de facto es el precio base, aunque uses 1 GB) | Sí | Falkenstein (FSN1), Núremberg (NBG1), Helsinki (HEL1) — todas en Alemania/Finlandia. **No hay región en América**; latencia mayor desde Ecuador que las opciones en EE. UU. | Backend Ceph, cumplimiento GDPR (Alemania) | Bajo |
| **Wasabi** | $7.99/TB-mes (pay-as-you-go, ~$0.0078/GB-mes), con **cargo mínimo por 1 TB de almacenamiento activo** aunque se use menos | Sin cargo por egreso ni por solicitudes API en el plan pay-as-you-go | No hay tier gratis permanente | **Mínimo mensual: se factura como mínimo 1 TB** aunque se almacene menos. **Retención mínima de 90 días** (Pay-as-you-Go): borrar un objeto antes de 90 días genera cargo por los días restantes | Sí | us-east-1/2 (Virginia), us-central-1 (Texas), us-west-1/2 (Oregon/San José), ca-central-1 (Toronto). Ninguna en Sudamérica; la más cercana es Texas/Virginia | No publican cifra específica de "9s"; multi-disco/redundancia interna | Bajo, pero el mínimo de 1 TB y la retención de 90 días son fricciones si se necesita borrar evidencia joven |
| **DigitalOcean Spaces** | $5/mes incluye 250 GiB + 1 TiB egreso (bundle tipo suscripción); excedente almacenamiento $0.02/GiB, excedente egreso $0.01/GiB | Ver arriba (incluido en el bundle) | Ninguno adicional (el bundle de $5 ya es generoso) | Cargo fijo de $5/mes mientras exista al menos un bucket, independientemente del uso | Sí | NYC1/2/3, SFO2/3, AMS3, SGP1, LON1, FRA1, TOR1, etc. Ninguna en Sudamérica; la más cercana es NYC | CDN integrado (Spaces CDN) con puntos de presencia en Latinoamérica (incl. Guadalajara, Ciudad de México, Querétaro) que ayudan a la latencia de lectura | Bajo |
| **Scaleway Object Storage** | Standard Multi-AZ €0.000022/GB-hora (~€0.0161/GB-mes); Standard One Zone ~€0.0080/GB-mes; Glacier ~€0.0025/GB-mes | 75 GB gratis de egreso al mes, luego €0.01/GB. Sin cargo por requests | 750 GB de almacenamiento gratis durante 90 días para cuentas nuevas | Sin mínimo mensual fijo | Sí | París, Ámsterdam, Varsovia (todas en Europa). **No hay presencia en América**; mayor latencia desde Ecuador | Multi-AZ dentro de Francia (Standard Multi-AZ) | Bajo |
| **Storj** | Tres niveles: Global Collaboration $15/TB-mes, Regional Workflows $10/TB-mes, Active Archive $6/TB-mes | Global/Regional incluyen 1x egreso gratis (igual al volumen almacenado), luego $0.02/GB o $0.01/GB según tier; Active Archive cobra $0.02/GB sin gratuidad | Mínimo mensual de $5 en cuentas Standard/Advanced | Active Archive exige 30 días de retención mínima; Global/Regional sin mínimo de retención | Sí (gateway S3) | Red descentralizada global (miles de nodos operados por terceros); no hay "región" fija, por lo que la cercanía a Ecuador depende de qué nodos sirvan cada pieza | Codificación de borrado (erasure coding, p. ej. k=29 de 80 fragmentos) distribuida entre nodos no correlacionados — durabilidad muy alta sin depender de un solo datacenter | Bajo técnicamente, pero el modelo descentralizado es menos predecible en latencia |
| **Contabo Object Storage** | Desde €2.49/mes por 250 GB (Europa); €4.98/500 GB; €9.96/1 TB; escalas hasta 10 TB por €99.60/mes | Transferencia (egreso) **incluida sin límite** en la tarifa plana | Ninguno | El plan mínimo es de 250 GB por €2.49/mes (no hay "pago por GB" fino por debajo de ese piso) | Sí | Europa, Estados Unidos, Asia (3 regiones globales). Región US disponible, pero sin más detalle público de ciudad; probablemente más cercana que Europa | Triple replicación de cada objeto entre servidores (según su propia página) | Bajo, pero Contabo tiene reputación mixta de soporte/estabilidad (riesgo operativo, no técnico) |
| **Hostinger (almacenamiento propio)** | Hostinger **no ofrece un producto nativo de almacenamiento de objetos S3**. La única vía es (a) subir el plan de VPS completo (no se puede ampliar solo el disco) o (b) instalar una app de un clic tipo RustFS/SeaweedFS **sobre la misma VPS** | N/A | N/A | El upgrade de plan VPS es todo-o-nada; ejemplo: KVM 2 (100 GB NVMe) ronda $8.79/mes con descuento a 2 años, $24.49/mes sin descuento | RustFS/SeaweedFS sobre Hostinger sí exponen API S3, pero corren en el mismo disco físico de la VPS | N/A | Instalar objeto storage por software en la misma VPS **no resuelve el requisito de "no depender del disco único"**: sigue siendo un solo disco, un solo punto de falla | Ninguno adicional, pero no cumple el requisito de distribución/durabilidad |
| **Self-hosted (Garage/SeaweedFS/MinIO) en una segunda VPS barata o Hetzner Storage Box** | Costo = costo del servidor. P. ej. Hetzner Storage Box BX11 (1 TB) ≈ €3.20/mes [fuente: docs.aeroftp.app y whtop.com, agregadores de terceros; **no se pudo confirmar el número exacto en la página oficial de Hetzner porque el precio se renderiza dinámicamente** — verificar en el panel antes de decidir]; BX21 (5 TB) ≈€10.90, BX31 (10 TB) ≈€20.80, BX41 (20 TB) ≈€40.60 [misma fuente, no verificado en hetzner.com] | Tráfico incluido/ilimitado en Storage Box | N/A | N/A | Depende del software: Garage y SeaweedFS sí hablan S3; **Hetzner Storage Box en sí NO es S3** (es SFTP/WebDAV/Samba), haría falta correr un gateway S3 encima | Ubicación fija (Alemania/Finlandia si es Storage Box; o la región de la VPS elegida) | **Importante**: un solo Storage Box o una sola VPS sigue siendo un único punto de falla — no cumple el objetivo de "distribuido/duradero" salvo que se despliegue Garage en 2-3 nodos geo-distribuidos (mayor costo y complejidad operativa) | Alto esfuerzo operativo propio (parches, monitoreo, backups del propio object storage) |

**Nota sobre MinIO**: el servidor comunitario de MinIO fue archivado por su fabricante en 2025-2026 (repositorio marcado `archived: true`, sin binarios precompilados nuevos, última release de octubre de 2025); sigue siendo AGPLv3 y funcional, pero **no se recomienda para un despliegue nuevo en 2026**. Si se opta por autoalojar, **Garage** (Rust, AGPLv3, diseñado para operar en 2-3 nodos geo-distribuidos con poco RAM) es la alternativa recomendada en 2026 sobre MinIO o SeaweedFS para un caso de uso pequeño como Dentalware. Fuente: análisis de terceros (bigiron.cc, shipgarden.com), no una página oficial de precios — se cita como contexto de arquitectura, no de costo.

Fuentes oficiales citadas arriba:
- Cloudflare R2: https://developers.cloudflare.com/r2/pricing/ y https://developers.cloudflare.com/r2/reference/data-location/ (verificado 2026-09-05)
- Backblaze B2: https://www.backblaze.com/cloud-storage/pricing y https://www.backblaze.com/docs/cloud-storage-data-regions (verificado 2026-09-05)
- Hetzner Object Storage: https://www.hetzner.com/storage/object-storage/ (precio no renderizado en fetch estático), https://docs.hetzner.com/storage/object-storage/overview/, https://www.hetzner.com/pressroom/object-storage/ (verificado 2026-09-05; cifra de €6.49 corroborada solo por fuentes de terceros, ver nota arriba)
- Wasabi: https://wasabi.com/pricing, https://wasabi.com/pricing/faq, https://docs.wasabi.com/docs/how-does-wasabis-minimum-storage-duration-policy-work, https://wasabi.com/company/storage-regions (verificado 2026-09-05)
- DigitalOcean Spaces: https://www.digitalocean.com/pricing/spaces-object-storage, https://docs.digitalocean.com/products/spaces/details/pricing/, https://docs.digitalocean.com/products/spaces/details/availability/ (verificado 2026-09-05)
- Scaleway: https://www.scaleway.com/en/pricing/storage/, https://www.scaleway.com/en/docs/object-storage/faq/ (verificado 2026-09-05)
- Storj: https://www.storj.io/pricing, https://storj.dev/dcs/pricing/tiered (verificado 2026-09-05)
- Contabo: https://contabo.com/en/object-storage/ (verificado 2026-09-05)
- Hostinger: https://www.hostinger.com/support/1583229-how-to-upgrade-a-vps-server-at-hostinger/, https://www.hostinger.com/applications/rustfs, https://www.hostinger.com/applications/seaweedfs, https://www.hostinger.com/pricing (verificado 2026-09-05; Hostinger no publica un producto de object storage propio)
- Hetzner Storage Box: https://www.hetzner.com/storage/storage-box/ (precios no renderizados en fetch estático; cifras tomadas de https://docs.aeroftp.app/providers/hetzner-storage-box y https://www.whtop.com/plans/hetzner.com/128269, **no verificado directamente en la página oficial**)

---

## Costos estimados (3 escenarios)

Escenario base: **1 GB/mes de egreso** en los tres casos, variando solo el almacenamiento total (20 GB, 100 GB, 500 GB). Se calculan los 4 candidatos principales (los productos de object storage "puro" más relevantes para el caso de uso, con modelo S3 nativo): **Cloudflare R2, Backblaze B2, Wasabi y Hetzner Object Storage**.

| Escenario | Cloudflare R2 | Backblaze B2 | Wasabi | Hetzner Object Storage |
|---|---|---|---|---|
| **20 GB** almacenados | (20 − 10 GB gratis) × $0.015 = **≈$0.15/mes** (egreso $0, dentro del free tier de operaciones) | (20 − 10 GB gratis) × ~$0.0069 = **≈$0.07/mes** (egreso gratis, muy por debajo del 3x de tolerancia) | **$7.99/mes** (se factura el mínimo de 1 TB aunque solo se usen 20 GB; egreso gratis) | **≈€6.49/mes (~$7.0/mes\*)** — precio base plano, ya incluye hasta 1 TB de almacenamiento y 1 TB de egreso |
| **100 GB** almacenados | (100 − 10) × $0.015 = **≈$1.35/mes** | (100 − 10) × ~$0.0069 = **≈$0.63/mes** | **$7.99/mes** (mismo mínimo de 1 TB) | **≈€6.49/mes (~$7.0/mes\*)** (sigue dentro del 1 TB incluido) |
| **500 GB** almacenados | (500 − 10) × $0.015 = **≈$7.35/mes** | (500 − 10) × ~$0.0069 = **≈$3.38/mes** | **$7.99/mes** (todavía bajo el umbral de 1 TB) | **≈€6.49/mes (~$7.0/mes\*)** (sigue dentro del 1 TB incluido) |

\* Conversión EUR→USD aproximada (~1.08), **no verificada con una fuente de tipo de cambio en esta investigación** — tratar como referencial.

Lecturas clave:
- **R2 y B2 son los únicos que escalan de forma proporcional al uso real** por debajo de 1 TB; ambos son dramáticamente más baratos que Wasabi/Hetzner en los escenarios de 20 GB y 100 GB, que son los realistas para Dentalware en el corto/mediano plazo.
- **Wasabi y Hetzner cobran esencialmente lo mismo (~$7-8/mes) sin importar si usas 20 GB o 500 GB**, porque ambos tienen un piso de facturación atado a 1 TB. Esto los hace poco atractivos ahora, pero interesantes si el volumen creciera por encima de varios cientos de GB (a partir de cierto punto, ese precio plano puede ganarle a R2/B2 por GB marginal).
- Si se combinan **R2 (primario) + B2 (respaldo/réplica)** como se recomienda más abajo, el costo combinado en el escenario de 100 GB sería de aproximadamente **$1.35 + $0.63 ≈ $2.00/mes**, todavía muy por debajo de cualquier alternativa de un solo proveedor con piso de facturación.
- Ninguno de estos 4 candidatos tiene presencia física en Sudamérica; la latencia de subida/descarga desde Ecuador será similar entre R2 (red anycast de Cloudflare, generalmente la de mejor rendimiento percibido fuera de EE. UU./Europa por su red global), B2 US East/West y Hetzner (Alemania, la opción con mayor latencia esperada desde Ecuador).

---

## Arquitectura recomendada para Dentalware

1. **Adaptador S3 en la API (Hono)**: implementar una interfaz `StorageService` (p. ej. `putObject`, `getSignedGetUrl`, `getSignedPutUrl`, `deleteObject`) usando `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`, apuntando al endpoint S3-compatible de Cloudflare R2 (`https://<account-id>.r2.cloudflarestorage.com`). Esto desacopla el código de negocio del proveedor concreto: migrar a B2, Hetzner o cualquier otro backend S3 en el futuro es solo cambiar variables de entorno (endpoint, región, credenciales), no reescribir lógica.

2. **Flujo de subida**: el cliente (PWA) comprime la imagen a ≤1600 px client-side (ya planeado) y la sube directamente al bucket usando una **URL prefirmada de PUT** generada por la API (evita que los bytes de la foto pasen por la VPS de Hostinger, ahorrando CPU/ancho de banda del servidor y evitando cuellos de botella en el disco de 100 GB).

3. **Flujo de descarga/visualización**: servir las imágenes con **URLs prefirmadas de GET** de corta duración (5-15 minutos) directamente desde el bucket, en vez de proxiarlas a través de la API. Con R2 esto es gratis siempre (cero egreso); con B2, el egreso hacia el navegador del usuario consume la misma cuota gratuita de "3x almacenamiento" tanto si se sirve vía URL directa como si se proxya por la API — la diferencia real de proxiar es que consumiría ancho de banda/CPU de la VPS de Hostinger y añadiría latencia extra (cliente → API → bucket → API → cliente) sin ningún beneficio de costo. **Conclusión: usar siempre URLs prefirmadas directas, nunca proxiar los binarios por la API**, salvo que se necesite aplicar watermarking, redimensionado on-the-fly o control de acceso adicional no soportado por el firmado de URL.

4. **Estructura de claves (keys)**: `cases/<caseId>/<uuid>.<ext>` como ya está planeado. Importante: **no incluir nombres de pacientes ni datos identificables en la key** (usar solo el UUID del `caseId`, que ya es un identificador opaco); cualquier metadato personal debe vivir únicamente en la base de datos Postgres (que ya tiene controles de acceso y backups), nunca en el nombre del archivo ni en metadatos S3 públicos.

5. **Versionado y respaldo (backup)**:
   - Activar **object versioning** en el bucket primario de R2 (protege contra sobrescritura/borrado accidental).
   - Complementar la regla 3-2-1 con una **réplica nocturna a un segundo proveedor** (Backblaze B2) usando `rclone sync` en un cron job dentro de la propia infraestructura Docker (contenedor liviano con `rclone`, ejecutado diariamente junto al backup de Postgres ya planeado). Esto da redundancia entre proveedores sin depender de un solo punto de fallo, y es prácticamente gratis dado el volumen (ver tabla de costos).
   - El backup diario de la base de datos (ya planeado) sigue siendo indispensable porque `attachments.storage_path` es la única referencia a dónde vive cada archivo; sin la fila en Postgres, el archivo en el bucket queda "huérfano".

6. **Ciclo de vida (lifecycle) simple**: dado el volumen (decenas de GB/año), no es urgente, pero se puede configurar desde el día uno con poco esfuerzo:
   - Órdenes de trabajo activas/recientes (p. ej. <180 días desde el cierre del caso) → clase de almacenamiento **Standard** (caliente).
   - Órdenes cerradas hace más de ese umbral → transición automática a **R2 Infrequent Access** ($0.01/GB-mes de almacenamiento, con cargo de $0.01/GB por recuperación) vía una regla de lifecycle S3 estándar. Esto reduce aún más el costo de almacenamiento a largo plazo sin intervención manual, sabiendo que rara vez se van a re-consultar casos antiguos.

7. **Migración futura**: si Dentalware creciera lo suficiente como para que el piso de facturación de Wasabi/Hetzner (~$7-8/mes por hasta 1 TB) se vuelva más barato que el costo variable de R2/B2, o si se necesitara presencia regional distinta, la migración es: (a) apuntar el adaptador `StorageService` al nuevo endpoint S3, (b) copiar los objetos existentes con `rclone copy` entre los dos endpoints S3, (c) actualizar `storage_path` solo si cambia el esquema de URL (normalmente no, si se mantiene la misma key). No se requiere downtime si se hace la copia antes de cortar el tráfico nuevo hacia el proveedor nuevo.

---

## Riesgos y notas

- **LOPDP (Ecuador) y transferencia internacional de datos**: las evidencias fotográficas de trabajos dentales pueden calificar como "datos relativos a la salud" bajo el Art. 30-31 de la LOPDP (dato sensible), y ningún proveedor de los evaluados tiene datacenter en Ecuador ni en Sudamérica — todos implican una **transferencia internacional de datos personales**, regulada por el Capítulo IX de la LOPDP (Arts. 55-61) y por la normativa de la Superintendencia de Protección de Datos Personales (SPDP) sobre transferencias (Resolución SPDP-SPD-2026-0004-R). En la práctica esto implica:
  - Mantener, durante al menos 3 años, documentación que respalde la legalidad de la transferencia (contratos, evaluación de impacto, medidas de seguridad) — según el Art. 4 de dicha resolución.
  - Firmar/aceptar el **Data Processing Agreement (DPA)** que ofrecen estos proveedores (Cloudflare, Backblaze y Hetzner publican DPAs alineados a GDPR, que la SPDP puede considerar como garantía adecuada o insumo para las cláusulas contractuales tipo).
  - Minimizar datos personales en los archivos y en las keys (ver punto 4 de arquitectura): evitar nombres de pacientes en filenames/metadatos, mantenerlos solo en la base de datos.
  - Habilitar **cifrado en reposo** (server-side encryption, disponible en R2, B2 y Hetzner) y **cifrado en tránsito** (TLS, ya implícito en HTTPS/S3).
  - Este documento no es asesoría legal; se recomienda validar con un abogado especializado en protección de datos en Ecuador antes de decidir el proveedor final, especialmente si las fotos pudieran mostrar rasgos identificables del paciente (no solo moldes/dientes).

- **Riesgo de un solo proveedor**: por eso se recomienda la réplica cruzada R2 + B2 desde el día uno, no como algo "para después".

- **Riesgo de "vendor lock-in" bajo, pero no cero**: aunque todos son S3-compatible, hay pequeñas diferencias de comportamiento (límites de tamaño de parte en multipart upload, soporte de ciertas cabeceras, comportamiento de listado) que conviene probar con un smoke test antes de migrar en producción.

- **Riesgo del piso de facturación de Wasabi/Hetzner**: si en algún momento se decide usarlos como primario en vez de secundario, recordar que el costo no baja de ~$7-8/mes incluso con pocos GB, y que Wasabi penaliza el borrado antes de 90 días — mal ajuste si alguna vez se necesita purgar evidencia rápidamente (p. ej. por solicitud de derecho al olvido bajo LOPDP).

- **Cifras no verificadas / a confirmar antes de decidir**:
  - Precio actual exacto de Hetzner Object Storage (€6.49/mes) — la página oficial no expuso el número en el fetch estático; solo se corroboró vía dos fuentes de terceros (benchmark de abril 2026 y guía de julio 2026). **Verificar en el panel de Hetzner antes de presupuestar.**
  - Precios de Hetzner Storage Box (BX11 €3.20, BX21 €10.90, BX31 €20.80, BX41 €40.60) — tomados de agregadores de terceros (docs.aeroftp.app, whtop.com), no de hetzner.com directamente por la misma razón de renderizado dinámico. **Verificar en el panel de Hetzner antes de presupuestar.**
  - Conversión EUR→USD usada en la tabla de costos (~1.08) es referencial, no se consultó una fuente de tipo de cambio en esta investigación.
  - Región exacta (ciudad) de los datacenters de Contabo "United States" — su página no especifica la ciudad/estado.

---

## Fuentes

- Cloudflare R2 — Pricing: https://developers.cloudflare.com/r2/pricing/ (verificado 2026-09-05)
- Cloudflare R2 — Data location: https://developers.cloudflare.com/r2/reference/data-location/ (verificado 2026-09-05)
- Cloudflare — Pricing overview: https://www.cloudflare.com/pricing.md (verificado 2026-09-05)
- Backblaze B2 — Pricing: https://www.backblaze.com/cloud-storage/pricing (verificado 2026-09-05)
- Backblaze B2 — Data regions: https://www.backblaze.com/docs/cloud-storage-data-regions (verificado 2026-09-05)
- Hetzner Object Storage — Producto: https://www.hetzner.com/storage/object-storage/ (verificado 2026-09-05; precio no visible en HTML estático)
- Hetzner Object Storage — Docs/overview: https://docs.hetzner.com/storage/object-storage/overview/ (verificado 2026-09-05)
- Hetzner Object Storage — Nota de prensa de lanzamiento: https://www.hetzner.com/pressroom/object-storage/ (verificado 2026-09-05)
- Hetzner Storage Box — Producto: https://www.hetzner.com/storage/storage-box/ (verificado 2026-09-05; precios no visibles en HTML estático)
- Hetzner Storage Box — precios de terceros: https://docs.aeroftp.app/providers/hetzner-storage-box y https://www.whtop.com/plans/hetzner.com/128269 (verificado 2026-09-05, no oficiales)
- Wasabi — Pricing: https://wasabi.com/pricing (verificado 2026-09-05)
- Wasabi — Pricing FAQ: https://wasabi.com/pricing/faq (verificado 2026-09-05)
- Wasabi — Política de retención mínima: https://docs.wasabi.com/docs/how-does-wasabis-minimum-storage-duration-policy-work (verificado 2026-09-05)
- Wasabi — Regiones: https://wasabi.com/company/storage-regions (verificado 2026-09-05)
- DigitalOcean Spaces — Pricing: https://www.digitalocean.com/pricing/spaces-object-storage (verificado 2026-09-05)
- DigitalOcean Spaces — Pricing docs: https://docs.digitalocean.com/products/spaces/details/pricing/ (verificado 2026-09-05)
- DigitalOcean Spaces — Disponibilidad/regiones/CDN: https://docs.digitalocean.com/products/spaces/details/availability/ (verificado 2026-09-05)
- Scaleway — Pricing storage: https://www.scaleway.com/en/pricing/storage/ (verificado 2026-09-05)
- Scaleway — Object Storage FAQ: https://www.scaleway.com/en/docs/object-storage/faq/ (verificado 2026-09-05)
- Storj — Pricing: https://www.storj.io/pricing (verificado 2026-09-05)
- Storj — Tiered pricing docs: https://storj.dev/dcs/pricing/tiered (verificado 2026-09-05)
- Storj — Redundancia por erasure coding: https://storj.dev/learn/concepts/file-redundancy (verificado 2026-09-05)
- Contabo — Object Storage: https://contabo.com/en/object-storage/ (verificado 2026-09-05)
- Hostinger — Upgrade de VPS: https://www.hostinger.com/support/1583229-how-to-upgrade-a-vps-server-at-hostinger/ (verificado 2026-09-05)
- Hostinger — App RustFS: https://www.hostinger.com/applications/rustfs (verificado 2026-09-05)
- Hostinger — App SeaweedFS: https://www.hostinger.com/applications/seaweedfs (verificado 2026-09-05)
- MinIO/Garage/SeaweedFS — comparación y estado del proyecto MinIO en 2026: https://www.bigiron.cc/guides/minio-vs-garage-vs-seaweedfs y https://www.shipgarden.com/gallery/minio-vs-garage-vs-seaweedfs-self-hosted-s3-nextjs-2026 (verificado 2026-09-05; fuentes de terceros, no oficiales, citadas solo para contexto de arquitectura/estado del proyecto, no para precios)
- Ecuador — LOPDP (texto de la ley): https://rpmilagro.gob.ec/documentos/Leyes/ley_organica_de_proteccion_de_datos_personales.pdf (verificado 2026-09-05)
- Ecuador — SPDP, Resolución sobre transferencias internacionales: https://spdp.gob.ec/wp-content/uploads/2026/01/04.01.01-SPSP-SPD-2026-0004-R-Norma-general-de-transferencias-signed.pdf (verificado 2026-09-05)
- Ecuador — SPDP, Normativa general de aplicación de la LOPDP: https://spdp.gob.ec/wp-content/uploads/2025/07/SPSP-SPD-2025-0024-R-Normativa-General-Aplicacion-de-la-LOPDP-y-su-Reglamento55-signed.pdf (verificado 2026-09-05)
