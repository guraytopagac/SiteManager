import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Register.css";
import Swal from "sweetalert2";
import logoImg from "../../assets/logo.png";

function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const navigate = useNavigate();

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();

    const cleanUsername = username.trim();
    const cleanEmail = email.trim();

    if (!cleanUsername || !cleanEmail || !password || !confirmPassword) {
      Swal.fire({
        icon: "warning",
        title: "Eksik Alan",
        text: "Lütfen tüm alanları doldurun!",
        confirmButtonColor: "#f59e0b",
        heightAuto: false,
      });
      return;
    }

    if (password !== confirmPassword) {
      Swal.fire({
        icon: "error",
        title: "Şifreler Eşleşmiyor",
        text: "Girdiğiniz şifreler birbiriyle uyuşmuyor!",
        confirmButtonColor: "#dc2626",
        heightAuto: false,
      });
      return;
    }

    if (password.length < 6) {
      Swal.fire({
        icon: "warning",
        title: "Zayıf Şifre",
        text: "Şifre en az 6 karakterden oluşmalıdır!",
        confirmButtonColor: "#f59e0b",
        heightAuto: false,
      });
      return;
    }

    const response = await window.electronAPI.register({
      username: cleanUsername,
      email: cleanEmail,
      password,
    });

    if (response.success) {
      Swal.fire({
        icon: "success",
        title: "Kayıt Başarılı!",
        text: response.message || "Hesabınız başarıyla oluşturuldu.",
        timer: 2500,
        timerProgressBar: true,
        showConfirmButton: false,
        allowOutsideClick: false,
        heightAuto: false,
        showClass: {
          popup: "animate__animated animate__fadeInDown",
        },
      }).then(() => {
        navigate("/");
      });
    } else {
      Swal.fire({
        icon: "error",
        title: "Kayıt Başarısız",
        text: response.message || "Bir hata oluştu.",
        confirmButtonText: "Tamam",
        confirmButtonColor: "#dc2626",
        heightAuto: false,
      });
    }
  };

  return (
    <div className="registerContainer">
      <div className="logo-container">
        <img src={logoImg} alt="Mavikent Logo" className="app-logo" />
      </div>
      <h1 className="title">Mavikent Site Yönetimi</h1>
      <h2 className="subtitle">Yeni Hesap Oluştur</h2>

      <form className="registerForm" onSubmit={handleRegisterSubmit}>
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
        <input
          type="password"
          id="userConfirmPassword"
          placeholder="Şifrenizi tekrar girin"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />

        <button type="submit" id="registerButton">
          Kayıt Ol
        </button>
      </form>

      <p className="infoText">
        Zaten bir hesabınız var mı? <Link to="/">Giriş yapın</Link>
      </p>
    </div>
  );
}

export default Register;
