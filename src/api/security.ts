import { client } from './client';
import type {
  AttackDefinition,
  AuditEntry,
  AuditFilters,
  Paginated,
  SecurityDashboardData,
  SimulationResult,
} from '@/types';

export async function getAuditLog(filters: AuditFilters): Promise<Paginated<AuditEntry>> {
  const { data } = await client.get<Paginated<AuditEntry>>('/audit', {
    params: {
      search: filters.search || undefined,
      action: filters.action || undefined,
      status: filters.status || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      page: filters.page,
      pageSize: filters.pageSize,
    },
  });
  return data;
}

export async function getSecurityDashboard(): Promise<SecurityDashboardData> {
  const { data } = await client.get<SecurityDashboardData>('/security/dashboard');
  return data;
}

/**
 * Runs all 8 isolation checks server-side in one request. Each check uses its own
 * DB scope and nothing is mutated or returned except pass/fail evidence.
 */
export async function simulateAttacks(): Promise<SimulationResult[]> {
  const { data } = await client.post<SimulationResult[]>('/security/simulate-attack', undefined, {
    skipGlobalErrorHandler: true,
    timeout: 30_000,
  });
  return data;
}

export const ATTACKS: AttackDefinition[] = [
  {
    id: 'missing_tenant_header',
    name: 'Missing tenant header',
    description: 'Valid JWT, but no X-Tenant-Id header or tenant subdomain.',
    expected: '400',
  },
  {
    id: 'header_spoof',
    name: 'Header spoof to another tenant',
    description: 'X-Tenant-Id is rewritten to a tenant the user does not belong to.',
    expected: '403',
  },
  {
    id: 'forged_jwt',
    name: 'Forged JWT',
    description: 'Token with valid claims signed with an attacker-controlled key.',
    expected: '401',
  },
  {
    id: 'cross_tenant_read',
    name: 'Cross-tenant product read',
    description: 'Fetch a product ID that belongs to a different tenant.',
    expected: '404',
  },
  {
    id: 'cross_tenant_write',
    name: 'Cross-tenant product write',
    description: "Update another tenant's product, then force it past the query filter.",
    expected: '404',
  },
  {
    id: 'path_traversal',
    name: 'Path traversal filename',
    description: 'Upload named "../../../tenants/other/products/evil.png".',
    expected: 'key rewritten',
  },
  {
    id: 'cache_probe',
    name: 'Cache probe without tenant key',
    description: 'Read a cached value using a key with no tenant namespace.',
    expected: 'cache miss',
  },
  {
    id: 'rls_bypass_raw_sql',
    name: 'Raw SQL around the ORM',
    description: 'SELECT count(*) FROM products on a raw connection, skipping EF entirely.',
    expected: '0 rows',
  },
];
