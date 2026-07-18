import { lazy, Suspense, useEffect, useState } from "react";
import { HashRouter as Router, Routes, Route, Navigate, Outlet } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary/ErrorBoundary.jsx";
import Footer from "./components/Footer/Footer.jsx";
import PageLoader from "./components/PageLoader/PageLoader.jsx";
import { useCurrentUser, homePathFor } from "./hooks/useCurrentUser.js";
import ProtectedRoute from "./components/ProtectedRoute/ProtectedRoute.jsx";

const Setup = lazy(() => import("./pages/Setup/Setup.jsx"));
const Login = lazy(() => import("./pages/Login/Login.jsx"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard/AdminDashboard.jsx"));
const Dashboard = lazy(() => import("./pages/Dashboard/Dashboard.jsx"));
const AddApartment = lazy(() => import("./pages/AddApartment/AddApartment.jsx"));
const Apartments = lazy(() => import("./pages/Apartments/Apartments.jsx"));
const ApartmentsManage = lazy(() => import("./pages/Apartments/ApartmentsManage.jsx"));
const Residents = lazy(() => import("./pages/Residents/Residents.jsx"));
const AddIncome = lazy(() => import("./pages/AddIncome/AddIncome.jsx"));
const AddExpense = lazy(() => import("./pages/AddExpense/AddExpense.jsx"));
const Transactions = lazy(() => import("./pages/Transactions/Transactions.jsx"));
const Profile = lazy(() => import("./pages/Profile/Profile.jsx"));
const Reports = lazy(() => import("./pages/Reports/Reports.jsx"));

function StartupRedirect() {
  const currentUser = useCurrentUser();
  const [setupTarget, setSetupTarget] = useState(null);

  useEffect(() => {
    if (currentUser) return;
    let active = true;
    window.electronAPI
      .getSetupState()
      .then((res) => {
        if (active) setSetupTarget(res?.needsSetup ? "/setup" : "/login");
      })
      .catch(() => {
        if (active) setSetupTarget("/login");
      });
    return () => {
      active = false;
    };
  }, [currentUser]);

  if (currentUser) {
    return <Navigate to={homePathFor(currentUser)} replace />;
  }

  if (!setupTarget) return <PageLoader message="Yükleniyor..." fullscreen />;
  return <Navigate to={setupTarget} replace />;
}

function App() {
  return (
    <div className="app-wrapper">
      <Router>
        <ErrorBoundary>
          <Suspense fallback={<PageLoader message="Sayfa yükleniyor..." />}>
            <Routes>
              <Route
                path="/setup"
                element={
                  <ProtectedRoute guestOnly>
                    <Setup />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/login"
                element={
                  <ProtectedRoute guestOnly>
                    <Login />
                  </ProtectedRoute>
                }
              />

              {/* Admin routes */}
              <Route
                element={
                  <ProtectedRoute requiredRole="admin">
                    <Outlet />
                  </ProtectedRoute>
                }
              >
                <Route path="/admin" element={<AdminDashboard />} />
              </Route>

              {/* Manager routes */}
              <Route
                element={
                  <ProtectedRoute requiredRole="manager">
                    <Outlet />
                  </ProtectedRoute>
                }
              >
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/add-apartment" element={<AddApartment />} />
                <Route path="/apartments" element={<Apartments />} />
                <Route path="/apartments/manage" element={<ApartmentsManage />} />
                <Route path="/residents" element={<Residents />} />
                <Route path="/add-income" element={<AddIncome />} />
                <Route path="/add-expense" element={<AddExpense />} />
                <Route path="/transactions" element={<Transactions />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/reports" element={<Reports />} />
              </Route>

              <Route path="*" element={<StartupRedirect />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
        <Footer />
      </Router>
    </div>
  );
}

export default App;
