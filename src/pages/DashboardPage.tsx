import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Bot,
  Boxes,
  DollarSign,
  History,
  Layers,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { getDashboard } from '@/api/dashboard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Spinner';
import { Table, type Column } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { MovementBadge, SeverityBadge } from '@/components/ui/Badge';
import { LinkButton } from '@/components/ui/Button';
import { Carousel } from '@/components/ui/Carousel';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { useCurrentTenant } from '@/context/TenantContext';
import { formatCompactCurrency, formatNumber, formatRelativeTime } from '@/lib/format';
import type { DashboardData, StockMovement } from '@/types';

interface StatCardProps {
  label: string;
  value: number | undefined;
  format: (n: number) => string;
  icon: LucideIcon;
  tone?: 'accent' | 'danger';
  hint: string;
  loading: boolean;
}

function StatCard({ label, value, format, icon: Icon, tone = 'accent', hint, loading }: StatCardProps) {
  const danger = tone === 'danger';
  return (
    <div className="card card-lift group relative overflow-hidden p-5">
      <div
        aria-hidden
        className={`absolute -right-10 -top-10 h-32 w-32 rounded-full blur-2xl transition-all duration-500 group-hover:scale-125 ${
          danger ? 'bg-red-400/15' : 'bg-accent/15'
        }`}
      />
      <div className="relative flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span
          className={
            danger
              ? 'flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-red-100 to-red-50 text-red-600 ring-1 ring-inset ring-red-200 dark:from-red-500/25 dark:to-red-500/5 dark:text-red-400'
              : 'icon-chip'
          }
        >
          <Icon className="h-5 w-5 transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110" />
        </span>
      </div>
      {loading || value === undefined ? (
        <Skeleton className="mt-3 h-9 w-24" />
      ) : (
        <p className="relative mt-3 text-3xl font-bold text-slate-900">
          <AnimatedNumber value={value} format={format} />
        </p>
      )}
      <p className="relative mt-1 text-xs text-slate-400">{hint}</p>
      <span
        aria-hidden
        className={`absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100 ${
          danger ? 'bg-red-500' : 'bg-accent'
        }`}
      />
    </div>
  );
}

interface SlideProps {
  eyebrow: string;
  title: string;
  body: string;
  icon: LucideIcon;
  cta?: { to: string; label: string };
}

function Slide({ eyebrow, title, body, icon: Icon, cta }: SlideProps) {
  return (
    <div className="flex min-h-[210px] flex-col justify-center gap-6 px-6 pb-12 pt-7 sm:flex-row sm:items-center sm:justify-between sm:px-10">
      <div className="max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-bold leading-tight text-white sm:text-3xl">{title}</h2>
        <p className="mt-2 text-sm text-white/75">{body}</p>
        {cta && (
          <Link
            to={cta.to}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-slate-900 shadow-lg transition hover:-translate-y-px hover:shadow-xl"
          >
            {cta.label}
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
      <div className="relative hidden shrink-0 sm:block">
        <span className="absolute inset-0 animate-ping rounded-3xl bg-white/10 [animation-duration:3s]" />
        <span className="relative flex h-24 w-24 animate-float items-center justify-center rounded-3xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
          <Icon className="h-12 w-12 text-white" />
        </span>
      </div>
    </div>
  );
}

function buildSlides(tenantName: string, role: string, data: DashboardData | undefined) {
  const critical = data?.alerts.filter((a) => a.severity === 'critical').length ?? 0;
  return [
    <Slide
      key="welcome"
      eyebrow={`${role} workspace`}
      title={`Welcome to ${tenantName}`}
      body="Everything on this screen is scoped to this tenant only. Switch tenants from the header to see a completely separate inventory."
      icon={Sparkles}
      cta={{ to: '/products', label: 'Browse products' }}
    />,
    <Slide
      key="value"
      eyebrow="Inventory value"
      title={data ? `${formatCompactCurrency(data.inventoryValue)} across ${formatNumber(data.totalSkus)} SKUs` : 'Loading inventory…'}
      body={data ? `Spread across ${formatNumber(data.categoryCount)} categories. Open analytics for trends and turnover.` : ''}
      icon={DollarSign}
      cta={{ to: '/analytics', label: 'View analytics' }}
    />,
    <Slide
      key="alerts"
      eyebrow="Needs attention"
      title={
        data
          ? data.lowStockCount > 0
            ? `${formatNumber(data.lowStockCount)} products are running low`
            : 'Stock levels look healthy'
          : 'Checking stock levels…'
      }
      body={
        critical > 0
          ? `${critical} critical alert${critical === 1 ? '' : 's'} right now, including items that are out of stock.`
          : 'No critical alerts at the moment.'
      }
      icon={AlertTriangle}
      cta={{ to: '/alerts', label: 'Review alerts' }}
    />,
    <Slide
      key="isolation"
      eyebrow="Tenant isolation"
      title="Prove nothing leaks between tenants"
      body="Run 8 live attacks against this workspace, from header spoofing to raw SQL, and watch every one get blocked."
      icon={ShieldCheck}
      cta={{ to: '/security/simulator', label: 'Run the simulator' }}
    />,
    <Slide
      key="ai"
      eyebrow="AI assistant"
      title="Ask your inventory anything"
      body="Low stock, dead stock and reorder suggestions, answered only from this tenant's data."
      icon={Bot}
      cta={{ to: '/ai', label: 'Open assistant' }}
    />,
  ];
}

const movementColumns: Column<StockMovement>[] = [
  {
    key: 'product',
    header: 'Product',
    render: (m) => (
      <Link to={`/products/${m.productId}`} className="group/link">
        <span className="font-medium text-slate-900 transition-colors group-hover/link:text-accent">{m.productName}</span>
        <span className="ml-2 font-mono text-xs text-slate-500">{m.sku}</span>
      </Link>
    ),
  },
  { key: 'type', header: 'Type', render: (m) => <MovementBadge type={m.type} /> },
  {
    key: 'qty',
    header: 'Qty',
    render: (m) => (
      <span
        className={`inline-flex min-w-[3rem] justify-end rounded-md px-2 py-0.5 font-semibold tabular-nums ${
          m.type === 'out' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-700'
        }`}
      >
        {m.type === 'out' ? '−' : '+'}
        {formatNumber(Math.abs(m.quantity))}
      </span>
    ),
    className: 'text-right',
    headerClassName: 'text-right',
  },
  { key: 'when', header: 'When', render: (m) => <span className="text-slate-500">{formatRelativeTime(m.createdAt)}</span> },
];

export function DashboardPage() {
  const tenant = useCurrentTenant();
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', tenant.id],
    queryFn: getDashboard,
  });

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={
          <>
            Inventory overview for <span className="font-medium text-accent">{tenant.name}</span>
          </>
        }
      />

      <div className="relative mb-6 overflow-hidden rounded-3xl accent-gradient shadow-xl shadow-accent/20">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -right-16 -top-24 h-72 w-72 animate-blob rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-24 left-1/3 h-64 w-64 animate-blob rounded-full bg-white/10 blur-2xl [animation-delay:-6s]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgb(255_255_255/0.06)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.06)_1px,transparent_1px)] [background-size:32px_32px]" />
        </div>
        <Carousel tone="dark" interval={6000} label="Dashboard highlights" slides={buildSlides(tenant.name, tenant.role, data)} />
      </div>

      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total SKUs"
          icon={Boxes}
          loading={isLoading}
          value={data?.totalSkus}
          format={(n) => formatNumber(Math.round(n))}
          hint="Distinct products in stock"
        />
        <StatCard
          label="Inventory Value"
          icon={DollarSign}
          loading={isLoading}
          value={data?.inventoryValue}
          format={formatCompactCurrency}
          hint="Quantity × unit price"
        />
        <StatCard
          label="Low-stock Count"
          icon={AlertTriangle}
          tone="danger"
          loading={isLoading}
          value={data?.lowStockCount}
          format={(n) => formatNumber(Math.round(n))}
          hint="At or below reorder level"
        />
        <StatCard
          label="Categories"
          icon={Layers}
          loading={isLoading}
          value={data?.categoryCount}
          format={(n) => formatNumber(Math.round(n))}
          hint="Product groupings"
        />
      </div>

      <div className="stagger mt-6 grid gap-6 xl:grid-cols-3">
        <section className="card overflow-hidden xl:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <span className="icon-chip h-8 w-8">
                <History className="h-4 w-4" />
              </span>
              Recent movements
            </h2>
            <Link to="/products" className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
              View products <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <Table
            columns={movementColumns}
            rows={data?.recentMovements}
            rowKey={(m) => m.id}
            loading={isLoading}
            skeletonRows={6}
            empty={
              <EmptyState
                icon={<History className="h-6 w-6" />}
                title="No stock movements yet"
                message="Movements appear here as products are received, sold or adjusted."
                action={
                  <LinkButton to="/products/new" size="sm">
                    Add a product
                  </LinkButton>
                }
              />
            }
          />
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <span className="icon-chip h-8 w-8">
                <Bell className="h-4 w-4" />
              </span>
              Alerts
            </h2>
            <Link to="/alerts" className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
              All alerts <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {isLoading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : data && data.alerts.length > 0 ? (
            <ul className="stagger divide-y divide-slate-100">
              {data.alerts.slice(0, 6).map((alert) => (
                <li
                  key={alert.id}
                  className={`border-l-2 px-5 py-3 transition-colors hover:bg-slate-50/80 ${
                    alert.severity === 'critical'
                      ? 'border-l-red-500'
                      : alert.severity === 'warning'
                        ? 'border-l-amber-400'
                        : 'border-l-sky-400'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-slate-700">{alert.message}</p>
                    <SeverityBadge severity={alert.severity} />
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{formatRelativeTime(alert.createdAt)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<Bell className="h-6 w-6" />}
              title="All clear"
              message="No active alerts for this tenant."
              action={
                <LinkButton to="/alerts" size="sm" variant="secondary">
                  Open alerts
                </LinkButton>
              }
            />
          )}
        </section>
      </div>
    </>
  );
}
