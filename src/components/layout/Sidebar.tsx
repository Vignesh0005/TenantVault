import { NavLink } from 'react-router-dom';
import {
  Bell,
  BarChart3,
  Bot,
  Info,
  LayoutDashboard,
  Package,
  ScrollText,
  Settings,
  ShieldCheck,
  ShieldAlert,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useCurrentTenant } from '@/context/TenantContext';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Inventory',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/products', label: 'Products', icon: Package },
      { to: '/alerts', label: 'Alerts', icon: Bell },
      { to: '/analytics', label: 'Analytics', icon: BarChart3 },
      { to: '/ai', label: 'AI Assistant', icon: Bot },
    ],
  },
  {
    title: 'Security',
    items: [
      { to: '/security', label: 'Security', icon: ShieldAlert, end: true },
      { to: '/security/simulator', label: 'Isolation Simulator', icon: ShieldCheck },
      { to: '/audit', label: 'Audit', icon: ScrollText },
    ],
  },
  {
    title: 'Workspace',
    items: [
      { to: '/settings', label: 'Settings', icon: Settings },
      { to: '/home', label: 'About TenantVault', icon: Info },
    ],
  },
];

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const tenant = useCurrentTenant();
  let order = 0;
  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-accent/25 blur-3xl transition-colors duration-700" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-accent/10 blur-3xl transition-colors duration-700" />

      <div className="relative flex h-16 items-center gap-2.5 border-b border-white/5 px-5">
        <span className="relative flex h-9 w-9 items-center justify-center rounded-xl accent-gradient text-white shadow-lg shadow-accent/30">
          <ShieldCheck className="h-5 w-5" />
          <span className="absolute inset-0 animate-glow-pulse rounded-xl" />
        </span>
        <div className="leading-tight">
          <span className="block text-base font-semibold tracking-tight text-white">TenantVault</span>
          <span className="block text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">Isolated inventory</span>
        </div>
      </div>

      <nav className="relative flex-1 space-y-5 overflow-y-auto px-3 py-5">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{section.title}</p>
            <div className="space-y-0.5">
              {section.items.map(({ to, label, icon: Icon, end }) => {
                const delay = order++ * 40;
                return (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    onClick={onNavigate}
                    style={{ animationDelay: `${delay}ms` }}
                    className={({ isActive }) =>
                      `group relative flex animate-slide-in-left items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-300 ${
                        isActive
                          ? 'bg-gradient-to-r from-accent/30 to-accent/5 text-white shadow-inner shadow-white/5'
                          : 'text-slate-400 hover:translate-x-0.5 hover:bg-white/5 hover:text-slate-100'
                      } ${to === '/security/simulator' ? 'ml-3' : ''}`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span className="absolute inset-y-1.5 left-0 w-1 rounded-r-full bg-accent shadow-[0_0_12px_rgb(var(--tv-accent))] transition-colors duration-500" />
                        )}
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-300 ${
                            isActive ? 'bg-accent text-white shadow-md shadow-accent/40' : 'bg-white/5 group-hover:bg-white/10'
                          }`}
                        >
                          <Icon className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
                        </span>
                        {label}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="relative p-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Isolated workspace</p>
          <div key={tenant.id} className="mt-2 flex animate-fade-in items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-200">{tenant.name}</span>
            <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
              {tenant.role}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 lg:block">
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
          <aside className="relative h-full w-64 animate-slide-in-left bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 shadow-2xl">
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-4 z-10 rounded-md p-1 text-slate-400 hover:bg-white/10"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent onNavigate={onClose} />
          </aside>
        </div>
      )}
    </>
  );
}
