import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import { LiveStreamProvider } from "../lib/liveStream";

export default function AppShell() {
  // Drives the mobile (<md) nav drawer only. On desktop the sidebar is always in-flow
  // and this state is never read, so the desktop layout is unaffected.
  const [navOpen, setNavOpen] = useState(false);

  return (
    // LiveStreamProvider owns the single app-wide SSE connection so the Live page's
    // series keep accumulating across navigation (and the sidebar could later reflect
    // real connection state). It wraps Sidebar + main, above the router's Outlet.
    <LiveStreamProvider>
      <div className="flex h-full min-h-screen bg-bg">
        {/* Mobile-only top bar with the hamburger. md:hidden → never renders on desktop. */}
        <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-panel/95 px-4 backdrop-blur md:hidden">
          <button
            type="button"
            aria-label="Open navigation"
            onClick={() => setNavOpen(true)}
            className="-ml-1 inline-flex h-9 w-9 items-center justify-center rounded-md text-fg hover:bg-panel2/60"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-1.5">
            <img src="/eth.svg" alt="Ethereum" className="h-6 w-6" />
            <span className="text-[14px] font-semibold tracking-tight text-fg">ChainSense</span>
          </div>
        </header>

        {/* Backdrop behind the open drawer; tap to dismiss. md:hidden keeps it off desktop. */}
        {navOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setNavOpen(false)}
            aria-hidden="true"
          />
        )}

        <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />

        {/* pt-16 clears the fixed mobile top bar; md:py-6 restores the exact desktop padding. */}
        <main className="min-w-0 flex-1 overflow-y-auto px-4 pb-6 pt-16 md:px-8 md:py-6">
          <nav className="mb-4 text-right text-sm" aria-label="Project source"><a href="https://github.com/anirudh9280/ChainSense" target="_blank" rel="noopener noreferrer" className="text-fg underline">GitHub</a></nav>
          <Outlet />
        </main>
      </div>
    </LiveStreamProvider>
  );
}

function MenuIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M4 6h16M4 12h16M4 18h16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
