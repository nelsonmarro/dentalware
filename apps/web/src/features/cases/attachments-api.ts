import type { AttachmentKind } from '@dentalware/shared'
import { api } from '@/lib/api'
import { throwIfNotOk } from '@/lib/api-error'

const adjuntos = api.api.adjuntos

export type Attachment = {
  id: string
  caseId: string
  kind: AttachmentKind
  filename: string
  mime: string
  size: number
  width: number | null
  height: number | null
  createdAt: string
  uploadedBy: { id: string; name: string } | null
  url: string
  thumbUrl: string | null
}

export async function fetchAttachments(caseId: string): Promise<Attachment[]> {
  return (
    await (await throwIfNotOk(await adjuntos.trabajo[':caseId'].$get({ param: { caseId } }))).json()
  ).attachments
}

/**
 * `POST /api/adjuntos/trabajo/:caseId` recibe `multipart/form-data` con
 * `c.req.parseBody()` a mano (ver `apps/api/src/features/attachments/routes.ts`), sin
 * `validate('form', …)`: el cliente `hc` no tipa `form` para esta ruta, así que se sube
 * con `fetch` directo (mismo transporte y credenciales que usa `hc`).
 */
export async function uploadAttachment(caseId: string, form: FormData): Promise<Attachment> {
  const res = await fetch(`/api/adjuntos/trabajo/${caseId}`, {
    method: 'POST',
    body: form,
    credentials: 'include',
  })
  // `throwIfNotOk<T extends Response>` extrae la variante `{ ok: true }` del tipo hc
  // (union por código de estado); el `Response` nativo de `fetch` tiene `ok: boolean`,
  // así que aquí solo se usa por su efecto de lanzar `ApiError` y se sigue leyendo `res`.
  await throwIfNotOk(res)
  return (await res.json()).attachment
}

export async function deleteAttachment(id: string): Promise<void> {
  await throwIfNotOk(await adjuntos[':id'].$delete({ param: { id } }))
}
