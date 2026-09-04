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
const AddApartment = lazy(() => import("./pages/AddApartment/AddApartment.jsx"));
const Apartments = lazy(() => import("./pages/Apartments/Apartments.jsx"));
const Residents = lazy(() => import("./pages/Residents/Residents.jsx"));
const AddIncome = lazy(() => import("./pages/AddIncome/AddIncome.jsx"));
const AddExpense = lazy(() => import("./pages/AddExpense/AddExpense.jsx"));
const Transactions = lazy(() => import("./pages/Transactions/Transactions.jsx"));
const Profile = lazy(() => import("./pages/Profile/Profile.jsx"));
const Reports = lazy(() => import("./pages/Reports/Reports.jsx"));
const SelectBuilding = lazy(() => import("./pages/SelectBuilding/SelectBuilding.jsx"));

function StartupRedirect() {
  const session = useSession();

  if (session) {
    return <Navigate to="/select-building" replace />;
  }

  return <Navigate to={needsSetup() ? "/setup" : "/login"} replace />;
}

function RequireGuest() {
  const session = useSession();
  if (session) {
    return <Navigate to="/select-building" replace />;
  }
  return <Outlet />;
}

function RequireAuth() {
  const session = useSession();
  if (!session) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

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
              <Route path="/profile" element={<Profile />} />
              <Route element={<RequireBuilding />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/add-apartment" element={<AddApartment />} />
                <Route path="/apartments" element={<Apartments />} />
                <Route path="/residents" element={<Residents />} />
                <Route path="/add-income" element={<AddIncome />} />
                <Route path="/add-expense" element={<AddExpense />} />
                <Route path="/transactions" element={<Transactions />} />
                <Route path="/reports" element={<Reports />} />
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
