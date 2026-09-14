import { describe, expect, it, vi } from 'vitest'
import {
  advancedFilterSignal,
  clearAdvancedFilter,
  getAdvancedFilter,
  setAdvancedFilter,
} from './advanced-filter-store'

describe('advanced-filter-store', () => {
  it('aísla el filtro por key: escribir en una no afecta a otra', () => {
    setAdvancedFilter('store-a', {
      logic: 'or',
      conditions: [{ column: 'x', op: 'es', value: '1' }],
    })
    expect(getAdvancedFilter('store-a')).toEqual({
      logic: 'or',
      conditions: [{ column: 'x', op: 'es', value: '1' }],
    })
    expect(getAdvancedFilter('store-b')).toEqual({ logic: 'and', conditions: [] })
    clearAdvancedFilter('store-a')
  })

  it('notifica a los suscriptores al escribir y al limpiar', () => {
    const listener = vi.fn()
    const signal = advancedFilterSignal('store-c')
    const unsubscribe = signal.subscribe(listener)

    setAdvancedFilter('store-c', {
      logic: 'and',
      conditions: [{ column: 'y', op: 'contiene', value: 'z' }],
    })
    expect(listener).toHaveBeenCalledTimes(1)

    clearAdvancedFilter('store-c')
    expect(listener).toHaveBeenCalledTimes(2)

    unsubscribe()
  })

  it('getSnapshot es estable (misma referencia) si el filtro no cambió', () => {
    setAdvancedFilter('store-d', { logic: 'and', conditions: [] })
    const first = getAdvancedFilter('store-d')
    const second = getAdvancedFilter('store-d')
    expect(first).toBe(second)
    clearAdvancedFilter('store-d')
  })

  it('el `dataSignal` está memoizado por key: subscribe/getSnapshot son la misma función', () => {
    const first = advancedFilterSignal('store-e')
    const second = advancedFilterSignal('store-e')
    expect(first.subscribe).toBe(second.subscribe)
    expect(first.getSnapshot).toBe(second.getSnapshot)
    clearAdvancedFilter('store-e')
  })
})
