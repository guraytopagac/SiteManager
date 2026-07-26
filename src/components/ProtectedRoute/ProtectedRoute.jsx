import { Navigate } from "react-router-dom";
import { useCurrentUser } from "../../hooks/useCurrentUser";

function ProtectedRoute({ children, guestOnly = false }) {
  const currentUser = useCurrentUser();
  const hasSession = Boolean(currentUser?.id);

  if (guestOnly) {
    return hasSession ? <Navigate to="/select-building" replace /> : children;
  }

  if (!hasSession) return <Navigate to="/" replace />;

  return children;
}

export default ProtectedRoute;
