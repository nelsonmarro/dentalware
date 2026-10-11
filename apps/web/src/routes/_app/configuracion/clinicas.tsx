import { createFileRoute, Outlet, useMatchRoute, useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'
import { z } from 'zod'
import { ClinicsPage } from '@/features/clinics/clinics-page'

const clinicsSearchSchema = z.object({ editar: z.string() }).partial().catch({})

export const Route = createFileRoute('/_app/configuracion/clinicas')({
  validateSearch: clinicsSearchSchema,
  component: ClinicsRoute,
})

function ClinicsRoute() {
  // Si hay una clínica seleccionada ($clinicId), la ruta hija ocupa la pantalla.
  const matchRoute = useMatchRoute()
  const { editar } = Route.useSearch()
  const navigate = useNavigate()
  // Una vez abierto el diálogo (AVI-4), `editar` sale de la URL: cerrar y recargar no lo reabre.
  const clearEdit = useCallback(
    () => void navigate({ to: '/configuracion/clinicas', search: {}, replace: true }),
    [navigate],
  )
  if (matchRoute({ to: '/configuracion/clinicas/$clinicId', fuzzy: true })) return <Outlet />
  return <ClinicsPage editId={editar} onEditHandled={clearEdit} />
}
