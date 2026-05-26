// Libraries
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

// Part 1: Define the Login component with state management for username and password, and handle login responses from the main process
function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let unsubscribe;

    if (window.electronAPI && window.electronAPI.onLoginResponse) {
      unsubscribe = window.electronAPI.onLoginResponse((response) => {
        if (response.success) {
          navigate('/dashboard');
        } else {
          setPassword('');
        }
      });
    }

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [navigate]);

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (username && password) {
      if (window.electronAPI && window.electronAPI.login) {
        window.electronAPI.login({ username, password });
      } else {
        console.error("Electron API (preload) tespit edilemedi!");
      }
    }
  };

  return (
    <div className="login-container">
      <h1 className="title">Mavikent Site Yönetimi</h1>
      <h2 className="subtitle">Hoşgeldiniz!</h2>

      <form className="login-form" onSubmit={handleLoginSubmit}>
        <input
          type="text"
          id="userName"
          placeholder="Kullanıcı adınızı girin"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          type="password"
          id="userPassword"
          placeholder="Şifrenizi girin"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" id="loginButton"> Giriş Yap </button>
      </form>

      <p className="footer">
        Bir hesabınız yok mu?{' '}
        <Link to="/register">Kayıt olun</Link>
      </p>
    </div>
  );
}

// Part 2: Export the Login component as the default export
export default Login;