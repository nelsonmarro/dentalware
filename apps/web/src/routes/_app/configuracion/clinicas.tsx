import { createFileRoute, Outlet, useMatchRoute, useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'
import { ClinicsPage } from '@/features/clinics/clinics-page'
import { parseClinicsSearch } from '@/features/clinics/clinics-search'

export const Route = createFileRoute('/_app/configuracion/clinicas')({
  validateSearch: parseClinicsSearch,
  component: ClinicsRoute,
})

function ClinicsRoute() {
  // Si hay una clínica seleccionada ($clinicId), la ruta hija ocupa la pantalla.
  const matchRoute = useMatchRoute()
  const { editar, volver, campo } = Route.useSearch()
  const navigate = useNavigate()
  // Una vez abierto el diálogo (AVI-4), `editar` sale de la URL: cerrar y recargar no lo reabre.
  const clearEdit = useCallback(
    () => void navigate({ to: '/configuracion/clinicas', search: {}, replace: true }),
    [navigate],
  )
  if (matchRoute({ to: '/configuracion/clinicas/$clinicId', fuzzy: true })) return <Outlet />
  return (
    <ClinicsPage
      editId={editar}
      returnTo={volver ?? null}
      focusField={campo ?? null}
      onEditHandled={clearEdit}
    />
  )
}
