import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithRouter } from '@/test/router'
import { AppShell } from './app-shell'

const USER = { name: 'Ana', role: 'admin' as const }

describe('AppShell', () => {
  it('la navegación de escritorio tiene nombre accesible', async () => {
    renderWithRouter(<AppShell user={USER}>contenido</AppShell>)
    expect(await screen.findByRole('navigation', { name: 'Principal' })).toBeInTheDocument()
  })

  it('la navegación inferior móvil tiene un nombre accesible distinto', async () => {
    renderWithRouter(<AppShell user={USER}>contenido</AppShell>)
    expect(await screen.findByRole('navigation', { name: 'Principal móvil' })).toBeInTheDocument()
  })

  it('el botón de cerrar sesión de la barra lateral muestra el texto, no solo el icono', async () => {
    renderWithRouter(<AppShell user={USER}>contenido</AppShell>)
    const sidebar = (await screen.findByRole('navigation', { name: 'Principal' })).closest('aside')
    expect(sidebar).not.toBeNull()
    const { getByRole } = within(sidebar!)
    expect(getByRole('button', { name: 'Cerrar sesión' })).toHaveTextContent('Cerrar sesión')
  })
})
