import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  message?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, message, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex animate-fade-up flex-col items-center justify-center px-6 py-14 text-center ${className}`}>
      <div className="relative mb-5">
        <span className="absolute inset-0 animate-ping rounded-2xl bg-accent/10 [animation-duration:2.5s]" />
        <div className="relative flex h-14 w-14 animate-float items-center justify-center rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 text-accent ring-1 ring-inset ring-accent/20 transition-colors duration-300">
          {icon ?? <Inbox className="h-6 w-6" />}
        </div>
      </div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-sm text-slate-500">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
