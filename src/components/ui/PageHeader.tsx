import { useEffect, type ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  useEffect(() => {
    document.title = `${title} · TenantVault`;
  }, [title]);

  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="animate-slide-in-left">
        <h1 className="text-gradient animate-gradient-x text-3xl font-bold tracking-tight">{title}</h1>
        <span className="mt-2 block h-1 w-12 origin-left animate-grow-x rounded-full bg-accent transition-colors duration-500" />
        {description && <p className="mt-2 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex animate-fade-up flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
