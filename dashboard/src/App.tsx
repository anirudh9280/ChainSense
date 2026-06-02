import { Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import Overview from "./pages/Overview";
import FeatureAnalysis from "./pages/FeatureAnalysis";
import ClusterAnalysis from "./pages/ClusterAnalysis";
import Wallets from "./pages/Wallets";
import SignalValidation from "./pages/SignalValidation";
import RealtimeClassifier from "./pages/RealtimeClassifier";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<RealtimeClassifier />} />
        <Route path="overview" element={<Overview />} />
        <Route path="feature-analysis" element={<FeatureAnalysis />} />
        <Route path="cluster-analysis" element={<ClusterAnalysis />} />
        <Route path="wallets" element={<Wallets />} />
        <Route path="signal-validation" element={<SignalValidation />} />
      </Route>
    </Routes>
  );
}
