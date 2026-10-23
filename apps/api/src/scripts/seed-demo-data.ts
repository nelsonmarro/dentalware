import type { LabSettingsInput, UserRole } from '@dentalware/shared'

/** Instante de demostración: la API (`CLOCK_FIXED_AT`), el seed (su `clock`) y el navegador
 * (`page.clock.setFixedTime`) usan el mismo, así las capturas no cambian de un día a otro. Un
 * martes, a media mañana. */
export const DEMO_NOW = '2026-10-20T10:30:00-05:00'

/** Laboratorio ficticio: sustituye al de Arte Dental del seed normal en la BD de demostración.
 * El manual es público (LOPDP): ninguna captura puede mostrar datos reales. Teléfonos imposibles
 * de marcar: un fijo de Quito nunca empieza por 0 tras el «02» y el prefijo móvil 090 no está
 * asignado en Ecuador. */
export const DEMO_LAB: LabSettingsInput = {
  name: 'Laboratorio Demo',
  ruc: null,
  address: 'Av. de los Ejemplos 123 y Calle Ficticia, Quito',
  phone: '02 000 0000',
  logoUrl: null,
  codePrefix: null,
  ivaPct: 15,
}

/** Precio base ficticio de cada producto del catálogo del seed normal (que los deja en 0.00), por
 * código: el manual no enseña trabajos a $ 0.00. Los precios por clínica de `DEMO_CLINICS` siguen
 * mandando sobre estos. */
export const DEMO_BASE_PRICES: Record<string, string> = {
  ZR: '90.00',
  DL: '100.00',
  MP: '80.00',
  AC: '55.00',
  CC: '70.00',
  PH: '60.00',
}

export const DEMO_USERS = [
  { key: 'recepcion', name: 'Carla Recepción', email: 'recepcion@demo.local', role: 'recepcion' },
  { key: 'tecnico', name: 'Diego Técnico', email: 'tecnico@demo.local', role: 'tecnico' },
  { key: 'mensajero', name: 'Marco Mensajero', email: 'mensajero@demo.local', role: 'mensajero' },
  { key: 'mensajera', name: 'Lucía Mensajera', email: 'mensajera@demo.local', role: 'mensajero' },
] as const satisfies readonly { key: string; name: string; email: string; role: UserRole }[]
export type DemoUserKey = (typeof DEMO_USERS)[number]['key']

export const DEMO_CLINICS = [
  {
    key: 'norte',
    name: 'Clínica Sonrisa Norte',
    address: 'Av. Imaginaria N45-12 y Los Cedros',
    city: 'Quito',
    phone: '02 000 0001',
    whatsapp: '+593900000001',
    doctors: ['Dra. Valeria Andrade', 'Dr. Tomás Herrera'],
    /** Precio por clínica de algún producto, por código del catálogo del seed (sobre el precio
     * base de `DEMO_BASE_PRICES`). */
    prices: { ZR: '95.00', MP: '85.00' },
  },
  {
    key: 'alamos',
    name: 'Centro Dental Los Álamos',
    address: 'Calle Ficticia 8-20 y Av. Ejemplo',
    city: 'Quito',
    phone: '02 000 0002',
    whatsapp: null,
    doctors: ['Dr. Rafael Mena'],
    prices: {},
  },
  {
    key: 'paredes',
    name: 'Consultorio Dra. Paredes',
    address: 'Pasaje Inventado 3 y Calle 9',
    city: 'Cumbayá',
    phone: '02 000 0003',
    whatsapp: '+593900000003',
    doctors: ['Dra. Inés Paredes'],
    prices: { DL: '110.00', AC: '60.00' },
  },
] as const
export type DemoClinicKey = (typeof DEMO_CLINICS)[number]['key']

/** Un trabajo por escenario que el manual necesita enseñar. Las fechas son días relativos a hoy
 * (`recibidoHace`, `venceEn`, en días de calendario; negativo = pasado). `escenario` es el
 * estado final al que `seedDemo` lo lleva con acciones reales (ver `runScenario` en
 * seed-demo.ts). */
export const DEMO_CASES = [
  {
    key: 'por-recoger',
    clinic: 'norte',
    patient: 'M. P.',
    product: 'ZR',
    teeth: [11, 21],
    recibidoHace: 0,
    venceEn: 7,
    escenario: 'por_recoger',
    courier: 'mensajero',
  },
  {
    key: 'en-camino',
    clinic: 'paredes',
    patient: 'T. W.',
    product: 'DL',
    teeth: [23],
    recibidoHace: 0,
    venceEn: 7,
    escenario: 'en_camino',
    courier: 'mensajero',
  },
  {
    key: 'nuevo',
    clinic: 'alamos',
    patient: 'J. R.',
    product: 'DL',
    teeth: [14],
    recibidoHace: 0,
    venceEn: 6,
    escenario: 'nuevo',
  },
  {
    key: 'vence-hoy',
    clinic: 'norte',
    patient: 'A. S.',
    product: 'MP',
    teeth: [36, 37],
    recibidoHace: -6,
    venceEn: 0,
    escenario: 'en_proceso',
  },
  {
    key: 'atrasado',
    clinic: 'paredes',
    patient: 'L. T.',
    product: 'ZR',
    teeth: [46],
    recibidoHace: -10,
    venceEn: -2,
    escenario: 'en_proceso',
  },
  {
    key: 'vence-manana',
    clinic: 'alamos',
    patient: 'C. V.',
    product: 'AC',
    teeth: [],
    recibidoHace: -3,
    venceEn: 1,
    escenario: 'en_proceso_fase_3',
  },
  {
    key: 'en-espera',
    clinic: 'paredes',
    patient: 'R. M.',
    product: 'DL',
    teeth: [12],
    recibidoHace: -4,
    venceEn: 4,
    escenario: 'en_espera',
  },
  {
    key: 'en-prueba',
    clinic: 'norte',
    patient: 'E. G.',
    product: 'MP',
    teeth: [24, 25, 26],
    recibidoHace: -5,
    venceEn: 5,
    escenario: 'en_prueba',
  },
  {
    key: 'terminado',
    clinic: 'alamos',
    patient: 'P. Q.',
    product: 'ZR',
    teeth: [16],
    recibidoHace: -7,
    venceEn: 1,
    escenario: 'terminado',
  },
  {
    key: 'enviado-marco',
    clinic: 'norte',
    patient: 'D. F.',
    product: 'DL',
    teeth: [22],
    recibidoHace: -8,
    venceEn: 0,
    escenario: 'enviado',
    courier: 'mensajero',
  },
  {
    key: 'enviado-lucia',
    clinic: 'paredes',
    patient: 'N. B.',
    product: 'AC',
    teeth: [],
    recibidoHace: -8,
    venceEn: 0,
    escenario: 'enviado',
    courier: 'mensajera',
  },
  {
    key: 'entregado',
    clinic: 'norte',
    patient: 'S. L.',
    product: 'ZR',
    teeth: [11],
    recibidoHace: -15,
    venceEn: -9,
    escenario: 'entregado',
    courier: 'mensajero',
  },
  {
    key: 'entregado-2',
    clinic: 'norte',
    patient: 'K. O.',
    product: 'MP',
    teeth: [31, 41],
    recibidoHace: -20,
    venceEn: -14,
    escenario: 'entregado',
    courier: 'mensajera',
  },
  {
    key: 'cobrado',
    clinic: 'paredes',
    patient: 'B. A.',
    product: 'DL',
    teeth: [13],
    recibidoHace: -30,
    venceEn: -24,
    escenario: 'cobrado',
    courier: 'mensajero',
  },
  {
    key: 'fallida',
    clinic: 'alamos',
    patient: 'G. H.',
    product: 'ZR',
    teeth: [15],
    recibidoHace: -9,
    venceEn: -1,
    escenario: 'entrega_fallida',
    courier: 'mensajero',
  },
  {
    key: 'cancelado',
    clinic: 'alamos',
    patient: 'U. I.',
    product: 'AC',
    teeth: [],
    recibidoHace: -2,
    venceEn: 5,
    escenario: 'cancelado',
  },
] as const
