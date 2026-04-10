import axios from 'axios';
import { clearSession } from '../utils/auth';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && !config.headers?.Authorization) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      clearSession();
    }
    return Promise.reject(error);
  }
);

export const getAllCourses = async () => {
  try {
    const response = await API.get('/courses/get-all-courses');
    return response.data;
  } catch (error) {
    throw error?.response?.data || { message: error.message || 'Request failed' };
  }
};

export default API;
