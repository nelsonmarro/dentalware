import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { QrCode } from './qr-code'

describe('QrCode', () => {
  it('codifica la URL de la ficha corta del trabajo', async () => {
    renderWithProviders(<QrCode value="https://dentalware.ec/t/26-00123" size={96} />)
    const qr = await screen.findByRole('img', { name: /Código QR del trabajo/ })
    expect(qr).toBeInTheDocument()
    expect(qr.querySelector('svg')).toBeInTheDocument()
  })

  it('nombra el código del trabajo en la etiqueta accesible', async () => {
    renderWithProviders(<QrCode value="https://dentalware.ec/t/26-00123" size={96} />)
    expect(
      await screen.findByRole('img', { name: 'Código QR del trabajo 26-00123' }),
    ).toBeInTheDocument()
  })
})
