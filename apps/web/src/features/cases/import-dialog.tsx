import { useRef, useState } from 'react'
import { FormDialog } from '@/components/form-dialog'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ImportReport } from './api'
import { useImportCases, useValidateImport } from './use-import'

/**
 * Importación de trabajos desde CSV en dos pasos: elegir archivo y validar, luego
 * revisar el resultado (tabla de errores fila/columna/mensaje, o el resumen "N filas
 * → M trabajos" con el botón para confirmar la creación).
 */
export function ImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [report, setReport] = useState<ImportReport | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const validate = useValidateImport()
  const importCases = useImportCases()

  function reset() {
    setFile(null)
    setReport(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  async function handleValidate() {
    if (!file) return
    try {
      setReport(await validate.mutateAsync(file))
    } catch {
      // El toast de error ya lo muestra `onError` de `useValidateImport`; aquí solo se
      // evita dejar la promesa de este manejador (disparado con `void`) sin capturar.
    }
  }

  async function handleImport() {
    if (!file) return
    try {
      await importCases.mutateAsync(file)
      handleOpenChange(false)
    } catch {
      // Igual que arriba: el toast ya lo muestra `onError` de `useImportCases`; el
      // diálogo se queda abierto con el resumen para que el usuario pueda reintentar.
    }
  }

  const hasErrors = report !== null && report.errors.length > 0
  const canImport = report !== null && !hasErrors

  return (
    <FormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Importar trabajos"
      description="Sube un CSV con la plantilla de trabajos para crear varios a la vez."
      size="wide"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={() => handleOpenChange(false)}
          >
            Cancelar
          </Button>
          {canImport ? (
            <Button
              type="button"
              className="h-11"
              onClick={() => void handleImport()}
              disabled={importCases.isPending}
            >
              {importCases.isPending
                ? 'Importando…'
                : `Importar ${report.cases} ${report.cases === 1 ? 'trabajo' : 'trabajos'}`}
            </Button>
          ) : (
            <Button
              type="button"
              className="h-11"
              onClick={() => void handleValidate()}
              disabled={!file || validate.isPending}
            >
              {validate.isPending ? 'Validando…' : 'Validar'}
            </Button>
          )}
        </>
      }
    >
      <div className="flex min-w-0 flex-col gap-4">
        <a
          href="/api/trabajos/importar/plantilla"
          download="plantilla-trabajos.csv"
          className="text-sm font-medium text-primary underline underline-offset-4 hover:no-underline"
        >
          Descargar plantilla
        </a>
        <Field>
          <FieldLabel htmlFor="import-file">Archivo CSV</FieldLabel>
          <Input
            id="import-file"
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="h-11"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null)
              setReport(null)
            }}
          />
        </Field>
        {report && !hasErrors && (
          <p className="text-sm text-muted-foreground">
            {report.totalRows} {report.totalRows === 1 ? 'fila' : 'filas'} → {report.cases}{' '}
            {report.cases === 1 ? 'trabajo' : 'trabajos'}
          </p>
        )}
        {hasErrors && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fila</TableHead>
                <TableHead>Columna</TableHead>
                <TableHead>Mensaje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.errors.map((e, i) => (
                <TableRow key={i}>
                  <TableCell>{e.row}</TableCell>
                  <TableCell>{e.column}</TableCell>
                  <TableCell>{e.message}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </FormDialog>
  )
}
