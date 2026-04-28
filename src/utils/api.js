import axios from 'axios';

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || ''}/api`,
  headers: { 'Content-Type': 'application/json' },
});

const token = localStorage.getItem('memoria_token');
if (token) api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

api.interceptors.request.use(config => {
  const vaultToken = localStorage.getItem('memoria_vault_token');
  if (vaultToken) {
    config.headers['x-vault-token'] = vaultToken;
  }
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('memoria_token');
      delete api.defaults.headers.common['Authorization'];
      window.location.href = '/auth';
    }
    return Promise.reject(err);
  }
);

export default api;
