import { Navigate } from "react-router-dom";

function ProtectedRoute({ children, requiredRole }) {
  const currentUserRaw = sessionStorage.getItem("currentUser");

  if (!currentUserRaw) {
    return <Navigate to="/" replace />;
  }

  if (requiredRole) {
    const currentUser = JSON.parse(currentUserRaw);
    if (currentUser.role !== requiredRole) {
      const redirectTo = currentUser.role === "admin" ? "/admin-dashboard" : "/dashboard";
      return <Navigate to={redirectTo} replace />;
    }
  }

  return children;
}

export default ProtectedRoute;
