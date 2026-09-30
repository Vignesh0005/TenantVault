import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Download, FileJson, FileSpreadsheet, KeyRound, Minus, ShieldCheck } from 'lucide-react';
import { exportProducts, getSecurityContext, type ExportFormat } from '@/api/tenants';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { useCurrentTenant } from '@/context/TenantContext';
import { toast } from '@/components/ui/Toast';
import type { Role } from '@/types';

const ROLES: Role[] = ['admin', 'staff', 'viewer'];

// Mirrors the backend's RolePermissions map; the server remains the source of truth for enforcement.
const PERMISSIONS: { id: string; label: string; roles: Role[] }[] = [
  { id: 'products:read', label: 'View products, dashboard, alerts and analytics', roles: ['admin', 'staff', 'viewer'] },
  { id: 'products:write', label: 'Create, edit and scan products', roles: ['admin', 'staff'] },
  { id: 'images:write', label: 'Upload and remove product images', roles: ['admin', 'staff'] },
  { id: 'products:delete', label: 'Delete products', roles: ['admin'] },
  { id: 'security:read', label: 'View the security dashboard', roles: ['admin', 'staff'] },
  { id: 'audit:read', label: 'View the audit log', roles: ['admin'] },
  { id: 'export:read', label: 'Export tenant data', roles: ['admin', 'staff'] },
  { id: 'ai:use', label: 'Use the AI assistant', roles: ['admin', 'staff', 'viewer'] },
];

function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden card shadow-sm">
      <div className="border-b border-slate-200 px-6 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          {icon}
          {title}
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function SettingsPage() {
  const tenant = useCurrentTenant();
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  const context = useQuery({
    queryKey: ['security-context', tenant.id],
    queryFn: () => getSecurityContext(),
  });

  const role = context.data?.role ?? tenant.role;
  const permissions = new Set(context.data?.permissions ?? []);
  const canExport = context.data ? permissions.has('export:read') : role !== 'viewer';

  const onExport = async (format: ExportFormat) => {
    setExporting(format);
    try {
      const blob = await exportProducts(format);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${tenant.slug}-products-${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success(`${format.toUpperCase()} export downloaded`);
    } catch {
      // Status-specific toasts are raised by the API client.
    } finally {
      setExporting(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Settings"
        description={
          <>
            Access and data for <span className="font-medium text-accent">{tenant.name}</span>
          </>
        }
      />

      <div className="stagger space-y-6">
        <Section
          icon={<ShieldCheck className="h-4 w-4 text-accent" />}
          title="Your access"
          description="Resolved by the server for the active tenant from your membership."
        >
          <div className="grid gap-4 p-6 sm:grid-cols-3">
            <div>
              <p className="text-xs text-slate-500">Tenant</p>
              <p className="mt-0.5 font-medium text-slate-900">{tenant.name}</p>
              <p className="font-mono text-xs text-slate-400">{tenant.slug}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Role</p>
              {context.isLoading ? (
                <Skeleton className="mt-1 h-5 w-20" />
              ) : (
                <p className="mt-1 inline-flex animate-scale-in items-center rounded-lg accent-gradient px-2.5 py-1 text-sm font-semibold capitalize text-white shadow-md shadow-accent/25">
                  {role}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Permissions</p>
              {context.isLoading ? (
                <Skeleton className="mt-1 h-5 w-40" />
              ) : (
                <div className="mt-1 flex flex-wrap gap-1">
                  {[...permissions].map((p) => (
                    <Badge key={p} className="font-mono">
                      {p}
                    </Badge>
                  ))}
                  {context.data && permissions.size === 0 && <span className="text-sm text-slate-400">None</span>}
                </div>
              )}
            </div>
          </div>
        </Section>

        <Section
          icon={<KeyRound className="h-4 w-4 text-slate-400" />}
          title="Roles & permissions"
          description="What each role can do inside a tenant. Your role is highlighted."
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-6 py-3">Permission</th>
                  {ROLES.map((r) => (
                    <th key={r} className={`px-4 py-3 text-center capitalize ${r === role ? 'text-accent' : ''}`}>
                      {r}
                      {r === role && <span className="ml-1 normal-case text-slate-400">(you)</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {PERMISSIONS.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-slate-50/80">
                    <td className="px-6 py-3">
                      <p className="text-slate-800">{p.label}</p>
                      <p className="font-mono text-xs text-slate-400">{p.id}</p>
                    </td>
                    {ROLES.map((r) => (
                      <td key={r} className={`px-4 py-3 text-center ${r === role ? 'bg-accent/5' : ''}`}>
                        {p.roles.includes(r) ? (
                          <span className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100">
                            <Check className="h-3.5 w-3.5 text-emerald-600" aria-label="Allowed" />
                          </span>
                        ) : (
                          <Minus className="mx-auto h-4 w-4 text-slate-300" aria-label="Not allowed" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section
          icon={<Download className="h-4 w-4 text-slate-400" />}
          title="Export data"
          description="Download every product in this tenant. Each export is recorded in the audit log."
        >
          <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              {canExport
                ? `The export contains ${tenant.name}'s data only.`
                : 'Your role cannot export data. Ask an admin or staff member.'}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => onExport('csv')}
                loading={exporting === 'csv'}
                disabled={!canExport || exporting !== null}
                icon={<FileSpreadsheet className="h-4 w-4" />}
              >
                Export CSV
              </Button>
              <Button
                variant="secondary"
                onClick={() => onExport('json')}
                loading={exporting === 'json'}
                disabled={!canExport || exporting !== null}
                icon={<FileJson className="h-4 w-4" />}
              >
                Export JSON
              </Button>
            </div>
          </div>
        </Section>
      </div>
    </>
  );
}
