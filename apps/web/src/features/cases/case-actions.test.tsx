import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import type { CaseDetail } from './api'
import { CaseActions } from './case-actions'
import { useCase } from './use-cases'

const { postCaseAction, fetchCase } = vi.hoisted(() => ({
  postCaseAction: vi.fn(),
  fetchCase: vi.fn(),
}))
vi.mock('./api', () => ({ postCaseAction, fetchCase }))

beforeEach(() => {
  postCaseAction.mockClear()
  fetchCase.mockClear()
})

function caso(overrides: Partial<CaseDetail> = {}): CaseDetail {
  return {
    id: 'c1',
    code: '26-00001',
    boxNumber: null,
    clinicId: 'clinica-1',
    doctorId: 'doctor-1',
    patientRef: 'Juan Pérez',
    patientAge: null,
    patientSex: null,
    status: 'nuevo',
    currentStageId: null,
    assignedTechnicianId: null,
    priority: 'normal',
    receivedAt: '2026-01-01',
    dueDate: '2026-01-15',
    promisedDate: null,
    finishedAt: null,
    shippedAt: null,
    deliveredAt: null,
    paidAt: null,
    shade: null,
    shadeSystem: null,
    reference: null,
    checklist: { antagonista: false, mordida: false, color: false, fotos: false },
    observations: null,
    prescription: null,
    internalNotes: null,
    holdReason: null,
    parentCaseId: null,
    remakeReason: null,
    remakeResponsibility: null,
    remakeChargePct: null,
    total: '90.00',
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    clinic: { id: 'clinica-1', name: 'Clínica Uno' },
    doctor: { id: 'doctor-1', name: 'Dr. Gómez' },
    technician: null,
    stage: null,
    items: [],
    ...overrides,
  } as unknown as CaseDetail
}

describe('CaseActions', () => {
  it('en un trabajo nuevo y completo ofrece Aceptar y Cancelar a recepción', async () => {
    renderWithProviders(
      <CaseActions case={caso({ status: 'nuevo' })} missing={[]} role="recepcion" />,
    )
    expect(await screen.findByRole('button', { name: 'Aceptar' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Cancelar trabajo' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Finalizar' })).not.toBeInTheDocument()
  })

  it('deshabilita Aceptar cuando el trabajo está incompleto', async () => {
    renderWithProviders(
      <CaseActions
        case={caso({ status: 'nuevo' })}
        missing={['Color', 'Prescripción']}
        role="recepcion"
      />,
    )
    // El texto de qué falta lo pinta `CaseHeader` ("Para aceptar falta: …"); aquí solo
    // importa que "Aceptar" quede deshabilitado, sin repetir el aviso (M-1).
    expect(await screen.findByRole('button', { name: 'Aceptar' })).toBeDisabled()
  })

  it('a un técnico no le ofrece Aceptar ni Cancelar', async () => {
    renderWithProviders(
      <CaseActions case={caso({ status: 'nuevo' })} missing={[]} role="tecnico" />,
    )
    await waitFor(() => expect(screen.queryAllByRole('button')).toHaveLength(0))
    expect(screen.queryByRole('button', { name: 'Aceptar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancelar trabajo' })).not.toBeInTheDocument()
  })

  it('pausar pide motivo y no envía hasta que se escribe', async () => {
    const { user } = renderWithProviders(
      <CaseActions case={caso({ status: 'en_proceso' })} missing={[]} role="recepcion" />,
    )
    await user.click(await screen.findByRole('button', { name: 'Pausar' }))
    const confirmar = within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Pausar trabajo',
    })
    await user.click(confirmar)
    expect(await screen.findByText('Escribe el motivo')).toBeInTheDocument()
    expect(postCaseAction).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText('Motivo'), 'Falta antagonista')
    await user.click(confirmar)
    await waitFor(() =>
      expect(postCaseAction).toHaveBeenCalledWith('c1', {
        accion: 'pausar',
        motivo: 'Falta antagonista',
      }),
    )
  })

  // UX3-12: el botón principal nombra la acción y una línea dice qué le pasa al trabajo;
  // «Volver» (no «Cancelar») cierra, para no leerse como «Cancelar trabajo».
  it.each([
    [
      'Pausar',
      'Pausar trabajo',
      'El trabajo sale de producción y queda "En espera" hasta que lo reanudes.',
    ],
    [
      'Cancelar trabajo',
      'Cancelar trabajo',
      'El trabajo queda "Cancelado" y no hay ninguna acción para retomarlo.',
    ],
  ])('el diálogo de «%s» nombra la acción y su efecto', async (boton, confirmar, efecto) => {
    const { user } = renderWithProviders(
      <CaseActions case={caso({ status: 'en_proceso' })} missing={[]} role="recepcion" />,
    )
    await user.click(await screen.findByRole('button', { name: boton }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: confirmar })).toBeInTheDocument()
    expect(within(dialog).getByText(efecto)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: confirmar })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Volver' })).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument()
  })

  it('la confirmación de finalizar cierra con «Volver», no con «Cancelar»', async () => {
    const { user } = renderWithProviders(
      <CaseActions case={caso({ status: 'en_proceso' })} missing={[]} role="recepcion" />,
    )
    await user.click(await screen.findByRole('button', { name: 'Finalizar' }))
    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Volver' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(postCaseAction).not.toHaveBeenCalled()
  })

  // UX3-04/UX3-05: un solo primario por contexto. Tabla literal (no derivada de la
  // clasificación que protege): estado × fase → el único botón primario esperado.
  it.each([
    ['nuevo', false, 'Aceptar'],
    ['en_proceso', false, 'Finalizar'],
    ['en_espera', false, 'Reanudar'],
    ['en_prueba', false, 'Recibir de prueba'],
    ['terminado', false, 'Marcar enviado'],
    ['enviado', false, 'Marcar entregado'],
  ] as const)(
    'en «%s» (con fase siguiente: %s) el único primario es «%s»',
    async (status, hasNextStage, primario) => {
      renderWithProviders(
        <CaseActions
          case={caso({ status })}
          missing={[]}
          role="admin"
          hasNextStage={hasNextStage}
        />,
      )
      expect(await screen.findByRole('button', { name: primario })).toHaveAttribute(
        'data-variant',
        'default',
      )
      const primarios = screen
        .getAllByRole('button')
        .filter((b) => b.getAttribute('data-variant') === 'default')
      expect(primarios).toHaveLength(1)
    },
  )

  it('con una fase siguiente por delante «Finalizar» no es primario y ninguna acción lo es', async () => {
    renderWithProviders(
      <CaseActions
        case={caso({ status: 'en_proceso' })}
        missing={[]}
        role="tecnico"
        hasNextStage
      />,
    )
    expect(await screen.findByRole('button', { name: 'Finalizar' })).toHaveAttribute(
      'data-variant',
      'outline',
    )
    expect(
      screen.getAllByRole('button').filter((b) => b.getAttribute('data-variant') === 'default'),
    ).toHaveLength(0)
  })

  it('pausar y enviar a prueba son secundarias y cancelar es destructiva', async () => {
    renderWithProviders(
      <CaseActions case={caso({ status: 'en_proceso' })} missing={[]} role="admin" />,
    )
    expect(await screen.findByRole('button', { name: 'Pausar' })).toHaveAttribute(
      'data-variant',
      'outline',
    )
    expect(screen.getByRole('button', { name: 'Enviar a prueba' })).toHaveAttribute(
      'data-variant',
      'outline',
    )
    expect(screen.getByRole('button', { name: 'Cancelar trabajo' })).toHaveAttribute(
      'data-variant',
      'destructive',
    )
  })

  // M-5 (revisión de la Tarea 3): el botón que confirma «Cancelar trabajo» es tan destructivo
  // como el que abre el diálogo; el de «Pausar» sigue siendo el primario normal.
  it.each([
    ['Cancelar trabajo', 'destructive'],
    ['Pausar', 'default'],
  ])('el botón que confirma «%s» lleva la variante %s', async (boton, variante) => {
    const { user } = renderWithProviders(
      <CaseActions case={caso({ status: 'en_proceso' })} missing={[]} role="admin" />,
    )
    await user.click(await screen.findByRole('button', { name: boton }))
    const dialog = screen.getByRole('dialog')
    const confirmar = within(dialog)
      .getAllByRole('button')
      .find((b) => b.getAttribute('type') === 'submit')
    expect(confirmar).toHaveAttribute('data-variant', variante)
  })

  it('un trabajo entregado no ofrece ninguna acción de estado', async () => {
    renderWithProviders(
      <CaseActions case={caso({ status: 'entregado' })} missing={[]} role="recepcion" />,
    )
    await waitFor(() => expect(screen.queryAllByRole('button')).toHaveLength(0))
  })

  it('finalizar pide confirmación con la consecuencia concreta y no se envía hasta confirmar', async () => {
    const { user } = renderWithProviders(
      <CaseActions case={caso({ status: 'en_proceso' })} missing={[]} role="recepcion" />,
    )
    await user.click(await screen.findByRole('button', { name: 'Finalizar' }))
    const dialog = screen.getByRole('alertdialog')
    expect(
      within(dialog).getByText(/No hay ninguna acción para devolverlo a "En proceso"/),
    ).toBeInTheDocument()
    expect(postCaseAction).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Finalizar' }))
    await waitFor(() =>
      expect(postCaseAction).toHaveBeenCalledWith('c1', { accion: 'finalizar', motivo: null }),
    )
  })

  it('un segundo clic mientras se confirma el cambio de estado no duplica la acción', async () => {
    // La lista de trabajos también monta `useCase('c1')` (misma clave que invalida la
    // mutación): así la invalidación de `useCaseAction` dispara un refetch real que
    // podemos mantener pendiente para reproducir la ventana entre "la API respondió" y
    // "el detalle todavía muestra el estado viejo" (M-3).
    fetchCase.mockResolvedValueOnce({ case: caso({ status: 'en_proceso' }), missing: [] })
    let resolveRefetch!: (value: unknown) => void
    fetchCase.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRefetch = resolve
      }),
    )

    function Harness() {
      useCase('c1')
      return <CaseActions case={caso({ status: 'en_proceso' })} missing={[]} role="recepcion" />
    }
    const { user } = renderWithProviders(<Harness />)

    const finalizarBtn = await screen.findByRole('button', { name: 'Finalizar' })
    await user.click(finalizarBtn)
    const dialog = screen.getByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Finalizar' }))

    await waitFor(() => expect(finalizarBtn).toBeDisabled())
    await user.click(finalizarBtn) // botón deshabilitado: no debe disparar una segunda mutación

    resolveRefetch({ case: caso({ status: 'terminado' }), missing: [] })

    await waitFor(() => expect(finalizarBtn).not.toBeDisabled())
    expect(postCaseAction).toHaveBeenCalledTimes(1)
  })
})
