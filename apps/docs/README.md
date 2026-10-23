# Manual de usuario de Dentalware (`apps/docs`)

El manual en línea para recepción, el mensajero y, más adelante, técnicos y administración: un sitio de
[Docusaurus](https://docusaurus.io) en español, con buscador local y capturas de la app hechas con datos
ficticios. Se publica en `docs.dentalware.naphsoft.dev`.

## Verlo en local

```bash
export PATH=$HOME/.nvm/versions/node/v24.19.0/bin:$PATH
pnpm --filter @dentalware/docs dev      # http://localhost:3100, recarga al guardar
pnpm --filter @dentalware/docs build    # como en CI: falla con un enlace, ancla o imagen rotos
pnpm --filter @dentalware/docs serve    # sirve el build en http://localhost:3100
```

El buscador solo funciona sobre el build (`build` + `serve`), no en `dev`. El `pnpm build` de la raíz
construye también el manual, así que el job `quality` de CI lo comprueba en cada PR.

## Escribir una guía

1. Copia `plantillas/guia.md` (está fuera de `docs/` para que no se publique) a la sección que toque,
   por ejemplo `docs/recepcion/registrar-un-pago.md`, y añádela a `sidebars.ts` en su orden.
2. **Captura primero, texto después**: define las capturas en la tubería (sección siguiente), genéralas,
   míralas y escribe los pasos sobre lo que se ve.
3. Frases cortas, en sentence case y con el vocabulario del laboratorio (trabajo, clínica, doctor,
   pieza, fase, recogida, entrega, saldo a favor). Los botones, tal cual salen en la app.
4. `:::warning Importante` solo para lo que no tiene vuelta (finalizar, cancelar, anular un pago) y
   `:::tip Consejo` para atajos.

Los tres componentes propios se usan en cualquier página sin importarlos:

```mdx
<Rol roles={['admin', 'recepcion']} />
```

Quién puede hacerlo, con los rótulos de la app (`admin`, `recepcion`, `tecnico`, `mensajero`). El MDX
no pasa por `tsc`: otro valor (`'recepción'`, con tilde) rompe el build con «Rol desconocido en
<Rol>».

```mdx
Toca <Boton>Registrar pago</Boton>.
```

El texto de un botón o enlace de la app, tal cual.

```mdx
<Captura
  nombre="recepcion/registrar-pago"
  alt="Diálogo Registrar pago con el reparto sugerido"
  telefono
/>
```

Una captura de `static/img/capturas/<nombre>.escritorio.png`; con `telefono`, también la de
`<nombre>.telefono.png` al lado (debajo en el teléfono), y con `solo="telefono"`, solo esa. `alt`
describe lo que se ve; `pie` añade un texto debajo.

## Regenerar las capturas

`pnpm capturas` (desde la raíz) arranca la API y la web en modo test, carga los datos de demostración y
vuelve a sacar todas las capturas en `static/img/capturas/`. El modo rápido y el detalle de la tubería
se completan con ella (Tarea 3 del plan del manual).

## Qué no puede salir nunca

Ni en el texto ni en una captura: pacientes, clínicas o doctores reales; el nombre, la dirección o los
teléfonos del laboratorio; contraseñas, tokens, IPs ni URLs internas. Las capturas salen solo de los
datos de demostración, que son ficticios.
