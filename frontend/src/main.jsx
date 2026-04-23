import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { BrowserRouter } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import axios from 'axios';
import { clearSession } from './utils/auth';
import './index.css'; // Tailwind CSS or your styling

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || 'http://localhost:3000';

axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  const url = config?.url || '';
  const isAppApi = url.startsWith('/api') || url.startsWith(API_ORIGIN);
  if (token && isAppApi && !config.headers?.Authorization) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || '';
    const isAppApi = url.startsWith('/api') || url.startsWith(API_ORIGIN);
    const isAuthEndpoint = url.includes('/login') || url.includes('/password-reset');
    if (status === 401 && isAppApi && !isAuthEndpoint) {
      clearSession();
    }
    return Promise.reject(error);
  }
);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);
