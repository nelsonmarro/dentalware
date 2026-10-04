import type { CaseView } from '@dentalware/shared'
import { CASE_VIEWS } from '@dentalware/shared'
import { Link } from '@tanstack/react-router'
import { LoadError } from '@/components/load-error'
import { CASE_VIEW_LABEL } from './case-views'
import { STATUS_COLOR } from './status-chip'
import { useSummary } from './use-summary'

/**
 * Vistas que arma el panel de inicio (INI-1), en un `Record<CaseView, …>` exhaustivo para que
 * una vista nueva en `CASE_VIEWS` no compile aquí sin decidir su color (mismo patrón que
 * `STATUS_COLOR`/`CASE_VIEW_LABEL`). `todos` no arma tarjeta (se filtra abajo, ruling PR 2,
 * T12): no es un conteo "del día" — es el total histórico de trabajos activos y cancelados
 * aparte, y duplicaría información sin ayudar a planear el día; su color queda declarado por
 * si una tarjeta futura lo necesita.
 */
const VIEW_COLOR: Record<CaseView, string> = {
  nuevos: STATUS_COLOR.nuevo,
  en_curso: STATUS_COLOR.en_proceso,
  vencen_hoy: 'var(--wax-amber)',
  vencen_manana: STATUS_COLOR.en_espera,
  atrasados: STATUS_COLOR.cancelado,
  en_prueba: STATUS_COLOR.en_prueba,
  listos: STATUS_COLOR.terminado,
  todos: STATUS_COLOR.entregado,
}

const SUMMARY_VIEWS = CASE_VIEWS.filter((v): v is Exclude<CaseView, 'todos'> => v !== 'todos')

export function SummaryCards() {
  const summary = useSummary()

  // UX3-02: antes de este cambio, un fallo de red dejaba las seis tarjetas en "—" con
  // `aria-label` "cargando" para siempre — un estado de carga permanente, no un error.
  if (summary.isError) {
    return <LoadError onRetry={() => void summary.refetch()} />
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {SUMMARY_VIEWS.map((vista) => {
        const count = summary.data?.[vista]
        // "En curso" ya incluye los trabajos "en prueba" (ruling PR 2, T12: `viewCondition` en
        // `repo.ts`); la nota dice cuántos (UX3-17) para que recepción no los cuente dos veces.
        // Con cero no hay nada que aclarar: «de ellos 0 en prueba» solo es ruido.
        const note =
          vista === 'en_curso' && summary.data && summary.data.en_prueba > 0
            ? `de ellos ${summary.data.en_prueba} en prueba`
            : undefined
        return (
          <Link
            key={vista}
            to="/trabajos"
            search={{ vista }}
            // `aria-label` explícito: dos nodos de texto hermanos sin separador se concatenan
            // sin espacio en el nombre accesible («Nuevos3»). La nota de «En curso» va también
            // en el nombre: quien usa lector de pantalla necesita la misma aclaración.
            aria-label={
              count === undefined
                ? `${CASE_VIEW_LABEL[vista]}, cargando`
                : [`${CASE_VIEW_LABEL[vista]} ${count}`, note].filter(Boolean).join(', ')
            }
            className="flex min-h-[88px] flex-col justify-between gap-2 rounded-xl border-l-4 bg-card p-4 ring-1 ring-foreground/10 transition-colors hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            style={{ borderLeftColor: VIEW_COLOR[vista] }}
          >
            {/* La nota va con el rótulo, arriba: el número queda abajo en todas las tarjetas
                (con tres hijos, `justify-between` lo subía en «En curso»). */}
            <span className="flex flex-col gap-0.5">
              <span className="text-sm text-muted-foreground">{CASE_VIEW_LABEL[vista]}</span>
              {note && <span className="text-xs text-muted-foreground">{note}</span>}
            </span>
            <span className="font-mono text-2xl font-semibold tabular-nums">{count ?? '—'}</span>
          </Link>
        )
      })}
    </div>
  )
}
