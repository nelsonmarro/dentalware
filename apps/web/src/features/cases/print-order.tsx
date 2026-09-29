import {
  CHECKLIST_KEYS,
  CHECKLIST_LABEL,
  FDI_QUADRANTS,
  SHADE_SYSTEM_LABEL,
} from '@dentalware/shared'
import type { FdiTooth } from '@dentalware/shared'
import type { LabSettings } from '@/features/config/api'
import { formatMoney } from '@/features/products/pricing-unit-label'
import type { CaseDetail } from './api'
import { formatDate } from './date-format'
import { QrCode } from './qr-code'

function money(value: string) {
  return formatMoney(value)
}

/** Odontograma estático para la orden impresa: sin botones ni interacción (en papel no hay
 * nada que tocar), marca las piezas de **todas** las líneas del trabajo a la vez. Distinto del
 * `Odontogram` interactivo de `odontogram.tsx` (ese es para el formulario y la ficha en
 * pantalla); este vive solo aquí porque su único consumidor es `PrintOrder`. */
function PrintOdontogram({ teeth }: { teeth: ReadonlySet<number> }) {
  const row = (label: string, right: readonly FdiTooth[], left: readonly FdiTooth[]) => (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1">
        {[...right, ...left].map((n) => (
          <span
            key={n}
            data-testid={`pieza-${n}`}
            data-marcada={teeth.has(n)}
            className={
              'flex size-7 items-center justify-center rounded border font-mono text-[11px] ' +
              (teeth.has(n)
                ? 'border-foreground bg-foreground text-background'
                : 'border-border text-muted-foreground')
            }
          >
            {n}
          </span>
        ))}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-2" data-testid="print-odontogram">
      {row('Superior', FDI_QUADRANTS[1], FDI_QUADRANTS[2])}
      {row('Inferior', FDI_QUADRANTS[4], FDI_QUADRANTS[3])}
    </div>
  )
}

/** Orden de trabajo imprimible (FIC-1, #71): reproduce los bloques y el orden de la hoja en
 * papel de Arte Dental (spec §5, "Orden de trabajo actual del laboratorio", y la foto
 * `docs/planilla de ingreso actual.jpeg`): (1) encabezado del laboratorio y código con QR,
 * (2) clínica/doctor/paciente/fechas, (3) color y odontograma marcado, (4) líneas,
 * (5) observaciones, (6) lista de verificación ("Importante"), (7) firmas. Sin precios ni
 * total con `hidePrices` (técnico y mensajero); las notas internas nunca se imprimen, para
 * nadie — el papel que sale del laboratorio no las tenía. */
export function PrintOrder({
  case: c,
  settings,
  hidePrices,
}: {
  case: CaseDetail
  settings: LabSettings
  hidePrices: boolean
}) {
  const url = `${window.location.origin}/t/${c.code}`
  const markedTeeth = new Set(c.items.flatMap((item) => item.teeth))
  const patient = [
    c.patientRef,
    c.patientAge !== null ? `${c.patientAge} años` : null,
    c.patientSex === 'M' ? 'Masculino' : c.patientSex === 'F' ? 'Femenino' : null,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <article className="print-order mx-auto flex max-w-[780px] flex-col gap-6 bg-background p-2 text-foreground print:max-w-none print:gap-4 print:p-0">
      {/* 1. Encabezado del laboratorio + código y QR */}
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{settings.name}</h1>
          {settings.address && <p className="text-sm">{settings.address}</p>}
          {settings.phone && <p className="text-sm">Cel.: {settings.phone}</p>}
          {settings.ruc && <p className="text-sm text-muted-foreground">RUC: {settings.ruc}</p>}
        </div>
        <div className="flex flex-col items-end gap-2 text-right">
          <h2 className="font-mono text-xl font-semibold">Trabajo {c.code}</h2>
          <QrCode value={url} size={96} />
        </div>
      </header>

      {/* 2. Clínica / doctor, paciente, fechas */}
      <section className="flex flex-col gap-2 rounded-lg border border-border p-3">
        <h2 className="font-medium">Paciente</h2>
        <p className="text-sm">
          <span className="text-muted-foreground">Clínica / Doctor: </span>
          {c.clinic.name} / {c.doctor.name}
        </p>
        <p className="text-sm">
          <span className="text-muted-foreground">Paciente: </span>
          {patient}
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <p className="text-sm">
            <span className="text-muted-foreground">Fecha ingreso: </span>
            {formatDate(c.receivedAt)}
          </p>
          <p className="text-sm">
            <span className="text-muted-foreground">Fecha deseada: </span>
            {formatDate(c.dueDate)}
          </p>
          <p className="text-sm">
            <span className="text-muted-foreground">Fecha entrega: </span>
            {formatDate(c.promisedDate)}
          </p>
        </div>
      </section>

      {/* 3. Color, referencia y odontograma */}
      <section className="flex flex-col gap-3 rounded-lg border border-border p-3">
        <h2 className="font-medium">Color y sistema</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <p className="text-sm">
            <span className="text-muted-foreground">Color: </span>
            {c.shade || '—'}
          </p>
          <p className="text-sm">
            <span className="text-muted-foreground">Sistema: </span>
            {c.shadeSystem ? SHADE_SYSTEM_LABEL[c.shadeSystem] : '—'}
          </p>
          <p className="text-sm">
            <span className="text-muted-foreground">Referencia: </span>
            {c.reference || '—'}
          </p>
        </div>
      </section>
      <section className="flex break-inside-avoid flex-col gap-3 rounded-lg border border-border p-3">
        <h2 className="font-medium">Odontograma</h2>
        <PrintOdontogram teeth={markedTeeth} />
      </section>

      {/* 4. Descripción del trabajo: líneas */}
      <section className="flex flex-col gap-2 rounded-lg border border-border p-3">
        <h2 className="font-medium">Líneas</h2>
        {c.items.map((item) => (
          <div
            key={item.id}
            className="flex break-inside-avoid flex-wrap items-start justify-between gap-3 border-b border-dashed border-border pb-2 last:border-b-0 last:pb-0"
          >
            <div>
              <p className="text-sm font-medium">{item.product?.name}</p>
              {item.teeth.length > 0 && (
                <p className="font-mono text-xs text-muted-foreground">
                  Piezas: {item.teeth.join(', ')}
                </p>
              )}
              {item.material && <p className="text-xs text-muted-foreground">{item.material}</p>}
            </div>
            <div className="flex gap-4 text-sm">
              <span>Cant.: {item.quantity}</span>
              {!hidePrices && <span className="font-mono">{money(item.lineTotal)}</span>}
            </div>
          </div>
        ))}
        {!hidePrices && (
          <p className="flex justify-end gap-2 pt-1 text-sm font-semibold">
            <span>Total:</span>
            <span className="font-mono">{money(c.total)}</span>
          </p>
        )}
      </section>

      {/* 5. Observaciones */}
      <section className="flex min-h-24 flex-col gap-2 rounded-lg border border-border p-3">
        <h2 className="font-medium">Observaciones</h2>
        <p className="text-sm whitespace-pre-wrap">{c.observations || ' '}</p>
        {c.prescription && <p className="text-sm whitespace-pre-wrap">{c.prescription}</p>}
      </section>

      {/* 6. Importante: lista de verificación */}
      <section className="flex break-inside-avoid flex-col gap-2 rounded-lg border border-border p-3">
        <h2 className="font-medium">Lista de verificación</h2>
        <p className="flex flex-wrap gap-4 text-sm">
          {CHECKLIST_KEYS.map((key) => (
            <span key={key}>
              {c.checklist[key] ? '☑' : '☐'} {CHECKLIST_LABEL[key]}
            </span>
          ))}
        </p>
      </section>

      {/* 7. Firmas */}
      <section className="mt-8 flex break-inside-avoid flex-col gap-4">
        <h2 className="font-medium">Firmas</h2>
        <div className="flex flex-wrap justify-between gap-8">
          <div className="flex flex-1 flex-col items-center gap-1">
            <span className="w-full border-t border-foreground pt-1 text-center text-sm">
              Técnico responsable{c.technician ? ` (${c.technician.name})` : ''}
            </span>
          </div>
          <div className="flex flex-1 flex-col items-center gap-1">
            <span className="w-full border-t border-foreground pt-1 text-center text-sm">
              Dr. / Cliente
            </span>
          </div>
        </div>
      </section>
    </article>
  )
}
