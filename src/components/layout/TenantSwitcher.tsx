import { useEffect, useRef } from 'react';
import { Building2, Check, ChevronsUpDown } from 'lucide-react';
import { useTenant } from '@/context/TenantContext';
import { useTenantSwitch } from '@/hooks/useTenantSwitch';
import { getTenantColor } from '@/lib/tenantColors';

export function TenantSwitcher() {
  const { currentTenant, tenants, switcherOpen, setSwitcherOpen } = useTenant();
  const switchTenant = useTenantSwitch();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!switcherOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setSwitcherOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSwitcherOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [switcherOpen, setSwitcherOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setSwitcherOpen(!switcherOpen)}
        aria-haspopup="listbox"
        aria-expanded={switcherOpen}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/20"
      >
        <Building2 className="h-4 w-4 text-slate-400" />
        <span className="hidden sm:inline">Switch tenant</span>
        <ChevronsUpDown className="h-4 w-4 text-slate-400" />
      </button>

      {switcherOpen && (
        <div
          role="listbox"
          aria-label="Your tenants"
          className="absolute right-0 z-40 mt-2 w-72 animate-fade-in overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        >
          <div className="border-b border-slate-100 px-4 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your tenants</p>
            <p className="text-xs text-slate-400">Only workspaces you are a member of are listed.</p>
          </div>
          <ul className="max-h-72 overflow-y-auto py-1">
            {tenants.map((tenant) => {
              const active = tenant.slug === currentTenant?.slug;
              return (
                <li key={tenant.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => switchTenant(tenant)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition hover:bg-slate-50 ${active ? 'bg-slate-50' : ''}`}
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                      style={{ backgroundColor: getTenantColor(tenant.slug) }}
                    >
                      {tenant.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-900">{tenant.name}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {tenant.slug} · {tenant.role}
                      </span>
                    </span>
                    {active && <Check className="h-4 w-4 text-accent" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
