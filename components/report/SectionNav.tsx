'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cx } from '@/components/ui';

// Height of the app header (72px) plus this bar (about 49px) plus breathing room.
// Sections use the same value as scroll-margin so hash links land below both bars.
const OFFSET = 136;

export function SectionNav({ items }: { items: [string, string][] }) {
  const scroller = useRef<HTMLUListElement>(null);
  const links = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [active, setActive] = useState(items[0][0]);
  const [edge, setEdge] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setEdge({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);

  // Which section is under the sticky bars. At the very bottom, the last one.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      let current = items[0][0];
      for (const [id] of items) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= OFFSET + 8) current = id;
      }
      setActive(atBottom ? items[items.length - 1][0] : current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [items]);

  // Keep the highlighted tab in view inside the bar.
  useEffect(() => {
    const el = scroller.current;
    const link = links.current[active];
    if (!el || !link) return;
    const target = link.offsetLeft - (el.clientWidth - link.offsetWidth) / 2;
    el.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }, [active]);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  const go = (id: string) => (e: React.MouseEvent) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - OFFSET + 8, behavior: 'smooth' });
    history.replaceState(null, '', `#${id}`);
    setActive(id);
  };

  const nudge = (dir: -1 | 1) => scroller.current?.scrollBy({ left: dir * 220, behavior: 'smooth' });

  return (
    <nav aria-label="Report sections" className="sticky top-72 z-10 -mx-16 border-y border-line bg-canvas/95 backdrop-blur md:-mx-32">
      <div className="relative">
        <ul ref={scroller} onScroll={measure} className="no-scrollbar flex gap-4 overflow-x-auto px-16 py-8 md:px-32">
          {items.map(([id, label]) => (
            <li key={id} className="shrink-0">
              <a
                ref={(node) => {
                  links.current[id] = node;
                }}
                href={`#${id}`}
                onClick={go(id)}
                aria-current={active === id ? 'true' : undefined}
                className={cx(
                  'flex h-32 items-center whitespace-nowrap rounded-md px-10 text-body-sm transition-colors',
                  active === id ? 'bg-primary/15 font-semibold text-primary' : 'text-ink-subtle hover:bg-surface-high hover:text-ink',
                )}
              >
                {label}
              </a>
            </li>
          ))}
        </ul>

        {/* Edge fades and arrows show that the bar scrolls sideways. */}
        {(['left', 'right'] as const).map((side) => {
          const show = edge[side];
          return (
            <div
              key={side}
              aria-hidden={!show}
              className={cx(
                'pointer-events-none absolute inset-y-0 flex w-56 items-center transition-opacity duration-150',
                side === 'left' ? 'left-0 justify-start bg-gradient-to-r from-canvas via-canvas/80 to-transparent pl-6 md:pl-24' : 'right-0 justify-end bg-gradient-to-l from-canvas via-canvas/80 to-transparent pr-6 md:pr-24',
                show ? 'opacity-100' : 'opacity-0',
              )}
            >
              <button
                type="button"
                tabIndex={show ? 0 : -1}
                onClick={() => nudge(side === 'left' ? -1 : 1)}
                aria-label={side === 'left' ? 'Scroll sections left' : 'Scroll sections right'}
                className={cx('flex h-28 w-28 items-center justify-center rounded-full border border-line-strong bg-surface text-ink-muted shadow-card hover:text-ink', show && 'pointer-events-auto')}
              >
                {side === 'left' ? <ChevronLeft className="h-16 w-16" aria-hidden /> : <ChevronRight className="h-16 w-16" aria-hidden />}
              </button>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
