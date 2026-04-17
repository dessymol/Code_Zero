const TOKEN_KEY = 'token';
const USER_KEY = 'user';
const USER_ROLE_KEY = 'userRole';

const LEGACY_KEYS = [
  'role',
  'userId',
  'adminData',
  'facultyData',
  'studentData',
];

const safeParse = (value, fallback = null) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

export const decodeJwtPayload = (token) => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join('')
    );
    return safeParse(json, null);
  } catch {
    return null;
  }
};

export const isTokenExpired = (token) => {
  const payload = decodeJwtPayload(token);
  if (!payload || !payload.exp) return true;
  const now = Math.floor(Date.now() / 1000);
  return payload.exp <= now;
};

export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(USER_ROLE_KEY);
  LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
};

export const setSession = ({ token, user }) => {
  if (!token || !user || !user.role) {
    throw new Error('Invalid session payload');
  }
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem(USER_ROLE_KEY, user.role);
  localStorage.setItem('role', user.role);
  localStorage.setItem('userId', String(user.id || ''));

  if (user.role === 'admin' || user.role === 'super_admin') localStorage.setItem('adminData', JSON.stringify(user));
  if (user.role === 'faculty') localStorage.setItem('facultyData', JSON.stringify(user));
  if (user.role === 'student') localStorage.setItem('studentData', JSON.stringify(user));
};

export const getSession = () => {
  const token = localStorage.getItem(TOKEN_KEY) || '';
  const user = safeParse(localStorage.getItem(USER_KEY), null);
  const role = localStorage.getItem(USER_ROLE_KEY) || user?.role || localStorage.getItem('role') || '';
  if (!token || !role || isTokenExpired(token)) {
    clearSession();
    return { isAuthenticated: false, token: null, user: null, role: null };
  }
  return { isAuthenticated: true, token, user, role };
};

export const hasRole = (requiredRoles = []) => {
  const session = getSession();
  if (!session.isAuthenticated) return false;
  if (!requiredRoles.length) return true;
  if (requiredRoles.includes(session.role)) return true;
  if (session.role === 'super_admin' && requiredRoles.includes('admin')) return true;
  return false;
};
