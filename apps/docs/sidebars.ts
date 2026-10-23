import type { SidebarsConfig } from '@docusaurus/plugin-content-docs'

const sidebars: SidebarsConfig = {
  manual: [
    'index',
    {
      type: 'category',
      label: 'Primeros pasos',
      link: { type: 'generated-index', title: 'Primeros pasos', slug: '/primeros-pasos' },
      items: [
        'primeros-pasos/entrar-y-salir',
        'primeros-pasos/instalar-la-app',
        'primeros-pasos/que-ve-cada-rol',
      ],
    },
    {
      type: 'category',
      label: 'Recepción',
      link: { type: 'doc', id: 'recepcion/index' },
      items: [
        'recepcion/crear-un-trabajo',
        'recepcion/la-ficha-del-trabajo',
        'recepcion/estados-y-acciones',
        'recepcion/recogidas-y-entregas',
        'recepcion/avisar-por-whatsapp',
        'recepcion/cuentas-y-pagos',
        'recepcion/imprimir',
      ],
    },
  ],
}

export default sidebars
