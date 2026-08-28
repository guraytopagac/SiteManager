import { lazy, Suspense } from "react";
import { HashRouter as Router, Routes, Route, Navigate, Outlet } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary/ErrorBoundary.jsx";
import Footer from "./components/Footer/Footer.jsx";
import PageLoader from "./components/PageLoader/PageLoader.jsx";
import ProtectedRoute from "./components/ProtectedRoute/ProtectedRoute.jsx";
import { useCurrentBuilding } from "./hooks/useCurrentBuilding.js";
import { useCurrentUser } from "./hooks/useCurrentUser.js";
import { useNeedsSetup } from "./hooks/useNeedsSetup.js";

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
  const currentUser = useCurrentUser();
  const needsSetup = useNeedsSetup();

  if (currentUser) {
    return <Navigate to="/select-building" replace />;
  }

  if (needsSetup === null) return <PageLoader message="Yükleniyor..." />;
  return <Navigate to={needsSetup ? "/setup" : "/login"} replace />;
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
        <Suspense fallback={<PageLoader message="Sayfa yükleniyor..." />}>
          <Routes>
            <Route element={<ProtectedRoute guestOnly />}>
              <Route path="/setup" element={<Setup />} />
              <Route path="/login" element={<Login />} />
              <Route path="/recover" element={<Recover />} />
            </Route>

            <Route element={<ProtectedRoute />}>
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
