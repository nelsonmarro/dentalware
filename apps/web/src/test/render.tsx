import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'

export function renderWithProviders(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return {
    user: userEvent.setup(),
    client,
    ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>),
  }
}

/**
 * Mismo patrón que `renderWithProviders`, con `RouterProvider` además de `QueryClientProvider`
 * (ronda de fixes 2, hallazgo M-2): para componentes que fetchean con TanStack Query **y**
 * además usan `<Link>` (p. ej. una tabla de `DataGrid` con filas enlazadas, o un `<Link>` de
 * «volver») — sin el router, `<Link>` lanza fuera de un `RouterProvider`. Antes se repetía este
 * mismo harness local en `clinics-list.test.tsx`, `clinic-detail-content.test.tsx` y
 * `users-list.test.tsx`.
 */
export function renderWithQueryAndRouter(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
    }),
    history: createMemoryHistory(),
  })
  return {
    user: userEvent.setup(),
    client,
    ...render(<RouterProvider router={router} />),
  }
}
