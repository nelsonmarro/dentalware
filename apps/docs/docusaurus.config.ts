import type { Config } from '@docusaurus/types'
import type * as Preset from '@docusaurus/preset-classic'
import { themes as prismThemes } from 'prism-react-renderer'

const config: Config = {
  title: 'Manual de Dentalware',
  tagline: 'Cómo usar el programa del laboratorio, paso a paso',
  favicon: 'img/favicon.ico',
  url: 'https://docs.dentalware.naphsoft.dev',
  baseUrl: '/',
  trailingSlash: true,
  i18n: { defaultLocale: 'es', locales: ['es'], localeConfigs: { es: { htmlLang: 'es-EC' } } },
  // Un enlace, un ancla o una imagen rotos rompen el build (y el job `quality`).
  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',
  markdown: { hooks: { onBrokenMarkdownLinks: 'throw', onBrokenMarkdownImages: 'throw' } },
  presets: [
    [
      'classic',
      {
        docs: { routeBasePath: '/', sidebarPath: './sidebars.ts', showLastUpdateTime: false },
        blog: false,
        theme: { customCss: './src/css/custom.css' },
      } satisfies Preset.Options,
    ],
  ],
  themes: [
    [
      // Los textos del buscador en español están en `i18n/es/code.json`: la versión 0.55.3 no
      // tiene opción `translations` y toma los de la traducción de Docusaurus.
      '@easyops-cn/docusaurus-search-local',
      {
        hashed: true,
        language: ['es'],
        docsRouteBasePath: '/',
        indexBlog: false,
        indexPages: true,
        searchBarShortcut: true,
        searchBarShortcutHint: true,
      },
    ],
  ],
  themeConfig: {
    colorMode: { defaultMode: 'light', disableSwitch: true, respectPrefersColorScheme: false },
    navbar: {
      title: 'Dentalware',
      // Va junto al título «Dentalware»: un alt igual se leería dos veces.
      logo: { alt: '', src: 'img/logo.svg' },
      items: [
        { to: '/primeros-pasos/', label: 'Primeros pasos', position: 'left' },
        { to: '/recepcion/', label: 'Recepción', position: 'left' },
        { to: '/mensajero/', label: 'Mensajero', position: 'left' },
        { href: 'https://dentalware.naphsoft.dev', label: 'Abrir la app', position: 'right' },
      ],
    },
    footer: { style: 'light', copyright: 'Dentalware · Manual de usuario' },
    prism: { theme: prismThemes.github },
    tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
  } satisfies Preset.ThemeConfig,
}

export default config
