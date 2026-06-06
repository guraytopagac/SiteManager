// Libraries
import { useState, useEffect } from "react";
import { HashRouter as Router, Routes, Route, Navigate } from "react-router-dom";

// Pages & Components
import Login from "./pages/Login/Login.jsx";
import Register from "./pages/Register/Register.jsx";
import Dashboard from "./pages/Dashboard/Dashboard.jsx";
import AddApartment from "./pages/AddApartment/AddApartment.jsx";
import Apartments from "./pages/Apartments/Apartments.jsx";
import AddIncome from "./pages/AddIncome/AddIncome.jsx";
import AddExpense from "./pages/AddExpense/AddExpense.jsx";
import Footer from "./components/Footer.jsx";

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
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/add-apartment" element={<AddApartment />} />
          <Route path="/apartments" element={<Apartments />} />
          <Route path="/add-income" element={<AddIncome />} />
          <Route path="/add-expense" element={<AddExpense />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Footer />
      </Router>
    </div>
  );
}

export default App;
