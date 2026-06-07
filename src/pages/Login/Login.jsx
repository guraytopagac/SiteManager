import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Login.css";
import Swal from "sweetalert2";
import logoImg from "../../assets/logo.png";
import { useLoginLock } from "../../hooks/useLoginLock.js";

function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const { isLocked, remainingTime, handleFailedAttempt, resetLock } = useLoginLock(5, 5);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();

    if (isLocked) {
      Swal.fire({
        title: "Çok Fazla Hatalı Giriş!",
        text: `Lütfen ${remainingTime} sonra tekrar deneyin.`,
        icon: "error",
        heightAuto: false,
      });
      return;
    }

    const cleanUsername = username.trim();

    if (cleanUsername && password) {
      const { success, user, message } = await window.electronAPI.login({
        username: cleanUsername,
        password,
      });

      if (success) {
        resetLock();

        const { id, username: loggedInUsername, email, role, last_login } = user;
        sessionStorage.setItem(
          "currentUser",
          JSON.stringify({
            id,
            username: loggedInUsername,
            email,
            role,
            last_login,
          }),
        );

        Swal.fire({
          icon: "success",
          title: loggedInUsername + "\n\nHoş Geldiniz",
          text: message,
          timer: 2000,
          showConfirmButton: false,
          heightAuto: false,
        }).then(() => {
          navigate("/dashboard");
        });
      } else {
        handleFailedAttempt(message);
      }
    } else {
      Swal.fire("Uyarı", "Lütfen tüm alanları doldurun!", "warning");
    }
  };

  return (
    <div className="main-wrapper">
      <div className="loginContainer">
        <div className="logo-container">
          <img src={logoImg} alt="Mavikent Logo" className="app-logo" />
        </div>
        <h1 className="title">Mavikent Site Yönetimi</h1>
        <h2 className="subtitle">Hoşgeldiniz!</h2>

        <form className="loginForm" onSubmit={handleLoginSubmit}>
          <input
            type="text"
            placeholder="Kullanıcı adınızı girin"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={isLocked}
            required
          />
          <input
            type="password"
            placeholder="Şifrenizi girin"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLocked}
            required
          />
          <button
            type="submit"
            id="loginButton"
            disabled={isLocked}
          >
            {isLocked ? `Kilitlendi (${remainingTime})` : "Giriş Yap"}
          </button>
        </form>

        <p className="infoText">
          Bir hesabınız yok mu? <Link to="/register">Kayıt olun</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
