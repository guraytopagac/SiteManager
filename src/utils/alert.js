import Swal from "sweetalert2";

const theme = () => {
  const styles = getComputedStyle(document.documentElement);
  const cssVar = (name) => styles.getPropertyValue(name).trim();
  return {
    background: cssVar("--card-background-1"),
    text: cssVar("--text-color"),
    confirm: cssVar("--button-color"),
    cancel: cssVar("--text-secondary"),
    danger: cssVar("--danger"),
  };
};

const base = (t) => ({
  heightAuto: false,
  background: t.background,
  color: t.text,
});

const fire = (build) => Swal.fire(build(theme()));

const ESCAPE_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);

const STATIC_BACKDROP = {
  showClass: { popup: "swal2-show", backdrop: "" },
  hideClass: { popup: "swal2-hide", backdrop: "" },
};

const bodyOf = (body) => {
  if (!body) return {};
  if (typeof body === "string") return { text: body };
  if ("html" in body) return { html: body.html };
  if ("text" in body) return { text: body.text };
  return {};
};

const dismissDialog = (title, body, icon) =>
  fire((t) => ({
    ...base(t),
    ...bodyOf(body),
    icon,
    title,
    confirmButtonText: "Tamam",
    confirmButtonColor: t.confirm,
  }));

const confirmDialog = (title, body, confirmText, { cancelText = "Vazgeç", pickConfirmColor }) =>
  fire((t) => ({
    ...base(t),
    ...bodyOf(body),
    title,
    icon: "warning",
    showCancelButton: true,
    reverseButtons: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    confirmButtonColor: pickConfirmColor(t),
    cancelButtonColor: t.cancel,
  }));

const CODE_ELEMENT_ID = "swal-recovery-code";
const COPY_NOTE_ELEMENT_ID = "swal-copy-note";

const CODE_LINE = `<code id="${CODE_ELEMENT_ID}" style="font-size:1.1em;letter-spacing:1px"></code>`;
const COPY_NOTE_LINE = `<div id="${COPY_NOTE_ELEMENT_ID}" style="font-size:0.9em;margin-top:0.6em"></div>`;

const copyToClipboard = async (value) => {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
};

const codeDialog = async ({ title, code, html, confirmButtonText, staticBackdrop = false }) => {
  const copied = await copyToClipboard(code);
  return fire((t) => ({
    ...base(t),
    ...(staticBackdrop ? { ...STATIC_BACKDROP, allowOutsideClick: false } : {}),
    icon: "success",
    title,
    html,
    didOpen: () => {
      const codeEl = document.getElementById(CODE_ELEMENT_ID);
      if (codeEl) codeEl.textContent = code;

      const noteEl = document.getElementById(COPY_NOTE_ELEMENT_ID);
      if (noteEl) {
        noteEl.textContent = copied
          ? "Kod panoya kopyalandı."
          : "Kod panoya kopyalanamadı — lütfen yukarıdaki kodu elle kopyalayın.";
        noteEl.style.color = copied ? t.text : t.danger;
      }
    },
    confirmButtonText,
    confirmButtonColor: t.confirm,
  }));
};

const fieldElementId = (id) => `swal-field-${id}`;

const fieldHtml = ({ id, type = "text", placeholder = "", autocomplete = "off" }) =>
  `<input id="${fieldElementId(id)}" type="${escapeHtml(type)}" class="swal2-input" placeholder="${escapeHtml(
    placeholder,
  )}" autocomplete="${escapeHtml(autocomplete)}" />`;

const formDialog = async ({ title, description, fields, confirmButtonText, cancelText = "Vazgeç", validate }) => {
  const { value } = await fire((t) => ({
    ...base(t),
    title,
    html: [
      description && `<p style="font-size:0.9em;margin-bottom:1em">${escapeHtml(description)}</p>`,
      ...fields.map(fieldHtml),
    ]
      .filter(Boolean)
      .join("\n"),
    focusConfirm: false,
    showCancelButton: true,
    reverseButtons: true,
    confirmButtonText,
    cancelButtonText: cancelText,
    confirmButtonColor: t.confirm,
    cancelButtonColor: t.cancel,
    preConfirm: () => {
      const entries = fields.map(({ id, trim = false }) => {
        const el = document.getElementById(fieldElementId(id));
        return [id, el && (trim ? el.value.trim() : el.value)];
      });

      if (entries.some(([, val]) => val === null || val === undefined || val === false)) {
        Swal.showValidationMessage("Form yüklenemedi, lütfen tekrar deneyin.");
        return false;
      }

      const values = Object.fromEntries(entries);
      const message = validate?.(values);
      if (message) {
        Swal.showValidationMessage(message);
        return false;
      }
      return values;
    },
  }));
  return value ?? null;
};

export const showAlert = {
  toast: (title, text, { icon = "success" } = {}) =>
    fire((t) => ({
      ...base(t),
      icon,
      title,
      text,
      timer: 4000,
      timerProgressBar: true,
      showConfirmButton: false,
      toast: true,
      position: "top",
      backdrop: false,
      width: 420,
      padding: "1.1em 1.5em",
      customClass: {
        popup: "toast-popup",
        title: "toast-title",
        htmlContainer: "toast-text",
      },
    })),

  errorToast: (title, text) => showAlert.toast(title, text, { icon: "error" }),

  success: (title, text) =>
    fire((t) => ({
      ...base(t),
      icon: "success",
      title,
      text,
      timer: 1500,
      timerProgressBar: true,
      showConfirmButton: false,
    })),

  error: (title, body) => dismissDialog(title, body, "error"),

  warning: (title, body) => dismissDialog(title, body, "warning"),

  info: (title, html) =>
    fire((t) => ({
      ...base(t),
      title,
      html,
      width: "42em",
      confirmButtonText: "Kapat",
      confirmButtonColor: t.confirm,
    })),

  confirm: (title, body, confirmText, { cancelText } = {}) =>
    confirmDialog(title, body, confirmText, {
      cancelText,
      pickConfirmColor: (t) => t.confirm,
    }),

  confirmDanger: (title, body, confirmText, { cancelText } = {}) =>
    confirmDialog(title, body, confirmText, {
      cancelText,
      pickConfirmColor: (t) => t.danger,
    }),

  prompt: async ({
    title,
    text,
    input = "text",
    inputLabel,
    inputPlaceholder,
    confirmButtonText = "Tamam",
    cancelText = "Vazgeç",
    trim = false,
    validate,
  }) => {
    const shouldTrim = input === "password" ? false : trim;

    const { value } = await fire((t) => ({
      ...base(t),
      title,
      text,
      input,
      inputLabel,
      inputPlaceholder,
      showCancelButton: true,
      reverseButtons: true,
      confirmButtonText,
      cancelButtonText: cancelText,
      confirmButtonColor: t.confirm,
      cancelButtonColor: t.cancel,
      preConfirm: (raw) => {
        const val = shouldTrim ? raw?.trim() : raw;
        const message = validate?.(val);
        if (message) {
          Swal.showValidationMessage(message);
          return false;
        }
        return val;
      },
    }));
    return value ?? null;
  },

  cancelReason: (title) =>
    showAlert.prompt({
      title,
      input: "textarea",
      inputLabel: "İptal Nedeni",
      inputPlaceholder: "Lütfen iptal nedenini yazın...",
      confirmButtonText: "Evet, İptal Etmek İstiyorum",
      cancelText: "Geri Dön",
      trim: true,
      validate: (val) => (!val ? "İptal nedeni zorunludur." : null),
    }),

  passwordPrompt: ({ title, text, confirmButtonText }) =>
    showAlert.prompt({
      title,
      text,
      input: "password",
      inputPlaceholder: "Admin şifreniz",
      confirmButtonText,
      validate: (val) => (!val ? "Şifre zorunludur." : null),
    }),

  adminRecoveryForm: () =>
    formDialog({
      title: "Admin Şifre Sıfırlama",
      description: "İlk kurulumda verilen kurtarma kodunu girin ve yeni bir şifre belirleyin.",
      fields: [
        { id: "recoveryCode", placeholder: "Kurtarma kodu", trim: true },
        {
          id: "newPassword",
          type: "password",
          placeholder: "Yeni şifre (en az 8 karakter)",
          autocomplete: "new-password",
        },
      ],
      confirmButtonText: "Şifreyi Sıfırla",
      validate: ({ recoveryCode, newPassword }) => {
        if (!recoveryCode) return "Kurtarma kodu zorunludur.";
        if (!newPassword || newPassword.length < 8) return "Yeni şifre en az 8 karakter olmalıdır.";
        return null;
      },
    }),

  setupCode: (code) =>
    codeDialog({
      title: "Hesabınız Hazır",
      code,
      html: `
        Admin şifreniz belirlendi.<br /><br />
        <b>Kurtarma kodunuz:</b><br />
        ${CODE_LINE}
        ${COPY_NOTE_LINE}<br />
        Şifrenizi unutursanız giriş ekranından bu kodla sıfırlayabilirsiniz.<br />
        Güvenli bir yerde saklayın — bir daha gösterilmeyecek.
      `,
      confirmButtonText: "Kaydettim, Devam Et",
      staticBackdrop: true,
    }),

  resetCode: (code) =>
    codeDialog({
      title: "Şifre Sıfırlandı",
      code,
      html: `
        Admin şifreniz güncellendi.<br /><br />
        <b>Yeni kurtarma kodunuz:</b><br />
        ${CODE_LINE}
        ${COPY_NOTE_LINE}<br />
        Bu kodu güvenli bir yerde saklayın — eski kod artık geçersizdir.
      `,
      confirmButtonText: "Anladım",
    }),

  regeneratedCode: (code) =>
    codeDialog({
      title: "Kurtarma Kodunuz",
      code,
      html: `
        ${CODE_LINE}
        ${COPY_NOTE_LINE}<br />
        Güvenli bir yerde saklayın; şifrenizi unutursanız giriş ekranından bu kodla
        sıfırlayabilirsiniz.
      `,
      confirmButtonText: "Anladım",
    }),
};
