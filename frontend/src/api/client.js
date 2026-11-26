import axios from "axios";

export const BACKEND_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";

const apiClient = axios.create({
  baseURL: BACKEND_URL,
  timeout: 15000,
});

export default apiClient;
