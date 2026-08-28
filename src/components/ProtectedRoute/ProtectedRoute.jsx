import { Navigate, Outlet } from "react-router-dom";
import { useCurrentUser } from "@/hooks/useCurrentUser";

function ProtectedRoute({ guestOnly = false }) {
  const currentUser = useCurrentUser();
  const hasSession = Boolean(currentUser?.id);

  if (guestOnly) {
    return hasSession ? <Navigate to="/select-building" replace /> : <Outlet />;
  }

  if (!hasSession) return <Navigate to="/" replace />;

  return <Outlet />;
}

export default ProtectedRoute;
