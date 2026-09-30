import { client } from './client';
import type { SecurityContext, Tenant } from '@/types';

export async function getTenants(): Promise<Tenant[]> {
  const { data } = await client.get<Tenant[]>('/tenants', { skipGlobalErrorHandler: true });
  return data;
}

export async function createTenant(name: string): Promise<Tenant> {
  const { data } = await client.post<Tenant>('/tenants', { name });
  return data;
}

/** Pass `'switch'` right after a tenant switch so the backend records it in the audit log. */
export async function getSecurityContext(reason?: 'switch'): Promise<SecurityContext> {
  const { data } = await client.get<SecurityContext>('/security/context', {
    params: { reason },
  });
  return data;
}

export type ExportFormat = 'csv' | 'json';

export async function exportProducts(format: ExportFormat): Promise<Blob> {
  const { data } = await client.get<Blob>(`/export/products.${format}`, { responseType: 'blob' });
  return data;
}
