import { Moon, Sun } from 'lucide-react';
import { toggleTheme, useTheme } from '@/lib/theme';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const theme = useTheme();
  const dark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      className={`relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white/80 text-slate-600 shadow-sm backdrop-blur transition hover:-translate-y-px hover:text-slate-900 hover:shadow-md active:scale-95 ${className}`}
    >
      <Sun
        className={`absolute h-[18px] w-[18px] text-amber-500 transition-all duration-500 ${
          dark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'
        }`}
      />
      <Moon
        className={`absolute h-[18px] w-[18px] text-indigo-300 transition-all duration-500 ${
          dark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'
        }`}
      />
    </button>
  );
}
