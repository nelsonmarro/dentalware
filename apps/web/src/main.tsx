import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import { createAppRouter } from './router'

registerSW({ immediate: true })

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

const router = createAppRouter(queryClient)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      {/* Envuelto en `print:hidden`: los botones flotantes de las devtools salían en cada PDF de
       * la orden imprimible, encima de la firma (K-3/N-1, Tarea 14). Un `display: none` en el
       * ancestro oculta también a los hijos con `position: fixed`. */}
      <div className="print:hidden">
        <ReactQueryDevtools initialIsOpen={false} />
      </div>
    </QueryClientProvider>
  </StrictMode>,
)
