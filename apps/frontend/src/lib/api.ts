import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export const apiClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: false,
  headers: { "Content-Type": "application/json" },
  timeout: 30_000,
});

// ─── Request interceptor: attach access token ─────────────────────────────
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("cb_access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response interceptor: auto refresh on 401 ───────────────────────────
let _isRefreshing = false;
let _queue: Array<{ resolve: (t: string) => void; reject: (e: unknown) => void }> = [];

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }
    original._retry = true;

    if (_isRefreshing) {
      return new Promise((resolve, reject) => {
        _queue.push({ resolve, reject });
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`;
        return apiClient(original);
      });
    }

    _isRefreshing = true;
    try {
      const refreshToken = localStorage.getItem("cb_refresh_token");
      if (!refreshToken) throw new Error("No refresh token");

      const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
      const newToken: string = data.data.accessToken;
      localStorage.setItem("cb_access_token", newToken);
      if (data.data.refreshToken) {
        localStorage.setItem("cb_refresh_token", data.data.refreshToken);
      }

      _queue.forEach(({ resolve }) => resolve(newToken));
      _queue = [];
      original.headers.Authorization = `Bearer ${newToken}`;
      return apiClient(original);
    } catch (refreshError) {
      _queue.forEach(({ reject }) => reject(refreshError));
      _queue = [];
      localStorage.removeItem("cb_access_token");
      localStorage.removeItem("cb_refresh_token");
      window.location.href = "/login";
      return Promise.reject(refreshError);
    } finally {
      _isRefreshing = false;
    }
  }
);

export type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
  meta?: { total: number; page: number; limit: number; pages: number };
};
