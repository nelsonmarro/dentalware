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

  // I-1 (revisión de la Tarea 7): `GET /api/entregas` es de DELIVERY_ROLES; el técnico no
  // debe ver un enlace a una pantalla que siempre fallaría.
  it.each([
    { role: 'admin' as const, entregas: true },
    { role: 'recepcion' as const, entregas: true },
    { role: 'mensajero' as const, entregas: true },
    { role: 'tecnico' as const, entregas: false },
  ])('con rol $role muestra Entregas: $entregas', async ({ role, entregas }) => {
    renderWithRouter(<AppShell user={{ name: 'Ana', role }}>contenido</AppShell>)
    for (const name of ['Principal', 'Principal móvil']) {
      const nav = await screen.findByRole('navigation', { name })
      expect(within(nav).queryByRole('link', { name: /Entregas/ }) !== null).toBe(entregas)
    }
  })

  it.each([
    { role: 'admin' as const, cuentas: true, configuracion: true },
    { role: 'recepcion' as const, cuentas: true, configuracion: false },
    { role: 'tecnico' as const, cuentas: false, configuracion: false },
    { role: 'mensajero' as const, cuentas: false, configuracion: false },
  ])(
    'con rol $role muestra Cuentas: $cuentas y Configuración: $configuracion',
    async ({ role, cuentas, configuracion }) => {
      renderWithRouter(<AppShell user={{ name: 'Ana', role }}>contenido</AppShell>)
      const nav = await screen.findByRole('navigation', { name: 'Principal' })
      expect(within(nav).queryByRole('link', { name: /Cuentas/ }) !== null).toBe(cuentas)
      expect(within(nav).queryByRole('link', { name: /Configuración/ }) !== null).toBe(
        configuracion,
      )
    },
  )
})
