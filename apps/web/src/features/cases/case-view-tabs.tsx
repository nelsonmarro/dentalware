import type { CaseView } from '@dentalware/shared'
import { CASE_VIEWS, toIsoDate } from '@dentalware/shared'
import { useEffect, useRef } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { caseViewLabel } from './case-views'

interface CaseViewTabsProps {
  value: CaseView
  onChange: (view: CaseView) => void
}

/** Pestañas de las vistas rápidas de `/trabajos`. En móvil la lista hace scroll horizontal:
 * al montar y al cambiar de vista lleva la pestaña activa a la vista (UX4-04). */
export function CaseViewTabs({ value, onChange }: CaseViewTabsProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const today = toIsoDate(new Date())

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[data-state=active]')
      ?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  }, [value])

  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as CaseView)}>
      <div ref={listRef} className="overflow-x-auto overflow-y-hidden">
        <TabsList>
          {CASE_VIEWS.map((v) => (
            // `flex-none`: cada pestaña toma el ancho de su texto; el reparto igual de
            // `flex-1` recortaba «Vencen mañana» sobre sus vecinas (UX4-03). El contenedor
            // ya hace scroll horizontal si no caben todas.
            <TabsTrigger key={v} value={v} className="flex-none">
              {caseViewLabel(v, today)}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
    </Tabs>
  )
}
