import type { QueryClient } from '@tanstack/react-query'
import { createRouter, type RouterHistory } from '@tanstack/react-router'
import { RouterErrorFallback } from './components/router-error-fallback'
import { routeTree } from './routeTree.gen'

/**
 * Extraído de `main.tsx` (UX3-02) para poder probar `defaultErrorComponent` con el árbol de
 * rutas real, igual que ya hacen los tests de `features/auth/` con `createRouter({ routeTree })`
 * directo — `history` es opcional solo para poder pasar un `createMemoryHistory()` en pruebas.
 */
export function createAppRouter(queryClient: QueryClient, history?: RouterHistory) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    scrollRestoration: true,
    defaultErrorComponent: RouterErrorFallback,
    ...(history ? { history } : {}),
  })
}

export type AppRouter = ReturnType<typeof createAppRouter>

declare module '@tanstack/react-router' {
  interface Register {
    router: AppRouter
  }
}
