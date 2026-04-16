import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getSession, hasRole } from '../utils/auth';

const loginByRole = {
  admin: '/login',
  super_admin: '/login',
  faculty: '/login',
  student: '/login',
};

const ProtectedRoute = ({ children, roles = [] }) => {
  const location = useLocation();
  const session = getSession();

  if (!session.isAuthenticated) {
    const fallback = roles.length ? loginByRole[roles[0]] : '/';
    return <Navigate to={fallback || '/'} replace state={{ from: location }} />;
  }

  if (!hasRole(roles)) {
    const redirect = loginByRole[session.role] || '/';
    return <Navigate to={redirect} replace />;
  }

  return children;
};

export default ProtectedRoute;
