import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("session_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;

export const buildFileUrl = (fotoUrl) => {
  if (!fotoUrl) return null;
  if (fotoUrl.startsWith("http")) return fotoUrl;
  const token = localStorage.getItem("session_token");
  if (fotoUrl.startsWith("/api/files/")) {
    return `${BACKEND_URL}${fotoUrl}${token ? `?auth=${token}` : ""}`;
  }
  return fotoUrl;
};
