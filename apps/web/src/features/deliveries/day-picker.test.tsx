import { fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { DayPicker } from './day-picker'

beforeEach(() => {
  // Sábado 2026-10-03.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-03T12:00:00'))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('DayPicker', () => {
  it('nombra el día con palabras y dice si es hoy', () => {
    renderWithProviders(<DayPicker day="2026-10-03" onChange={() => {}} />)
    expect(screen.getByText('Hoy · sábado, 3 de octubre')).toBeInTheDocument()
  })

  it('otro día no dice «Hoy»', () => {
    renderWithProviders(<DayPicker day="2026-10-05" onChange={() => {}} />)
    expect(screen.getByText('lunes, 5 de octubre')).toBeInTheDocument()
  })

  it('las flechas van al día anterior y al siguiente, cruzando el mes', async () => {
    const onChange = vi.fn()
    const { user } = renderWithProviders(<DayPicker day="2026-10-01" onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'Día anterior' }))
    expect(onChange).toHaveBeenLastCalledWith('2026-09-30')
    await user.click(screen.getByRole('button', { name: 'Día siguiente' }))
    expect(onChange).toHaveBeenLastCalledWith('2026-10-02')
  })

  it('«Hoy» vuelve a hoy y no hace falta cuando ya es hoy', async () => {
    const onChange = vi.fn()
    const { user, rerender } = renderWithProviders(
      <DayPicker day="2026-10-08" onChange={onChange} />,
    )
    await user.click(screen.getByRole('button', { name: 'Hoy' }))
    expect(onChange).toHaveBeenCalledWith('2026-10-03')
    rerender(<DayPicker day="2026-10-03" onChange={onChange} />)
    expect(screen.getByRole('button', { name: 'Hoy' })).toBeDisabled()
  })

  it('se puede elegir una fecha', () => {
    const onChange = vi.fn()
    renderWithProviders(<DayPicker day="2026-10-03" onChange={onChange} />)
    const input = screen.getByLabelText('Día')
    expect(input).toHaveValue('2026-10-03')
    fireEvent.change(input, { target: { value: '2026-10-15' } })
    expect(onChange).toHaveBeenCalledWith('2026-10-15')
  })

  // UX4-23: la fecha se anuncia y, donde el navegador lo respeta, se muestra en español de
  // Ecuador (10/04 no se lee como 10 de abril).
  it('el campo de fecha va en español de Ecuador', () => {
    renderWithProviders(<DayPicker day="2026-10-03" onChange={() => {}} />)
    expect(screen.getByLabelText('Día')).toHaveAttribute('lang', 'es-EC')
  })

  it('borrar la fecha no deja la pantalla sin día', () => {
    const onChange = vi.fn()
    renderWithProviders(<DayPicker day="2026-10-03" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Día'), { target: { value: '' } })
    expect(onChange).not.toHaveBeenCalled()
  })
})
