import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://localhost:3000/api', // Pointing to our backend
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
