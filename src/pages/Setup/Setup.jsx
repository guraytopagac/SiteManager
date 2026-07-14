import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import "./Setup.css";
import { showAlert, swalBase, getCssVar } from "@/utils/alert";
import {
  FiCheck,
  FiEye,
  FiEyeOff,
  FiLock,
  FiCheckCircle,
  FiUser,
  FiAlertCircle,
  FiInfo,
  FiArrowRight,
} from "react-icons/fi";

function scorePassword(pw) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  // Empty field stays "Nötr"; any input scores at least "Zayıf".
  if (pw.length === 0) return 0;
  return Math.min(Math.max(score, 1), 4);
}

const STRENGTH = [
  { label: "—", cls: "neutral" },
  { label: "Zayıf", cls: "weak" },
  { label: "Orta", cls: "fair" },
  { label: "İyi", cls: "good" },
  { label: "Güçlü", cls: "strong" },
];

function Setup() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const strength = useMemo(() => scorePassword(password), [password]);
  const hasMinLength = password.length >= 8;
  const passwordsMatch = confirm.length > 0 && password === confirm;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!hasMinLength) {
      setError("Şifre en az 8 karakter olmalıdır.");
      return;
    }
    if (password !== confirm) {
      setError("Şifreler eşleşmiyor.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    const res = await window.electronAPI.completeAdminSetup(password);

    if (!res.success) {
      setIsSubmitting(false);
      setError(res.message);
      return;
    }

    navigator.clipboard?.writeText(res.recoveryCode);
    await Swal.fire({
      ...swalBase(),
      icon: "success",
      title: "Hesabınız Hazır",
      html: `
        Admin şifreniz belirlendi.<br /><br />
        <b>Kurtarma kodunuz</b> (panoya kopyalandı):<br />
        <code id="swal-recovery-code" style="font-size:1.1em;letter-spacing:1px"></code><br /><br />
        Şifrenizi unutursanız giriş ekranından bu kodla sıfırlayabilirsiniz.<br />
        Güvenli bir yerde saklayın — bir daha gösterilmeyecek.
      `,
      didOpen: () => {
        document.getElementById("swal-recovery-code").textContent = res.recoveryCode;
      },
      confirmButtonText: "Kaydettim, Devam Et",
      confirmButtonColor: getCssVar("--button-color"),
      allowOutsideClick: false,
      // Keep the popup's own pop animation (cheap), but don't fade the backdrop:
      // the setup screen has two blur(20px) panels behind the modal and HW
      // acceleration is disabled, so fading the backdrop forces a per-frame
      // recomposite of those panels (the jank). Static backdrop = smooth pop.
      showClass: { popup: "swal2-show", backdrop: "" },
      hideClass: { popup: "swal2-hide", backdrop: "" },
    });

    showAlert.toast("Kurulum tamamlandı", "Artık giriş yapabilirsiniz.");
    navigate("/login", { replace: true, state: { username: "admin" } });
  };

  return (
    <div className="setup-page-bg">
      <div className="setup-card">
        {/* ── Welcome / branding panel ── */}
        <aside className="setup-welcome">
          <h1 className="setup-welcome-title">İlk Kurulum</h1>
          <p className="setup-welcome-lead">Hoş Geldiniz</p>

          <div className="setup-notice">
            <FiInfo className="setup-notice-icon" size={20} />
            <div>
              <p className="setup-notice-title">Güvenlik Notu</p>
              <p className="setup-notice-text">
                Bu hesap uygulamadaki tüm yetkilere sahiptir, bu yüzden şifresini kimseyle paylaşmayın. Kurulum sonrası
                size bir kurtarma kodu verilecektir. Şifrenizi unutursanız yeni bir şifreyi yalnızca bu kodla
                belirleyebilirsiniz. Bu nedenle kodu güvenli bir yerde saklayın.
              </p>
            </div>
          </div>

          <p className="setup-adv-label">Uygulama Avantajları</p>
          <ul className="setup-steps">
            <li>
              <FiCheckCircle />
              <span>Aidat, gelir ve giderleri tek ekrandan yönetin</span>
            </li>
            <li>
              <FiCheckCircle />
              <span>Detaylı PDF raporları anında oluşturun</span>
            </li>
            <li>
              <FiCheckCircle />
              <span>Verileriniz yalnızca sizin bilgisayarınızda kalsın</span>
            </li>
            <li>
              <FiCheckCircle />
              <span>Yardıma ihtiyacınız olduğunda e-posta ile ulaşın</span>
            </li>
          </ul>
        </aside>

        {/* ── Form panel ── */}
        <section className="setup-form-panel">
          <h2 className="setup-form-title">Yönetici şifrenizi belirleyin</h2>
          <p className="setup-form-sub">Aşağıdaki kullanıcı adıyla giriş yapacaksınız.</p>

          <form className="setup-form" onSubmit={handleSubmit}>
            <div className="setup-input-wrapper">
              <FiUser className="setup-icon" size={18} />
              <input
                className="setup-input has-toggle setup-input-locked"
                type="text"
                value="admin"
                readOnly
                tabIndex={-1}
                aria-label="Kullanıcı adı (sabit)"
              />
              <span className="setup-lock" title="Kullanıcı adı değiştirilemez">
                <FiLock size={16} />
              </span>
            </div>

            <div className="setup-input-wrapper">
              <FiLock className="setup-icon" size={18} />
              <input
                className="setup-input has-toggle"
                type={showPassword ? "text" : "password"}
                placeholder="Yeni şifre"
                autoComplete="new-password"
                autoFocus
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                required
              />
              <button
                type="button"
                className="setup-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
              >
                {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </button>
            </div>

            <div className={`setup-strength ${STRENGTH[strength].cls}`}>
              <div className="setup-strength-segments">
                {[1, 2, 3, 4].map((i) => (
                  <span key={i} className={i <= strength ? "on" : ""} />
                ))}
              </div>
              <span className="setup-strength-label">{STRENGTH[strength].label}</span>
            </div>

            <div className="setup-input-wrapper">
              <FiLock className="setup-icon" size={18} />
              <input
                className="setup-input"
                type={showPassword ? "text" : "password"}
                placeholder="Şifreyi tekrar girin"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  setError("");
                }}
                required
              />
            </div>

            <ul className="setup-rules">
              <li className={hasMinLength ? "ok" : ""}>
                <FiCheck size={13} /> 8+ karakter
              </li>
              <li className={passwordsMatch ? "ok" : ""}>
                <FiCheck size={13} /> Eşleşiyor
              </li>
            </ul>

            {error && (
              <div className="setup-error">
                <FiAlertCircle size={15} />
                {error}
              </div>
            )}

            <button type="submit" className="setup-btn" disabled={isSubmitting}>
              {isSubmitting ? (
                "Hesap oluşturuluyor..."
              ) : (
                <>
                  Hesabı Oluştur
                  <FiArrowRight size={18} strokeWidth={2.5} />
                </>
              )}
            </button>
          </form>

          <div className="setup-form-foot">
            <p>
              <FiLock size={13} />
              İpucu: Büyük/küçük harf, rakam ve sembol karışımı şifrenizi güçlendirir.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Setup;
