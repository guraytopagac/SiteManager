import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";
import logoImgWebp from "../../assets/images/logo.webp";
import logoImgPng from "../../assets/images/logo.png";
import { alert } from "../../utils/alert";
import { SESSION_USER_KEY } from "../../utils/constants";

function formatBytes(bytes) {
  if (!bytes) return "0 MB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [update, setUpdate] = useState(null);

  useEffect(() => {
    const unsub = window.electronAPI.onPrefillLogin((_e, { username, password }) => {
      setUsername(username);
      setPassword(password);
    });
    const unsubAvailable = window.electronAPI.onUpdateAvailable((_e, { version }) => {
      setUpdate({ version, percent: 0, transferred: 0, total: 0, downloaded: false });
    });
    const unsubProgress = window.electronAPI.onDownloadProgress((_e, { percent, transferred, total }) => {
      setUpdate((prev) => prev && { ...prev, percent, transferred, total });
    });
    const unsubDownloaded = window.electronAPI.onUpdateDownloaded(() => {
      setUpdate((prev) => prev && { ...prev, downloaded: true });
    });
    return () => {
      unsub();
      unsubAvailable();
      unsubProgress();
      unsubDownloaded();
    };
  }, []);

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
        SESSION_USER_KEY,
        JSON.stringify({ id, username: loggedInUsername, email, role, last_login }),
      );
      window.dispatchEvent(new Event("user-session-changed"));
      await alert.success(loggedInUsername + " — Hoş Geldiniz", message);
      navigate(role === "admin" ? "/admin-dashboard" : "/dashboard");
    } else {
      alert.error("Giriş Başarısız", message);
      setPassword("");
    }
  };

  return (
    <div className="loginContainer">
      <picture>
        <source srcSet={logoImgWebp} type="image/webp" />
        <img src={logoImgPng} alt="Mavikent Logo" />
      </picture>
      <h1 className="title">Mavikent Site Yönetimi</h1>

      {update ? (
        <div className="updateOverlay">
          {update.downloaded ? (
            <>
              <div className="updateIcon updateIconReady">&#10003;</div>
              <p className="updateTitle">Güncelleme Hazır</p>
              <p className="updateSub">Yeniden başlatma bekleniyor...</p>
            </>
          ) : (
            <>
              <div className="updateIcon">&#8659;</div>
              <p className="updateTitle">Güncelleme İndiriliyor</p>
              <p className="updateSub">v{update.version} hazırlanıyor...</p>
              <div className="updateProgressBar">
                <div className="updateProgressFill" style={{ width: `${update.percent}%` }} />
              </div>
              <p className="updateProgressText">
                %{update.percent}
                {update.total > 0 && ` — ${formatBytes(update.transferred)} / ${formatBytes(update.total)}`}
              </p>
              <p className="updateNote">İndirme tamamlandığında yeniden başlatma isteyecek.</p>
            </>
          )}
        </div>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}

export default Login;
