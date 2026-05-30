// Libraries
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import "./Login.css";
import Swal from 'sweetalert2';

function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLoginSubmit = async (e) => {
    e.preventDefault();

    if (username && password) {
      const response = await window.electronAPI.login({ username, password });

      if (response.success) {
        navigate("/dashboard");
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Giriş Başarısız',
          text: response.message,
          confirmButtonText: 'Tamam',
          confirmButtonColor: '#3b82f6',
          background: '#ffffff',
          allowOutsideClick: false,
          heightAuto: false
        })
      }
    } else {
      Swal.fire('Uyarı', 'Lütfen tüm alanları doldurun!', 'warning');
    }
  };

  return (
    <div className="main-wrapper">
      <div className="loginContainer">
        <h1 className="title">Mavikent Site Yönetimi</h1>
        <h2 className="subtitle">Hoşgeldiniz!</h2>

        <form className="loginForm" onSubmit={handleLoginSubmit}>
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

        <p className="infoText">
          Bir hesabınız yok mu?{' '}
          <Link to="/register">Kayıt olun</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;