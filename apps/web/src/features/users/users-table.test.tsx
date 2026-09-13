import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { setMatchMedia } from '@/test/match-media'
import { renderWithRouter } from '@/test/router'
import type { User } from './api'
import { UsersTable } from './users-table'

// Orden intencionalmente distinto del alfabético: si el clic no reordenara de verdad, la
// aserción de la lista de nombres lo delataría (a diferencia de un fixture ya ordenado).
const USERS = [
  { id: 'u1', name: 'Beto', email: 'beto@lab.local', role: 'tecnico', banned: false },
  { id: 'u2', name: 'Ana', email: 'ana@lab.local', role: 'recepcion', banned: true },
] as unknown as User[]

const namesInOrder = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((r) => r.querySelectorAll('td')[0]?.textContent)

describe('UsersTable', () => {
  it('ordena por nombre al pulsar «Ordenar por Nombre»', async () => {
    setMatchMedia(true)
    const user = userEvent.setup()
    renderWithRouter(
      <UsersTable users={USERS} currentUserId="u1" onEdit={vi.fn()} onToggleBanned={vi.fn()} />,
    )
    await screen.findByRole('table')
    expect(namesInOrder()).toEqual(['Beto', 'Ana'])
    await user.click(screen.getByRole('button', { name: 'Ordenar por Nombre' }))
    expect(namesInOrder()).toEqual(['Ana', 'Beto'])
  })

  it('busca por correo', async () => {
    setMatchMedia(true)
    const user = userEvent.setup()
    renderWithRouter(
      <UsersTable users={USERS} currentUserId="u1" onEdit={vi.fn()} onToggleBanned={vi.fn()} />,
    )
    await user.type(await screen.findByLabelText('Buscar usuario'), 'ana@')
    expect(screen.queryByText('Beto')).not.toBeInTheDocument()
    expect(screen.getByText('Ana')).toBeInTheDocument()
  })

  it('bloquea la acción de bloqueo sobre uno mismo, sin filtrar la lista', async () => {
    setMatchMedia(true)
    renderWithRouter(
      <UsersTable users={USERS} currentUserId="u1" onEdit={vi.fn()} onToggleBanned={vi.fn()} />,
    )
    const selfRow = await screen.findByRole('row', { name: /Beto/ })
    const selfButton = within(selfRow).getByRole('button', { name: 'Bloquear' })
    expect(selfButton).toBeDisabled()
    expect(selfButton).toHaveAttribute('title', 'No puedes modificar tu propio acceso')

    const otherRow = screen.getByRole('row', { name: /Ana/ })
    const otherButton = within(otherRow).getByRole('button', { name: 'Desbloquear' })
    expect(otherButton).toBeEnabled()
  })
})
