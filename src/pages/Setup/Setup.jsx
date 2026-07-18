import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Setup.css";
import { showAlert } from "@/utils/alert";
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
  FiMinus,
  FiX,
} from "react-icons/fi";

const COMMON_WORDS = [
  "sifre",
  "şifre",
  "parola",
  "deneme",
  "kullanici",
  "kullanıcı",
  "password",
  "admin",
  "mavikent",
  "yonetim",
  "yönetim",
  "yonetici",
  "yönetici",
  "apartman",
  "galatasaray",
  "fenerbahce",
  "fenerbahçe",
  "besiktas",
  "beşiktaş",
  "trabzonspor",
  "cimbom",
  "istanbul",
  "ankara",
  "izmir",
  "antalya",
  "trabzon",
  "turkiye",
  "türkiye",
  "mehmet",
  "mustafa",
  "ahmet",
  "huseyin",
  "hüseyin",
  "ibrahim",
  "zeynep",
  "murat",
  "qwerty",
  "asdf",
  "iloveyou",
  "letmein",
];

const SEQUENCES = ["abcdefghijklmnopqrstuvwxyz", "0123456789", "qwertyuiop", "asdfghjkl", "zxcvbnm"];

const YEAR_PATTERN = /(19|20)\d{2}/g;

const MIN_PASSWORD_LENGTH = 8;

const STRENGTH = [
  { label: "Şifre gücü", variant: "neutral" },
  { label: "Çok Zayıf", variant: "veryweak" },
  { label: "Zayıf", variant: "weak" },
  { label: "Orta", variant: "fair" },
  { label: "İyi", variant: "good" },
  { label: "Güçlü", variant: "strong" },
];

function collapseRepeats(password) {
  return password.replace(/(.)\1{4,}/gu, "$1$1");
}

function longestSequenceLength(password) {
  const lower = password.toLowerCase();
  let longest = 0;
  for (const sequence of SEQUENCES) {
    let streak = 1;
    let direction = 0;
    for (let i = 1; i < lower.length; i++) {
      const previous = sequence.indexOf(lower[i - 1]);
      const current = sequence.indexOf(lower[i]);
      const step = previous === -1 || current === -1 ? 0 : current - previous;
      if (step !== 1 && step !== -1) {
        streak = 1;
        direction = 0;
      } else if (step === direction) {
        streak++;
      } else {
        streak = 2;
        direction = step;
      }
      if (streak >= 4) longest = Math.max(longest, streak);
    }
  }
  return longest;
}

function findCommonWords(password) {
  const letters = password.toLowerCase().replace(/[^a-zçğıöşü]/g, "");
  const hits = [];
  for (const word of COMMON_WORDS) {
    const occurrences = letters.split(word).length - 1;
    if (occurrences > 0) hits.push({ word, occurrences });
  }
  return hits;
}

function periodLength(password) {
  for (let period = 1; period <= password.length / 2; period++) {
    let isPeriodic = true;
    for (let i = period; i < password.length; i++) {
      if (password[i] !== password[i - period]) {
        isPeriodic = false;
        break;
      }
    }
    if (isPeriodic) return period;
  }
  return password.length;
}

function scorePassword(password) {
  if (!password) return { score: 0, isPredictable: false, isPatterned: false };

  let pool = 0;
  if (/[a-zçğıöşü]/.test(password)) pool += 29;
  if (/[A-ZÇĞİÖŞÜ]/.test(password)) pool += 29;
  if (/\d/.test(password)) pool += 10;
  if (/[^A-Za-z0-9çğıöşüÇĞİÖŞÜ]/.test(password)) pool += 32;

  const collapsed = collapseRepeats(password);
  const period = periodLength(password);
  const isPeriodic = period < password.length;
  let effectiveLength = isPeriodic ? Math.min(period + 1, collapsed.length) : collapsed.length;

  const words = findCommonWords(password);
  for (const { word, occurrences } of words) {
    effectiveLength -= word.length * occurrences;
  }
  const years = password.match(YEAR_PATTERN)?.length ?? 0;
  effectiveLength -= 3 * years;

  const sequenceLength = longestSequenceLength(password);
  if (sequenceLength > 0) effectiveLength -= sequenceLength - 1;

  const bits = Math.max(effectiveLength, 1) * Math.log2(pool || 1);
  const score = bits < 30 ? 1 : bits < 45 ? 2 : bits < 60 ? 3 : bits < 75 ? 4 : 5;

  return {
    score,
    isPredictable: words.length > 0 || years > 0,
    isPatterned: isPeriodic || sequenceLength > 0 || collapsed.length < password.length,
  };
}

function Setup() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const strength = scorePassword(password);
  const hasMinLength = password.length >= MIN_PASSWORD_LENGTH;
  const meter = {
    variant: STRENGTH[strength.score].variant,
    label:
      password.length > 0 && !hasMinLength
        ? `${MIN_PASSWORD_LENGTH - password.length} karakter daha gerekli`
        : STRENGTH[strength.score].label,
  };
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const isPasswordEmpty = password.length === 0;
  const rules = [
    {
      id: "length",
      label: `${MIN_PASSWORD_LENGTH}+ karakter`,
      isMet: hasMinLength,
      isPending: isPasswordEmpty,
    },
    {
      id: "match",
      label: "Şifreler eşleşiyor",
      isMet: passwordsMatch,
      isPending: confirmPassword.length === 0,
    },
    {
      id: "predictable",
      label: "Tahmin edilebilir bilgi yok",
      isMet: !isPasswordEmpty && !strength.isPredictable,
      isPending: isPasswordEmpty,
    },
    {
      id: "pattern",
      label: "Tekrar eden kalıp yok",
      isMet: !isPasswordEmpty && !strength.isPatterned,
      isPending: isPasswordEmpty,
    },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!hasMinLength) {
      setError(`Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalıdır.`);
      return;
    }
    if (password !== confirmPassword) {
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

    await showAlert.setupCode(res.recoveryCode);

    showAlert.toast("Kurulum tamamlandı", "Artık giriş yapabilirsiniz.");
    navigate("/login", { replace: true, state: { username: "admin" } });
  };

  return (
    <div className="setup-page-bg">
      <div className="setup-card">
        <aside className="setup-welcome">
          <h1 className="setup-welcome-title">İlk Kurulum</h1>
          <p className="setup-welcome-lead">Hoş Geldiniz</p>

          <div className="setup-notice">
            <FiInfo className="setup-notice-icon" size={20} />
            <div>
              <p className="setup-notice-title">Güvenlik Notu</p>
              <p className="setup-notice-text">
                Bu oluşturulacak hesap uygulamadaki tüm yetkilere sahiptir, bu yüzden şifresini kimseyle paylaşmayınız.
                Kurulum sonrası size bir kurtarma kodu verilecektir. Şifrenizi unutursanız yeni şifreyi yalnızca bu
                kodla belirleyebilirsiniz. Bu nedenle kodu güvenli bir yerde saklayın.
              </p>
            </div>
          </div>

          <p className="setup-adv-label">Uygulama Avantajları</p>
          <ul className="setup-steps">
            <li>
              <FiCheckCircle className="setup-step-icon" />
              <span>Aidat, gelir ve giderleri tek ekrandan yönetin</span>
            </li>
            <li>
              <FiCheckCircle className="setup-step-icon" />
              <span>Detaylı PDF raporlarını anında oluşturun</span>
            </li>
            <li>
              <FiCheckCircle className="setup-step-icon" />
              <span>Verileriniz yalnızca sizin bilgisayarınızda kalsın</span>
            </li>
            <li>
              <FiCheckCircle className="setup-step-icon" />
              <span>Yardıma ihtiyacınız olduğunda e-posta ile ulaşın</span>
            </li>
          </ul>
        </aside>

        <section className="setup-form-panel">
          <h2 className="setup-form-title">Yönetici şifrenizi belirleyin</h2>
          <p className="setup-form-sub">Aşağıdaki kullanıcı adı ve şifre ile giriş yapacaksınız.</p>

          <form className="setup-form" onSubmit={handleSubmit}>
            <div className="setup-input-wrapper">
              <FiUser className="setup-icon" size={18} />
              <input
                className="setup-input setup-input-locked"
                type="text"
                value="admin"
                readOnly
                tabIndex={-1}
                aria-label="Kullanıcı adı (sabit)"
                title="Kullanıcı adı değiştirilemez"
              />
              <span className="setup-lock">
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
                onClick={() => setShowPassword((isVisible) => !isVisible)}
                aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
              >
                {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </button>
            </div>

            <div className={`setup-strength ${meter.variant}`}>
              <div className="setup-strength-segments">
                {[1, 2, 3, 4, 5].map((segment) => (
                  <span key={segment} className={segment <= strength.score ? "on" : ""} />
                ))}
              </div>
              <span className="setup-strength-label">{meter.label}</span>
            </div>

            <div className="setup-input-wrapper">
              <FiLock className="setup-icon" size={18} />
              <input
                className="setup-input"
                type="password"
                placeholder="Şifreyi tekrar girin"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError("");
                }}
                required
              />
            </div>

            <ul className="setup-rules">
              {rules.map((rule) => {
                const state = rule.isMet ? "valid" : rule.isPending ? "pending" : "failed";
                const RuleIcon = { valid: FiCheck, pending: FiMinus, failed: FiX }[state];
                return (
                  <li key={rule.id} className={`setup-rule-${state}`}>
                    <RuleIcon className="setup-rule-icon" size={13} />
                    {rule.label}
                  </li>
                );
              })}
            </ul>

            {error && (
              <div className="setup-error">
                <FiAlertCircle className="setup-error-icon" size={15} />
                {error}
              </div>
            )}

            <button type="submit" className="setup-btn" disabled={isSubmitting}>
              {isSubmitting ? (
                "Hesap oluşturuluyor..."
              ) : (
                <>
                  Hesabı Oluştur
                  <FiArrowRight className="setup-btn-arrow" size={18} strokeWidth={2.5} />
                </>
              )}
            </button>
          </form>

          <div className="setup-form-foot">
            <p>
              <FiLock className="setup-foot-icon" size={13} />
              İpucu: Uzun bir şifre, kısa ve karmaşık olandan daha güvenlidir.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Setup;
