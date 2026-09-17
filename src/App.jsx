// Routes and the three guards that protect them. The guards live here rather than under components: none
// produces markup, each returns an outlet or a redirect, and all three wrap a whole group as layout routes.

import { lazy, Suspense } from "react";
import { HashRouter as Router, Routes, Route, Navigate, Outlet } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary/ErrorBoundary";
import Footer from "./components/Footer/Footer";
import PageLoader from "./components/PageLoader/PageLoader";
import { needsSetup, useCurrentBuilding, useSession } from "./hooks/useSession";

const Setup = lazy(() => import("./pages/Setup/Setup.jsx"));
const Login = lazy(() => import("./pages/Login/Login.jsx"));
const Recover = lazy(() => import("./pages/Recover/Recover.jsx"));
const Dashboard = lazy(() => import("./pages/Dashboard/Dashboard.jsx"));
const BuildingView = lazy(() => import("./pages/BuildingView/BuildingView.jsx"));
const Dues = lazy(() => import("./pages/Dues/Dues.jsx"));
const Residents = lazy(() => import("./pages/Residents/Residents.jsx"));
const Transactions = lazy(() => import("./pages/Transactions/Transactions.jsx"));
const Profile = lazy(() => import("./pages/Profile/Profile.jsx"));
const Reports = lazy(() => import("./pages/Reports/Reports.jsx"));
const SeveranceFund = lazy(() => import("./pages/SeveranceFund/SeveranceFund.jsx"));
const SelectBuilding = lazy(() => import("./pages/SelectBuilding/SelectBuilding.jsx"));
const NewBuilding = lazy(() => import("./pages/NewBuilding/NewBuilding.jsx"));

function StartupRedirect() {
  const session = useSession();

  if (session) {
    return <Navigate to="/select-building" replace />;
  }

  return <Navigate to={needsSetup() ? "/setup" : "/login"} replace />;
}

// Two named guards instead of one with a flag, so the call site reads which protection applies from the name.
// The outlet and the redirect render together, or the current card would blank before the target is ready.
function RequireGuest() {
  const session = useSession();
  return (
    <>
      <Outlet />
      {session && <Navigate to="/select-building" replace />}
    </>
  );
}

function RequireAuth() {
  const session = useSession();
  if (!session) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

// Only the screens that read building scoped data sit under this one. The account page is deliberately
// outside it and works with no building selected.
function RequireBuilding() {
  const building = useCurrentBuilding();
  if (!building) {
    return <Navigate to="/select-building" replace />;
  }
  return <Outlet />;
}

function App() {
  return (
    <Router>
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route element={<RequireGuest />}>
              <Route path="/setup" element={<Setup />} />
              <Route path="/login" element={<Login />} />
              <Route path="/recover" element={<Recover />} />
            </Route>

            <Route element={<RequireAuth />}>
              <Route path="/select-building" element={<SelectBuilding />} />
              <Route path="/new-building" element={<NewBuilding />} />
              <Route path="/profile" element={<Profile />} />
              <Route element={<RequireBuilding />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/building-view" element={<BuildingView />} />
                <Route path="/dues" element={<Dues />} />
                <Route path="/residents" element={<Residents />} />
                <Route path="/transactions" element={<Transactions />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/severance-fund" element={<SeveranceFund />} />
              </Route>
            </Route>

            <Route path="*" element={<StartupRedirect />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
      <Footer />
    </Router>
  );
}

export default App;
