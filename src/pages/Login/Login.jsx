import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";
import logoImgWebp from "../../assets/images/logo.webp";
import logoImgPng from "../../assets/images/logo.png";
import { showAlert } from "../../utils/alert";
import { SESSION_USER_KEY } from "../../utils/constants";

function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubPrefillLogin = window.electronAPI.onPrefillLogin(({ username, password }) => {
      setUsername(username);
      setPassword(password);
    });
    return () => {
      unsubPrefillLogin();
    };
  }, []);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();

    const cleanUsername = username.trim();

    if (!cleanUsername || !password) {
      setError("Lütfen tüm alanları doldurun.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    const { success, user, message } = await window.electronAPI.login({
      username: cleanUsername,
      password,
    });
    setIsSubmitting(false);

    if (success) {
      const { id, username: loggedInUsername, email, role, last_login } = user;
      sessionStorage.setItem(
        SESSION_USER_KEY,
        JSON.stringify({ id, username: loggedInUsername, email, role, last_login }),
      );
      window.dispatchEvent(new Event("user-session-changed"));
      await showAlert.success(loggedInUsername + " — Hoş Geldiniz", message);
      navigate(role === "admin" ? "/admin" : "/dashboard");
    } else {
      setError(message);
      setPassword("");
    }
  };

  return (
    <div className="login-container">
      <picture>
        <source srcSet={logoImgWebp} type="image/webp" />
        <img src={logoImgPng} alt="Mavikent Logo" />
      </picture>
      <h1 className="title">Mavikent Site Yönetimi</h1>
      <p className="subtitle">Hesabınıza giriş yapın</p>

      <form className="login-form" onSubmit={handleLoginSubmit}>
        <div className="input-wrapper">
          <svg
            className="input-icon"
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <input
            className="has-icon"
            type="text"
            placeholder="Kullanıcı adınızı girin"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setError("");
            }}
            required
          />
        </div>
        <div className="password-wrapper">
          <svg
            className="input-icon"
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <input
            className="password-input has-icon"
            type={showPassword ? "text" : "password"}
            placeholder="Şifrenizi girin"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            required
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowPassword((v) => !v)}
            tabIndex={-1}
            aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
          >
            {showPassword ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>

        {error && (
          <div className="login-error">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        <button type="submit" id="loginButton" className="login-btn" disabled={isSubmitting}>
          {isSubmitting ? (
            "Giriş yapılıyor..."
          ) : (
            <>
              Giriş Yap
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </>
          )}
        </button>
      </form>
    </div>
  );
}

export default Login;
