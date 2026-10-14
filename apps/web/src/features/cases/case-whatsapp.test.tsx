import { caseWhatsappText } from '@dentalware/shared'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { whatsappUrl } from '@/lib/map-link'
import { renderWithRouter } from '@/test/router'
import type { CaseDetail } from './api'
import { CaseWhatsapp } from './case-whatsapp'

function caseOf(whatsapp: string | null): CaseDetail {
  return {
    id: 'caso-1',
    code: '26-00087',
    patientRef: 'Ana Ruiz',
    status: 'terminado',
    total: '120.00',
    clinic: { id: 'clinica-9', name: 'Clínica Sur', whatsapp },
  } as unknown as CaseDetail
}

describe('CaseWhatsapp', () => {
  it.each(['recepcion', 'admin'] as const)(
    '%s con WhatsApp ve el enlace con el aviso, sin precios',
    async (role) => {
      renderWithRouter(
        <CaseWhatsapp case={caseOf('+593991234567')} role={role} labName="Arte Dental" />,
      )
      const link = await screen.findByRole('link', {
        name: 'Avisar por WhatsApp a Clínica Sur (abre WhatsApp)',
      })
      const expected = whatsappUrl(
        '+593991234567',
        caseWhatsappText({
          labName: 'Arte Dental',
          code: '26-00087',
          patientRef: 'Ana Ruiz',
          status: 'terminado',
        }),
      )
      expect(link).toHaveAttribute('href', expected)
      expect(link).toHaveAttribute('target', '_blank')
      expect(link.getAttribute('rel')).toContain('noopener')
      expect(decodeURIComponent(expected)).not.toContain('$')
      expect(link.className).toMatch(/h-11|min-h-11/)
      expect(link.className).toContain('w-full')
      expect(link.className).toContain('sm:w-auto')
    },
  )

  // El centinela «listo» se pinta junto al componente: cuando aparece, el router ya montó y
  // lo que falte es que `CaseWhatsapp` no pintó nada (sin esperas fijas).
  it.each([
    ['tecnico', '+593991234567'],
    ['tecnico', null],
    ['mensajero', '+593991234567'],
    ['mensajero', null],
  ] as const)('%s no ve nada (WhatsApp: %s)', async (role, whatsapp) => {
    renderWithRouter(
      <>
        <span>listo</span>
        <CaseWhatsapp case={caseOf(whatsapp)} role={role} labName={null} />
      </>,
    )
    await screen.findByText('listo')
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.queryByText(/Sin WhatsApp/)).toBeNull()
  })

  it('recepción sin WhatsApp lee un aviso corto, sin enlace ni nombre de la clínica', async () => {
    renderWithRouter(<CaseWhatsapp case={caseOf(null)} role="recepcion" labName={null} />)
    const text = await screen.findByText(
      'Sin WhatsApp registrado. Pídele al administrador que lo registre.',
    )
    expect(text.textContent).not.toContain('Clínica Sur')
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('admin sin WhatsApp ve «Añadir WhatsApp», que vuelve a la ficha', async () => {
    renderWithRouter(<CaseWhatsapp case={caseOf(null)} role="admin" labName={null} />)
    expect(await screen.findByText('Sin WhatsApp registrado.')).toBeInTheDocument()
    const link = await screen.findByRole('link', { name: 'Añadir WhatsApp' })
    expect(link).toHaveAttribute(
      'href',
      '/configuracion/clinicas?editar=clinica-9&volver=%2Ftrabajos%2Fcaso-1&campo=whatsapp',
    )
    expect(link.className).toContain('min-h-11')
    expect(screen.queryByText(/Pídele al administrador/)).not.toBeInTheDocument()
  })

  it('con focus, el enlace de avisar recibe el foco; sin focus, no', async () => {
    const { unmount } = renderWithRouter(
      <CaseWhatsapp case={caseOf('+593991234567')} role="admin" labName={null} focus />,
    )
    const link = await screen.findByRole('link', { name: /Avisar por WhatsApp/ })
    expect(document.activeElement).toBe(link)
    unmount()
    renderWithRouter(<CaseWhatsapp case={caseOf('+593991234567')} role="admin" labName={null} />)
    const other = await screen.findByRole('link', { name: /Avisar por WhatsApp/ })
    expect(document.activeElement).not.toBe(other)
  })

  it('con focus, el enlace recibe el foco cuando el número aparece después del montaje', async () => {
    function Harness() {
      const [whatsapp, setWhatsapp] = useState<string | null>(null)
      return (
        <>
          <button type="button" onClick={() => setWhatsapp('+593991234567')}>
            llega el número
          </button>
          <CaseWhatsapp case={caseOf(whatsapp)} role="admin" labName={null} focus />
        </>
      )
    }
    renderWithRouter(<Harness />)
    await screen.findByText('Sin WhatsApp registrado.')
    await userEvent.click(screen.getByRole('button', { name: 'llega el número' }))
    const link = await screen.findByRole('link', { name: /Avisar por WhatsApp/ })
    expect(document.activeElement).toBe(link)
  })
})
