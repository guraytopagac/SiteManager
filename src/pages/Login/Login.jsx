import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";
import Swal from "sweetalert2";
import logoImg from "../../assets/logo.png";
import { alert } from "../../utils/alert";

function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();

    const cleanUsername = username.trim();

    if (!cleanUsername || !password) {
      alert.warning("Uyarı", "Lütfen tüm alanları doldurun!");
      return;
    }

    setIsSubmitting(true);
    const { success, user, message } = await window.electronAPI.login({
      username: cleanUsername,
      password,
    });
    setIsSubmitting(false);

    if (success) {
      const { id, username: loggedInUsername, email, role, last_login } = user;
      sessionStorage.setItem(
        "currentUser",
        JSON.stringify({ id, username: loggedInUsername, email, role, last_login }),
      );
      Swal.fire({
        icon: "success",
        title: loggedInUsername + "\n\nHoş Geldiniz",
        text: message,
        timer: 2000,
        showConfirmButton: false,
        heightAuto: false,
      }).then(() => {
        if (role === "admin") {
          navigate("/admin-dashboard");
        } else {
          navigate("/dashboard");
        }
      });
    } else {
      alert.error("Giriş Başarısız", message);
    }
  };

  return (
    <div className="loginContainer">
      <img src={logoImg} alt="Mavikent Logo" />
      <h1 className="title">Mavikent Site Yönetimi</h1>
      <h2 className="subtitle">Hoşgeldiniz!</h2>
      <form className="loginForm" onSubmit={handleLoginSubmit}>
        <input
          type="text"
          placeholder="Kullanıcı adınızı girin"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Şifrenizi girin"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" id="loginButton" disabled={isSubmitting}>
          {isSubmitting ? "Giriş yapılıyor..." : "Giriş Yap"}
        </button>
      </form>
    </div>
  );
}

export default Login;
