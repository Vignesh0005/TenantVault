import { Bot, Database, ScrollText, ShieldCheck, Swords, type LucideIcon } from 'lucide-react';
import { Carousel } from '@/components/ui/Carousel';

interface Feature {
  icon: LucideIcon;
  title: string;
  body: string;
  stat: string;
  statLabel: string;
}

const FEATURES: Feature[] = [
  {
    icon: Database,
    title: 'Isolation enforced by PostgreSQL itself',
    body: 'Row-level security policies mean even a raw SQL bug returns zero rows from another tenant.',
    stat: '4',
    statLabel: 'independent isolation layers',
  },
  {
    icon: Swords,
    title: 'Attack your own workspace, live',
    body: 'The isolation simulator fires 8 real attacks, from header spoofing to forged tokens, and shows each one blocked.',
    stat: '8/8',
    statLabel: 'attacks blocked',
  },
  {
    icon: ScrollText,
    title: 'Every cross-tenant attempt is audited',
    body: 'Blocked requests are logged for the targeted tenant and for the attacker’s own tenants.',
    stat: '100%',
    statLabel: 'of denials recorded',
  },
  {
    icon: Bot,
    title: 'AI answers from your data only',
    body: 'Stock-out predictions, dead stock and reorder suggestions, never mixed with another tenant’s inventory.',
    stat: '1',
    statLabel: 'tenant in scope, always',
  },
];

function FeatureSlide({ icon: Icon, title, body, stat, statLabel }: Feature) {
  return (
    <div className="pb-14 pr-2">
      <span className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
        <Icon className="h-7 w-7 text-white" />
      </span>
      <h2 className="text-3xl font-bold leading-tight text-white xl:text-4xl">{title}</h2>
      <p className="mt-4 max-w-md text-base text-slate-300">{body}</p>
      <div className="mt-8 inline-flex items-baseline gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 backdrop-blur">
        <span className="bg-gradient-to-r from-sky-300 to-emerald-300 bg-clip-text text-3xl font-bold text-transparent">{stat}</span>
        <span className="text-sm text-slate-300">{statLabel}</span>
      </div>
    </div>
  );
}

export function AuthShowcase() {
  return (
    <div className="relative hidden w-1/2 overflow-hidden bg-slate-950 lg:flex lg:flex-col lg:justify-between lg:p-12">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-24 h-96 w-96 animate-blob rounded-full bg-blue-600/30 blur-3xl" />
        <div className="absolute -bottom-32 right-0 h-96 w-96 animate-blob rounded-full bg-emerald-500/25 blur-3xl [animation-delay:-5s]" />
        <div className="absolute right-1/4 top-1/3 h-72 w-72 animate-blob rounded-full bg-red-500/20 blur-3xl [animation-delay:-10s]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgb(255_255_255/0.04)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.04)_1px,transparent_1px)] [background-size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_75%)]" />
      </div>

      <div className="relative flex animate-slide-in-left items-center gap-2.5 text-white">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 shadow-lg shadow-blue-500/30">
          <ShieldCheck className="h-6 w-6" />
        </span>
        <span className="text-xl font-semibold">TenantVault</span>
      </div>

      <div className="relative animate-fade-up">
        <Carousel tone="dark" interval={5000} showArrows={false} label="TenantVault features" slides={FEATURES.map((f) => <FeatureSlide key={f.title} {...f} />)} />
      </div>

      <div className="relative flex flex-wrap gap-2 text-xs">
        {['Row-level security', 'Tenant-scoped storage', 'Audited access', 'Fail-closed'].map((tag, i) => (
          <span
            key={tag}
            className="animate-fade-up rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300 backdrop-blur"
            style={{ animationDelay: `${300 + i * 80}ms` }}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
