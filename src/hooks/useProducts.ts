import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as productsApi from '@/api/products';
import { useCurrentTenant } from '@/context/TenantContext';
import { emitToast } from '@/lib/errors';
import type { Product, ProductInput, ProductQuery } from '@/types';

export const productKeys = {
  all: (tenantId: string) => ['products', tenantId] as const,
  list: (tenantId: string, query: ProductQuery) => ['products', tenantId, query] as const,
  categories: (tenantId: string) => ['products', tenantId, 'categories'] as const,
  detail: (tenantId: string, id: string) => ['product', tenantId, id] as const,
  movements: (tenantId: string, id: string) => ['product', tenantId, id, 'movements'] as const,
};

export function useProducts(query: ProductQuery) {
  const tenant = useCurrentTenant();
  return useQuery({
    queryKey: productKeys.list(tenant.id, query),
    queryFn: () => productsApi.getProducts(query),
    // Only keeps the previous page within the same tenant, since keys are tenant-scoped.
    placeholderData: keepPreviousData,
  });
}

export function useCategories() {
  const tenant = useCurrentTenant();
  return useQuery({
    queryKey: productKeys.categories(tenant.id),
    queryFn: productsApi.getCategories,
    staleTime: 5 * 60_000,
  });
}

export function useProduct(id: string | undefined) {
  const tenant = useCurrentTenant();
  return useQuery({
    queryKey: productKeys.detail(tenant.id, id ?? ''),
    queryFn: () => productsApi.getProduct(id as string),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useProductMovements(id: string | undefined, enabled = true) {
  const tenant = useCurrentTenant();
  return useQuery({
    queryKey: productKeys.movements(tenant.id, id ?? ''),
    queryFn: () => productsApi.getProductMovements(id as string),
    enabled: Boolean(id) && enabled,
    retry: false,
  });
}

export interface SaveProductVariables {
  input: ProductInput;
  /** `undefined` leaves the image untouched, `null` removes it, a File replaces it. */
  image?: File | null;
  onUploadProgress?: (percent: number) => void;
}

interface SaveResult {
  product: Product;
  imageFailed: boolean;
}

/** Image changes run after the product is saved, since uploads need the product id. */
async function applyImageChange(product: Product, vars: SaveProductVariables): Promise<SaveResult> {
  try {
    if (vars.image) {
      return { product: await productsApi.uploadProductImage(product.id, vars.image, vars.onUploadProgress), imageFailed: false };
    }
    if (vars.image === null && product.imageUrl) {
      return { product: await productsApi.deleteProductImage(product.id), imageFailed: false };
    }
    return { product, imageFailed: false };
  } catch {
    // The API error handler already explained the failure; the product itself was saved.
    return { product, imageFailed: true };
  }
}

function useSaveProduct(save: (input: ProductInput) => Promise<Product>, verb: string) {
  const tenant = useCurrentTenant();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: SaveProductVariables) => applyImageChange(await save(vars.input), vars),
    onSuccess: ({ product, imageFailed }) => {
      queryClient.setQueryData(productKeys.detail(tenant.id, product.id), product);
      queryClient.invalidateQueries({ queryKey: productKeys.all(tenant.id) });
      queryClient.invalidateQueries({ queryKey: ['dashboard', tenant.id] });
      if (imageFailed) emitToast('warning', `${verb} ${product.name}, but the image change was not applied`);
      else emitToast('success', `${verb} ${product.name}`);
    },
  });
}

export function useCreateProduct() {
  return useSaveProduct(productsApi.createProduct, 'Created');
}

export function useUpdateProduct(id: string) {
  return useSaveProduct((input) => productsApi.updateProduct(id, input), 'Saved');
}

export function useDeleteProduct() {
  const tenant = useCurrentTenant();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => productsApi.deleteProduct(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: productKeys.detail(tenant.id, id) });
      queryClient.invalidateQueries({ queryKey: productKeys.all(tenant.id) });
      queryClient.invalidateQueries({ queryKey: ['dashboard', tenant.id] });
      emitToast('success', 'Product deleted');
    },
  });
}
