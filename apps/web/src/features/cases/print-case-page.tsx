import type { PrintCopy, UserRole } from '@dentalware/shared'
import { printCopiesFor } from '@dentalware/shared'
import { Link } from '@tanstack/react-router'
import { Printer } from 'lucide-react'
import { Fragment, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/empty-state'
import { useLabSettings } from '@/features/config/use-lab-settings'
import { getPublicUrl } from '@/lib/public-url'
import { PrintOrder } from './print-order'
import { useCase } from './use-cases'

/**
 * Pantalla de la orden imprimible (FIC-1, #71): trabajo con esa lógica que antes vivía dentro
 * del archivo de ruta (`routes/_app/trabajos/$caseId_.imprimir.tsx`). Se movió a `features/`
 * (ronda de fixes 1, Tarea 14) para que fuera testeable sin montar el árbol de rutas completo
 * (`Route.useParams()`/`useRouteContext()` no hacen falta aquí: el archivo de ruta se los pasa
 * ya resueltos como props) — I-3, «test de la ruta de impresión».
 *
 * Copias (UX3-21, spec §5): `printCopiesFor(role)` (shared, derivada de `hidesPrices`, ADR 31)
 * decide qué copias puede imprimir cada rol. Técnico y mensajero solo tienen la «Copia
 * laboratorio» y no ven selector. Admin y recepción eligen con unas pestañas «Ambas» (por
 * omisión), «Laboratorio» o «Clínica»: lo habitual al recibir un trabajo es imprimir las dos
 * hojas a la vez (una sola vez Ctrl+P / «Imprimir», cada copia en su página); reimprimir una sola
 * queda a un toque. Se descartaron dos botones «Imprimir copia X» porque el caso habitual
 * obligaba a abrir dos veces el diálogo de impresión.
 */
type PrintSelection = 'ambas' | PrintCopy

const SELECTION_LABEL: Record<PrintSelection, string> = {
  ambas: 'Ambas',
  laboratorio: 'Laboratorio',
  clinica: 'Clínica',
}

const SELECTION_HINT: Record<PrintSelection, string> = {
  ambas:
    'Se imprimen dos hojas: la copia laboratorio, sin precios, y la copia clínica, con precios.',
  laboratorio: 'Copia laboratorio: acompaña al trabajo hasta el banco, sin precios.',
  clinica: 'Copia clínica: con los precios de cada línea y el total.',
}

export function PrintCasePage({ caseId, role }: { caseId: string; role: UserRole }) {
  const detail = useCase(caseId)
  const settings = useLabSettings()
  const copies = printCopiesFor(role)
  const [selection, setSelection] = useState<PrintSelection>('ambas')

  if (detail.isPending || settings.isPending) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>
  }
  if (detail.isError || !detail.data || settings.isError || !settings.data) {
    return (
      <EmptyState
        title="No se pudo cargar la orden"
        action={
          <Button asChild>
            <Link to="/trabajos/$caseId" params={{ caseId }}>
              Volver al trabajo
            </Link>
          </Button>
        }
      />
    )
  }

  const data = detail.data.case
  const lab = settings.data
  const selections: PrintSelection[] = ['ambas', ...copies]

  // Cada copia en su hoja: en papel, salto de página tras todas menos la última.
  const renderCopies = (list: readonly PrintCopy[]) =>
    list.map((copy, index) => (
      <Fragment key={copy}>
        {index > 0 && <hr className="border-dashed print:hidden" aria-hidden />}
        <div className={index < list.length - 1 ? 'print:break-after-page' : undefined}>
          <PrintOrder case={data} settings={lab} copy={copy} publicUrl={getPublicUrl()} />
        </div>
      </Fragment>
    ))

  const toolbar = (
    // M-6: enlace de vuelta junto al botón de imprimir — antes solo existía en la pantalla de
    // error, así que abrir la orden por error o cambiar de opinión no tenía salida sin usar el
    // botón "atrás" del navegador.
    <div className="flex items-center justify-between gap-4 print:hidden">
      <Button variant="outline" asChild className="h-11">
        <Link to="/trabajos/$caseId" params={{ caseId }}>
          Volver al trabajo
        </Link>
      </Button>
      <Button onClick={() => window.print()} className="h-11">
        <Printer /> Imprimir
      </Button>
    </div>
  )

  if (copies.length === 1) {
    return (
      <div className="flex flex-col gap-4">
        {toolbar}
        {renderCopies(copies)}
      </div>
    )
  }

  return (
    <Tabs
      value={selection}
      onValueChange={(value) => setSelection(value as PrintSelection)}
      className="gap-4"
    >
      {toolbar}
      <div className="flex flex-col gap-1.5 print:hidden">
        <span id="copia-a-imprimir" className="text-sm font-medium">
          Copia a imprimir
        </span>
        <TabsList aria-labelledby="copia-a-imprimir" className="w-full sm:w-fit">
          {selections.map((value) => (
            <TabsTrigger key={value} value={value} className="px-4">
              {SELECTION_LABEL[value]}
            </TabsTrigger>
          ))}
        </TabsList>
        <p className="text-sm text-muted-foreground">{SELECTION_HINT[selection]}</p>
      </div>
      {selections.map((value) => (
        <TabsContent key={value} value={value} className="flex flex-col gap-4">
          {renderCopies(value === 'ambas' ? copies : [value])}
        </TabsContent>
      ))}
    </Tabs>
  )
}
