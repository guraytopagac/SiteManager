// Libraries
import { lazy, Suspense } from "react";
import { HashRouter as Router, Routes, Route, Navigate, Outlet } from "react-router-dom";

// Hooks
import { useTheme } from "./hooks/useTheme.js";

// Components (eager — küçük, her zaman gerekli)
import Footer from "./components/Footer.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

// Pages (lazy — ilk yüklemede bundle'ı küçültür)
const Login = lazy(() => import("./pages/Login/Login.jsx"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard/AdminDashboard.jsx"));
const Dashboard = lazy(() => import("./pages/Dashboard/Dashboard.jsx"));
const AddApartment = lazy(() => import("./pages/AddApartment/AddApartment.jsx"));
const Apartments = lazy(() => import("./pages/Apartments/Apartments.jsx"));
const AddIncome = lazy(() => import("./pages/AddIncome/AddIncome.jsx"));
const AddExpense = lazy(() => import("./pages/AddExpense/AddExpense.jsx"));
const Transactions = lazy(() => import("./pages/Transactions/Transactions.jsx"));
const Profile = lazy(() => import("./pages/Profile/Profile.jsx"));
const Reports = lazy(() => import("./pages/Reports/Reports.jsx"));

function App() {
  useTheme();

  return (
    <div className="app-wrapper">
      <Router>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Login />} />

            {/* Admin rotaları */}
            <Route
              element={
                <ProtectedRoute requiredRole="admin">
                  <Outlet />
                </ProtectedRoute>
              }
            >
              <Route path="/admin-dashboard" element={<AdminDashboard />} />
            </Route>

            {/* Manager rotaları */}
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
              <Route path="/add-income" element={<AddIncome />} />
              <Route path="/add-expense" element={<AddExpense />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/reports" element={<Reports />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        <Footer />
      </Router>
    </div>
  );
}

export default App;
