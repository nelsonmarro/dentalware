# Dentalware — Dirección de diseño de la interfaz

Fecha: 2026-09-01 · Aplica a toda tarea de UI (web PWA). Complementa el spec del MVP.

## 1. Sujeto, audiencia y trabajo de la pantalla

- **Sujeto**: la mesa de trabajo de un laboratorio dental. Yeso, zirconia, porcelana, cera, papel de articular, fichas de trabajo con código y colores VITA.
- **Audiencias y contexto real de uso**:
  - Recepción/administración en PC: listas densas, filtros, teclado, impresión.
  - Técnicos en el banco con guantes y polvo de yeso, en celular o tablet: lectura a un metro, botones grandes, pocas decisiones por pantalla.
  - Mensajero en la calle, con sol: contraste alto, acciones de un toque.
- **Trabajo único de la app**: saber en qué estado está cada trabajo y moverlo a la siguiente fase sin fricción.

## 2. Tokens

### Color (claro por defecto; oscuro opcional después)

| Token | Hex | Uso |
|---|---|---|
| `--porcelain` | `#F4F6F5` | fondo de página (blanco porcelana, frío) |
| `--zirconia` | `#FFFFFF` | superficies: tarjetas, tablas, formularios |
| `--plaster` | `#E2E6E3` | bordes y divisores (1px) |
| `--graphite` | `#1E2A2D` | texto principal (grafito verdoso, no negro puro) |
| `--graphite-60` | `#5B6A6E` | texto secundario, iconos inactivos |
| `--teal-lab` | `#0F766E` | primario: botones, enlaces activos, foco |
| `--teal-lab-soft` | `#D9EFEC` | fondos de chips/estado activo |
| `--articulating-red` | `#D6453D` | atrasado, error, destructivo (rojo del papel de articular) |
| `--wax-amber` | `#D99A16` | vence hoy, advertencia, en espera |
| `--ok-green` | `#2F8F5B` | entregado, correcto |

Reglas: el color primario aparece solo en la acción principal, el enlace activo y el anillo de foco. Los estados (nuevo, en proceso, en espera, en prueba, terminado, enviado, entregado, cancelado) se codifican con **chip + texto**, nunca solo con color. Las fases usan el color configurado por el laboratorio (VEVI) sobre `--teal-lab-soft`.

Mapeo a variables de shadcn (`src/index.css`, bloque `:root`):

```css
--background: #F4F6F5;
--foreground: #1E2A2D;
--card: #FFFFFF;
--card-foreground: #1E2A2D;
--popover: #FFFFFF;
--popover-foreground: #1E2A2D;
--primary: #0F766E;
--primary-foreground: #FFFFFF;
--secondary: #E9EEEC;
--secondary-foreground: #1E2A2D;
--muted: #EEF1F0;
--muted-foreground: #5B6A6E;
--accent: #D9EFEC;
--accent-foreground: #0F766E;
--destructive: #D6453D;
--border: #E2E6E3;
--input: #E2E6E3;
--ring: #0F766E;
--radius: 0.75rem;
```

### Tipografía

- **UI y texto**: `Instrument Sans` (variable), 400/500/600. Legible en pantallas pequeñas, personalidad geométrica sin parecer plantilla.
- **Datos**: `JetBrains Mono` para códigos de trabajo (`26-00123`), piezas FDI, fechas cortas y montos. Cifras tabulares hacen las listas escaneables.
- Ambas **autoalojadas** vía paquetes `@fontsource-variable/instrument-sans` y `@fontsource-variable/jetbrains-mono` (versión 5.3.0 en ambas, verificada en npm el 2026-09-03). Fallbacks: `system-ui, sans-serif` y `ui-monospace, monospace`.
- Escala: 12 / 14 (base móvil) / 16 (base PC) / 18 / 24 / 32. Títulos de página 24 semibold, sin mayúsculas forzadas. Interlineado 1.45.

```css
@theme inline {
  --font-sans: 'Instrument Sans Variable', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono Variable', ui-monospace, monospace;
}
```

### Espaciado y forma

- Radio 12px en tarjetas y botones, 8px en inputs y chips. Bordes 1px `--plaster`; sombras casi inexistentes (solo en menús flotantes).
- Objetivos táctiles ≥ 44px. En móvil los botones primarios ocupan el ancho completo al pie del formulario.
- Ancho máximo del contenido 1200px en PC; listas en tabla en PC y en tarjetas en móvil.

## 3. Layout

```
PC (≥1024px)                              Móvil
┌──────────┬──────────────────────────┐   ┌──────────────────────┐
│ Dentalware│ Título de página   [+]   │   │ Dentalware      [⏻]  │
│──────────│──────────────────────────│   │──────────────────────│
│ ▸ Inicio │ filtros ─────────────────│   │ Título               │
│  Trabajos│ ┌ tabla ────────────────┐│   │ ┌ tarjeta ─────────┐ │
│  Entregas│ │ código │ clínica │ … ││   │ │▌26-00123  En proc│ │
│  Cuentas │ │ 26-00123 ...          ││   │ │ Clínica · Dr.    │ │
│  Config. │ └───────────────────────┘│   │ │ vence hoy ●      │ │
│          │                          │   │ └──────────────────┘ │
│ Ana  [⏻] │                          │   │──────────────────────│
└──────────┴──────────────────────────┘   │ ⌂  ☰  🚚  $  ⚙       │
                                          └──────────────────────┘
```

- Sidebar fija de 240px en PC con el nombre del usuario y cerrar sesión al pie.
- Barra inferior en móvil con 4-5 destinos según rol; el destino activo en `--teal-lab`.
- Acción principal de cada pantalla arriba a la derecha en PC y como botón flotante o de ancho completo en móvil.

## 4. Firma visual

La **pestaña de color del ticket**: cada trabajo se representa como una ficha física con un borde izquierdo de 4px del color de su fase, y su código en monoespaciado. Es el mismo lenguaje en la lista, en la tarjeta móvil, en la ficha impresa y en el tablero. En la Iteración 2 el **odontograma FDI** interactivo hereda esta identidad (piezas seleccionadas en `--teal-lab`, pilares/pónticos diferenciados por trazo).

## 5. Movimiento

Casi nulo: transición de 150ms en hover/foco y al cambiar de chip de estado. Ninguna animación de entrada de página. Respetar `prefers-reduced-motion`.

## 6. Redacción

- Español, sentence case, verbos concretos: "Ingresar", "Cerrar sesión", "Nuevo trabajo", "Avanzar fase", "Marcar entregado". El nombre de la acción se mantiene igual en botón y confirmación.
- Errores: qué pasó y cómo seguir, sin disculpas ("Correo o contraseña incorrectos", "No se puede finalizar: el trabajo está en espera").
- Estados vacíos como invitación: "Aún no hay trabajos. Crea el primero con Nuevo trabajo".

## 7. Piso de calidad (no negociable)

- Responsive de 360px a 1920px sin scroll horizontal.
- Foco visible (anillo `--ring` de 2px) en todo control; navegación por teclado completa en PC.
- Contraste AA mínimo en texto y chips.
- Etiquetas visibles en todos los campos; `aria-label` en botones de solo icono.
- `prefers-reduced-motion` respetado; `viewport-fit=cover` y `safe-area-inset-bottom` en la barra inferior.

## 8. Autocrítica frente a los defaults

- Se evitó el fondo crema `#F4F1EA` + serif + terracota: el laboratorio es porcelana fría y grafito, no papel viejo.
- Se evitó el fondo negro con acento ácido: los técnicos trabajan en bancos muy iluminados; un tema claro con acento teal lee mejor con polvo en la pantalla. El tema oscuro queda como opción futura.
- Se evitó Inter/Roboto por defecto: Instrument Sans + JetBrains Mono dan carácter con costo cero.
- Un solo elemento con riesgo: la pestaña de color del ticket como lenguaje transversal. Todo lo demás, silencioso.
