import { lazy, Suspense, useEffect, useState } from "react";
import { HashRouter as Router, Routes, Route, Navigate, Outlet } from "react-router-dom";
import Footer from "./components/Footer.jsx";
import { useCurrentUser } from "./hooks/useCurrentUser.js";
import ProtectedRoute from "./router/ProtectedRoute.jsx";

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
    return <Navigate to={currentUser.role === "admin" ? "/admin" : "/dashboard"} replace />;
  }

  if (!setupTarget) return null;
  return <Navigate to={setupTarget} replace />;
}

function App() {
  return (
    <div className="app-wrapper">
      <Router>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/setup" element={<Setup />} />
            <Route path="/login" element={<Login />} />

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
        <Footer />
      </Router>
    </div>
  );
}

export default App;
