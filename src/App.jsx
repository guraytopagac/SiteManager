// Libraries
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'; // <-- BrowserRouter yerine HashRouter yapıldı!
import Login from './components/Login.jsx';
import Register from './components/Register.jsx';
import './style.css';

// Part 1: Define the main App component that manages theme state and sets up routing for Login and Register components
function App() {
    const [theme, setTheme] = useState('dark');

    useEffect(() => {
        let unsubscribe;
        document.documentElement.setAttribute('data-theme', 'dark');

        if (window.electronAPI && window.electronAPI.onThemeChange) {
            unsubscribe = window.electronAPI.onThemeChange((selectedTheme) => {
                setTheme(selectedTheme);
                document.documentElement.setAttribute('data-theme', selectedTheme);
            });
        }

        return () => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        };
    }, []);

    return (
        <Router>
            <Routes>
                <Route path="/" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Router>
    );
}

// Part 2: Export the App component as the default export
export default App;