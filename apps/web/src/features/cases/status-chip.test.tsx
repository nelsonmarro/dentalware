import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusChip } from './status-chip'

describe('StatusChip', () => {
  it('muestra el texto en español y el color del estado', () => {
    render(<StatusChip status="en_proceso" />)
    const chip = screen.getByText('En proceso')
    expect(chip).toHaveAttribute('data-status', 'en_proceso')
    expect(chip).toHaveStyle({ '--chip': '#0F766E' })
  })
})
