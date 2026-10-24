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
      label: 'Técnico',
      link: { type: 'doc', id: 'tecnico/index' },
      items: [
        'tecnico/mis-trabajos',
        'tecnico/avanzar-fase',
        'tecnico/pruebas-y-espera',
        'tecnico/finalizar',
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
      label: 'Administración',
      link: { type: 'doc', id: 'administracion/index' },
      items: [
        'administracion/datos-del-laboratorio',
        'administracion/fases',
        'administracion/productos-y-precios',
        'administracion/clinicas-y-doctores',
        'administracion/usuarios-y-roles',
      ],
    },
    {
      type: 'category',
      label: 'Referencia',
      link: { type: 'doc', id: 'referencia/index' },
      items: ['referencia/estados', 'referencia/glosario', 'referencia/preguntas-frecuentes'],
    },
  ],
}

export default sidebars
