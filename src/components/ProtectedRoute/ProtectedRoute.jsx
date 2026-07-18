import { useEffect } from "react";
import PropTypes from "prop-types";
import { Navigate } from "react-router-dom";
import { useCurrentUser, hasRole, homePathFor, VALID_ROLES } from "../../hooks/useCurrentUser";
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

  // Auth screens (/login, /setup): keep a signed-in user out, so history
  // navigation cannot land them back on a login form they already passed.
  if (guestOnly) {
    return hasSession ? <Navigate to={homePathFor(currentUser)} replace /> : children;
  }

  if (!hasSession) return <Navigate to="/" replace />;

  if (isForbidden) return <Navigate to={homePathFor(currentUser)} replace />;

  return children;
}

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
  requiredRole: PropTypes.oneOf(VALID_ROLES),
  guestOnly: PropTypes.bool,
};

export default ProtectedRoute;
