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
  ],
}

export default sidebars
