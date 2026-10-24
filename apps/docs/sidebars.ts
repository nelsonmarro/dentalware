import type { SidebarsConfig } from '@docusaurus/plugin-content-docs'

const sidebars: SidebarsConfig = {
  manual: [
    'index',
    {
      type: 'category',
      label: 'Primeros pasos',
      link: { type: 'doc', id: 'primeros-pasos/index' },
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
    {
      type: 'category',
      label: 'Mensajero',
      link: { type: 'doc', id: 'mensajero/index' },
      items: [
        'mensajero/entregas-del-dia',
        'mensajero/marcar-entregado',
        'mensajero/no-se-pudo',
        'mensajero/sin-senal',
      ],
    },
    {
      type: 'category',
      label: 'Referencia',
      link: { type: 'doc', id: 'referencia/index' },
      items: ['referencia/estados'],
    },
  ],
}

export default sidebars
