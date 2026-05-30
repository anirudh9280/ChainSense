import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import { LiveStreamProvider } from "../lib/liveStream";
import { loadSnapshot, type Snapshot } from "../lib/snapshot";

export default function AppShell() {
  // Transitional: the legacy pages (Archetypes, Feature Space, Wallets,
  // Anomaly, Real-time) still read the OLD snapshot via Outlet context. Migrated
  // pages (Overview) ignore it and load their own data. Snapshot failures no
  // longer block the migrated pages.
  const [snap, setSnap] = useState<Snapshot | null>(null);

  useEffect(() => {
    loadSnapshot()
      .then(setSnap)
      .catch((e) => console.warn("legacy snapshot.json unavailable:", String(e)));
  }, []);

  return (
    // LiveStreamProvider owns the single app-wide SSE connection so the Live page's
    // series keep accumulating across navigation (and the sidebar could later reflect
    // real connection state). It wraps Sidebar + main, above the router's Outlet.
    <LiveStreamProvider>
      <div className="flex h-full min-h-screen bg-bg">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-y-auto px-8 py-6">
          <Outlet context={{ snap }} />
        </main>
      </div>
    </LiveStreamProvider>
  );
}
