const VERSION = 'v1'

/** Lee `${key}:v1` de localStorage; ante ausencia, JSON inválido o excepción devuelve `fallback`. */
export function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`${key}:${VERSION}`)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/** Escribe `${key}:v1`; nunca lanza (modo privado, cuota llena, entorno sin storage). */
export function writeStored(key: string, value: unknown): void {
  try {
    localStorage.setItem(`${key}:${VERSION}`, JSON.stringify(value))
  } catch {
    /* sin persistencia: el grid sigue funcionando con estado en memoria */
  }
}
