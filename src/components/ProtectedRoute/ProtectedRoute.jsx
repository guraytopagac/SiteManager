import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useCurrentUser, hasRole, homePathFor } from "../../hooks/useCurrentUser";
import { showAlert } from "../../utils/alert";

function ProtectedRoute({ children, requiredRole, guestOnly = false }) {
  const currentUser = useCurrentUser();
  const hasSession = Boolean(currentUser?.id && currentUser?.role);
  const isForbidden = hasSession && Boolean(requiredRole) && !hasRole(currentUser, requiredRole);

  useEffect(() => {
    if (isForbidden) {
      showAlert.errorToast("Erişim reddedildi", "Bu sayfaya erişim yetkiniz yok.");
    }
  }, [isForbidden]);

  if (guestOnly) {
    return hasSession ? <Navigate to={homePathFor(currentUser)} replace /> : children;
  }

  if (!hasSession) return <Navigate to="/" replace />;

  if (isForbidden) return <Navigate to={homePathFor(currentUser)} replace />;

  return children;
}

export default ProtectedRoute;
