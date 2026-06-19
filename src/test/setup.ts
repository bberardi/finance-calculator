import '@testing-library/jest-dom/vitest';

// jsdom (used only by the *.test.tsx component tests via a per-file
// `@vitest-environment jsdom` docblock) doesn't implement everything MUI and the
// table virtualizer reach for. Provide minimal stubs. The guard means the
// node-environment math/helper tests — which have no `window` — skip all of it,
// so `environment: 'node'` stays the default for `src/helpers/**`.
if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    // MUI `useMediaQuery` (responsive table vs. card view, full-screen dialogs).
    window.matchMedia = (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList;
  }

  if (typeof window.ResizeObserver === 'undefined') {
    // @tanstack/react-virtual (schedule popouts). Use a `typeof` guard rather
    // than `'ResizeObserver' in window`: under TS's narrowing the negative
    // branch of an `in` check against a known DOM global collapses `window` to
    // `never`, which breaks the assignment below.
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    window.ResizeObserver =
      ResizeObserverStub as unknown as typeof ResizeObserver;
  }
}
