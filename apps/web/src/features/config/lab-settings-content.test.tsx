import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { fetchLabSettings } from './api'
import { LabSettingsContent } from './lab-settings-content'
import { useLabSettings } from './use-lab-settings'

vi.mock('./api', () => ({ fetchLabSettings: vi.fn() }))

function Harness() {
  const settings = useLabSettings()
  return <LabSettingsContent settings={settings} onSubmit={vi.fn()} pending={false} />
}

describe('LabSettingsContent', () => {
  it('sin configurar todavía (null) muestra el formulario vacío', async () => {
    vi.mocked(fetchLabSettings).mockResolvedValue(null)

    renderWithProviders(<Harness />)

    expect(await screen.findByRole('button', { name: /Guardar/ })).toBeInTheDocument()
  })

  // Ronda de fixes 1 (UX3-02, punto 3): un fallo de red se confundía con "aún no
  // configurado" — ambos pintaban el mismo formulario vacío.
  it('un fallo de red ofrece reintentar, distinto de "aún no configurado"', async () => {
    vi.mocked(fetchLabSettings).mockRejectedValue(new TypeError('Failed to fetch'))

    renderWithProviders(<Harness />)

    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })
})
