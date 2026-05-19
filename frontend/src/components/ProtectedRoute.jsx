import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children, allowedRoles = null }) => {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    // Redirect to appropriate dashboard based on role
    switch(user?.role) {
      case 'admin':
        return <Navigate to="/admin" />;
      case 'sme':
        return <Navigate to="/sme-dashboard" />;
      case 'agent':
        return <Navigate to="/agent-dashboard" />;
      case 'delivery':
        return <Navigate to="/delivery-dashboard" />;
      default:
        return <Navigate to="/" />;
    }
  }

  return children;
};

export default ProtectedRoute;