import { useEffect, useRef, type ReactNode } from 'react';

// Moves focus to the page heading on navigation so screen reader and keyboard users know the page changed.
export function PageHeading({ children, title }: { children: ReactNode; title?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    document.title = `${title ?? ref.current?.textContent ?? 'Podcast Library'} – Podcast Library`;
    ref.current?.focus({ preventScroll: false });
  }, [title]);
  return (
    <h1 ref={ref} tabIndex={-1} className="page-heading">
      {children}
    </h1>
  );
}
