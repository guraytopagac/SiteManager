export function validatePasswordForm(oldPassword, newPassword, confirmPassword) {
  if (!oldPassword) return "Mevcut şifrenizi girmelisiniz.";
  if (newPassword.length < 8) return "Yeni şifre en az 8 karakter olmalıdır.";
  if (newPassword !== confirmPassword) return "Yeni şifre ve tekrarı birbirinden farklı.";
  return null;
}
