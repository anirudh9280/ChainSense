import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import { loadSnapshot, type Snapshot } from "../lib/snapshot";

export default function AppShell() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    loadSnapshot().then(setSnap).catch((e) => setErr(String(e)));
  }, []);

  return (
    <div className="flex h-full min-h-screen bg-bg">
      <Sidebar snap={snap} />
      <main className="min-w-0 flex-1 overflow-y-auto px-8 py-6">
        {err ? (
          <div className="rounded border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            Failed to load snapshot: {err}
          </div>
        ) : (
          <Outlet context={{ snap }} />
        )}
      </main>
    </div>
  );
}
