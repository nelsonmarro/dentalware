import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import type { LabSettings } from '@/features/config/api'
import type { CaseDetail } from './api'
import { PrintOrder } from './print-order'

// El QR solo necesita comprobar qué `value` recibe (I-2): un fake que lo vuelca a texto evita
// decodificar una imagen SVG en jsdom y deja la aserción exacta sobre la URL que se codifica.
vi.mock('./qr-code', () => ({
  QrCode: ({ value }: { value: string }) => <span data-testid="qr-value">{value}</span>,
}))

const PUBLIC_URL = 'https://artedental.example'

function settings(overrides: Partial<LabSettings> = {}): LabSettings {
  return {
    id: 'lab-1',
    name: 'Arte Dental',
    ruc: '1791234567001',
    address: 'Puerto Rico N27-33 y La Isla',
    phone: '0961440991 / 0996081498',
    logoUrl: null,
    codePrefix: null,
    ivaPct: 15,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as unknown as LabSettings
}

function casoCompleto(overrides: Partial<CaseDetail> = {}): CaseDetail {
  return {
    id: 'caso-1',
    code: '26-00123',
    boxNumber: null,
    clinicId: 'clinica-1',
    doctorId: 'doctor-1',
    patientRef: 'JP-14',
    patientAge: 42,
    patientSex: 'M',
    status: 'nuevo',
    currentStageId: null,
    assignedTechnicianId: null,
    priority: 'normal',
    receivedAt: '2026-01-01',
    dueDate: '2026-01-10',
    promisedDate: '2026-01-12',
    finishedAt: null,
    shippedAt: null,
    deliveredAt: null,
    paidAt: null,
    shade: 'A2',
    shadeSystem: 'vita_classical',
    reference: 'Guía adjunta',
    checklist: { antagonista: true, mordida: false, color: true, fotos: false },
    observations: 'Ajustar oclusión',
    prescription: null,
    internalNotes: 'Nota interna confidencial: no imprimir',
    holdReason: null,
    parentCaseId: null,
    parentCase: null,
    remakeReason: null,
    remakeResponsibility: null,
    remakeChargePct: null,
    total: '147.00',
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    clinic: { id: 'clinica-1', name: 'Clínica Uno' },
    doctor: { id: 'doctor-1', name: 'Dr. Gómez' },
    technician: { id: 'tec-1', name: 'Carlos Pilco' },
    stage: null,
    items: [
      {
        id: 'item-1',
        caseId: 'caso-1',
        productId: 'producto-1',
        description: null,
        quantity: 1,
        teeth: [11],
        unitPrice: '100.00',
        discountPct: '0.00',
        lineTotal: '100.00',
        material: null,
        notes: null,
        sort: 0,
        product: {
          id: 'producto-1',
          code: 'ZR',
          name: 'Corona de zirconio',
          pricingUnit: 'por_pieza',
        },
      },
      {
        id: 'item-2',
        caseId: 'caso-1',
        productId: 'producto-2',
        description: null,
        quantity: 1,
        teeth: [],
        unitPrice: '47.00',
        discountPct: '0.00',
        lineTotal: '47.00',
        material: null,
        notes: null,
        sort: 1,
        product: { id: 'producto-2', code: 'AC', name: 'Placa acrílica', pricingUnit: 'unidad' },
      },
    ],
    ...overrides,
  } as unknown as CaseDetail
}

describe('PrintOrder', () => {
  it('reproduce los bloques de la orden en papel y en su orden (M-2: título "Orden de trabajo")', async () => {
    renderWithProviders(
      <PrintOrder
        case={casoCompleto()}
        settings={settings()}
        copy="clinica"
        publicUrl={PUBLIC_URL}
      />,
    )
    const titulos = (await screen.findAllByRole('heading')).map((h) => h.textContent)
    expect(titulos).toEqual([
      'Arte Dental',
      'Orden de trabajo 26-00123',
      'Paciente',
      'Color y sistema',
      'Odontograma',
      'Líneas',
      'Observaciones',
      'Lista de verificación',
      'Firmas',
    ])
  })

  it('la copia laboratorio no lleva precios ni total (UX3-21)', async () => {
    renderWithProviders(
      <PrintOrder
        case={casoCompleto()}
        settings={settings()}
        copy="laboratorio"
        publicUrl={PUBLIC_URL}
      />,
    )
    await screen.findByRole('heading', { name: /Orden de trabajo 26-00123/ })
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Total/)).not.toBeInTheDocument()
  })

  it('la copia clínica lleva los precios de cada línea y el total (UX3-21)', async () => {
    renderWithProviders(
      <PrintOrder
        case={casoCompleto()}
        settings={settings()}
        copy="clinica"
        publicUrl={PUBLIC_URL}
      />,
    )
    expect(await screen.findByText('$ 100.00')).toBeInTheDocument()
    expect(screen.getByText('$ 47.00')).toBeInTheDocument()
    expect(screen.getByText('$ 147.00')).toBeInTheDocument()
  })

  it('rotula la copia laboratorio en el papel (UX3-21)', async () => {
    renderWithProviders(
      <PrintOrder
        case={casoCompleto()}
        settings={settings()}
        copy="laboratorio"
        publicUrl={PUBLIC_URL}
      />,
    )
    expect(await screen.findByText('Copia laboratorio')).toBeInTheDocument()
    expect(screen.queryByText('Copia clínica')).not.toBeInTheDocument()
  })

  it('rotula la copia clínica en el papel (UX3-21)', async () => {
    renderWithProviders(
      <PrintOrder
        case={casoCompleto()}
        settings={settings()}
        copy="clinica"
        publicUrl={PUBLIC_URL}
      />,
    )
    expect(await screen.findByText('Copia clínica')).toBeInTheDocument()
    expect(screen.queryByText('Copia laboratorio')).not.toBeInTheDocument()
  })

  it('marca en el odontograma solo las piezas del trabajo', async () => {
    renderWithProviders(
      <PrintOrder
        case={casoCompleto()}
        settings={settings()}
        copy="clinica"
        publicUrl={PUBLIC_URL}
      />,
    )
    expect(await screen.findByTestId('pieza-11')).toHaveAttribute('data-marcada', 'true')
    expect(screen.getByTestId('pieza-21')).toHaveAttribute('data-marcada', 'false')
  })

  // I-1 (lo más grave de la revisión): con «Gráficos de fondo» desactivado (por defecto en
  // Chrome), `background-color` no se imprime pero el color de texto sí — `bg-foreground
  // text-background` a solas dejaba la marca invisible (texto del mismo color que el fondo
  // ausente). La marca real es el borde grueso y la negrita, con el texto siempre en
  // `foreground`; el relleno puede quedar además, pero no es lo único que distingue la pieza.
  it('marca la pieza con borde grueso y negrita, no solo con el fondo (I-1)', async () => {
    renderWithProviders(
      <PrintOrder
        case={casoCompleto()}
        settings={settings()}
        copy="clinica"
        publicUrl={PUBLIC_URL}
      />,
    )
    const marcada = await screen.findByTestId('pieza-11')
    expect(marcada.className).toMatch(/border-2/)
    expect(marcada.className).toMatch(/font-bold/)
    expect(marcada.className).not.toMatch(/text-background/)
    const sinMarcar = screen.getByTestId('pieza-21')
    expect(sinMarcar.className).not.toMatch(/font-bold/)
  })

  // M-1: el orden de lectura del odontograma en papel es 18→11, 21→28 (arcada superior) y
  // 48→41, 31→38 (arcada inferior). Mutación: invertir los cuadrantes de una arcada (p. ej.
  // pasar `[FDI_QUADRANTS[2], FDI_QUADRANTS[1]]` en vez de `[1, 2]`) hace caer este test.
  it('ordena las piezas del odontograma como en la hoja de papel (M-1)', async () => {
    renderWithProviders(
      <PrintOrder
        case={casoCompleto()}
        settings={settings()}
        copy="clinica"
        publicUrl={PUBLIC_URL}
      />,
    )
    const odontograma = await screen.findByTestId('print-odontogram')
    const ids = [...odontograma.querySelectorAll('[data-testid^="pieza-"]')].map((el) =>
      el.getAttribute('data-testid'),
    )
    expect(ids).toEqual([
      'pieza-18',
      'pieza-17',
      'pieza-16',
      'pieza-15',
      'pieza-14',
      'pieza-13',
      'pieza-12',
      'pieza-11',
      'pieza-21',
      'pieza-22',
      'pieza-23',
      'pieza-24',
      'pieza-25',
      'pieza-26',
      'pieza-27',
      'pieza-28',
      'pieza-48',
      'pieza-47',
      'pieza-46',
      'pieza-45',
      'pieza-44',
      'pieza-43',
      'pieza-42',
      'pieza-41',
      'pieza-31',
      'pieza-32',
      'pieza-33',
      'pieza-34',
      'pieza-35',
      'pieza-36',
      'pieza-37',
      'pieza-38',
    ])
  })

  it('nunca imprime las notas internas, ni para admin', async () => {
    renderWithProviders(
      <PrintOrder
        case={casoCompleto()}
        settings={settings()}
        copy="clinica"
        publicUrl={PUBLIC_URL}
      />,
    )
    await screen.findByRole('heading', { name: /Orden de trabajo 26-00123/ })
    expect(screen.queryByText(/Nota interna confidencial/)).not.toBeInTheDocument()
  })

  it('el QR codifica la URL pública configurada, no window.location (I-2)', async () => {
    renderWithProviders(
      <PrintOrder
        case={casoCompleto()}
        settings={settings()}
        copy="clinica"
        publicUrl={PUBLIC_URL}
      />,
    )
    expect(await screen.findByTestId('qr-value')).toHaveTextContent(`${PUBLIC_URL}/t/26-00123`)
  })

  // M-2: el logo del laboratorio, cuando `lab_settings.logoUrl` existe.
  it('muestra el logo del laboratorio cuando settings.logoUrl existe (M-2)', async () => {
    renderWithProviders(
      <PrintOrder
        case={casoCompleto()}
        settings={settings({ logoUrl: 'https://cdn.example/logo.png' })}
        copy="clinica"
        publicUrl={PUBLIC_URL}
      />,
    )
    expect(await screen.findByRole('img', { name: /logo/i })).toHaveAttribute(
      'src',
      'https://cdn.example/logo.png',
    )
  })

  it('no muestra logo cuando settings.logoUrl es null', async () => {
    renderWithProviders(
      <PrintOrder
        case={casoCompleto()}
        settings={settings({ logoUrl: null })}
        copy="clinica"
        publicUrl={PUBLIC_URL}
      />,
    )
    await screen.findByRole('heading', { name: /Orden de trabajo 26-00123/ })
    expect(screen.queryByRole('img', { name: /logo/i })).not.toBeInTheDocument()
  })

  // M-3: si la línea no tiene producto (borrado o importado sin catálogo), se usa la
  // descripción libre como respaldo para que la línea no quede en blanco.
  it('usa la descripción de la línea como respaldo cuando no hay producto (M-3)', async () => {
    renderWithProviders(
      <PrintOrder
        case={casoCompleto({
          items: [
            {
              id: 'item-1',
              caseId: 'caso-1',
              productId: 'producto-eliminado',
              description: 'Corona provisional (sin catálogo)',
              quantity: 1,
              teeth: [],
              unitPrice: '10.00',
              discountPct: '0.00',
              lineTotal: '10.00',
              material: null,
              notes: null,
              sort: 0,
              product: null,
            },
          ],
        })}
        settings={settings()}
        copy="clinica"
        publicUrl={PUBLIC_URL}
      />,
    )
    expect(await screen.findByText('Corona provisional (sin catálogo)')).toBeInTheDocument()
  })

  // M-7: "Fecha entrega" es la comprometida (`promisedDate`) si existe; si no, la deseada
  // (`dueDate`); si tampoco hay deseada, una línea en blanco para escribirla a mano.
  it('«Fecha entrega» muestra la fecha comprometida cuando existe (M-7)', async () => {
    renderWithProviders(
      <PrintOrder
        case={casoCompleto({ promisedDate: '2026-02-20', dueDate: '2026-02-10' })}
        settings={settings()}
        copy="clinica"
        publicUrl={PUBLIC_URL}
      />,
    )
    expect(await screen.findByText('20/02/2026')).toBeInTheDocument()
  })

  it('«Fecha entrega» cae a la fecha deseada si no hay comprometida (M-7)', async () => {
    renderWithProviders(
      <PrintOrder
        case={casoCompleto({ promisedDate: null, dueDate: '2026-02-10' })}
        settings={settings()}
        copy="clinica"
        publicUrl={PUBLIC_URL}
      />,
    )
    expect(await screen.findByText('10/02/2026')).toBeInTheDocument()
  })

  it('«Fecha entrega» deja una línea en blanco si no hay comprometida ni deseada (M-7)', async () => {
    renderWithProviders(
      <PrintOrder
        case={casoCompleto({ promisedDate: null, dueDate: null })}
        settings={settings()}
        copy="clinica"
        publicUrl={PUBLIC_URL}
      />,
    )
    expect(await screen.findByTestId('fecha-entrega-en-blanco')).toBeInTheDocument()
  })
})
