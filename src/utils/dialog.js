// The only module allowed to import sweetalert2, enforced by no-restricted-imports in eslint.config.mjs.
// Pages call showDialog methods, a new kind of dialog is added here rather than at the call site.

import Swal from "sweetalert2";

// Resolved at fire time rather than at module load: the theme toggles at runtime and a cached palette
// would go stale on the first switch.
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

// allowOutsideClick lives here instead of on individual methods, so no dialog can be dismissed by a stray
// click. Escape still closes. Cancel reason and password prompts used to lose typed text this way.
const base = (t) => ({
  heightAuto: false,
  allowOutsideClick: false,
  background: t.background,
  color: t.text,
});

const fire = (build) => Swal.fire(build(theme()));

export const isDialogOpen = () => Swal.isVisible();

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

// Deliberately not exported. A dialog that embeds raw user text gets its own method in this file, so the
// escaping stays next to the markup that needs it.
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);

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

// Returns a boolean rather than the raw SweetAlertResult, so callers write `if (confirmed)`. reverseButtons
// puts cancel on the left, so cancelText comes third: the signature follows the order the user reads.
const confirmDialog = async (title, body, cancelText, confirmText, pickConfirmColor) => {
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

const CODE_DIALOG_WIDTH = "37em";

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
  } catch (err) {
    console.error("[alert] copyToClipboard:", err);
    return false;
  }
};

// Shared by the three dialogs that show a value exactly once. The backdrop animation is off and the code is
// never written to the clipboard on its own, the user presses the button and sees the result.
const codeDialog = ({ title, code, html }) => {
  let resetTimer = null;

  return fire((t) => ({
    ...base(t),
    showClass: { popup: "swal2-show", backdrop: "" },
    hideClass: { popup: "swal2-hide", backdrop: "" },
    width: CODE_DIALOG_WIDTH,
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
    confirmButtonText: "Anladım",
    confirmButtonColor: t.confirm,
  }));
};

export const showDialog = {
  toast: (title, body) =>
    fire((t) => ({
      ...base(t),
      ...bodyOf(body),
      icon: "success",
      title,
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

  error: (title, body) => dismissDialog(title, body, "error"),

  warning: (title, body) => dismissDialog(title, body, "warning"),

  releaseNotes: (html) =>
    fire((t) => ({
      ...base(t),
      title: "Sürüm Notları",
      html,
      width: "54em",
      confirmButtonText: "Kapat",
      confirmButtonColor: t.confirm,
    })),

  confirm: (title, body, cancelText, confirmText) =>
    confirmDialog(title, body, cancelText, confirmText, (t) => t.confirm),

  confirmDanger: (title, body, cancelText, confirmText) =>
    confirmDialog(title, body, cancelText, confirmText, (t) => t.danger),

  prompt: async ({
    title,
    text,
    input = "text",
    inputLabel,
    inputPlaceholder,
    inputValue = "",
    inputAttributes,
    confirmButtonText = "Tamam",
    cancelText = "Vazgeç",
    validate,
  }) => {
    const { value } = await fire((t) => ({
      ...base(t),
      title,
      text,
      input,
      inputLabel,
      inputPlaceholder,
      inputValue,
      inputAttributes,
      showCancelButton: true,
      reverseButtons: true,
      confirmButtonText,
      cancelButtonText: cancelText,
      confirmButtonColor: t.confirm,
      cancelButtonColor: t.cancel,
      preConfirm: (raw) => {
        // Passwords are never trimmed, a leading or trailing space may be deliberate.
        const val = input === "password" ? raw : raw?.trim();
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
    showDialog.prompt({
      title,
      input: "textarea",
      inputLabel: "İptal Nedeni",
      inputPlaceholder: "Lütfen iptal nedenini yazın...",
      // Mirrors the handler's 300 character limit, the user should meet the bound while typing.
      inputAttributes: { maxlength: 300 },
      confirmButtonText: "Evet, İptal Etmek İstiyorum",
      cancelText: "Geri Dön",
      validate: (val) => (!val ? "İptal nedeni zorunludur." : null),
    }),

  passwordPrompt: ({ title, text, confirmButtonText }) =>
    showDialog.prompt({
      title,
      text,
      input: "password",
      inputPlaceholder: "Şifreniz",
      confirmButtonText,
      validate: (val) => (!val ? "Şifre zorunludur." : null),
    }),

  temporaryPassword: ({ managerName, username, code, filePath }) =>
    codeDialog({
      title: "Hesap Devredildi",
      code,
      html: `
        Hesap <b>${escapeHtml(managerName)}</b> adına devredildi ve geçici bir şifre üretildi.<br /><br />
        <b>Kullanıcı adı:</b> ${escapeHtml(username)}<br /><br />
        <b>Geçici şifre:</b><br />
        ${CODE_LINE}
        ${COPY_LINE}<br />
        <p class="swal-note"><b>Devir dosyası:</b><br /><span class="swal-path">${escapeHtml(filePath)}</span></p>
        <p class="swal-note">Kullanıcı adını, bu şifreyi ve sonraki adımda gösterilecek kurtarma kodunu yeni yöneticiye iletin. Yeni yönetici bu bilgisayarı kullanacaksa doğrudan giriş yapar. Başka bir bilgisayar kullanacaksa uygulamayı kurar ve kurulum ekranının altındaki <b>Dosyadan yükleyin</b> bağlantısıyla bu dosyayı seçer. Giriş yaptıktan sonra profil sayfasından kendi şifresini belirlemelidir.</p>
        <p class="swal-warning">Bu şifre bir daha gösterilmeyecek.</p>
      `,
    }),

  transferredRecoveryCode: (code) =>
    codeDialog({
      title: "Yeni Kurtarma Kodu",
      code,
      html: `
        Devir sırasında yeni bir kurtarma kodu üretildi, önceki kod geçersiz oldu.<br /><br />
        ${CODE_LINE}
        ${COPY_LINE}<br />
        <p class="swal-note">Bu kodu da yeni yöneticiye iletin. Şifre unutulduğunda giriş ekranından bu kodla sıfırlama yapılır.</p>
        <p class="swal-warning">Bu kod bir daha gösterilmeyecek.</p>
      `,
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
    }),
};
