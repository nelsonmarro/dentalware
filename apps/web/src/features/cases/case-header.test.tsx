import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithRouter } from '@/test/router'
import { paragraph } from '@/test/text'
import type { CaseDetail, CaseEvent } from './api'
import { CaseHeader } from './case-header'

function event(overrides: Partial<CaseEvent>): CaseEvent {
  return {
    id: 'e1',
    caseId: 'caso-1',
    type: 'hold',
    fromValue: 'en_proceso',
    toValue: 'en_espera',
    reason: null,
    actorId: 'u1',
    actor: { id: 'u1', name: 'Ana' },
    createdAt: '2026-01-10T12:00:00.000Z',
    ...overrides,
  } as CaseEvent
}

function baseCase(overrides: Partial<CaseDetail> = {}): CaseDetail {
  return {
    id: 'caso-1',
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

describe('CaseHeader', () => {
  // AVI-4: el aviso por WhatsApp cuelga de la cabecera, bajo «clínica · doctor».
  it('recepción ve «Avisar por WhatsApp» si la clínica tiene número; sin nombre del laboratorio también', async () => {
    renderWithRouter(
      <CaseHeader
        case={baseCase({
          clinic: { id: 'clinica-1', name: 'Clínica Uno', whatsapp: '+593990000000' },
        } as Partial<CaseDetail>)}
        missing={[]}
        role="recepcion"
      />,
    )
    const link = await screen.findByRole('link', { name: /Avisar por WhatsApp a Clínica Uno/ })
    expect(link.getAttribute('href')).toContain('https://wa.me/593990000000?text=')
    expect(decodeURIComponent(link.getAttribute('href') ?? '')).toContain('del laboratorio')
  })

  it('con el nombre del laboratorio, el aviso lo nombra', async () => {
    renderWithRouter(
      <CaseHeader
        case={baseCase({
          clinic: { id: 'clinica-1', name: 'Clínica Uno', whatsapp: '+593990000000' },
        } as Partial<CaseDetail>)}
        missing={[]}
        role="admin"
        labName="Arte Dental"
      />,
    )
    const link = await screen.findByRole('link', { name: /Avisar por WhatsApp/ })
    expect(decodeURIComponent(link.getAttribute('href') ?? '')).toContain('Arte Dental')
  })

  it('admin en un trabajo "nuevo" ve el total y el enlace Editar', async () => {
    renderWithRouter(<CaseHeader case={baseCase()} missing={[]} role="admin" />)
    expect(await screen.findByText('$ 90.00')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Editar/ })).toBeInTheDocument()
  })

  // Iteración 5: la línea de cobro, con enlace a la cuenta de la clínica, para admin y
  // recepción; a técnico y mensajero la API les manda `account: null`.
  it.each(['admin', 'recepcion'] as const)(
    '%s ve la línea de cobro de un trabajo entregado',
    async (role) => {
      renderWithRouter(
        <CaseHeader
          case={baseCase({
            status: 'entregado',
            account: {
              charge: '90.00',
              adjustments: '0.00',
              allocated: '40.00',
              outstanding: '50.00',
              paidAt: null,
            },
          } as Partial<CaseDetail>)}
          missing={[]}
          role={role}
        />,
      )
      expect(await screen.findByText(paragraph('Pendiente $ 50.00 de $ 90.00'))).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Ver cuenta de la clínica' })).toHaveAttribute(
        'href',
        '/cuentas/clinica-1',
      )
    },
  )

  it.each(['tecnico', 'mensajero'] as const)(
    '%s no ve la línea de cobro (la API no le manda la cuenta)',
    async (role) => {
      renderWithRouter(
        <CaseHeader
          case={baseCase({ status: 'entregado', account: null } as Partial<CaseDetail>)}
          missing={[]}
          role={role}
        />,
      )
      await screen.findByText('26-00001')
      expect(screen.queryByText(/Pendiente|Cobrado el/)).not.toBeInTheDocument()
      expect(
        screen.queryByRole('link', { name: 'Ver cuenta de la clínica' }),
      ).not.toBeInTheDocument()
    },
  )

  it('el código del trabajo se renderiza como encabezado h1', async () => {
    renderWithRouter(<CaseHeader case={baseCase()} missing={[]} role="admin" />)
    expect(await screen.findByRole('heading', { level: 1, name: '26-00001' })).toBeInTheDocument()
  })

  it('técnico no ve el total ni el enlace Editar', async () => {
    renderWithRouter(<CaseHeader case={baseCase()} missing={[]} role="tecnico" />)
    await screen.findByText('26-00001')
    expect(screen.queryByText('$ 90.00')).not.toBeInTheDocument()
    expect(screen.queryByText('Total')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Editar/ })).not.toBeInTheDocument()
  })

  it('admin en un trabajo "terminado" no ve el enlace Editar', async () => {
    renderWithRouter(
      <CaseHeader case={baseCase({ status: 'terminado' })} missing={[]} role="admin" />,
    )
    await screen.findByText('26-00001')
    expect(screen.queryByRole('link', { name: /Editar/ })).not.toBeInTheDocument()
  })

  // UX3-18: la fase y el técnico viven en el panel «Producción», justo debajo; la cabecera no
  // los repite.
  it('no repite la fase ni el técnico, que van en el panel «Producción»', async () => {
    renderWithRouter(
      <CaseHeader
        case={baseCase({
          status: 'en_proceso',
          stage: { id: 'f1', name: 'Modelo', color: '#000' },
          assignedTechnicianId: 't1',
          technician: { id: 't1', name: 'Ana Técnica' },
        })}
        missing={[]}
        role="admin"
      />,
    )
    await screen.findByText('26-00001')
    expect(screen.queryByText('Modelo')).not.toBeInTheDocument()
    expect(screen.queryByText('Ana Técnica')).not.toBeInTheDocument()
    expect(screen.queryByText('Técnico')).not.toBeInTheDocument()
  })

  // M-3, ola de fixes del PR 1 (lote B): `finalizar` no limpia `currentStageId`/`stage` en la
  // API (ruling: no se toca la API), así que un trabajo entregado sigue trayendo la fase en la
  // que se quedó. Mostrarla ahí es ruido: ya está entregado, la fase no aporta nada.
  it('un trabajo entregado con fase en la respuesta no la muestra', async () => {
    renderWithRouter(
      <CaseHeader
        case={baseCase({
          status: 'entregado',
          stage: { id: 'f1', name: 'Modelo', color: '#000' },
        })}
        missing={[]}
        role="admin"
      />,
    )
    await screen.findByText('26-00001')
    expect(screen.queryByText('Modelo')).not.toBeInTheDocument()
  })

  // I-1, ola de fixes del PR 1 (lote B): CIC-3 exige que la ficha muestre el motivo y desde
  // cuándo está en espera, no solo que quede guardado (`holdReason` ya viajaba en `CaseDetail`
  // sin que ninguna pantalla lo mostrara).
  it('en espera muestra el motivo y la fecha del último evento "hold"', async () => {
    renderWithRouter(
      <CaseHeader
        case={baseCase({ status: 'en_espera', holdReason: 'Esperando color del paciente' })}
        missing={[]}
        role="admin"
        events={[
          event({ id: 'e1', createdAt: '2026-01-05T12:00:00.000Z', reason: 'Motivo viejo' }),
          event({ id: 'e2', createdAt: '2026-01-10T12:00:00.000Z' }),
        ]}
      />,
    )
    expect(
      await screen.findByText('En espera desde 10/01/2026: Esperando color del paciente'),
    ).toBeInTheDocument()
  })

  it('sin trabajo en espera no muestra el aviso', async () => {
    renderWithRouter(
      <CaseHeader
        case={baseCase({ status: 'en_proceso' })}
        missing={[]}
        role="admin"
        events={[]}
      />,
    )
    await screen.findByText('26-00001')
    expect(screen.queryByText(/En espera desde/)).not.toBeInTheDocument()
  })

  // I-2, ola de fixes del PR 1 (lote B): CIC-4 exige que la repetición quede enlazada en la
  // ficha del hijo, no solo en `parentCaseId` (sin código ni enlace, invisible para quien la ve).
  it('un trabajo que es repetición enlaza al padre por su código', async () => {
    renderWithRouter(
      <CaseHeader
        case={baseCase({ parentCaseId: 'caso-padre', parentCase: { code: '26-00099' } })}
        missing={[]}
        role="admin"
      />,
    )
    const link = await screen.findByRole('link', { name: /Repetición de 26-00099/ })
    expect(link).toHaveAttribute('href', '/trabajos/caso-padre')
  })

  it('el enlace al padre mide 44 px de alto (objetivo táctil)', async () => {
    renderWithRouter(
      <CaseHeader
        case={baseCase({ parentCaseId: 'caso-padre', parentCase: { code: '26-00099' } })}
        missing={[]}
        role="admin"
      />,
    )
    const link = await screen.findByRole('link', { name: /Repetición de 26-00099/ })
    expect(link).toHaveClass('min-h-11')
  })

  it('el original avisa de su repetición con un enlace «Repetido: código» de 44 px', async () => {
    renderWithRouter(
      <CaseHeader
        case={baseCase()}
        missing={[]}
        role="admin"
        remakes={[{ id: 'hijo-1', code: '26-00096' }]}
      />,
    )
    const link = await screen.findByRole('link', { name: 'Repetido: 26-00096' })
    expect(link).toHaveAttribute('href', '/trabajos/hijo-1')
    expect(link).toHaveClass('min-h-11')
  })

  it('con varias repeticiones enlaza cada una', async () => {
    renderWithRouter(
      <CaseHeader
        case={baseCase()}
        missing={[]}
        role="admin"
        remakes={[
          { id: 'h2', code: '26-00097' },
          { id: 'h1', code: '26-00096' },
        ]}
      />,
    )
    expect(await screen.findByRole('link', { name: 'Repetido: 26-00097' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Repetido: 26-00096' })).toBeInTheDocument()
  })

  it('sin repeticiones no muestra «Repetido»', async () => {
    renderWithRouter(<CaseHeader case={baseCase()} missing={[]} role="admin" remakes={[]} />)
    await screen.findByText('26-00001')
    expect(screen.queryByText(/Repetido/)).not.toBeInTheDocument()
  })

  it('muestra el enlace Imprimir para cualquier rol, incluso sin poder editar', async () => {
    renderWithRouter(
      <CaseHeader case={baseCase({ status: 'entregado' })} missing={[]} role="tecnico" />,
    )
    const link = await screen.findByRole('link', { name: /Imprimir/ })
    expect(link).toHaveAttribute('href', '/trabajos/caso-1/imprimir')
  })

  it('un trabajo que no es repetición no muestra el enlace', async () => {
    renderWithRouter(<CaseHeader case={baseCase()} missing={[]} role="admin" />)
    await screen.findByText('26-00001')
    expect(screen.queryByText(/Repetición de/)).not.toBeInTheDocument()
  })

  it('con datos faltantes muestra el aviso "Para aceptar falta: …"', async () => {
    renderWithRouter(
      <CaseHeader
        case={baseCase()}
        missing={['Fecha deseada', 'Prescripción (texto o documento)']}
        role="admin"
      />,
    )
    expect(
      await screen.findByText(
        'Para aceptar falta: Fecha deseada, Prescripción (texto o documento)',
      ),
    ).toBeInTheDocument()
  })
})
