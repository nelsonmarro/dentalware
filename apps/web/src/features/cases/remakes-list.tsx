import { Link } from '@tanstack/react-router'
import { LoadError } from '@/components/load-error'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from './date-format'
import { StatusChip } from './status-chip'
import { useCaseRemakes } from './use-cases'

/**
 * Bloque «Repeticiones» de la ficha del padre (#96, Tarea 9): cada hijo directo —solo el
 * padre inmediato, nunca el árbol completo, ver `CasesRepository.remakesOf`— con su código
 * enlazado, chip de estado, fecha de recepción y motivo, de la más reciente a la más antigua.
 * Sin dinero: ningún rol lo necesita aquí.
 *
 * No se monta mientras carga ni si no hay ninguna (ni siquiera el título): es ruido para la
 * mayoría de fichas, que nunca se repiten. Un fallo de red sí se muestra (`LoadError`): no hay
 * forma de distinguir «sin repeticiones» de «no se pudo cargar» sin avisar (UX3-02).
 */
export function RemakesList({ caseId }: { caseId: string }) {
  const remakes = useCaseRemakes(caseId)

  if (remakes.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle asChild>
            <h2>Repeticiones</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LoadError onRetry={() => void remakes.refetch()} />
        </CardContent>
      </Card>
    )
  }

  if (!remakes.data || remakes.data.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2>Repeticiones</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {remakes.data.map((r) => (
          <div
            key={r.id}
            className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/trabajos/$caseId"
                params={{ caseId: r.id }}
                className="inline-flex min-h-11 items-center font-mono text-sm text-primary underline underline-offset-2"
              >
                {r.code}
              </Link>
              <StatusChip status={r.status} />
            </div>
            <div className="flex flex-col text-sm text-muted-foreground sm:text-right">
              <span>{formatDate(r.receivedAt)}</span>
              {r.remakeReason && <span>{r.remakeReason}</span>}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
