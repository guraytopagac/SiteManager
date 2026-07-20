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

const isPasswordInput = (type) => type === "password";

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

const confirmDialog = async (title, body, confirmText, { cancelText = "Vazgeç", pickConfirmColor }) => {
  const { isConfirmed } = await fire((t) => ({
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
  return isConfirmed;
};

const CODE_ELEMENT_ID = "swal-recovery-code";
const COPY_BUTTON_ELEMENT_ID = "swal-copy-code";
const COPY_NOTE_ELEMENT_ID = "swal-copy-note";

const COPY_LABEL_IDLE = "Kodu Kopyala";
const COPY_LABEL_DONE = "✓ Kopyalandı";
const COPY_RESET_DELAY = 2000;

const CODE_LINE = `<code id="${CODE_ELEMENT_ID}" class="swal-code"></code>`;
const COPY_LINE = `
  <div class="swal-copy-row">
    <button type="button" id="${COPY_BUTTON_ELEMENT_ID}" class="swal-copy-button">${COPY_LABEL_IDLE}</button>
    <span id="${COPY_NOTE_ELEMENT_ID}" class="swal-copy-note"></span>
  </div>`;

const copyToClipboard = async (value) => {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
};

const codeDialog = ({ title, code, html, confirmButtonText, staticBackdrop = false, width }) => {
  let resetTimer = null;

  return fire((t) => ({
    ...base(t),
    ...(staticBackdrop ? { ...STATIC_BACKDROP, allowOutsideClick: false } : {}),
    ...(width ? { width } : {}),
    icon: "success",
    title,
    html,
    customClass: { htmlContainer: "swal-code-body", title: "swal-code-title" },
    didOpen: () => {
      const codeEl = document.getElementById(CODE_ELEMENT_ID);
      if (codeEl) codeEl.textContent = code;

      const buttonEl = document.getElementById(COPY_BUTTON_ELEMENT_ID);
      const noteEl = document.getElementById(COPY_NOTE_ELEMENT_ID);
      if (!buttonEl || !noteEl) return;

      buttonEl.addEventListener("click", async () => {
        const copied = await copyToClipboard(code);
        clearTimeout(resetTimer);

        if (!copied) {
          noteEl.textContent = "Panoya kopyalanamadı. Lütfen kodu elle kopyalayın.";
          noteEl.classList.add("is-error");
          return;
        }

        noteEl.textContent = "";
        noteEl.classList.remove("is-error");
        buttonEl.textContent = COPY_LABEL_DONE;
        buttonEl.classList.add("is-copied");

        resetTimer = setTimeout(() => {
          buttonEl.textContent = COPY_LABEL_IDLE;
          buttonEl.classList.remove("is-copied");
        }, COPY_RESET_DELAY);
      });
    },
    willClose: () => clearTimeout(resetTimer),
    confirmButtonText,
    confirmButtonColor: t.confirm,
  }));
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
      width: 500,
      padding: "1.3em 1.7em",
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

  releaseNotes: (html) =>
    fire((t) => ({
      ...base(t),
      title: "Sürüm Notları",
      html,
      width: "54em",
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
    validate,
  }) => {
    const shouldTrim = !isPasswordInput(input);

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

  setupCode: (code) =>
    codeDialog({
      title: "Hesabınız Hazır",
      code,
      html: `
        Sistem yöneticisi şifreniz belirlendi.<br /><br />
        <b>Kurtarma kodunuz:</b><br />
        ${CODE_LINE}
        ${COPY_LINE}<br />
        <p class="swal-note">Şifrenizi unutursanız giriş ekranından bu kodla yeni şifre belirlersiniz.</p>
        <p class="swal-warning">Bu kod bir daha gösterilmeyecek. Güvenli bir yerde saklayın.</p>
      `,
      confirmButtonText: "Kaydettim, Devam Et",
      staticBackdrop: true,
      width: "34em",
    }),

  resetCode: (code) =>
    codeDialog({
      title: "Şifre Sıfırlandı",
      code,
      html: `
        Sistem yöneticisi şifreniz güncellendi.<br /><br />
        <b>Yeni kurtarma kodunuz:</b><br />
        ${CODE_LINE}
        ${COPY_LINE}
        Bu kodu güvenli bir yerde saklayın. Eski kod artık geçersizdir.
      `,
      confirmButtonText: "Anladım",
      staticBackdrop: true,
      width: "37em",
    }),

  regeneratedCode: (code) =>
    codeDialog({
      title: "Kurtarma Kodunuz",
      code,
      html: `
        ${CODE_LINE}
        ${COPY_LINE}
        Güvenli bir yerde saklayın; şifrenizi unutursanız giriş ekranından bu kodla
        sıfırlayabilirsiniz.
      `,
      confirmButtonText: "Anladım",
    }),
};
