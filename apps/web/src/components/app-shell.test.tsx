import { onlineManager } from '@tanstack/react-query'
import { act, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithQueryAndRouter } from '@/test/render'
import { AppShell } from './app-shell'

const USER = { name: 'Ana', role: 'admin' as const }

describe('AppShell', () => {
  it('la navegación de escritorio tiene nombre accesible', async () => {
    renderWithQueryAndRouter(<AppShell user={USER}>contenido</AppShell>)
    expect(await screen.findByRole('navigation', { name: 'Principal' })).toBeInTheDocument()
  })

  it('la navegación inferior móvil tiene un nombre accesible distinto', async () => {
    renderWithQueryAndRouter(<AppShell user={USER}>contenido</AppShell>)
    expect(await screen.findByRole('navigation', { name: 'Principal móvil' })).toBeInTheDocument()
  })

  // UX7-03: con `viewport-fit=cover` los márgenes de la muesca los pone la página.
  it('cabecera, contenido y barra inferior respetan las zonas seguras', async () => {
    renderWithQueryAndRouter(<AppShell user={USER}>contenido</AppShell>)
    const header = await screen.findByRole('banner')
    for (const side of ['left', 'right', 'top'])
      expect(header.className).toContain(`env(safe-area-inset-${side})`)
    const main = screen.getByRole('main')
    for (const side of ['left', 'right'])
      expect(main.className).toContain(`env(safe-area-inset-${side})`)
    const nav = screen.getByTestId('bottom-nav')
    for (const side of ['left', 'right', 'bottom'])
      expect(nav.className).toContain(`env(safe-area-inset-${side})`)
  })

  it('el botón de cerrar sesión de la barra lateral muestra el texto, no solo el icono', async () => {
    renderWithQueryAndRouter(<AppShell user={USER}>contenido</AppShell>)
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
    renderWithQueryAndRouter(<AppShell user={{ name: 'Ana', role }}>contenido</AppShell>)
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
      renderWithQueryAndRouter(<AppShell user={{ name: 'Ana', role }}>contenido</AppShell>)
      const nav = await screen.findByRole('navigation', { name: 'Principal' })
      expect(within(nav).queryByRole('link', { name: /Cuentas/ }) !== null).toBe(cuentas)
      expect(within(nav).queryByRole('link', { name: /Configuración/ }) !== null).toBe(
        configuracion,
      )
    },
  )

  // Sin VITE_DOCS_URL, la URL de producción: un `.env` local no cambia el resultado.
  describe('«Ayuda»', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_DOCS_URL', '')
    })
    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it.each([
      { role: 'recepcion' as const, href: 'https://docs.dentalware.naphsoft.dev/recepcion/' },
      { role: 'mensajero' as const, href: 'https://docs.dentalware.naphsoft.dev/mensajero/' },
    ])(
      'abre la guía del rol $role en otra pestaña, en la barra lateral y en la cabecera móvil',
      async ({ role, href }) => {
        renderWithQueryAndRouter(<AppShell user={{ name: 'Ana', role }}>contenido</AppShell>)
        const links = await screen.findAllByRole('link', {
          name: 'Ayuda (abre el manual en otra pestaña)',
        })
        expect(links).toHaveLength(2)
        for (const link of links) {
          expect(link).toHaveAttribute('href', href)
          expect(link).toHaveAttribute('target', '_blank')
          expect(link).toHaveAttribute('rel', 'noopener')
        }
      },
    )
  })

  // UX4-11: el aviso sin conexión vive en el layout autenticado, en todas las pantallas de `_app`.
  describe('sin conexión', () => {
    afterEach(() => {
      act(() => onlineManager.setOnline(true))
    })

    it('muestra el aviso global sin red y lo quita al volver', async () => {
      renderWithQueryAndRouter(<AppShell user={USER}>contenido</AppShell>)
      await screen.findByRole('navigation', { name: 'Principal' })

      act(() => onlineManager.setOnline(false))
      expect(screen.getByRole('status')).toHaveTextContent(
        'Sin conexión: lo que marques se enviará al volver la señal',
      )

      act(() => onlineManager.setOnline(true))
      expect(screen.getByRole('status')).toBeEmptyDOMElement()
    })
  })
})
