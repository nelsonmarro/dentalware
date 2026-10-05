/**
 * `foreign_key_violation` (23503) de Postgres sobre una FK concreta. Drizzle envuelve el error de
 * `pg` en `cause`. Mirar la constraint evita traducir a un error de dominio la violación de otra
 * FK que más adelante apunte a la misma tabla: esa se relanza tal cual.
 */
export const isForeignKeyViolation = (e: unknown, constraint: string): boolean =>
  e instanceof Error &&
  typeof e.cause === 'object' &&
  e.cause !== null &&
  'code' in e.cause &&
  e.cause.code === '23503' &&
  'constraint' in e.cause &&
  e.cause.constraint === constraint
