import { useQuery } from '@tanstack/react-query';
import {
  Ban,
  CheckCircle2,
  Database,
  Filter,
  Fingerprint,
  KeyRound,
  Lock,
  LogIn,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { getSecurityDashboard } from '@/api/security';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Spinner';
import { Table, type Column } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { LinkButton } from '@/components/ui/Button';
import { Carousel } from '@/components/ui/Carousel';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { useCurrentTenant } from '@/context/TenantContext';
import { formatDateTime, formatNumber, formatRelativeTime } from '@/lib/format';
import type { CrossTenantAttempt, LoginEvent } from '@/types';

const POLL_MS = 15_000;

interface StatProps {
  label: string;
  value: number | undefined;
  icon: LucideIcon;
  tone: 'accent' | 'danger' | 'warning';
  loading: boolean;
}

const TONES = {
  accent: 'bg-accent/10 text-accent',
  danger: 'bg-red-50 text-red-600',
  warning: 'bg-amber-50 text-amber-600',
};

const GLOWS = {
  accent: 'bg-accent/15',
  danger: 'bg-red-400/15',
  warning: 'bg-amber-400/15',
};

function Stat({ label, value, icon: Icon, tone, loading }: StatProps) {
  return (
    <div className="card card-lift group relative overflow-hidden p-5">
      <div
        aria-hidden
        className={`absolute -right-10 -top-10 h-28 w-28 rounded-full blur-2xl transition-transform duration-500 group-hover:scale-125 ${GLOWS[tone]}`}
      />
      <div className="relative flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${TONES[tone]}`}>
          <Icon className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
        </span>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-9 w-16" />
      ) : (
        <p className="relative mt-3 text-3xl font-bold text-slate-900">
          {value === undefined ? '—' : <AnimatedNumber value={value} format={(n) => formatNumber(Math.round(n))} />}
        </p>
      )}
    </div>
  );
}

const LAYERS: { icon: LucideIcon; step: string; title: string; body: string }[] = [
  {
    icon: Fingerprint,
    step: 'Layer 1',
    title: 'Tenant middleware',
    body: 'The X-Tenant-Id header is only trusted if it matches the signed JWT and a membership row in the database. Mismatches get a 403 and an audit entry.',
  },
  {
    icon: Filter,
    step: 'Layer 2',
    title: 'Automatic query filters',
    body: 'Every read on a tenant-owned table gets the tenant condition added by the data layer, so no query can forget it.',
  },
  {
    icon: Lock,
    step: 'Layer 3',
    title: 'Write interceptor',
    body: 'Saving a row that belongs to another tenant throws before it reaches the database, even if the code attached it manually.',
  },
  {
    icon: Database,
    step: 'Layer 4',
    title: 'PostgreSQL row-level security',
    body: 'The database itself hides other tenants’ rows. The app role cannot bypass it, and with no tenant set it returns nothing at all.',
  },
];

function LayerSlide({ icon: Icon, step, title, body }: (typeof LAYERS)[number]) {
  return (
    <div className="flex items-start gap-5 px-6 pb-12 pt-6 sm:px-8">
      <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
        <span className="absolute inset-0 animate-ping rounded-2xl bg-white/10 [animation-duration:2.5s]" />
        <Icon className="relative h-7 w-7 text-white" />
      </span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">{step} of 4</p>
        <h3 className="mt-1 text-xl font-bold text-white">{title}</h3>
        <p className="mt-1.5 max-w-2xl text-sm text-white/75">{body}</p>
      </div>
    </div>
  );
}

const attemptColumns: Column<CrossTenantAttempt>[] = [
  {
    key: 'when',
    header: 'When',
    render: (a) => (
      <span title={formatDateTime(a.createdAt)} className="text-slate-500">
        {formatRelativeTime(a.createdAt)}
      </span>
    ),
  },
  { key: 'actor', header: 'Actor', render: (a) => a.actorEmail ?? <span className="text-slate-400">anonymous</span> },
  {
    key: 'request',
    header: 'Request',
    render: (a) => (
      <span className="font-mono text-xs">
        <span className="font-semibold text-slate-700">{a.method}</span> {a.path}
      </span>
    ),
    className: 'max-w-[260px] truncate',
  },
  { key: 'target', header: 'Target tenant', render: (a) => a.targetTenant ?? <span className="text-slate-400">—</span> },
  { key: 'status', header: 'Status', render: (a) => <Badge variant="danger">{a.status}</Badge> },
  { key: 'reason', header: 'Reason', render: (a) => <span className="text-slate-600">{a.reason}</span>, className: 'max-w-[280px] truncate' },
];

const loginColumns: Column<LoginEvent>[] = [
  { key: 'when', header: 'When', render: (l) => <span className="text-slate-500">{formatRelativeTime(l.createdAt)}</span> },
  { key: 'email', header: 'Email', render: (l) => l.email },
  {
    key: 'result',
    header: 'Result',
    render: (l) =>
      l.success ? (
        <Badge variant="success" icon={<CheckCircle2 className="h-3 w-3" />}>
          Success
        </Badge>
      ) : (
        <Badge variant="danger" icon={<XCircle className="h-3 w-3" />}>
          Failed
        </Badge>
      ),
  },
  { key: 'ip', header: 'IP', render: (l) => <span className="font-mono text-xs text-slate-500">{l.ip ?? '—'}</span> },
];

export function SecurityDashboardPage() {
  const tenant = useCurrentTenant();
  const { data, isLoading, dataUpdatedAt, isFetching } = useQuery({
    queryKey: ['security-dashboard', tenant.id],
    queryFn: getSecurityDashboard,
    refetchInterval: POLL_MS,
  });

  return (
    <>
      <PageHeader
        title="Security"
        description={
          <>
            Authentication and isolation events for <span className="font-medium text-accent">{tenant.name}</span>
          </>
        }
        actions={
          <>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              <span className="relative flex h-2 w-2">
                <span className={`absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75 ${isFetching ? 'animate-ping' : ''}`} />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Live · every 15s
              {dataUpdatedAt > 0 && (
                <span className="text-emerald-600/70">· {new Date(dataUpdatedAt).toLocaleTimeString()}</span>
              )}
            </span>
            <LinkButton to="/security/simulator" icon={<ShieldCheck className="h-4 w-4" />}>
              Run isolation test
            </LinkButton>
          </>
        }
      />

      <div className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 shadow-xl">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -right-10 -top-20 h-64 w-64 animate-blob rounded-full bg-accent/40 blur-3xl" />
          <div className="absolute inset-x-0 top-0 h-16 animate-scan bg-gradient-to-b from-transparent via-accent/10 to-transparent" />
        </div>
        <div className="relative flex items-center gap-2 px-6 pt-5 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300 sm:px-8">
          <ShieldCheck className="h-4 w-4" />
          Defense in depth
        </div>
        <Carousel tone="dark" interval={5500} label="Isolation layers" slides={LAYERS.map((l) => <LayerSlide key={l.title} {...l} />)} />
      </div>

      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Logins today" icon={LogIn} tone="accent" loading={isLoading} value={data?.stats.loginsToday} />
        <Stat label="Failed logins" icon={KeyRound} tone="warning" loading={isLoading} value={data?.stats.failedLogins} />
        <Stat
          label="Cross-tenant attempts"
          icon={ShieldAlert}
          tone="danger"
          loading={isLoading}
          value={data?.stats.crossTenantAttempts}
        />
        <Stat label="Blocked requests" icon={Ban} tone="danger" loading={isLoading} value={data?.stats.blockedRequests} />
      </div>

      <section className="mt-6 overflow-hidden card shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <ShieldX className="h-4 w-4 text-red-500" />
            Cross-tenant access attempts
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Requests that referenced data outside {tenant.name}. Every one was blocked and logged.
          </p>
        </div>
        <Table
          columns={attemptColumns}
          rows={data?.crossTenantAttempts}
          rowKey={(a) => a.id}
          loading={isLoading}
          empty={
            <EmptyState
              icon={<ShieldCheck className="h-6 w-6" />}
              title="No cross-tenant attempts"
              message="Run the isolation simulator to generate blocked attempts."
              action={
                <LinkButton to="/security/simulator" size="sm">
                  Open simulator
                </LinkButton>
              }
            />
          }
        />
      </section>

      <section className="mt-6 overflow-hidden card shadow-sm">
        <h2 className="flex items-center gap-2 border-b border-slate-200 px-5 py-4 text-sm font-semibold text-slate-900">
          <LogIn className="h-4 w-4 text-slate-400" />
          Recent sign-ins
        </h2>
        <Table
          columns={loginColumns}
          rows={data?.recentLogins}
          rowKey={(l) => l.id}
          loading={isLoading}
          empty={
            <EmptyState
              icon={<LogIn className="h-6 w-6" />}
              title="No sign-ins recorded"
              message="Sign-in activity for members of this tenant appears here."
              action={
                <LinkButton to="/audit" size="sm" variant="secondary">
                  View audit log
                </LinkButton>
              }
            />
          }
        />
      </section>
    </>
  );
}
