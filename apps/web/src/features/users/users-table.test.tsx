import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { setMatchMedia } from '@/test/match-media'
import { renderWithRouter } from '@/test/router'
import type { User } from './api'
import { UsersTable } from './users-table'

const USERS = [
  { id: 'u1', name: 'Ana', email: 'ana@lab.local', role: 'recepcion', banned: false },
  { id: 'u2', name: 'Beto', email: 'beto@lab.local', role: 'tecnico', banned: true },
] as unknown as User[]

describe('UsersTable', () => {
  it('ordena por nombre, busca por correo y bloquea la acción sobre uno mismo', async () => {
    setMatchMedia(true)
    const user = userEvent.setup()
    renderWithRouter(
      <UsersTable users={USERS} currentUserId="u1" onEdit={vi.fn()} onToggleBanned={vi.fn()} />,
    )
    await user.click(await screen.findByRole('button', { name: 'Ordenar por Nombre' }))
    await user.type(screen.getByLabelText('Buscar usuario'), 'beto@')
    expect(screen.queryByText('Ana')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Desbloquear' })).toBeEnabled()
  })
})
