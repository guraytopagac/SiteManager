import PropTypes from "prop-types";
import { memo } from "react";
import { Navigate } from "react-router-dom";
import { useCurrentUser, isUserRole } from "../../hooks/useCurrentUser";

const ProtectedRoute = memo(function ProtectedRoute({ children, requiredRole }) {
  const currentUser = useCurrentUser();

  if (!currentUser?.id || !currentUser?.role) return <Navigate to="/login" replace />;

  if (requiredRole && !isUserRole(currentUser, requiredRole)) {
    const redirectTo = isUserRole(currentUser, "admin") ? "/admin" : "/dashboard";
    return <Navigate to={redirectTo} replace />;
  }

  return children;
});

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
  requiredRole: PropTypes.oneOf(["admin", "manager"]),
};

export default ProtectedRoute;
