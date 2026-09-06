import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { setMatchMedia } from '@/test/match-media'
import { DataTable } from './data-table'

const rows = [
  { id: '1', name: 'Zirconio' },
  { id: '2', name: 'Acrílico' },
]
const columns = [{ key: 'name', header: 'Producto', cell: (r: (typeof rows)[number]) => r.name }]

describe('DataTable', () => {
  it('en escritorio renderiza una tabla y ninguna tarjeta', () => {
    setMatchMedia(true)
    render(
      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        emptyMessage="Vacío"
        renderMobile={(r) => <span data-testid="card">{r.name}</span>}
      />,
    )
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.queryAllByTestId('card')).toHaveLength(0)
    expect(screen.getAllByText('Zirconio')).toHaveLength(1)
  })

  it('en móvil renderiza tarjetas y ninguna tabla', () => {
    setMatchMedia(false)
    render(
      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        emptyMessage="Vacío"
        renderMobile={(r) => <span data-testid="card">{r.name}</span>}
      />,
    )
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('card')).toHaveLength(2)
  })

  it('muestra el estado vacío con su acción', () => {
    render(
      <DataTable
        rows={[]}
        columns={columns}
        getRowId={(r) => r.id}
        emptyMessage="Aún no hay filas"
        emptyAction={<button>Crear</button>}
        renderMobile={() => null}
      />,
    )
    expect(screen.getByText('Aún no hay filas')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crear' })).toBeInTheDocument()
  })
})
