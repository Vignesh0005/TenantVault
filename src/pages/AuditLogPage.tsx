import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { FilterX, ScrollText, Search } from 'lucide-react';
import { getAuditLog } from '@/api/security';
import { PageHeader } from '@/components/ui/PageHeader';
import { Table, type Column } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { AuditStatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { useCurrentTenant } from '@/context/TenantContext';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDateTime } from '@/lib/format';
import type { AuditEntry, AuditFilters } from '@/types';

const ACTIONS = [
  'login',
  'login_failed',
  'product.create',
  'product.update',
  'product.delete',
  'product.scan',
  'image.upload',
  'image.delete',
  'tenant.switch',
  'tenant.create',
  'cross_tenant_attempt',
  'role_denied',
  'export',
];

const INITIAL_FILTERS: AuditFilters = {
  search: '',
  action: '',
  status: '',
  from: '',
  to: '',
  page: 1,
  pageSize: 25,
};

const columns: Column<AuditEntry>[] = [
  { key: 'when', header: 'Time', render: (e) => <span className="text-slate-500">{formatDateTime(e.createdAt)}</span> },
  { key: 'actor', header: 'Actor', render: (e) => e.actorEmail ?? <span className="text-slate-400">system</span> },
  { key: 'action', header: 'Action', render: (e) => <span className="font-mono text-xs text-slate-800">{e.action}</span> },
  {
    key: 'resource',
    header: 'Resource',
    render: (e) => (
      <span className="text-xs">
        <span className="text-slate-700">{e.resourceType}</span>
        {e.resourceId && <span className="ml-1 font-mono text-slate-400">{e.resourceId.slice(0, 12)}</span>}
      </span>
    ),
  },
  { key: 'status', header: 'Status', render: (e) => <AuditStatusBadge status={e.status} /> },
  {
    key: 'reason',
    header: 'Detail',
    render: (e) => <span className="text-slate-500">{e.reason ?? '—'}</span>,
    className: 'max-w-[260px] truncate',
  },
  { key: 'ip', header: 'IP', render: (e) => <span className="font-mono text-xs text-slate-400">{e.ip ?? '—'}</span> },
];

export function AuditLogPage() {
  const tenant = useCurrentTenant();
  const [filters, setFilters] = useState<AuditFilters>(INITIAL_FILTERS);
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput.trim(), 300);

  useEffect(() => {
    setFilters((f) => (f.search === debouncedSearch ? f : { ...f, search: debouncedSearch, page: 1 }));
  }, [debouncedSearch]);

  const { data, isLoading, isFetching, isPlaceholderData } = useQuery({
    queryKey: ['audit', tenant.id, filters],
    queryFn: () => getAuditLog(filters),
    placeholderData: keepPreviousData,
  });

  const update = <K extends keyof AuditFilters>(key: K, value: AuditFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value, page: key === 'page' ? (value as number) : 1 }));

  const hasFilters = Boolean(filters.search || filters.action || filters.status || filters.from || filters.to);

  const reset = () => {
    setSearchInput('');
    setFilters(INITIAL_FILTERS);
  };

  return (
    <>
      <PageHeader
        title="Audit log"
        description={
          <>
            Every action taken inside <span className="font-medium text-accent">{tenant.name}</span>
          </>
        }
      />

      <div className="overflow-hidden card shadow-sm">
        <div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-2 xl:grid-cols-[2fr_1.3fr_1fr_1fr_1fr_auto] xl:items-end">
          <Input
            label="Search"
            type="search"
            placeholder="Actor, resource ID…"
            leftIcon={<Search className="h-4 w-4" />}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <Select label="Action" value={filters.action} onChange={(e) => update('action', e.target.value)}>
            <option value="">All actions</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
          <Select
            label="Status"
            value={filters.status}
            onChange={(e) => update('status', e.target.value as AuditFilters['status'])}
          >
            <option value="">Any</option>
            <option value="success">Success</option>
            <option value="denied">Denied</option>
            <option value="failure">Failure</option>
          </Select>
          <Input label="From" type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => update('from', e.target.value)} />
          <Input label="To" type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => update('to', e.target.value)} />
          <Button variant="ghost" onClick={reset} disabled={!hasFilters} icon={<FilterX className="h-4 w-4" />}>
            Reset
          </Button>
        </div>

        <Table
          columns={columns}
          rows={data?.items}
          rowKey={(e) => e.id}
          loading={isLoading}
          dimmed={isFetching && isPlaceholderData}
          skeletonRows={10}
          empty={
            <EmptyState
              icon={<ScrollText className="h-6 w-6" />}
              title={hasFilters ? 'No entries match these filters' : 'No audit entries yet'}
              message={hasFilters ? 'Try widening the date range or clearing filters.' : 'Actions in this tenant will be recorded here.'}
              action={
                hasFilters ? (
                  <Button size="sm" variant="secondary" onClick={reset}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          }
        />

        {data && data.total > 0 && (
          <Pagination
            page={filters.page}
            pageSize={filters.pageSize}
            total={data.total}
            onPageChange={(p) => update('page', p)}
            onPageSizeChange={(s) => update('pageSize', s)}
          />
        )}
      </div>
    </>
  );
}
