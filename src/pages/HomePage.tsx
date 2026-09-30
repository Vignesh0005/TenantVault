import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Bell,
  Bot,
  Boxes,
  CheckCircle2,
  Database,
  Eye,
  FileLock2,
  Filter,
  Fingerprint,
  KeyRound,
  LayoutDashboard,
  Lock,
  Package,
  PenLine,
  ScrollText,
  ShieldCheck,
  Swords,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { ATTACKS } from '@/api/security';
import { useAuth } from '@/context/AuthContext';
import { Carousel } from '@/components/ui/Carousel';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

/** Fades its children in the first time they scroll into view. */
function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
      } ${className}`}
    >
      {children}
    </div>
  );
}

function SectionTitle({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <Reveal className="mx-auto mb-12 max-w-2xl text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{title}</h2>
      <p className="mt-4 text-base text-slate-500">{body}</p>
    </Reveal>
  );
}

const TENANTS = [
  { name: 'Acme Corp', color: '#2563eb', skus: 12, role: 'Admin' },
  { name: 'Globex Ltd', color: '#16a34a', skus: 11, role: 'Staff' },
  { name: 'Initech', color: '#dc2626', skus: 11, role: 'Viewer' },
];

function HeroVisual() {
  return (
    <div className="relative mx-auto h-[380px] w-full max-w-md">
      <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-blue-500/20 via-emerald-400/10 to-red-400/20 blur-2xl" />
      {TENANTS.map((t, i) => (
        <div
          key={t.name}
          className="absolute w-64 animate-float rounded-2xl border border-white/60 bg-white/90 p-4 shadow-2xl shadow-slate-900/10 backdrop-blur"
          style={{
            top: `${i * 30}%`,
            left: i === 1 ? '38%' : i === 2 ? '8%' : '0%',
            animationDelay: `${i * -1.3}s`,
          }}
        >
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ background: t.color, boxShadow: `0 0 12px ${t.color}` }} />
            <span className="text-sm font-semibold text-slate-900">{t.name}</span>
            <span className="ml-auto rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
              {t.role}
            </span>
          </div>
          <div className="mt-3 space-y-1.5">
            {[80, 55, 68].map((w, j) => (
              <div key={j} className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full origin-left animate-grow-x rounded-full"
                  style={{ width: `${w - i * 8}%`, background: t.color, animationDelay: `${400 + i * 200 + j * 120}ms` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>{t.skus} SKUs</span>
            <span className="inline-flex items-center gap-1 font-medium text-emerald-600">
              <Lock className="h-3 w-3" /> Isolated
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Package, title: 'Inventory management', body: 'Products, SKUs, categories, prices, images and stock movements for every tenant.' },
  { icon: Bell, title: 'Smart alerts', body: 'Low-stock, dead-stock and anomaly alerts generated from real movement history.' },
  { icon: BarChart3, title: 'Analytics', body: 'Movement trends, value by category, dead stock and reorder predictions.' },
  { icon: Bot, title: 'AI assistant', body: 'Ask questions in plain English. Answers come only from the active tenant’s data.' },
  { icon: ShieldCheck, title: 'Security dashboard', body: 'Live view of sign-ins, failed logins and every blocked cross-tenant attempt.' },
  { icon: ScrollText, title: 'Audit trail', body: 'Logins, changes, exports and denied requests recorded per tenant.' },
];

const LAYERS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Fingerprint,
    title: 'Tenant middleware',
    body: 'Resolves the tenant and checks it against the signed JWT and database membership. Spoofed headers get 403.',
  },
  {
    icon: Filter,
    title: 'Automatic query filters',
    body: 'Every read on a tenant table gets the tenant condition added automatically. No query can forget it.',
  },
  {
    icon: FileLock2,
    title: 'Write interceptor',
    body: 'Saving a row that belongs to another tenant throws before anything reaches the database.',
  },
  {
    icon: Database,
    title: 'PostgreSQL row-level security',
    body: 'The database itself hides other tenants’ rows. With no tenant set, it returns nothing at all.',
  },
];

const SHOWCASE: { icon: LucideIcon; title: string; body: string; gradient: string }[] = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard',
    body: 'Inventory value, low-stock counts, recent movements and alerts at a glance, in the tenant’s own colour.',
    gradient: 'from-blue-600 to-indigo-700',
  },
  {
    icon: Boxes,
    title: 'Products',
    body: 'Search, filter, create and edit products. Upload images to encrypted, tenant-scoped storage.',
    gradient: 'from-emerald-600 to-teal-700',
  },
  {
    icon: BarChart3,
    title: 'Analytics',
    body: 'Drag the trend window from 7 to 90 days and see inbound and outbound movement per day.',
    gradient: 'from-violet-600 to-purple-700',
  },
  {
    icon: Swords,
    title: 'Isolation simulator',
    body: 'One click fires 8 real attacks at the running system and shows each one blocked, with the reason.',
    gradient: 'from-slate-800 to-slate-950',
  },
  {
    icon: Bot,
    title: 'AI assistant',
    body: 'Low stock, dead stock and reorder suggestions, answered only from the current tenant’s inventory.',
    gradient: 'from-rose-600 to-red-700',
  },
];

function ShowcaseSlide({ icon: Icon, title, body, gradient }: (typeof SHOWCASE)[number]) {
  return (
    <div className={`relative flex min-h-[260px] items-center overflow-hidden bg-gradient-to-br ${gradient} px-8 pb-14 pt-10 sm:px-14`}>
      <div aria-hidden className="absolute -right-16 -top-16 h-72 w-72 animate-blob rounded-full bg-white/10 blur-2xl" />
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(rgb(255_255_255/0.06)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.06)_1px,transparent_1px)] [background-size:32px_32px]" />
      <div className="relative flex w-full flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/60">Inside TenantVault</p>
          <h3 className="mt-2 text-3xl font-bold text-white">{title}</h3>
          <p className="mt-3 text-white/80">{body}</p>
        </div>
        <span className="flex h-28 w-28 shrink-0 animate-float items-center justify-center rounded-3xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
          <Icon className="h-14 w-14 text-white" />
        </span>
      </div>
    </div>
  );
}

const ROLES: { role: string; icon: LucideIcon; color: string; can: string[] }[] = [
  { role: 'Admin', icon: Trash2, color: 'from-blue-600 to-blue-500', can: ['Everything staff can do', 'Delete products', 'View the audit log'] },
  { role: 'Staff', icon: PenLine, color: 'from-emerald-600 to-emerald-500', can: ['Create and edit products', 'Upload images', 'Export data, security view'] },
  { role: 'Viewer', icon: Eye, color: 'from-red-600 to-red-500', can: ['Read products and dashboard', 'Alerts and analytics', 'AI assistant'] },
];

const STACK = [
  'React 18',
  'TypeScript',
  'Vite',
  'TanStack Query',
  'Tailwind CSS',
  'ASP.NET Core 8',
  'EF Core 8',
  'PostgreSQL 16 RLS',
  'JWT HS256',
  'BCrypt',
  'Amazon S3',
  'Serilog',
  'xUnit + Testcontainers',
];

const DEMO = [
  { email: 'multi@demo.com', note: 'Admin in Acme, Staff in Globex, Viewer in Initech' },
  { email: 'acme@demo.com', note: 'Admin of Acme Corp' },
  { email: 'globex@demo.com', note: 'Admin of Globex Ltd' },
  { email: 'initech@demo.com', note: 'Admin of Initech' },
];

export function HomePage() {
  const { status } = useAuth();
  const signedIn = status === 'authenticated';
  const primaryCta = signedIn ? { to: '/dashboard', label: 'Open dashboard' } : { to: '/login', label: 'Try the live demo' };

  useEffect(() => {
    document.title = 'TenantVault · Multi-tenant inventory with provable isolation';
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-slate-900">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Link to="/home" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-emerald-500 text-white shadow-lg shadow-blue-600/30">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <span className="text-lg font-semibold tracking-tight">TenantVault</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
            {[
              ['#features', 'Features'],
              ['#isolation', 'Isolation'],
              ['#simulator', 'Simulator'],
              ['#roles', 'Roles'],
              ['#stack', 'Tech stack'],
            ].map(([href, label]) => (
              <a key={href} href={href} className="relative transition-colors hover:text-slate-900">
                {label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            {!signedIn && (
              <Link to="/login" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 sm:block">
                Sign in
              </Link>
            )}
            <Link
              to={primaryCta.to}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-px hover:bg-slate-800"
            >
              {primaryCta.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-32 -top-32 h-[30rem] w-[30rem] animate-blob rounded-full bg-blue-300/30 blur-3xl" />
          <div className="absolute right-0 top-20 h-96 w-96 animate-blob rounded-full bg-emerald-300/25 blur-3xl [animation-delay:-5s]" />
          <div className="absolute bottom-0 left-1/3 h-80 w-80 animate-blob rounded-full bg-red-300/20 blur-3xl [animation-delay:-9s]" />
          <div className="absolute inset-0 bg-[radial-gradient(rgb(148_163_184/0.25)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
        </div>

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-2 lg:pt-24">
          <div className="stagger">
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/80 px-3 py-1 text-xs font-semibold text-blue-700">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600" />
              </span>
              Multi-tenant SaaS · Provable isolation
            </span>
            <h1 className="mt-6 text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
              Inventory for every tenant.{' '}
              <span className="animate-gradient-x bg-gradient-to-r from-blue-600 via-emerald-500 to-red-500 bg-[length:200%_auto] bg-clip-text text-transparent">
                Isolation you can prove.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-slate-600">
              TenantVault is a multi-tenant inventory platform where every request, query, file and AI answer is locked to one
              tenant, enforced from the API all the way down to PostgreSQL row-level security.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to={primaryCta.to}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-500 px-6 py-3 text-base font-semibold text-white shadow-xl shadow-blue-600/25 transition hover:-translate-y-0.5 hover:shadow-2xl"
              >
                {primaryCta.label}
                <ArrowRight className="h-5 w-5" />
              </Link>
              <a
                href="#isolation"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white/80 px-6 py-3 text-base font-semibold text-slate-800 backdrop-blur transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                How isolation works
              </a>
            </div>
            <p className="mt-5 flex items-center gap-2 text-sm text-slate-500">
              <KeyRound className="h-4 w-4" />
              Demo password for every account: <span className="font-mono font-semibold text-slate-700">Password123!</span>
            </p>
          </div>

          <div className="animate-fade-up [animation-delay:200ms]">
            <HeroVisual />
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-slate-200 bg-slate-50/60">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 md:grid-cols-4">
          {[
            { value: 4, label: 'independent isolation layers' },
            { value: 8, label: 'live attacks, all blocked' },
            { value: 3, label: 'roles per tenant' },
            { value: 0, label: 'rows leaked across tenants' },
          ].map((s, i) => (
            <Reveal key={s.label} delay={i * 100} className="text-center">
              <p className="bg-gradient-to-br from-slate-900 to-slate-600 bg-clip-text text-5xl font-black text-transparent dark:from-white dark:to-slate-400">
                <AnimatedNumber value={s.value} duration={1600} />
              </p>
              <p className="mt-1 text-sm text-slate-500">{s.label}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-20 px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <SectionTitle
            eyebrow="Features"
            title="A complete inventory platform"
            body="Everything a team needs to run stock across multiple companies, with each company in its own sealed workspace."
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }, i) => (
              <Reveal key={title} delay={i * 80}>
                <div className="group relative h-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-2xl hover:shadow-blue-600/10">
                  <div aria-hidden className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-blue-400/10 blur-2xl transition-transform duration-500 group-hover:scale-150" />
                  <span className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-emerald-500 text-white shadow-lg shadow-blue-600/25 transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110">
                    <Icon className="h-6 w-6" />
                  </span>
                  <h3 className="relative mt-5 text-lg font-semibold text-slate-900">{title}</h3>
                  <p className="relative mt-2 text-sm leading-relaxed text-slate-500">{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Showcase slider */}
      <section className="px-4 pb-24 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionTitle
            eyebrow="Tour"
            title="See what’s inside"
            body="A quick look at the main screens. Every one of them is scoped to the tenant you are working in."
          />
          <Reveal>
            <div className="overflow-hidden rounded-3xl shadow-2xl shadow-slate-900/20">
              <Carousel
                tone="dark"
                interval={5000}
                label="Product tour"
                slides={SHOWCASE.map((s) => <ShowcaseSlide key={s.title} {...s} />)}
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Isolation layers */}
      <section id="isolation" className="relative scroll-mt-20 overflow-hidden bg-slate-950 px-4 py-24 text-white sm:px-6">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 top-0 h-96 w-96 animate-blob rounded-full bg-blue-600/25 blur-3xl" />
          <div className="absolute -right-24 bottom-0 h-96 w-96 animate-blob rounded-full bg-emerald-500/20 blur-3xl [animation-delay:-6s]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgb(255_255_255/0.04)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.04)_1px,transparent_1px)] [background-size:40px_40px]" />
        </div>
        <div className="relative mx-auto max-w-5xl">
          <Reveal className="mx-auto mb-14 max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">Defense in depth</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Four layers. Any one of them stops a leak.</h2>
            <p className="mt-4 text-slate-400">
              Most multi-tenant apps rely on a single WHERE clause. TenantVault checks tenant ownership at every step of a
              request, and fails closed when anything is missing.
            </p>
          </Reveal>

          <div className="relative">
            <div aria-hidden className="absolute bottom-6 left-6 top-6 w-px bg-gradient-to-b from-blue-500 via-emerald-400 to-red-400 sm:left-1/2" />
            <div className="space-y-8">
              {LAYERS.map(({ icon: Icon, title, body }, i) => (
                <Reveal key={title} delay={i * 120}>
                  <div className={`relative flex items-start gap-6 sm:w-1/2 ${i % 2 === 0 ? 'sm:pr-12' : 'sm:ml-auto sm:pl-12'}`}>
                    <span
                      className={`relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-emerald-500 shadow-lg shadow-blue-500/30 sm:absolute sm:top-2 ${
                        i % 2 === 0 ? 'sm:-right-6' : 'sm:-left-6'
                      }`}
                    >
                      <Icon className="h-6 w-6" />
                    </span>
                    <div className="flex-1 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur transition hover:border-white/20 hover:bg-white/10">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Layer {i + 1}</p>
                      <h3 className="mt-1 text-lg font-semibold">{title}</h3>
                      <p className="mt-1.5 text-sm text-slate-400">{body}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Simulator */}
      <section id="simulator" className="scroll-mt-20 px-4 py-24 sm:px-6">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">Isolation simulator</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Don’t trust the claim. Run the attacks.</h2>
            <p className="mt-4 text-slate-500">
              The built-in simulator fires eight real attacks against the running system, from missing headers to raw SQL
              that bypasses the ORM entirely. Each result shows the expected outcome, the actual outcome and why it was
              blocked. Every attempt also lands in the audit log.
            </p>
            <Link
              to={signedIn ? '/security/simulator' : '/login'}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-800"
            >
              <Swords className="h-4 w-4" />
              {signedIn ? 'Open the simulator' : 'Sign in to run it'}
            </Link>
          </Reveal>

          <Reveal delay={150}>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10">
              <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-4 py-3">
                <span className="h-3 w-3 rounded-full bg-red-400" />
                <span className="h-3 w-3 rounded-full bg-amber-400" />
                <span className="h-3 w-3 rounded-full bg-emerald-400" />
                <span className="ml-3 text-xs font-medium text-slate-500">8/8 attacks blocked · isolation verified</span>
              </div>
              <ul className="stagger divide-y divide-slate-100">
                {ATTACKS.map((a, i) => (
                  <li key={a.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="w-5 font-mono text-xs text-slate-400">{String(i + 1).padStart(2, '0')}</span>
                    <span className="flex-1 text-slate-700">{a.name}</span>
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">{a.expected}</span>
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="scroll-mt-20 bg-slate-50/60 px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionTitle
            eyebrow="Access control"
            title="One user, a different role in every tenant"
            body="Roles are resolved per tenant from the user’s membership and enforced on the server, not just hidden in the UI."
          />
          <div className="grid gap-5 md:grid-cols-3">
            {ROLES.map(({ role, icon: Icon, color, can }, i) => (
              <Reveal key={role} delay={i * 100}>
                <div className="group h-full rounded-2xl border border-slate-200 bg-white p-6 transition duration-300 hover:-translate-y-1 hover:shadow-2xl">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${color} text-white shadow-lg`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="text-xl font-bold">{role}</h3>
                  </div>
                  <ul className="mt-5 space-y-2.5">
                    {can.map((c) => (
                      <li key={c} className="flex items-start gap-2 text-sm text-slate-600">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Stack */}
      <section id="stack" className="scroll-mt-20 px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <SectionTitle
            eyebrow="Tech stack"
            title="Built on proven, boring technology"
            body="A React front end and an ASP.NET Core API over PostgreSQL, with isolation tested by integration and static-analysis tests."
          />
          <Reveal>
            <div className="flex flex-wrap justify-center gap-2.5">
              {STACK.map((s, i) => (
                <span
                  key={s}
                  className="animate-fade-up rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:text-blue-700 hover:shadow-md"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  {s}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-24 sm:px-6">
        <Reveal className="mx-auto max-w-6xl">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-700 to-emerald-600 p-8 text-white shadow-2xl shadow-blue-600/30 sm:p-12">
            <div aria-hidden className="absolute -right-20 -top-20 h-80 w-80 animate-blob rounded-full bg-white/10 blur-3xl" />
            <div className="relative grid gap-10 lg:grid-cols-2 lg:items-center">
              <div>
                <h2 className="text-3xl font-bold sm:text-4xl">Try it in under a minute</h2>
                <p className="mt-3 text-white/80">
                  Sign in with a demo account, switch tenants from the header, then run the isolation simulator.
                </p>
                <Link
                  to={primaryCta.to}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-slate-900 shadow-xl transition hover:-translate-y-0.5"
                >
                  {primaryCta.label}
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </div>
              <ul className="space-y-2">
                {DEMO.map((d) => (
                  <li key={d.email} className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur transition hover:bg-white/15">
                    <p className="font-mono text-sm font-semibold">{d.email}</p>
                    <p className="text-xs text-white/70">{d.note}</p>
                  </li>
                ))}
                <li className="px-1 pt-1 text-xs text-white/70">
                  Password for all accounts: <span className="font-mono font-semibold text-white">Password123!</span>
                </li>
              </ul>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-slate-200 px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 text-sm text-slate-500 sm:flex-row">
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-blue-600" />
            TenantVault · Multi-tenant inventory with provable isolation
          </span>
          <span>Row-level security · Tenant-scoped storage · Audited access</span>
        </div>
      </footer>
    </div>
  );
}
