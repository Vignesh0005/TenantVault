import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CarouselProps {
  slides: ReactNode[];
  /** Auto-advance interval in ms; 0 disables autoplay. */
  interval?: number;
  tone?: 'light' | 'dark';
  showArrows?: boolean;
  className?: string;
  label?: string;
}

const SWIPE_THRESHOLD_PX = 40;

export function Carousel({
  slides,
  interval = 6000,
  tone = 'light',
  showArrows = true,
  className = '',
  label = 'Highlights',
}: CarouselProps) {
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const dragStart = useRef<number | null>(null);

  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);

  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [count, index]);

  useEffect(() => {
    if (!interval || paused || count < 2) return;
    const id = window.setTimeout(() => go(index + 1), interval);
    return () => window.clearTimeout(id);
  }, [index, paused, interval, count, go]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    dragStart.current = e.clientX;
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (dragStart.current === null) return;
    const delta = e.clientX - dragStart.current;
    dragStart.current = null;
    if (Math.abs(delta) > SWIPE_THRESHOLD_PX) go(index + (delta < 0 ? 1 : -1));
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') go(index + 1);
    if (e.key === 'ArrowLeft') go(index - 1);
  };

  if (count === 0) return null;

  const dark = tone === 'dark';
  const arrowClass = dark
    ? 'bg-white/10 text-white hover:bg-white/20'
    : 'bg-white/80 text-slate-700 shadow-sm hover:bg-white';

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={`group/carousel relative overflow-hidden focus:outline-none ${className}`}
    >
      <div
        className="flex touch-pan-y select-none transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ transform: `translateX(-${index * 100}%)` }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={() => (dragStart.current = null)}
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            className="w-full shrink-0"
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
            aria-hidden={i !== index}
          >
            <div className={i === index ? 'animate-fade-up' : ''}>{slide}</div>
          </div>
        ))}
      </div>

      {count > 1 && showArrows && (
        <>
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Previous slide"
            className={`absolute left-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full opacity-0 backdrop-blur transition group-hover/carousel:opacity-100 ${arrowClass}`}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Next slide"
            className={`absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full opacity-0 backdrop-blur transition group-hover/carousel:opacity-100 ${arrowClass}`}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      )}

      {count > 1 && (
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => go(i)}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === index}
              className={`relative h-1.5 overflow-hidden rounded-full transition-all duration-500 ${
                i === index ? 'w-8' : 'w-1.5'
              } ${dark ? 'bg-white/25 hover:bg-white/40' : 'bg-slate-900/15 hover:bg-slate-900/30'}`}
            >
              {i === index && (
                <span
                  key={`${index}-${paused}`}
                  className={`absolute inset-0 origin-left rounded-full ${dark ? 'bg-white' : 'bg-accent'}`}
                  style={
                    interval && !paused
                      ? { animation: `tv-progress ${interval}ms linear both` }
                      : { transform: 'scaleX(1)' }
                  }
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
