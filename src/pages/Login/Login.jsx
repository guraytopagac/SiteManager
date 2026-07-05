import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import "./Login.css";
import logoImgWebp from "../../../assets/logo.webp";
import { showAlert, swalBase, getCssVar } from "@/utils/alert";
import { SESSION_USER_KEY } from "@/utils/constants";
import { FiUser, FiLock, FiEye, FiEyeOff, FiAlertCircle, FiArrowRight } from "react-icons/fi";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  // Prefilled with "admin" when arriving from the first-run setup screen.
  const [username, setUsername] = useState(location.state?.username ?? "");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleForgotPassword = async () => {
    const { value: formValues } = await Swal.fire({
      ...swalBase(),
      title: "Admin Şifre Sıfırlama",
      html: `
        <p style="font-size:0.9em;margin-bottom:1em">
          İlk kurulumda verilen kurtarma kodunu girin ve yeni bir şifre belirleyin.
        </p>
        <input id="swal-recovery" class="swal2-input" placeholder="Kurtarma kodu" autocomplete="off" />
        <input id="swal-newpass" type="password" class="swal2-input" placeholder="Yeni şifre (en az 8 karakter)" autocomplete="new-password" />
      `,
      focusConfirm: false,
      showCancelButton: true,
      reverseButtons: true,
      confirmButtonText: "Şifreyi Sıfırla",
      cancelButtonText: "Vazgeç",
      confirmButtonColor: getCssVar("--button-color"),
      cancelButtonColor: getCssVar("--text-secondary"),
      preConfirm: () => {
        const recoveryCode = document.getElementById("swal-recovery").value.trim();
        const newPassword = document.getElementById("swal-newpass").value;
        if (!recoveryCode) {
          Swal.showValidationMessage("Kurtarma kodu zorunludur.");
          return false;
        }
        if (!newPassword || newPassword.length < 8) {
          Swal.showValidationMessage("Yeni şifre en az 8 karakter olmalıdır.");
          return false;
        }
        return { recoveryCode, newPassword };
      },
    });

    if (!formValues) return;

    const res = await window.electronAPI.resetAdminPassword(formValues.recoveryCode, formValues.newPassword);
    if (res.success) {
      navigator.clipboard?.writeText(res.recoveryCode);
      await Swal.fire({
        ...swalBase(),
        icon: "success",
        title: "Şifre Sıfırlandı",
        html: `
          Admin şifreniz güncellendi.<br /><br />
          <b>Yeni kurtarma kodunuz</b> (panoya kopyalandı):<br />
          <code id="swal-recovery-code" style="font-size:1.1em;letter-spacing:1px"></code><br /><br />
          Bu kodu güvenli bir yerde saklayın — eski kod artık geçersizdir.
        `,
        didOpen: () => {
          document.getElementById("swal-recovery-code").textContent = res.recoveryCode;
        },
        confirmButtonText: "Anladım",
        confirmButtonColor: getCssVar("--button-color"),
      });
    } else {
      showAlert.error("Hata", res.message);
    }
  };

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

    if (success) {
      const { id, username: loggedInUsername, email, role, last_login } = user;
      sessionStorage.setItem(
        SESSION_USER_KEY,
        JSON.stringify({ id, username: loggedInUsername, email, role, last_login }),
      );
      window.dispatchEvent(new Event("user-session-changed"));
      showAlert.toast(loggedInUsername + " — Hoş Geldiniz", message);
      navigate(role === "admin" ? "/admin" : "/dashboard");
    } else {
      setIsSubmitting(false);
      setError(message);
      setPassword("");
    }
  };

  return (
    <div className="login-page-bg">
      <div className="login-container">
        <img src={logoImgWebp} alt="Mavikent Logo" />
        <h1 className="login-title">Mavikent Site Yönetimi</h1>
        <p className="login-subtitle">Hesabınıza giriş yapın</p>

        <form className="login-form" onSubmit={handleLoginSubmit}>
          <div className="login-input-wrapper">
            <FiUser className="login-icon" size={18} />
            <input
              className="login-input"
              type="text"
              placeholder="Kullanıcı adınızı girin"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError("");
              }}
              required
            />
          </div>
          <div className="login-password-wrapper">
            <FiLock className="login-icon" size={18} />
            <input
              className="login-password-input"
              type={showPassword ? "text" : "password"}
              placeholder="Şifrenizi girin"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              required
            />
            <button
              type="button"
              className="login-password-toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
            >
              {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
            </button>
          </div>

          {error && (
            <div className="login-error">
              <FiAlertCircle size={15} />
              {error}
            </div>
          )}

          <button type="submit" id="loginButton" className="login-btn" disabled={isSubmitting}>
            {isSubmitting ? (
              "Giriş yapılıyor..."
            ) : (
              <>
                Giriş Yap
                <FiArrowRight size={18} strokeWidth={2.5} />
              </>
            )}
          </button>

          <button type="button" className="login-forgot" onClick={handleForgotPassword}>
            Admin şifremi unuttum?
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
