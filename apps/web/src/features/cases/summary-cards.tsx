import type { CaseView } from '@dentalware/shared'
import { CASE_VIEWS } from '@dentalware/shared'
import { Link } from '@tanstack/react-router'
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
  atrasados: STATUS_COLOR.cancelado,
  en_prueba: STATUS_COLOR.en_prueba,
  listos: STATUS_COLOR.terminado,
  todos: STATUS_COLOR.entregado,
}

const SUMMARY_VIEWS = CASE_VIEWS.filter((v): v is Exclude<CaseView, 'todos'> => v !== 'todos')

export function SummaryCards() {
  const summary = useSummary()

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {SUMMARY_VIEWS.map((vista) => {
        const count = summary.data?.[vista]
        return (
          <Link
            key={vista}
            to="/trabajos"
            search={{ vista }}
            // `aria-label` explícito (en vez de dejar que el nombre accesible del enlace se
            // arme solo con el texto de los `<span>` hijos): dos nodos de texto hermanos sin
            // separador literal se concatenan sin espacio en el cómputo del nombre accesible
            // ("Nuevos3", no "Nuevos 3"), así que "Nuevos 3" quedaba fuera del regex del
            // criterio de aceptación (INI-1) hasta este ajuste. En "En curso" el nombre lleva
            // también la aclaración visual "Incluye en prueba" (M-6, ronda de fixes 1): quien
            // usa lector de pantalla necesita el mismo aviso del doble conteo que ve quien
            // mira la tarjeta, no solo el número.
            aria-label={
              count === undefined
                ? `${CASE_VIEW_LABEL[vista]}, cargando`
                : vista === 'en_curso'
                  ? `${CASE_VIEW_LABEL[vista]} ${count}, incluye en prueba`
                  : `${CASE_VIEW_LABEL[vista]} ${count}`
            }
            className="flex min-h-[88px] flex-col justify-between gap-2 rounded-xl border-l-4 bg-card p-4 ring-1 ring-foreground/10 transition-colors hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            style={{ borderLeftColor: VIEW_COLOR[vista] }}
          >
            <span className="text-sm text-muted-foreground">{CASE_VIEW_LABEL[vista]}</span>
            <span className="font-mono text-2xl font-semibold tabular-nums">{count ?? '—'}</span>
            {/* "En curso" ya incluye los trabajos "en prueba" (ruling PR 2, T12: la vista
                `en_curso` de la API los suma, `viewCondition` en `repo.ts`): la aclaración
                evita que recepción lea el mismo trabajo como contado dos veces por error. */}
            {vista === 'en_curso' && (
              <span className="text-[11px] text-muted-foreground">Incluye en prueba</span>
            )}
          </Link>
        )
      })}
    </div>
  )
}
