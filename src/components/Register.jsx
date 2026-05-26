// Libraries
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

// Part 1: Define the Register component with state management for user registration fields
function Register() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        let unsubscribe;

        if (window.electronAPI && window.electronAPI.onRegisterResponse) {
            unsubscribe = window.electronAPI.onRegisterResponse((response) => {
                if (response.success) {
                    navigate('/');
                }
            });
        }

        return () => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        };
    }, [navigate]);

    const handleRegisterSubmit = (e) => {
        e.preventDefault();

        if (username && email && password) {
            if (window.electronAPI && window.electronAPI.register) {
                window.electronAPI.register({ username, email, password });
            } else {
                console.error("Electron API (preload) tespit edilemedi!");
            }
        }
    };

    return (
        <div className="register-container">
            <h1 className="title">Mavikent Site Yönetimi</h1>
            <h2 className="subtitle">Yeni Hesap Oluştur</h2>

            <form className="register-form" onSubmit={handleRegisterSubmit}>
                <input
                    type="text"
                    id="userName"
                    placeholder="Kullanıcı adı belirleyin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                />
                <input
                    type="email"
                    id="userEmail"
                    placeholder="E-posta adresinizi girin"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
                <input
                    type="password"
                    id="userPassword"
                    placeholder="Şifre belirleyin"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
                <button type="submit" id="registerButton">Kayıt Ol</button>
            </form>

            <p className="footer">
                Zaten bir hesabınız var mı?{' '}
                <Link to="/">Giriş yapın</Link>
            </p>
        </div>
    );
}

// Part 2: Export the Register component as the default export
export default Register;