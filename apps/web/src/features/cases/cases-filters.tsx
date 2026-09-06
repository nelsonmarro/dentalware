import type { CaseStatus } from '@dentalware/shared'
import { CASE_STATUSES } from '@dentalware/shared'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Clinic } from '@/features/clinics/api'
import type { Doctor } from '@/features/doctors/api'
import type { User } from '@/features/users/api'
import { useMediaQuery } from '@/lib/use-media-query'
import type { CaseListQueryInput } from './api'
import { STATUS_LABEL } from './status-chip'

// Tailwind `lg` empieza en 1024px; los filtros se pliegan por debajo de ese ancho.
const DESKTOP_QUERY = '(min-width: 1024px)'
const ALL = '__todas__'

export function CasesFilters({
  value,
  onChange,
  clinics,
  doctors,
  technicians,
}: {
  value: CaseListQueryInput
  onChange: (patch: Partial<CaseListQueryInput>) => void
  clinics: Clinic[]
  doctors: Doctor[]
  technicians?: User[]
}) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const [search, setSearch] = useState(value.q ?? '')

  // Sincroniza si el valor cambia desde fuera (p. ej. "Limpiar"), ajustando el
  // estado durante el render en lugar de en un efecto (evita el re-render en cascada).
  const [lastExternalQ, setLastExternalQ] = useState(value.q)
  if (lastExternalQ !== value.q) {
    setLastExternalQ(value.q)
    setSearch(value.q ?? '')
  }

  // Debounce de 300 ms: no dispara onChange en cada tecla.
  useEffect(() => {
    const id = setTimeout(() => {
      if (search !== (value.q ?? '')) onChange({ q: search.trim() || undefined })
    }, 300)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo re-debounce al escribir
  }, [search])

  function clear() {
    setSearch('')
    onChange({
      q: undefined,
      clinicId: undefined,
      doctorId: undefined,
      tecnicoId: undefined,
      estado: undefined,
      desde: undefined,
      hasta: undefined,
    })
  }

  const fields = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="filtro-clinica">Clínica</Label>
        <Select
          value={value.clinicId ?? ALL}
          onValueChange={(v) =>
            onChange({ clinicId: v === ALL ? undefined : v, doctorId: undefined })
          }
        >
          <SelectTrigger id="filtro-clinica" className="h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas</SelectItem>
            {clinics.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="filtro-doctor">Doctor</Label>
        <Select
          value={value.doctorId ?? ALL}
          onValueChange={(v) => onChange({ doctorId: v === ALL ? undefined : v })}
          disabled={!value.clinicId}
        >
          <SelectTrigger id="filtro-doctor" className="h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos</SelectItem>
            {doctors.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="filtro-estado">Estado</Label>
        <Select
          value={value.estado ?? ALL}
          onValueChange={(v) => onChange({ estado: v === ALL ? undefined : (v as CaseStatus) })}
        >
          <SelectTrigger id="filtro-estado" className="h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos</SelectItem>
            {CASE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {technicians && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filtro-tecnico">Técnico</Label>
          <Select
            value={value.tecnicoId ?? ALL}
            onValueChange={(v) => onChange({ tecnicoId: v === ALL ? undefined : v })}
          >
            <SelectTrigger id="filtro-tecnico" className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos</SelectItem>
              {technicians.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="filtro-desde">Desde</Label>
        <Input
          id="filtro-desde"
          type="date"
          className="h-11"
          value={value.desde ?? ''}
          onChange={(e) => onChange({ desde: e.target.value || undefined })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="filtro-hasta">Hasta</Label>
        <Input
          id="filtro-hasta"
          type="date"
          className="h-11"
          value={value.hasta ?? ''}
          onChange={(e) => onChange({ hasta: e.target.value || undefined })}
        />
      </div>
      <div className="flex items-end">
        <Button variant="outline" className="h-11 w-full sm:w-auto" onClick={clear}>
          Limpiar
        </Button>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-3">
      <Input
        type="search"
        name="q"
        aria-label="Buscar por código, paciente o caja"
        placeholder="Buscar por código, paciente o caja…"
        className="h-11"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {isDesktop ? (
        fields
      ) : (
        <details className="rounded-lg border border-input">
          <summary className="flex h-11 cursor-pointer list-none items-center px-3 text-sm font-medium">
            Filtros
          </summary>
          <div className="border-t border-border p-3">{fields}</div>
        </details>
      )}
    </div>
  )
}
