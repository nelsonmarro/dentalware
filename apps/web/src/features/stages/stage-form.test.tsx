import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StageForm } from './stage-form'

describe('StageForm', () => {
  it('el color por defecto de una fase nueva no es el teal primario (#0F766E)', () => {
    render(
      <StageForm open onOpenChange={vi.fn()} stage={null} onSubmit={vi.fn()} pending={false} />,
    )
    const colorInput = screen.getByLabelText('Color') as HTMLInputElement
    expect(colorInput.value.toUpperCase()).not.toBe('#0F766E')
  })
})
