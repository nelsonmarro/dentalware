import { CASE_STATUS_LABEL, toIsoDate } from '@dentalware/shared'
import { Link } from '@tanstack/react-router'
import { LoadError } from '@/components/load-error'
import { AlertChip } from './alert-chip'
import { dueBadge } from './case-views'
import { formatDate } from './date-format'
import { STATUS_COLOR } from './status-chip'
import { useCases } from './use-cases'

/**
 * «Mis trabajos» del panel de inicio (INI-2): solo trabajos **activos** del técnico —
 * `vista: 'en_curso'` (en proceso, en espera y en prueba), no solo `tecnicoId` + `orden`
 * (ruling PR 2, T12). Sin `vista`, la lista cae a `todos` e incluiría terminados, enviados,
 * entregados y cancelados; INI-2 pide justo lo contrario. Un `nuevo` queda fuera a propósito:
 * no está aceptado ni tiene fase, el técnico no puede hacer nada con él todavía.
 *
 * La API ya enmascara el total a `null` para el rol técnico (`stripPrices` en `service.ts`),
 * así que este componente ni siquiera intenta leerlo.
 *
 * `orden: 'entrega'` no ordena solo por fecha (M-7, ronda de fixes 1): `orderFor` (`repo.ts`)
 * antepone siempre los trabajos urgentes, con la fecha como desempate — es la regla de orden
 * de toda la lista de trabajos, no una excepción de esta pantalla, y un trabajo urgente es lo
 * primero que el técnico debe atender aunque venza más tarde que otro normal. INI-2 pide
 * "ordenados por fecha de entrega" pero no exige que sea el único criterio; no lo contradice.
 */
export function MyCases({ technicianId }: { technicianId: string }) {
  const today = toIsoDate(new Date())
  const cases = useCases({ tecnicoId: technicianId, vista: 'en_curso', orden: 'entrega' })
  const rows = cases.data?.cases ?? []

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-lg font-medium">Mis trabajos</h2>
      {cases.isPending ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : cases.isError ? (
        // UX3-02: sin esta rama, un fallo de red se leía como "no tienes trabajos
        // asignados" — un dato falso, no un error que se pueda reintentar.
        <LoadError onRetry={() => void cases.refetch()} />
      ) : rows.length === 0 ? (
        <p className="rounded-xl bg-card p-4 text-sm text-muted-foreground ring-1 ring-foreground/10">
          No tienes trabajos asignados.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => {
            const date = r.promisedDate ?? r.dueDate
            const badge = dueBadge(date, today, r.status)
            return (
              <li key={r.id}>
                <Link
                  to="/trabajos/$caseId"
                  params={{ caseId: r.id }}
                  className="flex flex-col gap-1 rounded-xl border-l-4 bg-card p-4 ring-1 ring-foreground/10 transition-colors hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  style={{ borderLeftColor: STATUS_COLOR[r.status] }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-medium">{r.code}</span>
                    {badge === 'atrasado' && <AlertChip tone="destructive">Atrasado</AlertChip>}
                    {badge === 'hoy' && <AlertChip tone="amber">Vence hoy</AlertChip>}
                  </div>
                  <p className="text-sm">{r.patientRef}</p>
                  <p className="text-sm text-muted-foreground">
                    {r.stage ? r.stage.name : CASE_STATUS_LABEL[r.status]}
                    {/* I-3: en_espera/en_prueba conservan su fase, así que el borde de color
                        (`STATUS_COLOR` de arriba) no basta para distinguirlos de en_proceso
                        (conventions.md §5, nunca solo color) — se repite el rótulo del estado
                        con texto. Si no hay fase, `CASE_STATUS_LABEL` ya salió arriba: no se repite. */}
                    {r.stage && r.status !== 'en_proceso' && ` · ${CASE_STATUS_LABEL[r.status]}`} ·
                    Entrega {formatDate(date)}
                  </p>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
