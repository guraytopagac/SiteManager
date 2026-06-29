import Swal from "sweetalert2";

export const getCssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export const swalBase = () => ({
  heightAuto: false,
  background: getCssVar("--card-background-1"),
  color: getCssVar("--text-color"),
});

export const showAlert = {
  success: (title, text, timer = 1500) =>
    Swal.fire({
      ...swalBase(),
      icon: "success",
      title,
      text,
      timer,
      timerProgressBar: true,
      showConfirmButton: false,
    }),

  error: (title, text) => Swal.fire({ ...swalBase(), icon: "error", title, text }),

  warning: (title, text) => Swal.fire({ ...swalBase(), icon: "warning", title, text }),

  cancelInput: (title, inputLabel, inputPlaceholder) =>
    Swal.fire({
      ...swalBase(),
      title,
      input: "textarea",
      inputLabel,
      inputPlaceholder,
      showCancelButton: true,
      reverseButtons: true,
      confirmButtonText: "Evet, İptal Etmek İstiyorum",
      cancelButtonText: "Geri Dön",
      confirmButtonColor: getCssVar("--danger"),
      cancelButtonColor: getCssVar("--text-secondary"),
      preConfirm: (val) => {
        if (!val?.trim()) Swal.showValidationMessage("İptal nedeni zorunludur.");
        return val?.trim();
      },
    }),

  confirm: (title, text, confirmText = "Evet", danger = false, cancelText = "Vazgeç") =>
    Swal.fire({
      ...swalBase(),
      title,
      text,
      icon: "warning",
      showCancelButton: true,
      reverseButtons: true,
      confirmButtonText: confirmText,
      cancelButtonText: cancelText,
      confirmButtonColor: danger ? getCssVar("--danger") : getCssVar("--button-color"),
      cancelButtonColor: getCssVar("--text-secondary"),
    }),
};
