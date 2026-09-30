import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, BellOff, Radar, Snowflake, Sparkles } from 'lucide-react';
import { getAlerts } from '@/api/dashboard';
import { getAnomalies } from '@/api/ai';
import { PageHeader } from '@/components/ui/PageHeader';
import { SeverityBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Spinner';
import { useCurrentTenant } from '@/context/TenantContext';
import { formatRelativeTime } from '@/lib/format';
import type { AlertType } from '@/types';

const TABS: { id: '' | AlertType; label: string }[] = [
  { id: '', label: 'All' },
  { id: 'low_stock', label: 'Low stock' },
  { id: 'anomaly', label: 'Anomalies' },
  { id: 'dead_stock', label: 'Dead stock' },
];

const TYPE_ICON: Record<AlertType, JSX.Element> = {
  low_stock: <AlertTriangle className="h-4 w-4" />,
  anomaly: <Radar className="h-4 w-4" />,
  dead_stock: <Snowflake className="h-4 w-4" />,
};

function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

export function AlertsPage() {
  const tenant = useCurrentTenant();
  const [tab, setTab] = useState<'' | AlertType>('');

  const alerts = useQuery({
    queryKey: ['alerts', tenant.id],
    queryFn: () => getAlerts(),
  });

  const anomalies = useQuery({
    queryKey: ['anomalies', tenant.id],
    queryFn: getAnomalies,
  });

  const visible = (alerts.data ?? []).filter((a) => !tab || a.type === tab);
  const countFor = (type: '' | AlertType) =>
    (alerts.data ?? []).filter((a) => !type || a.type === type).length;

  return (
    <>
      <PageHeader
        title="Alerts"
        description={
          <>
            Low-stock warnings and anomalies for <span className="font-medium text-accent">{tenant.name}</span>
          </>
        }
      />

      <div className="stagger grid gap-6 xl:grid-cols-3">
        <section className="overflow-hidden card shadow-sm xl:col-span-2">
          <div className="flex gap-1 overflow-x-auto border-b border-slate-200 px-3 pt-3">
            {TABS.map((t) => {
              const active = tab === t.id;
              const count = countFor(t.id);
              return (
                <button
                  key={t.id || 'all'}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`relative -mb-px flex items-center gap-2 whitespace-nowrap px-3 pb-2.5 text-sm font-medium transition-colors ${
                    active ? 'text-accent' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {t.label}
                  {count > 0 && (
                    <span
                      className={`rounded-full px-1.5 text-xs transition-colors ${active ? 'bg-accent text-white' : 'bg-slate-100'}`}
                    >
                      {count}
                    </span>
                  )}
                  {active && (
                    <span className="absolute inset-x-2 bottom-0 h-0.5 origin-center animate-grow-x rounded-full bg-accent" />
                  )}
                </button>
              );
            })}
          </div>

          {alerts.isLoading ? (
            <ListSkeleton />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<BellOff className="h-6 w-6" />}
              title="No alerts here"
              message="Everything looks healthy for this tenant."
              action={
                tab ? (
                  <Button size="sm" variant="secondary" onClick={() => setTab('')}>
                    Show all alerts
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ul key={tab} className="stagger divide-y divide-slate-100">
              {visible.map((alert) => (
                <li
                  key={alert.id}
                  className={`group flex items-start gap-4 border-l-2 px-5 py-4 transition-colors hover:bg-slate-50/80 ${
                    alert.severity === 'critical'
                      ? 'border-l-red-500'
                      : alert.severity === 'warning'
                        ? 'border-l-amber-400'
                        : 'border-l-sky-400'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${
                      alert.severity === 'critical'
                        ? 'bg-red-50 text-red-600'
                        : alert.severity === 'warning'
                          ? 'bg-amber-50 text-amber-600'
                          : 'bg-sky-50 text-sky-600'
                    }`}
                  >
                    {TYPE_ICON[alert.type]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-slate-900">{alert.message}</p>
                      <SeverityBadge severity={alert.severity} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {alert.productId && alert.productName ? (
                        <Link to={`/products/${alert.productId}`} className="hover:underline">
                          {alert.productName}
                          {alert.sku && <span className="ml-1 font-mono">({alert.sku})</span>}
                        </Link>
                      ) : (
                        'Tenant-wide'
                      )}{' '}
                      · {formatRelativeTime(alert.createdAt)}
                    </p>
                  </div>
                  {alert.productId && (
                    <Link
                      to={`/products/${alert.productId}`}
                      className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:-translate-y-px hover:border-accent hover:text-accent hover:shadow-md"
                    >
                      View product
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="overflow-hidden card shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Sparkles className="h-4 w-4 text-accent" />
              AI-detected anomalies
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">Unusual movement patterns, scoped to {tenant.name}.</p>
          </div>
          {anomalies.isLoading ? (
            <ListSkeleton rows={3} />
          ) : anomalies.data && anomalies.data.length > 0 ? (
            <ul className="stagger divide-y divide-slate-100">
              {anomalies.data.map((a) => (
                <li key={a.id} className="px-5 py-3.5 transition-colors hover:bg-slate-50/80">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-slate-700">{a.description}</p>
                    <span className="shrink-0 rounded-md bg-accent/10 px-1.5 py-0.5 font-mono text-xs font-semibold text-accent">
                      {Math.round(a.score * 100)}%
                    </span>
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full origin-left animate-grow-x rounded-full bg-gradient-to-r from-amber-400 to-red-500"
                      style={{ width: `${Math.min(100, Math.round(a.score * 100))}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {a.name && a.productId ? (
                      <Link to={`/products/${a.productId}`} className="hover:underline">
                        {a.name}
                      </Link>
                    ) : (
                      'Tenant-wide'
                    )}{' '}
                    · {formatRelativeTime(a.detectedAt)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<Radar className="h-6 w-6" />}
              title="No anomalies detected"
              message="Ask the AI assistant for a deeper look at recent activity."
              action={
                <Link to="/ai" className="text-sm font-medium text-accent hover:underline">
                  Open AI Assistant
                </Link>
              }
            />
          )}
        </section>
      </div>
    </>
  );
}
