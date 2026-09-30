import { client } from './client';
import type {
  ImageUrlResponse,
  Paginated,
  Product,
  ProductInput,
  ProductQuery,
  StockMovement,
} from '@/types';

export async function getProducts(query: ProductQuery): Promise<Paginated<Product>> {
  const { data } = await client.get<Paginated<Product>>('/products', {
    params: {
      search: query.search || undefined,
      category: query.category || undefined,
      page: query.page,
      pageSize: query.pageSize,
    },
  });
  return data;
}

export async function getCategories(): Promise<string[]> {
  const { data } = await client.get<string[]>('/products/categories');
  return data;
}

/** Errors are handled by the detail page so it can render an explainable denial. */
export async function getProduct(id: string): Promise<Product> {
  const { data } = await client.get<Product>(`/products/${encodeURIComponent(id)}`, {
    skipGlobalErrorHandler: true,
  });
  return data;
}

export async function getProductMovements(id: string): Promise<StockMovement[]> {
  const { data } = await client.get<StockMovement[]>(
    `/products/${encodeURIComponent(id)}/movements`,
    { skipGlobalErrorHandler: true },
  );
  return data;
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const { data } = await client.post<Product>('/products', input);
  return data;
}

export async function updateProduct(id: string, input: ProductInput): Promise<Product> {
  const { data } = await client.put<Product>(`/products/${encodeURIComponent(id)}`, input);
  return data;
}

export async function deleteProduct(id: string): Promise<void> {
  await client.delete(`/products/${encodeURIComponent(id)}`);
}

export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Multipart upload; the server picks the storage key, so the filename is never used. */
export async function uploadProductImage(
  id: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<Product> {
  const form = new FormData();
  form.append('file', file, 'image');
  const { data } = await client.post<Product>(`/products/${encodeURIComponent(id)}/image`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60_000,
    onUploadProgress: (event) => {
      if (event.total && onProgress) onProgress(Math.round((event.loaded / event.total) * 100));
    },
  });
  return data;
}

export async function deleteProductImage(id: string): Promise<Product> {
  const { data } = await client.delete<Product>(`/products/${encodeURIComponent(id)}/image`);
  return data;
}

export async function getProductImageUrl(id: string): Promise<ImageUrlResponse> {
  const { data } = await client.get<ImageUrlResponse>(`/products/${encodeURIComponent(id)}/image-url`);
  return data;
}
