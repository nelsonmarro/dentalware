import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { setMatchMedia } from '@/test/match-media'
import { renderWithQueryAndRouter } from '@/test/render'
import { fetchUsers } from './api'
import { UsersList } from './users-list'
import { useUsers } from './use-users'

vi.mock('./api', () => ({ fetchUsers: vi.fn() }))

function Harness() {
  const users = useUsers()
  return <UsersList users={users} currentUserId="u1" onEdit={vi.fn()} onToggleBanned={vi.fn()} />
}

describe('UsersList', () => {
  it('muestra la tabla cuando el catálogo carga bien', async () => {
    setMatchMedia(true)
    vi.mocked(fetchUsers).mockResolvedValue([
      { id: 'u1', name: 'Ana', email: 'ana@lab.local', role: 'admin', banned: false },
    ] as Awaited<ReturnType<typeof fetchUsers>>)

    renderWithQueryAndRouter(<Harness />)

    expect(await screen.findByText('Ana')).toBeInTheDocument()
  })

  // Ronda de fixes 1 (UX3-02, punto 3): un fallo de red mostraba la tabla vacía (sin
  // usuarios).
  it('un fallo de red ofrece reintentar, en vez de una tabla vacía', async () => {
    setMatchMedia(true)
    vi.mocked(fetchUsers).mockRejectedValue(new TypeError('Failed to fetch'))

    renderWithQueryAndRouter(<Harness />)

    const retry = await screen.findByRole('button', { name: 'Reintentar' })
    expect(retry).toBeInTheDocument()
    // Ronda de fixes 2 (I-1): embebido en la lista, no debe robar el foco.
    expect(retry).not.toHaveFocus()
  })
})
