import { Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import Overview from "./pages/Overview";
import Archetypes from "./pages/Archetypes";
import FeatureSpace from "./pages/FeatureSpace";
import Wallets from "./pages/Wallets";
import AnomalyDetection from "./pages/AnomalyDetection";
import RealtimeClassifier from "./pages/RealtimeClassifier";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<RealtimeClassifier />} />
        <Route path="cluster-analysis" element={<Overview />} />
        <Route path="archetypes" element={<Archetypes />} />
        <Route path="feature-space" element={<FeatureSpace />} />
        <Route path="wallets" element={<Wallets />} />
        <Route path="anomaly" element={<AnomalyDetection />} />
      </Route>
    </Routes>
  );
}
