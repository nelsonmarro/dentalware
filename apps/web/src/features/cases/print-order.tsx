import {
  CHECKLIST_KEYS,
  CHECKLIST_LABEL,
  FDI_QUADRANTS,
  PRINT_COPY_LABEL,
  printCopyShowsPrices,
  SHADE_SYSTEM_LABEL,
} from '@dentalware/shared'
import type { FdiTooth, PrintCopy } from '@dentalware/shared'
import type { LabSettings } from '@/features/config/api'
import { formatMoney } from '@/features/products/pricing-unit-label'
import { cn } from '@/lib/utils'
import type { CaseDetail } from './api'
import { formatDate } from './date-format'
import { QrCode } from './qr-code'

function money(value: string) {
  return formatMoney(value)
}

/** Odontograma estático para la orden impresa: sin botones ni interacción (en papel no hay
 * nada que tocar), marca las piezas de **todas** las líneas del trabajo a la vez. Distinto del
 * `Odontogram` interactivo de `odontogram.tsx` (ese es para el formulario y la ficha en
 * pantalla); este vive solo aquí porque su único consumidor es `PrintOrder`.
 *
 * K-2 (ronda de fixes 1, Tarea 14, #71): rejilla CSS de **16 columnas fijas**, no `flex-wrap` —
 * con 16 celdas y 16 columnas la fila nunca envuelve, sin importar el ancho del contenedor (A4
 * en pantalla o el ancho útil de A5 en impresión, ~470 px); antes el `flex-wrap` partía cada
 * arcada en dos filas apenas faltaba espacio. El borde entre 11|21 y 41|31 marca la línea media
 * de la boca, como en la hoja de papel (`docs/planilla de ingreso actual.jpeg`). */
function PrintOdontogram({ teeth }: { teeth: ReadonlySet<number> }) {
  const arch = (label: string, right: readonly FdiTooth[], left: readonly FdiTooth[]) => (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground print:text-[8px]">{label}</span>
      <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-1 print:gap-0.5">
        {[...right, ...left].map((n, i) => (
          <span
            key={n}
            data-testid={`pieza-${n}`}
            data-marcada={teeth.has(n)}
            className={cn(
              'flex aspect-square items-center justify-center rounded border font-mono text-[10px] print:text-[7px]',
              i === right.length && 'border-l-2 border-l-foreground',
              // I-1: la marca no depende del fondo (con «Gráficos de fondo» desactivado, que es
              // el valor por defecto de Chrome, `background-color` no se imprime pero el color
              // de texto sí — un relleno con texto del mismo color quedaba invisible). El borde
              // grueso y la negrita son la marca real, con el texto siempre en `foreground`; el
              // tinte de fondo queda solo como refuerzo en pantalla/con fondos activos.
              teeth.has(n)
                ? 'border-2 border-foreground bg-foreground/10 font-bold text-foreground'
                : 'border-border text-muted-foreground',
            )}
          >
            {n}
          </span>
        ))}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-2 print:gap-1" data-testid="print-odontogram">
      {arch('Superior', FDI_QUADRANTS[1], FDI_QUADRANTS[2])}
      {arch('Inferior', FDI_QUADRANTS[4], FDI_QUADRANTS[3])}
    </div>
  )
}

/** «Fecha entrega» (M-7, ronda de fixes 1 de la Tarea 14): la comprometida (`promisedDate`,
 * calculada al aceptar el trabajo) manda; si el trabajo aún no se aceptó no existe, y entonces
 * se usa la deseada (`dueDate`) que pidió la clínica. Si tampoco hay deseada, se deja una línea
 * en blanco para que recepción la escriba a mano — igual que en la hoja de papel, donde
 * "Fecha entrega" siempre es un campo, tenga o no dato todavía. */
function DeliveryDate({
  promisedDate,
  dueDate,
}: {
  promisedDate: string | null
  dueDate: string | null
}) {
  const date = promisedDate ?? dueDate
  if (!date) {
    return (
      <span
        data-testid="fecha-entrega-en-blanco"
        className="inline-block w-28 border-b border-foreground align-bottom"
      >
        &nbsp;
      </span>
    )
  }
  return <>{formatDate(date)}</>
}

/** Orden de trabajo imprimible (FIC-1, #71): reproduce los bloques y el orden de la hoja en
 * papel de Arte Dental (spec §5, "Orden de trabajo actual del laboratorio", y la foto
 * `docs/planilla de ingreso actual.jpeg`): (1) encabezado del laboratorio y código con QR,
 * (2) clínica/doctor/paciente/fechas, (3) color y odontograma marcado, (4) líneas,
 * (5) observaciones, (6) lista de verificación ("Importante"), (7) firmas. Cada hoja es una
 * **copia** rotulada (UX3-21, spec §5): la «Copia laboratorio» va al banco del técnico y nunca
 * lleva precios ni total; la «Copia clínica» sí (`printCopyShowsPrices`, shared). Quién puede
 * imprimir cuál lo decide `printCopiesFor(role)` en `PrintCasePage`, no este componente. Las
 * notas internas nunca se imprimen, para nadie — el papel que sale del laboratorio no las tenía.
 *
 * K-1 (ronda de fixes 1): densidad de impresión propia (`print:` en tipos, paddings y
 * separaciones) para que una orden de hasta 4 líneas quepa en **una** página en A4 y en A5
 * (ruling de la Tarea 14); con más líneas puede pasar a una segunda página, pero ningún bloque
 * se corte a la mitad (`break-inside-avoid`).
 *
 * `publicUrl` (I-2): resuelta **fuera** de este componente (`lib/public-url.ts`, inyectada por
 * quien monta `PrintOrder`) para que el QR no dependa de `window.location.origin` leído aquí
 * dentro — así es testeable con un valor fijo y usa `VITE_PUBLIC_URL` en producción. */
export function PrintOrder({
  case: c,
  settings,
  copy,
  publicUrl,
}: {
  case: CaseDetail
  settings: LabSettings
  copy: PrintCopy
  publicUrl: string
}) {
  const showPrices = printCopyShowsPrices(copy)
  // `/t/<código>` es la ruta de la ficha corta (`routes/_app/t.$code.tsx`, FIC-2): si se
  // renombra allí, cambia aquí también — el QR impreso apunta a esa URL.
  const url = `${publicUrl}/t/${c.code}`
  const markedTeeth = new Set(c.items.flatMap((item) => item.teeth))
  const patient = [
    c.patientRef,
    c.patientAge !== null ? `${c.patientAge} años` : null,
    c.patientSex === 'M' ? 'Masculino' : c.patientSex === 'F' ? 'Femenino' : null,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <article className="print-order mx-auto flex max-w-[780px] flex-col gap-6 bg-background p-2 text-foreground print:max-w-none print:gap-1 print:p-0 print:text-[11px] print:leading-tight">
      {/* 1. Encabezado del laboratorio + código y QR */}
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4 print:gap-2 print:pb-1">
        <div className="flex items-start gap-3">
          {settings.logoUrl && (
            <img
              src={settings.logoUrl}
              alt={`Logo de ${settings.name}`}
              className="h-12 w-auto object-contain print:h-9"
            />
          )}
          <div className="flex flex-col gap-1 print:gap-0">
            <h1 className="text-2xl font-semibold print:text-base">{settings.name}</h1>
            {settings.address && <p className="text-sm print:text-[10px]">{settings.address}</p>}
            {settings.phone && <p className="text-sm print:text-[10px]">Cel.: {settings.phone}</p>}
            {settings.ruc && (
              <p className="text-sm text-muted-foreground print:text-[10px]">RUC: {settings.ruc}</p>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 text-right print:gap-1">
          {/* Rótulo de la copia: borde y texto, sin depender de color ni de fondo (en papel,
           * «Gráficos de fondo» viene apagado en Chrome). */}
          <p
            data-testid="rotulo-copia"
            className="rounded border border-foreground px-2 py-0.5 text-xs font-semibold tracking-wide print:text-[9px]"
          >
            {PRINT_COPY_LABEL[copy]}
          </p>
          <h2 className="font-mono text-xl font-semibold print:text-sm">
            Orden de trabajo {c.code}
          </h2>
          <QrCode value={url} size={96} />
        </div>
      </header>

      {/* 2. Clínica / doctor, paciente, fechas */}
      <section className="flex flex-col gap-2 rounded-lg border border-border p-3 print:gap-1 print:p-1.5">
        <h2 className="font-medium print:text-xs">Paciente</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 print:grid-cols-2 print:gap-1">
          <p className="text-sm print:text-[10px]">
            <span className="text-muted-foreground">Clínica / Doctor: </span>
            {c.clinic.name} / {c.doctor.name}
          </p>
          <p className="text-sm print:text-[10px]">
            <span className="text-muted-foreground">Paciente: </span>
            {patient}
          </p>
          <p className="text-sm print:text-[10px]">
            <span className="text-muted-foreground">Fecha ingreso: </span>
            {formatDate(c.receivedAt)}
          </p>
          <p className="text-sm print:text-[10px]">
            <span className="text-muted-foreground">Fecha entrega: </span>
            <DeliveryDate promisedDate={c.promisedDate} dueDate={c.dueDate} />
          </p>
        </div>
      </section>

      {/* 3. Color, referencia y odontograma — lado a lado, como en la hoja de papel */}
      <section className="flex break-inside-avoid flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-start print:flex-row print:gap-3 print:p-1.5">
        <div className="flex flex-col gap-2 sm:w-56 print:w-40 print:gap-1">
          <h2 className="font-medium print:text-xs">Color y sistema</h2>
          <p className="text-sm print:text-[10px]">
            <span className="text-muted-foreground">Color: </span>
            {c.shade || '—'}
          </p>
          <p className="text-sm print:text-[10px]">
            <span className="text-muted-foreground">Sistema: </span>
            {c.shadeSystem ? SHADE_SYSTEM_LABEL[c.shadeSystem] : '—'}
          </p>
          <p className="text-sm print:text-[10px]">
            <span className="text-muted-foreground">Referencia: </span>
            {c.reference || '—'}
          </p>
        </div>
        <div className="flex flex-1 flex-col gap-2 print:gap-1">
          <h2 className="font-medium print:text-xs">Odontograma</h2>
          <PrintOdontogram teeth={markedTeeth} />
        </div>
      </section>

      {/* 4. Descripción del trabajo: líneas */}
      <section className="flex flex-col gap-2 rounded-lg border border-border p-3 print:gap-1 print:p-1.5">
        <h2 className="font-medium print:text-xs">Líneas</h2>
        {c.items.map((item) => (
          <div
            key={item.id}
            className="flex break-inside-avoid flex-wrap items-start justify-between gap-3 border-b border-dashed border-border pb-2 last:border-b-0 last:pb-0 print:gap-2 print:pb-1"
          >
            <div>
              <p className="text-sm font-medium print:text-[10px]">
                {item.product?.name ?? item.description ?? 'Sin descripción'}
              </p>
              {item.teeth.length > 0 && (
                <p className="font-mono text-xs text-muted-foreground print:text-[9px]">
                  Piezas: {item.teeth.join(', ')}
                </p>
              )}
              {item.material && (
                <p className="text-xs text-muted-foreground print:text-[9px]">{item.material}</p>
              )}
            </div>
            <div className="flex gap-4 text-sm print:gap-2 print:text-[10px]">
              <span>Cant.: {item.quantity}</span>
              {showPrices && <span className="font-mono">{money(item.lineTotal)}</span>}
            </div>
          </div>
        ))}
        {showPrices && (
          <p className="flex justify-end gap-2 pt-1 text-sm font-semibold print:text-[10px]">
            <span>Total:</span>
            <span className="font-mono">{money(c.total)}</span>
          </p>
        )}
      </section>

      {/* 5. Observaciones */}
      <section className="flex flex-col gap-2 rounded-lg border border-border p-3 print:gap-1 print:p-1.5">
        <h2 className="font-medium print:text-xs">Observaciones</h2>
        <p className="text-sm whitespace-pre-wrap print:text-[10px]">{c.observations || ' '}</p>
        {c.prescription && (
          <p className="text-sm whitespace-pre-wrap print:text-[10px]">{c.prescription}</p>
        )}
      </section>

      {/* 6. Importante: lista de verificación */}
      <section className="flex break-inside-avoid flex-col gap-2 rounded-lg border border-border p-3 print:gap-1 print:p-1.5">
        <h2 className="font-medium print:text-xs">Lista de verificación</h2>
        <p className="flex flex-wrap gap-4 text-sm print:gap-2 print:text-[10px]">
          {CHECKLIST_KEYS.map((key) => (
            <span key={key}>
              {c.checklist[key] ? '☑' : '☐'} {CHECKLIST_LABEL[key]}
            </span>
          ))}
        </p>
      </section>

      {/* 7. Firmas */}
      <section className="flex break-inside-avoid flex-col gap-3 print:gap-1">
        <h2 className="font-medium print:text-xs">Firmas</h2>
        <div className="flex flex-wrap justify-between gap-8 print:gap-6">
          <div className="flex flex-1 flex-col items-center gap-1">
            <span className="w-full border-t border-foreground pt-1 text-center text-sm print:text-[10px]">
              Técnico responsable{c.technician ? ` (${c.technician.name})` : ''}
            </span>
          </div>
          <div className="flex flex-1 flex-col items-center gap-1">
            <span className="w-full border-t border-foreground pt-1 text-center text-sm print:text-[10px]">
              Dr. / Cliente
            </span>
          </div>
        </div>
      </section>
    </article>
  )
}
