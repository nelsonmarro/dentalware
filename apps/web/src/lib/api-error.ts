import { toast } from 'sonner'

export type ApiIssue = { path: string; message: string }
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public issues: ApiIssue[] = [],
  ) {
    super(message)
  }
}

/** Convierte una respuesta no-ok de la API en ApiError con el mensaje en español del servidor. */
export async function throwIfNotOk<T extends Response>(res: T): Promise<Extract<T, { ok: true }>> {
  if (res.ok) return res as Extract<T, { ok: true }>
  let body: { message?: string; issues?: ApiIssue[] } = {}
  try {
    body = (await res.json()) as typeof body
  } catch {
    /* sin cuerpo */
  }
  throw new ApiError(
    body.message ?? 'No se pudo completar la operación',
    res.status,
    body.issues ?? [],
  )
}

export function toastApiError(err: unknown) {
  toast.error(err instanceof ApiError ? err.message : 'No se pudo completar la operación')
}

/**
 * UX3-02: distingue "no existe" de "no se pudo cargar". Un `ApiError` con status 404 (o un
 * status extra propio de la pantalla, p. ej. 422 en `/t/:code` para un código mal formado) es
 * un dato que de verdad no existe; cualquier otro error — sin `ApiError` (un `TypeError` de
 * `fetch` sin red) o un `ApiError` con otro status (500, 403…) — es un fallo de red o del
 * servidor y nunca debe mostrarse como si el trabajo no existiera.
 */
export function isNotFoundError(error: unknown, extraStatuses: readonly number[] = []): boolean {
  return error instanceof ApiError && (error.status === 404 || extraStatuses.includes(error.status))
}
