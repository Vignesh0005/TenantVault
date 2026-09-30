import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { BarChart3, PackageCheck, PieChart, ShoppingCart, Snowflake } from 'lucide-react';
import { getAnalytics } from '@/api/dashboard';
import { getPredictions } from '@/api/ai';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Spinner';
import { Table, type Column } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { RangeSlider } from '@/components/ui/RangeSlider';
import { useCurrentTenant } from '@/context/TenantContext';
import { useDebounce } from '@/hooks/useDebounce';
import { formatCompactCurrency, formatCurrency, formatNumber } from '@/lib/format';
import type { DeadStockItem, StockPrediction, TrendPoint } from '@/types';

const RANGE_MARKS = [7, 30, 60, 90];

function TrendChart({ points }: { points: TrendPoint[] }) {
  const max = Math.max(1, ...points.flatMap((p) => [p.inbound, p.outbound]));
  const step = Math.min(25, 700 / Math.max(points.length, 1));
  return (
    <div>
      <div className="relative flex h-56 items-end gap-1">
        <div aria-hidden className="pointer-events-none absolute inset-0 flex flex-col justify-between">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="border-t border-dashed border-slate-200/80" />
          ))}
        </div>
        {points.map((p, i) => (
          <div key={p.date} className="group relative flex h-full flex-1 items-end justify-center gap-0.5">
            <div
              className="w-1/2 origin-bottom animate-grow-up rounded-t bg-gradient-to-t from-accent/70 to-accent transition-all duration-500 group-hover:brightness-110"
              style={{ height: `${(p.inbound / max) * 100}%`, animationDelay: `${i * step}ms` }}
            />
            <div
              className="w-1/2 origin-bottom animate-grow-up rounded-t bg-gradient-to-t from-slate-300 to-slate-400/80 transition-all duration-500"
              style={{ height: `${(p.outbound / max) * 100}%`, animationDelay: `${i * step + 40}ms` }}
            />
            <div className="pointer-events-none absolute bottom-full z-10 mb-2 hidden animate-scale-in whitespace-nowrap rounded-lg bg-slate-900/95 px-2.5 py-1.5 text-xs text-white shadow-xl backdrop-blur group-hover:block">
              <p className="font-medium">{p.date}</p>
              <p>In: {formatNumber(p.inbound)}</p>
              <p>Out: {formatNumber(p.outbound)}</p>
              <p>Value: {formatCompactCurrency(p.value)}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-slate-400">
        <span>{points[0]?.date}</span>
        <span>{points[points.length - 1]?.date}</span>
      </div>
      <div className="mt-3 flex gap-4 text-xs text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-accent/80" /> Inbound
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-slate-300" /> Outbound
        </span>
      </div>
    </div>
  );
}

const deadStockColumns: Column<DeadStockItem>[] = [
  {
    key: 'name',
    header: 'Product',
    render: (d) => (
      <Link to={`/products/${d.productId}`} className="hover:underline">
        <span className="font-medium text-slate-900">{d.name}</span>
        <span className="ml-2 font-mono text-xs text-slate-500">{d.sku}</span>
      </Link>
    ),
  },
  { key: 'qty', header: 'Qty', render: (d) => formatNumber(d.quantity), className: 'text-right tabular-nums', headerClassName: 'text-right' },
  { key: 'value', header: 'Tied-up value', render: (d) => formatCurrency(d.value), className: 'text-right tabular-nums', headerClassName: 'text-right' },
  {
    key: 'idle',
    header: 'Idle',
    render: (d) => <Badge variant={d.daysSinceLastMovement > 60 ? 'danger' : 'warning'}>{d.daysSinceLastMovement} days</Badge>,
  },
];

const predictionColumns: Column<StockPrediction>[] = [
  {
    key: 'name',
    header: 'Product',
    render: (p) => (
      <Link to={`/products/${p.productId}`} className="hover:underline">
        <span className="font-medium text-slate-900">{p.name}</span>
        <span className="ml-2 font-mono text-xs text-slate-500">{p.sku}</span>
      </Link>
    ),
  },
  { key: 'onhand', header: 'On hand', render: (p) => formatNumber(p.currentQuantity), className: 'text-right tabular-nums', headerClassName: 'text-right' },
  { key: 'usage', header: 'Daily use', render: (p) => p.dailyUsage.toFixed(1), className: 'text-right tabular-nums', headerClassName: 'text-right' },
  {
    key: 'stockout',
    header: 'Stock-out in',
    render: (p) =>
      p.daysUntilStockout === null ? (
        <span className="text-slate-400">—</span>
      ) : (
        <Badge variant={p.daysUntilStockout <= 7 ? 'danger' : p.daysUntilStockout <= 21 ? 'warning' : 'success'}>
          {p.daysUntilStockout} days
        </Badge>
      ),
  },
  {
    key: 'reorder',
    header: 'Reorder',
    render: (p) => <span className="font-medium text-accent">+{formatNumber(p.suggestedReorderQty)}</span>,
    className: 'text-right tabular-nums',
    headerClassName: 'text-right',
  },
];

export function AnalyticsPage() {
  const tenant = useCurrentTenant();
  const [days, setDays] = useState(30);
  const debouncedDays = useDebounce(days, 350);

  const analytics = useQuery({
    queryKey: ['analytics', tenant.id, debouncedDays],
    queryFn: () => getAnalytics(debouncedDays),
    placeholderData: keepPreviousData,
  });

  const predictions = useQuery({
    queryKey: ['predictions', tenant.id],
    queryFn: getPredictions,
  });

  const categoryMax = Math.max(1, ...(analytics.data?.categoryBreakdown.map((c) => c.value) ?? [1]));

  return (
    <>
      <PageHeader
        title="Analytics"
        description={
          <>
            Trends and dead stock for <span className="font-medium text-accent">{tenant.name}</span>
          </>
        }
        actions={
          <div className="card w-72 px-4 pb-2 pt-3">
            <RangeSlider
              label="Trend window"
              min={7}
              max={90}
              value={days}
              onChange={setDays}
              marks={RANGE_MARKS}
              format={(d) => `${d}d`}
            />
          </div>
        }
      />

      <div className="stagger grid gap-6 xl:grid-cols-3">
        <section className="card p-5 shadow-sm xl:col-span-2">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <BarChart3 className="h-4 w-4 text-slate-400" />
            Stock movement trend
          </h2>
          {analytics.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : analytics.data && analytics.data.trends.length > 0 ? (
            <TrendChart points={analytics.data.trends} />
          ) : (
            <EmptyState
              icon={<BarChart3 className="h-6 w-6" />}
              title="No movement data"
              message={`No stock movements in the last ${days} days.`}
              action={
                days !== 90 ? (
                  <button type="button" onClick={() => setDays(90)} className="text-sm font-medium text-accent hover:underline">
                    Try 90 days
                  </button>
                ) : undefined
              }
            />
          )}
        </section>

        <section className="card p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <PieChart className="h-4 w-4 text-slate-400" />
            Value by category
          </h2>
          {analytics.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : analytics.data && analytics.data.categoryBreakdown.length > 0 ? (
            <ul className="space-y-3">
              {analytics.data.categoryBreakdown.map((c) => (
                <li key={c.category}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium text-slate-700">{c.category}</span>
                    <span className="tabular-nums text-slate-500">
                      {formatCompactCurrency(c.value)} · {c.count}
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full origin-left animate-grow-x rounded-full bg-gradient-to-r from-accent/60 to-accent transition-all duration-700"
                      style={{ width: `${(c.value / categoryMax) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<PieChart className="h-6 w-6" />}
              title="No categories yet"
              message="Assign categories to products to see a breakdown."
              action={
                <Link to="/products" className="text-sm font-medium text-accent hover:underline">
                  Go to products
                </Link>
              }
            />
          )}
        </section>
      </div>

      <div className="stagger mt-6 grid gap-6 xl:grid-cols-2">
        <section className="overflow-hidden card shadow-sm">
          <h2 className="flex items-center gap-2 border-b border-slate-200 px-5 py-4 text-sm font-semibold text-slate-900">
            <Snowflake className="h-4 w-4 text-sky-500" />
            Dead stock
          </h2>
          <Table
            columns={deadStockColumns}
            rows={analytics.data?.deadStock}
            rowKey={(d) => d.productId}
            loading={analytics.isLoading}
            empty={
              <EmptyState
                icon={<PackageCheck className="h-6 w-6" />}
                title="No dead stock"
                message="Every product has moved recently."
                action={
                  <Link to="/products" className="text-sm font-medium text-accent hover:underline">
                    Review products
                  </Link>
                }
              />
            }
          />
        </section>

        <section className="overflow-hidden card shadow-sm">
          <h2 className="flex items-center gap-2 border-b border-slate-200 px-5 py-4 text-sm font-semibold text-slate-900">
            <ShoppingCart className="h-4 w-4 text-accent" />
            Reorder predictions
          </h2>
          <Table
            columns={predictionColumns}
            rows={predictions.data}
            rowKey={(p) => p.productId}
            loading={predictions.isLoading}
            empty={
              <EmptyState
                icon={<ShoppingCart className="h-6 w-6" />}
                title="No reorders needed"
                message="Stock levels cover projected demand."
                action={
                  <Link to="/ai" className="text-sm font-medium text-accent hover:underline">
                    Ask the AI assistant
                  </Link>
                }
              />
            }
          />
        </section>
      </div>
    </>
  );
}
