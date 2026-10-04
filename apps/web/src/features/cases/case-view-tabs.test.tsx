import type { CaseView } from '@dentalware/shared'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CaseViewTabs } from './case-view-tabs'

function Harness({ initial }: { initial: CaseView }) {
  const [vista, setVista] = useState<CaseView>(initial)
  return <CaseViewTabs value={vista} onChange={setVista} />
}

describe('CaseViewTabs', () => {
  afterEach(() => vi.restoreAllMocks())

  // UX4-04 (añadido de la Tarea 2): en móvil la lista hace scroll horizontal y la pestaña
  // activa podía quedar fuera de vista.
  it('al montar lleva la pestaña activa a la vista', () => {
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView')
    render(<Harness initial="atrasados" />)

    expect(spy).toHaveBeenCalledWith({ inline: 'nearest', block: 'nearest' })
    const el = spy.mock.contexts.at(-1) as HTMLElement
    expect(el).toBe(screen.getByRole('tab', { name: 'Atrasados' }))
  })

  it('al cambiar de vista lleva la nueva pestaña activa a la vista', async () => {
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView')
    render(<Harness initial="todos" />)
    spy.mockClear()

    await userEvent.click(screen.getByRole('tab', { name: 'Listos' }))

    expect(spy).toHaveBeenCalledWith({ inline: 'nearest', block: 'nearest' })
    expect(spy.mock.contexts.at(-1)).toBe(screen.getByRole('tab', { name: 'Listos' }))
  })

  it('rotula «Vencen mañana» con el día cuando el siguiente hábil no es mañana', () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-02T12:00:00') })
    try {
      render(<Harness initial="todos" />)
      expect(screen.getByRole('tab', { name: 'Vencen el lunes' })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})
