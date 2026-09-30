import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, LogOut, Menu, ShieldCheck, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCurrentTenant } from '@/context/TenantContext';
import { TenantSwitcher } from './TenantSwitcher';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

interface HeaderProps {
  onOpenMobileNav: () => void;
}

export function Header({ onOpenMobileNav }: HeaderProps) {
  const { user, logout } = useAuth();
  const tenant = useCurrentTenant();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-30 bg-white/70 backdrop-blur-xl transition-colors duration-500">
      <div className="relative h-1 overflow-hidden bg-accent/20">
        <div className="absolute inset-0 animate-gradient-x bg-[linear-gradient(90deg,rgb(var(--tv-accent)),rgb(var(--tv-accent)/0.4),rgb(var(--tv-accent)))] bg-[length:200%_100%]" />
        <div
          key={`${tenant.id}${location.pathname}`}
          className="absolute inset-y-0 w-1/3 animate-sweep bg-gradient-to-r from-transparent via-white/90 to-transparent"
        />
      </div>
      <div className="flex h-16 items-center gap-3 border-b border-slate-200/70 px-4 sm:px-6">
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="rounded-md p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>

        <Link to="/dashboard" className="flex items-center gap-2 lg:hidden">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white transition-colors duration-500">
            <ShieldCheck className="h-5 w-5" />
          </span>
        </Link>

        <div key={tenant.id} className="flex min-w-0 animate-fade-in items-center gap-2.5">
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-40" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-accent" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{tenant.name}</p>
            <p className="truncate text-xs text-slate-500">
              {tenant.slug} · <span className="capitalize">{tenant.role}</span>
            </p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <TenantSwitcher />

          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex h-9 items-center gap-2 rounded-lg px-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full accent-gradient text-xs font-semibold uppercase text-white shadow-md shadow-accent/30 ring-2 ring-white">
                {user?.email?.[0] ?? <UserIcon className="h-4 w-4" />}
              </span>
              <span className="hidden max-w-[180px] truncate md:inline">{user?.email}</span>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 z-40 mt-2 w-60 origin-top-right animate-scale-in overflow-hidden rounded-xl border border-slate-200 bg-white/95 shadow-2xl backdrop-blur"
              >
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="truncate text-sm font-medium text-slate-900">Signed in</p>
                  <p className="truncate text-xs text-slate-500">{user?.email}</p>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={logout}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
