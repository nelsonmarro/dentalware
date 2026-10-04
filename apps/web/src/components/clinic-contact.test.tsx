import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ClinicContact } from './clinic-contact'

const clinica = {
  address: 'Av. Amazonas N34-56',
  city: 'Quito',
  phone: '099 123 4567',
}

describe('ClinicContact', () => {
  // UX4-21: el mapa busca la dirección en su ciudad y el enlace dice que sale de la app.
  it('el mapa busca la dirección con la ciudad y avisa de que se abre en otra pestaña', () => {
    render(<ClinicContact clinic={clinica} />)
    const mapa = screen.getByRole('link', {
      name: 'Abrir en el mapa: Av. Amazonas N34-56, Quito (se abre en otra pestaña)',
    })
    expect(mapa).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=Av.%20Amazonas%20N34-56%2C%20Quito',
    )
    expect(mapa).toHaveAttribute('target', '_blank')
    expect(mapa).toHaveAttribute('rel', 'noopener noreferrer')
    expect(mapa).toHaveTextContent('Av. Amazonas N34-56, Quito')
  })

  it('el teléfono llama', () => {
    render(<ClinicContact clinic={clinica} />)
    expect(screen.getByRole('link', { name: /099 123 4567/ })).toHaveAttribute(
      'href',
      'tel:0991234567',
    )
  })

  it('sin dirección lo dice en vez de callar', () => {
    render(<ClinicContact clinic={{ ...clinica, address: null }} />)
    expect(screen.getByText('Sin dirección registrada')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Abrir en el mapa/ })).not.toBeInTheDocument()
  })

  it('sin dirección ni teléfono solo queda el aviso, sin botones vacíos', () => {
    render(<ClinicContact clinic={{ address: null, city: null, phone: null }} />)
    expect(screen.getByText('Sin dirección registrada')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
