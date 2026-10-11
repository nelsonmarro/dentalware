import { caseWhatsappText } from '@dentalware/shared'
import { screen } from '@testing-library/react'
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
        name: 'Avisar por WhatsApp a Clínica Sur (se abre en otra pestaña)',
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
    expect(screen.queryByText(/no tiene WhatsApp/)).toBeNull()
  })

  it('recepción sin WhatsApp lee cómo añadirlo, sin enlace', async () => {
    renderWithRouter(<CaseWhatsapp case={caseOf(null)} role="recepcion" labName={null} />)
    expect(
      await screen.findByText(/Clínica Sur no tiene WhatsApp registrado\./),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Pídele al administrador que lo añada en Configuración › Clínicas\./),
    ).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('admin sin WhatsApp ve «Añadirlo» hacia el diálogo de esa clínica', async () => {
    renderWithRouter(<CaseWhatsapp case={caseOf(null)} role="admin" labName={null} />)
    expect(
      await screen.findByText(/Clínica Sur no tiene WhatsApp registrado\./),
    ).toBeInTheDocument()
    const link = await screen.findByRole('link', { name: 'Añadirlo' })
    expect(link).toHaveAttribute('href', '/configuracion/clinicas?editar=clinica-9')
    expect(screen.queryByText(/Pídele al administrador/)).not.toBeInTheDocument()
  })
})
