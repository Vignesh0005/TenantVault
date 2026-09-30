import type { CSSProperties } from 'react';

interface RangeSliderProps {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  /** Values shown as clickable tick labels under the track. */
  marks?: number[];
  format?: (value: number) => string;
  label?: string;
  className?: string;
}

export function RangeSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
  marks = [],
  format = String,
  label,
  className = '',
}: RangeSliderProps) {
  const percent = ((value - min) / (max - min)) * 100;

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-500">
          <span>{label}</span>
          <span
            key={value}
            className="animate-scale-in rounded-md bg-accent/10 px-2 py-0.5 font-semibold tabular-nums text-accent"
          >
            {format(value)}
          </span>
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        aria-valuetext={format(value)}
        className="tv-range w-full"
        style={{ '--tv-fill': `${percent}%` } as CSSProperties}
      />
      {marks.length > 0 && (
        <div className="relative mt-1.5 h-4">
          {marks.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onChange(m)}
              className={`absolute -translate-x-1/2 text-[11px] tabular-nums transition-colors ${
                m === value ? 'font-semibold text-accent' : 'text-slate-400 hover:text-slate-700'
              }`}
              style={{ left: `${((m - min) / (max - min)) * 100}%` }}
            >
              {format(m)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
