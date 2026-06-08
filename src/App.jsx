// Libraries
import { useState, useEffect } from "react";
import { HashRouter as Router, Routes, Route, Navigate } from "react-router-dom";

// Pages & Components
import Login from "./pages/Login/Login.jsx";
import Dashboard from "./pages/Dashboard/Dashboard.jsx";
import AdminDashboard from "./pages/AdminDashboard/AdminDashboard.jsx";
import AddApartment from "./pages/AddApartment/AddApartment.jsx";
import Apartments from "./pages/Apartments/Apartments.jsx";
import AddIncome from "./pages/AddIncome/AddIncome.jsx";
import AddExpense from "./pages/AddExpense/AddExpense.jsx";
import Transactions from "./pages/Transactions/Transactions.jsx";
import Profile from "./pages/Profile/Profile.jsx";
import Footer from "./components/Footer.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

// Global Styles
import "./style.css";

function App() {
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    const handleThemeToggle = () => {
      setTheme((prev) => (prev === "light" ? "dark" : "light"));
    };
    const removeListener = window.electronAPI.onToggleTheme(handleThemeToggle);
    return () => {
      removeListener();
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <div className="app-wrapper">
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route
            path="/admin-dashboard"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute requiredRole="manager">
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/add-apartment"
            element={
              <ProtectedRoute requiredRole="manager">
                <AddApartment />
              </ProtectedRoute>
            }
          />
          <Route
            path="/apartments"
            element={
              <ProtectedRoute requiredRole="manager">
                <Apartments />
              </ProtectedRoute>
            }
          />
          <Route
            path="/add-income"
            element={
              <ProtectedRoute requiredRole="manager">
                <AddIncome />
              </ProtectedRoute>
            }
          />
          <Route
            path="/add-expense"
            element={
              <ProtectedRoute requiredRole="manager">
                <AddExpense />
              </ProtectedRoute>
            }
          />
          <Route
            path="/transactions"
            element={
              <ProtectedRoute requiredRole="manager">
                <Transactions />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute requiredRole="manager">
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Footer />
      </Router>
    </div>
  );
}

export default App;
