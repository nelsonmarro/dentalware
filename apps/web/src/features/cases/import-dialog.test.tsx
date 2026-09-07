import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { ImportDialog } from './import-dialog'

const { validateImport, commitImport } = vi.hoisted(() => ({
  validateImport: vi.fn(),
  commitImport: vi.fn(),
}))
vi.mock('./api', () => ({ validateImport, commitImport }))

function csvFile() {
  return new File(['clinica,doctor\nSonrisa,Pérez'], 'trabajos.csv', { type: 'text/csv' })
}

describe('ImportDialog', () => {
  it('enlaza la descarga de la plantilla', () => {
    renderWithProviders(<ImportDialog open onOpenChange={() => {}} />)
    expect(screen.getByRole('link', { name: 'Descargar plantilla' })).toHaveAttribute(
      'href',
      '/api/trabajos/importar/plantilla',
    )
  })

  it('valida el archivo elegido y muestra la tabla de errores', async () => {
    validateImport.mockResolvedValue({
      totalRows: 1,
      cases: 0,
      errors: [{ row: 2, column: 'clinica', message: 'La clínica "X" no existe' }],
      created: [],
    })
    const { user } = renderWithProviders(<ImportDialog open onOpenChange={() => {}} />)

    await user.upload(screen.getByLabelText('Archivo CSV'), csvFile())
    await user.click(screen.getByRole('button', { name: 'Validar' }))

    await waitFor(() => expect(validateImport).toHaveBeenCalledWith(expect.any(File)))
    const table = await screen.findByRole('table')
    expect(within(table).getByText('2')).toBeInTheDocument()
    expect(within(table).getByText('clinica')).toBeInTheDocument()
    expect(within(table).getByText('La clínica "X" no existe')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Importar/ })).not.toBeInTheDocument()
  })

  it('muestra el resumen sin errores y permite importar', async () => {
    validateImport.mockResolvedValue({ totalRows: 3, cases: 2, errors: [], created: [] })
    commitImport.mockResolvedValue({
      totalRows: 3,
      cases: 2,
      errors: [],
      created: ['26-00001', '26-00002'],
    })
    const onOpenChange = vi.fn()
    const { user } = renderWithProviders(<ImportDialog open onOpenChange={onOpenChange} />)

    await user.upload(screen.getByLabelText('Archivo CSV'), csvFile())
    await user.click(screen.getByRole('button', { name: 'Validar' }))

    await screen.findByText('3 filas → 2 trabajos')
    const importButton = screen.getByRole('button', { name: 'Importar 2 trabajos' })
    await user.click(importButton)

    await waitFor(() => expect(commitImport).toHaveBeenCalledWith(expect.any(File)))
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })
})
