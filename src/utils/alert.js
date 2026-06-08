import Swal from "sweetalert2";

const base = { heightAuto: false };

export const alert = {
  success: (title, text, timer = 2000) =>
    Swal.fire({ ...base, icon: "success", title, text, timer, timerProgressBar: true, showConfirmButton: false }),

  error: (title, text) => Swal.fire({ ...base, icon: "error", title, text }),

  warning: (title, text) => Swal.fire({ ...base, icon: "warning", title, text }),

  confirm: (title, text, confirmText = "Evet", danger = false) =>
    Swal.fire({
      ...base,
      title,
      text,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: "Vazgeç",
      confirmButtonColor: danger ? "#dc2626" : undefined,
    }),
};
