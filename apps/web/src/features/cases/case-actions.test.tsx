import { onlineManager } from '@tanstack/react-query'
import { act, screen, waitFor, within } from '@testing-library/react'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api-error'
import { renderWithProviders } from '@/test/render'
import type { CaseDetail } from './api'
import { CaseActions } from './case-actions'
import { useCase } from './use-cases'

const { postCaseAction, fetchCase, uploadAttachment } = vi.hoisted(() => ({
  postCaseAction: vi.fn(),
  fetchCase: vi.fn(),
  uploadAttachment: vi.fn(),
}))
vi.mock('./api', () => ({ postCaseAction, fetchCase }))
vi.mock('./attachments-api', () => ({ uploadAttachment }))
vi.mock('@/features/deliveries/api', () => ({
  fetchCouriers: vi.fn().mockResolvedValue([{ id: 'm1', name: 'Bruno Mensajero' }]),
}))

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
    pendingDelivery: null,
    lastDelivered: null,
    lastPickedUp: null,
    ...overrides,
  } as unknown as CaseDetail
}

/** Quien usa la app (`self`, obligatorio donde un mensajero llega al envío). */
const yo = { id: 'u-yo', name: 'Yo' }

describe('CaseActions', () => {
  it('en un trabajo nuevo y completo ofrece Aceptar y Cancelar a recepción', async () => {
    renderWithProviders(
      <CaseActions self={yo} case={caso({ status: 'nuevo' })} missing={[]} role="recepcion" />,
    )
    expect(await screen.findByRole('button', { name: 'Aceptar' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Cancelar trabajo' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Finalizar' })).not.toBeInTheDocument()
  })

  it('deshabilita Aceptar cuando el trabajo está incompleto', async () => {
    renderWithProviders(
      <CaseActions
        self={yo}
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
      <CaseActions self={yo} case={caso({ status: 'nuevo' })} missing={[]} role="tecnico" />,
    )
    await waitFor(() => expect(screen.queryAllByRole('button')).toHaveLength(0))
    expect(screen.queryByRole('button', { name: 'Aceptar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancelar trabajo' })).not.toBeInTheDocument()
  })

  it('pausar pide motivo y no envía hasta que se escribe', async () => {
    const { user } = renderWithProviders(
      <CaseActions self={yo} case={caso({ status: 'en_proceso' })} missing={[]} role="recepcion" />,
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
      <CaseActions self={yo} case={caso({ status: 'en_proceso' })} missing={[]} role="recepcion" />,
    )
    await user.click(await screen.findByRole('button', { name: boton }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: confirmar })).toBeInTheDocument()
    expect(within(dialog).getByText(efecto)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: confirmar })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Volver' })).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument()
  })

  // M-1 (revisión final de #118): cancelar un trabajo que viene en camino dice que el
  // mensajero ya lo tiene; sin recogida hecha, el diálogo no lo dice.
  it('cancelar un trabajo en camino dice que el mensajero ya lo recogió', async () => {
    const { user } = renderWithProviders(
      <CaseActions
        self={yo}
        case={caso({
          status: 'por_recoger',
          pendingDelivery: null,
          lastPickedUp: { doneAt: '2026-10-05T15:32:00.000Z', courierName: 'Luis Ortega' },
        })}
        missing={[]}
        role="recepcion"
      />,
    )
    await user.click(await screen.findByRole('button', { name: 'Cancelar trabajo' }))
    const dialog = screen.getByRole('dialog')
    expect(
      within(dialog).getByText('Luis Ortega ya lo recogió y viene en camino al laboratorio.'),
    ).toBeInTheDocument()
  })

  it('cancelar un trabajo que no viene en camino no habla del mensajero', async () => {
    const { user } = renderWithProviders(
      <CaseActions self={yo} case={caso({ status: 'en_proceso' })} missing={[]} role="recepcion" />,
    )
    await user.click(await screen.findByRole('button', { name: 'Cancelar trabajo' }))
    expect(within(screen.getByRole('dialog')).queryByText(/ya lo recogió/)).not.toBeInTheDocument()
  })

  it('la confirmación de finalizar cierra con «Volver», no con «Cancelar»', async () => {
    const { user } = renderWithProviders(
      <CaseActions self={yo} case={caso({ status: 'en_proceso' })} missing={[]} role="recepcion" />,
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
    ['por_recoger', false, 'Recibido'],
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
          self={yo}
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
        self={yo}
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
      <CaseActions self={yo} case={caso({ status: 'en_proceso' })} missing={[]} role="admin" />,
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

  // M-5 (revisión de la Tarea 3): el botón que confirma «Cancelar trabajo» es destructivo como
  // el que abre el diálogo, y además sólido (UX5-07): el que confirma pesa más que el que abre;
  // el de «Pausar» sigue siendo el primario normal.
  it.each([
    ['Cancelar trabajo', 'destructive-solid'],
    ['Pausar', 'default'],
  ])('el botón que confirma «%s» lleva la variante %s', async (boton, variante) => {
    const { user } = renderWithProviders(
      <CaseActions self={yo} case={caso({ status: 'en_proceso' })} missing={[]} role="admin" />,
    )
    await user.click(await screen.findByRole('button', { name: boton }))
    const dialog = screen.getByRole('dialog')
    const confirmar = within(dialog)
      .getAllByRole('button')
      .find((b) => b.getAttribute('type') === 'submit')
    expect(confirmar).toHaveAttribute('data-variant', variante)
  })

  // Un entregado ya no cambia de estado; a recepción solo le queda «Repetir» (UX3-05: vive en
  // esta barra como secundaria).
  it('un trabajo entregado no ofrece ninguna acción de estado, solo «Repetir»', async () => {
    renderWithProviders(
      <CaseActions self={yo} case={caso({ status: 'entregado' })} missing={[]} role="recepcion" />,
    )
    await waitFor(() =>
      expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Repetir']),
    )
  })

  it('un mensajero marca enviado un trabajo terminado, pero no ve «Repetir»', async () => {
    renderWithProviders(
      <CaseActions self={yo} case={caso({ status: 'terminado' })} missing={[]} role="mensajero" />,
    )
    expect(await screen.findByRole('button', { name: 'Marcar enviado' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Repetir' })).not.toBeInTheDocument()
  })

  it('a un técnico, en un trabajo entregado, no le monta nada', () => {
    const { container } = renderWithProviders(
      <CaseActions self={yo} case={caso({ status: 'entregado' })} missing={[]} role="tecnico" />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('en «por recoger» «Recibido» se envía al primer clic, sin diálogo', async () => {
    const { user } = renderWithProviders(
      <CaseActions
        self={yo}
        case={caso({ status: 'por_recoger' })}
        missing={[]}
        role="recepcion"
      />,
    )
    await user.click(await screen.findByRole('button', { name: 'Recibido' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    await waitFor(() =>
      expect(postCaseAction).toHaveBeenCalledWith('c1', { accion: 'recibir', motivo: null }),
    )
  })

  it('«Marcar enviado» abre el diálogo de envío con mensajero y fecha, sin enviar nada', async () => {
    const { user } = renderWithProviders(
      <CaseActions self={yo} case={caso({ status: 'terminado' })} missing={[]} role="recepcion" />,
    )
    await user.click(await screen.findByRole('button', { name: 'Marcar enviado' }))
    const dialog = await screen.findByRole('dialog', { name: 'Marcar enviado' })
    expect(within(dialog).getByRole('combobox', { name: 'Mensajero' })).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Fecha de entrega')).toBeInTheDocument()
    expect(postCaseAction).not.toHaveBeenCalled()
  })

  it('«Marcar entregado» abre el diálogo de la foto de constancia, sin enviar nada', async () => {
    const { user } = renderWithProviders(
      <CaseActions
        self={yo}
        case={caso({
          status: 'enviado',
          pendingDelivery: {
            id: 'd1',
            type: 'entrega',
            courierId: yo.id,
            courierName: 'Mario',
            scheduledFor: '2026-10-04',
          },
        })}
        missing={[]}
        role="mensajero"
      />,
    )
    await user.click(await screen.findByRole('button', { name: 'Marcar entregado' }))
    const dialog = await screen.findByRole('dialog', { name: 'Marcar entregado' })
    expect(
      within(dialog).getByRole('button', { name: 'Tomar foto de constancia' }),
    ).toBeInTheDocument()
    expect(postCaseAction).not.toHaveBeenCalled()
  })

  // M-4 de la revisión final de la ola It4: sin red, la entrega enviada desde el diálogo queda
  // en pausa; tras «Volver», la barra (también la de la ficha corta) no deja repetirla.
  it('sin red, tras «Volver» de una entrega en pausa la barra no deja repetirla y lo dice', async () => {
    uploadAttachment.mockResolvedValue({ id: 'a1', url: '/api/adjuntos/a1', thumbUrl: null })
    postCaseAction.mockResolvedValue({ id: 'c1', status: 'entregado' })
    const { user } = renderWithProviders(
      <CaseActions
        self={yo}
        case={caso({
          status: 'enviado',
          pendingDelivery: {
            id: 'd1',
            type: 'entrega',
            courierId: yo.id,
            courierName: 'Mario',
            scheduledFor: '2026-10-04',
          },
        })}
        missing={[]}
        role="mensajero"
        size="large"
      />,
    )
    const barra = await screen.findByRole('group', { name: 'Acciones del trabajo' })
    try {
      act(() => onlineManager.setOnline(false))
      await user.click(within(barra).getByRole('button', { name: 'Marcar entregado' }))
      const dialog = await screen.findByRole('dialog', { name: 'Marcar entregado' })
      await user.upload(
        within(dialog).getByLabelText('Foto de constancia'),
        new File(['contenido'], 'foto.png', { type: 'image/png' }),
      )
      await user.click(within(dialog).getByRole('button', { name: 'Marcar entregado' }))
      await user.click(within(dialog).getByRole('button', { name: 'Volver' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

      expect(within(barra).getByRole('button', { name: 'Marcar entregado' })).toBeDisabled()
      expect(within(barra).getByText('Se enviará al volver la señal.')).toBeInTheDocument()
    } finally {
      act(() => onlineManager.setOnline(true))
    }
    await waitFor(() => expect(postCaseAction).toHaveBeenCalledTimes(1))
    expect(uploadAttachment).toHaveBeenCalledTimes(1)
  })

  // M-4 (revisión final del PR 1 de la Iteración 4): el mensajero solo ve la acción de la
  // entrega que tiene asignada (`canActOnDelivery`); la API respondería 403 a la de otro.
  describe('entregas de otro mensajero', () => {
    it('a un mensajero no le ofrece «Recibido» de una recogida asignada a otro', () => {
      const { container } = renderWithProviders(
        <CaseActions
          case={caso({
            status: 'por_recoger',
            pendingDelivery: {
              id: 'd1',
              type: 'recogida',
              courierId: 'otro',
              courierName: 'Mario',
              scheduledFor: '2026-10-04',
            },
          })}
          self={yo}
          missing={[]}
          role="mensajero"
        />,
      )
      expect(container).toBeEmptyDOMElement()
    })

    // UX4-10 (Nelson, 2026-10-04): «Recibido» lo marca recepción al llegar al laboratorio.
    it('a un mensajero no le ofrece «Recibido» ni de su propia recogida', () => {
      const { container } = renderWithProviders(
        <CaseActions
          case={caso({
            status: 'por_recoger',
            pendingDelivery: {
              id: 'd1',
              type: 'recogida',
              courierId: yo.id,
              courierName: 'Mario',
              scheduledFor: '2026-10-04',
            },
          })}
          self={yo}
          missing={[]}
          role="mensajero"
        />,
      )
      expect(container).toBeEmptyDOMElement()
    })

    it('a un mensajero no le ofrece «Marcar entregado» de una entrega asignada a otro', () => {
      const { container } = renderWithProviders(
        <CaseActions
          case={caso({
            status: 'enviado',
            pendingDelivery: {
              id: 'd1',
              type: 'entrega',
              courierId: 'otro',
              courierName: 'Mario',
              scheduledFor: '2026-10-04',
            },
          })}
          self={yo}
          missing={[]}
          role="mensajero"
        />,
      )
      expect(container).toBeEmptyDOMElement()
    })

    it('recepción ve «Marcar entregado» aunque la entrega sea de un mensajero', () => {
      renderWithProviders(
        <CaseActions
          case={caso({
            status: 'enviado',
            pendingDelivery: {
              id: 'd1',
              type: 'entrega',
              courierId: 'otro',
              courierName: 'Mario',
              scheduledFor: '2026-10-04',
            },
          })}
          self={yo}
          missing={[]}
          role="recepcion"
        />,
      )
      expect(screen.getByRole('button', { name: 'Marcar entregado' })).toBeInTheDocument()
    })
  })

  it('finalizar pide confirmación con la consecuencia concreta y no se envía hasta confirmar', async () => {
    const { user } = renderWithProviders(
      <CaseActions self={yo} case={caso({ status: 'en_proceso' })} missing={[]} role="recepcion" />,
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
      return (
        <CaseActions
          self={yo}
          case={caso({ status: 'en_proceso' })}
          missing={[]}
          role="recepcion"
        />
      )
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
  // UX4-05: el diálogo de entrega o de envío se cierra en cuanto su acción deja de estar
  // disponible (otra persona canceló o cerró el trabajo); nunca queda abierto sobre el estado
  // nuevo con su botón habilitado.
  describe('diálogo de entrega sobre un estado que cambió', () => {
    /** La ficha: la barra pinta el trabajo que trae `useCase`, como `CaseDetailTab`. */
    function Ficha({ role }: { role: 'recepcion' | 'mensajero' }) {
      const { data } = useCase('c1')
      if (!data) return null
      return <CaseActions self={yo} case={data.case} missing={[]} role={role} />
    }

    it('se cierra si al refrescar la acción ya no está disponible', async () => {
      fetchCase.mockResolvedValueOnce({ case: caso({ status: 'terminado' }), missing: [] })
      const { user, client } = renderWithProviders(<Ficha role="recepcion" />)
      await user.click(await screen.findByRole('button', { name: 'Marcar enviado' }))
      await screen.findByRole('dialog', { name: 'Marcar enviado' })

      // Otra persona ya lo envió; la ficha se refresca (foco, otra mutación…) y la barra sigue
      // montada con «Marcar entregado», pero «Marcar enviado» ya no existe.
      fetchCase.mockResolvedValueOnce({
        case: caso({
          status: 'enviado',
          pendingDelivery: {
            id: 'd1',
            type: 'entrega',
            courierId: 'm1',
            courierName: 'Mario',
            scheduledFor: '2026-10-04',
          },
        }),
        missing: [],
      })
      await client.invalidateQueries({ queryKey: ['trabajos'] })

      await waitFor(() =>
        expect(screen.queryByRole('dialog', { name: 'Marcar enviado' })).not.toBeInTheDocument(),
      )
    })

    it('un 409 al marcar enviado refresca la ficha, avisa una vez y cierra el diálogo', async () => {
      const avisos = vi.spyOn(toast, 'error')
      fetchCase.mockResolvedValueOnce({ case: caso({ status: 'terminado' }), missing: [] })
      fetchCase.mockResolvedValueOnce({
        case: caso({
          status: 'enviado',
          pendingDelivery: {
            id: 'd1',
            type: 'entrega',
            courierId: yo.id,
            courierName: 'Mario',
            scheduledFor: '2026-10-04',
          },
        }),
        missing: [],
      })
      postCaseAction.mockRejectedValueOnce(
        new ApiError('No se puede "Marcar enviado": el trabajo está en estado "Enviado".', 409),
      )
      const { user } = renderWithProviders(<Ficha role="mensajero" />)
      await user.click(await screen.findByRole('button', { name: 'Marcar enviado' }))
      const dialog = await screen.findByRole('dialog', { name: 'Marcar enviado' })
      await user.click(within(dialog).getByRole('button', { name: 'Marcar enviado' }))

      await waitFor(() => expect(postCaseAction).toHaveBeenCalled())
      await waitFor(() =>
        expect(screen.queryByRole('dialog', { name: 'Marcar enviado' })).not.toBeInTheDocument(),
      )
      // La barra sigue montada con la acción que sí toca ahora, y el 409 avisa una sola vez.
      expect(screen.getByRole('button', { name: 'Marcar entregado' })).toBeInTheDocument()
      expect(avisos).toHaveBeenCalledTimes(1)
      avisos.mockRestore()
    })
  })
})
