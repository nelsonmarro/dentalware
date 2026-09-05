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
export async function throwIfNotOk(res: Response): Promise<Response> {
  if (res.ok) return res
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
