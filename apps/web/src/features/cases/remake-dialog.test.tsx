import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import type { CaseDetail } from './api'
import { RemakeDialog } from './remake-dialog'

const { createRemake } = vi.hoisted(() => ({ createRemake: vi.fn() }))
vi.mock('./api', () => ({ createRemake }))

beforeEach(() => {
  createRemake.mockClear()
})

// `total` admite `null`: el tipo inferido de la API dice `string`, pero `stripPrices` lo
// devuelve `null` a técnico y mensajero, y el diálogo tiene que soportarlo.
function caso(
  overrides: Partial<Omit<CaseDetail, 'total'>> & { total?: string | null } = {},
): CaseDetail {
  return {
    id: 'c1',
    code: '26-00001',
    boxNumber: null,
    clinicId: 'clinica-1',
    doctorId: 'doctor-1',
    patientRef: 'Juan Pérez',
    patientAge: null,
    patientSex: null,
    status: 'entregado',
    currentStageId: null,
    assignedTechnicianId: null,
    priority: 'normal',
    receivedAt: '2026-01-01',
    dueDate: '2026-01-15',
    promisedDate: '2026-01-20',
    finishedAt: '2026-01-18T00:00:00.000Z',
    shippedAt: '2026-01-19T00:00:00.000Z',
    deliveredAt: '2026-01-20T00:00:00.000Z',
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

describe('RemakeDialog', () => {
  it('exige motivo antes de crear la repetición', async () => {
    const { user } = renderWithProviders(<RemakeDialog case={caso({ status: 'entregado' })} />)
    await user.click(await screen.findByRole('button', { name: 'Repetir' }))
    await user.click(screen.getByRole('button', { name: 'Crear repetición' }))
    expect(await screen.findByText('Escribe el motivo')).toBeInTheDocument()
    expect(createRemake).not.toHaveBeenCalled()
  })

  it('con el porcentaje vacío avisa en español y no crea la repetición', async () => {
    // Antes, `z.coerce.number()` convertía el campo vacío en 0 y la repetición nacía como
    // "no se le cobra nada a la clínica". Como `remakeChargePct` no se ve ni se edita en
    // ninguna pantalla, el descuido solo se arreglaba tocando la BD y la Iteración 5 lo
    // leería como decisión deliberada (I-4 de la revisión).
    const { user } = renderWithProviders(<RemakeDialog case={caso({ status: 'entregado' })} />)
    await user.click(await screen.findByRole('button', { name: 'Repetir' }))
    await user.type(screen.getByLabelText('Motivo'), 'La cofia no asienta')
    await user.clear(screen.getByLabelText('Porcentaje a cobrar a la clínica'))
    await user.click(screen.getByRole('button', { name: 'Crear repetición' }))
    expect(await screen.findByText('Escribe el porcentaje a cobrar')).toBeInTheDocument()
    expect(createRemake).not.toHaveBeenCalled()
  })

  it('crea la repetición con los datos del formulario', async () => {
    const created = caso({ id: 'c2', code: '26-00002', status: 'nuevo', parentCaseId: 'c1' })
    createRemake.mockResolvedValue(created)
    const onCreated = vi.fn()
    const { user } = renderWithProviders(
      <RemakeDialog case={caso({ status: 'entregado' })} onCreated={onCreated} />,
    )
    await user.click(await screen.findByRole('button', { name: 'Repetir' }))
    await user.type(screen.getByLabelText('Motivo'), 'Fractura en cerámica al probar')
    await user.selectOptions(screen.getByLabelText('Responsabilidad'), 'laboratorio')
    await user.click(screen.getByRole('button', { name: 'Crear repetición' }))
    await waitFor(() =>
      expect(createRemake).toHaveBeenCalledWith('c1', {
        motivo: 'Fractura en cerámica al probar',
        responsabilidad: 'laboratorio',
        cobroPct: 0,
      }),
    )
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(created))
  })

  it('propone el porcentaje según la responsabilidad: laboratorio 0, clínica 100, compartida 50', async () => {
    const { user } = renderWithProviders(<RemakeDialog case={caso({ status: 'entregado' })} />)
    await user.click(await screen.findByRole('button', { name: 'Repetir' }))
    const pct = screen.getByLabelText('Porcentaje a cobrar a la clínica')
    expect(pct).toHaveValue(0)
    await user.selectOptions(screen.getByLabelText('Responsabilidad'), 'clinica')
    expect(pct).toHaveValue(100)
    await user.selectOptions(screen.getByLabelText('Responsabilidad'), 'compartida')
    expect(pct).toHaveValue(50)
    await user.selectOptions(screen.getByLabelText('Responsabilidad'), 'laboratorio')
    expect(pct).toHaveValue(0)
  })

  it('respeta el porcentaje escrito a mano aunque después cambie la responsabilidad', async () => {
    createRemake.mockResolvedValue(caso({ id: 'c2', status: 'nuevo' }))
    const { user } = renderWithProviders(<RemakeDialog case={caso({ status: 'entregado' })} />)
    await user.click(await screen.findByRole('button', { name: 'Repetir' }))
    await user.type(screen.getByLabelText('Motivo'), 'Color equivocado')
    const pct = screen.getByLabelText('Porcentaje a cobrar a la clínica')
    await user.clear(pct)
    await user.type(pct, '30')
    await user.selectOptions(screen.getByLabelText('Responsabilidad'), 'clinica')
    expect(pct).toHaveValue(30)
    await user.click(screen.getByRole('button', { name: 'Crear repetición' }))
    await waitFor(() =>
      expect(createRemake).toHaveBeenCalledWith('c1', {
        motivo: 'Color equivocado',
        responsabilidad: 'clinica',
        cobroPct: 30,
      }),
    )
  })

  it('al cerrar y volver a abrir, el porcentaje vuelve a seguir la responsabilidad', async () => {
    const { user } = renderWithProviders(<RemakeDialog case={caso({ status: 'entregado' })} />)
    await user.click(await screen.findByRole('button', { name: 'Repetir' }))
    const pct = screen.getByLabelText('Porcentaje a cobrar a la clínica')
    await user.clear(pct)
    await user.type(pct, '30')
    await user.click(screen.getByRole('button', { name: 'Volver' }))
    await user.click(screen.getByRole('button', { name: 'Repetir' }))
    expect(screen.getByLabelText('Porcentaje a cobrar a la clínica')).toHaveValue(0)
    await user.selectOptions(screen.getByLabelText('Responsabilidad'), 'compartida')
    expect(screen.getByLabelText('Porcentaje a cobrar a la clínica')).toHaveValue(50)
  })

  it('muestra el símbolo de porcentaje junto al campo', async () => {
    const { user } = renderWithProviders(<RemakeDialog case={caso({ status: 'entregado' })} />)
    await user.click(await screen.findByRole('button', { name: 'Repetir' }))
    expect(screen.getByText('%')).toBeInTheDocument()
  })

  it('dice cuánto se cobrará a la clínica sobre el total del trabajo', async () => {
    const { user } = renderWithProviders(
      <RemakeDialog case={caso({ status: 'entregado', total: '80.00' })} />,
    )
    await user.click(await screen.findByRole('button', { name: 'Repetir' }))
    const pct = screen.getByLabelText('Porcentaje a cobrar a la clínica')
    expect(pct).toHaveAccessibleDescription('Se cobrarán $ 0.00 de $ 80.00')
    await user.selectOptions(screen.getByLabelText('Responsabilidad'), 'compartida')
    expect(pct).toHaveAccessibleDescription('Se cobrarán $ 40.00 de $ 80.00')
    await user.clear(pct)
    await user.type(pct, '33')
    expect(pct).toHaveAccessibleDescription('Se cobrarán $ 26.40 de $ 80.00')
  })

  it('no muestra el importe con un porcentaje inválido', async () => {
    const { user } = renderWithProviders(
      <RemakeDialog case={caso({ status: 'entregado', total: '80.00' })} />,
    )
    await user.click(await screen.findByRole('button', { name: 'Repetir' }))
    const pct = screen.getByLabelText('Porcentaje a cobrar a la clínica')
    await user.clear(pct)
    await user.type(pct, '150')
    expect(screen.queryByText(/Se cobrarán/)).not.toBeInTheDocument()
  })

  it('sin precios del trabajo (total oculto por rol) no muestra ningún importe', async () => {
    const { user } = renderWithProviders(
      <RemakeDialog case={caso({ status: 'entregado', total: null })} />,
    )
    await user.click(await screen.findByRole('button', { name: 'Repetir' }))
    expect(screen.getByLabelText('Porcentaje a cobrar a la clínica')).toHaveValue(0)
    expect(screen.queryByText(/Se cobrarán/)).not.toBeInTheDocument()
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
  })

  it('no ofrece repetir un trabajo que no se puede repetir', () => {
    renderWithProviders(<RemakeDialog case={caso({ status: 'nuevo' })} />)
    expect(screen.queryByRole('button', { name: 'Repetir' })).not.toBeInTheDocument()
  })
})
