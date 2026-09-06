import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ProductCategoryInput, ProductInput } from '@dentalware/shared'
import { toast } from 'sonner'
import { toastApiError } from '@/lib/api-error'
import { queryKeys } from '@/lib/query-keys'
import {
  deleteClinicPrice,
  fetchCategories,
  fetchClinicPrices,
  fetchProducts,
  putClinicPrice,
  saveCategory,
  saveProduct,
  setCategoryActive,
  setProductActive,
} from './api'

export function useCategories(inactive: boolean) {
  return useQuery({
    queryKey: queryKeys.categories(inactive),
    queryFn: () => fetchCategories(inactive),
  })
}
function useInvalidateCategories() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['config', 'categorias'] })
}
export function useSaveCategory() {
  const invalidate = useInvalidateCategories()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: ProductCategoryInput }) =>
      saveCategory(id, input),
    onSuccess: (_c, { id }) => {
      void invalidate()
      toast.success(id ? 'Categoría actualizada' : 'Categoría creada')
    },
    onError: toastApiError,
  })
}
export function useSetCategoryActive() {
  const invalidate = useInvalidateCategories()
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setCategoryActive(id, active),
    onSuccess: (_c, { active }) => {
      void invalidate()
      toast.success(active ? 'Categoría activada' : 'Categoría desactivada')
    },
    onError: toastApiError,
  })
}

export function useProducts(inactive: boolean) {
  return useQuery({
    queryKey: queryKeys.products(inactive),
    queryFn: () => fetchProducts(inactive),
  })
}
function useInvalidateProducts() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['config', 'productos'] })
}
export function useSaveProduct() {
  const invalidate = useInvalidateProducts()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: ProductInput }) => saveProduct(id, input),
    onSuccess: (_p, { id }) => {
      void invalidate()
      toast.success(id ? 'Producto actualizado' : 'Producto creado')
    },
    onError: toastApiError,
  })
}
export function useSetProductActive() {
  const invalidate = useInvalidateProducts()
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setProductActive(id, active),
    onSuccess: (_p, { active }) => {
      void invalidate()
      toast.success(active ? 'Producto activado' : 'Producto desactivado')
    },
    onError: toastApiError,
  })
}

export function useClinicPrices(clinicId: string) {
  return useQuery({
    queryKey: queryKeys.clinicPrices(clinicId),
    queryFn: () => fetchClinicPrices(clinicId),
  })
}
export function useSaveClinicPrice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      clinicId,
      productId,
      price,
    }: {
      clinicId: string
      productId: string
      price: string
    }) => putClinicPrice(clinicId, productId, price),
    onSuccess: (_p, { clinicId }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.clinicPrices(clinicId) })
      toast.success('Precio especial guardado')
    },
    onError: toastApiError,
  })
}
export function useDeleteClinicPrice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ clinicId, productId }: { clinicId: string; productId: string }) =>
      deleteClinicPrice(clinicId, productId),
    onSuccess: (_v, { clinicId }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.clinicPrices(clinicId) })
      toast.success('Precio especial quitado')
    },
    onError: toastApiError,
  })
}
