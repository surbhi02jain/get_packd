import axios from "axios";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
export const http = axios.create({ baseURL: API });

// logged in (optional): every request carries the session token, so the shortlist can be kept on the account
const TOKEN_KEY = "wf_token";
export const savedToken = () => { try { return JSON.parse(localStorage.getItem(TOKEN_KEY)); } catch { return null; } };
export const saveToken = (t) => { try { t ? localStorage.setItem(TOKEN_KEY, JSON.stringify(t)) : localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ } };
http.interceptors.request.use((config) => {
  const t = savedToken();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

/** The message to show for a failed request: the API's `detail` (a sentence, or the first of a list), or a fallback. */
export const errorText = (e, fallback = "Something went wrong. Try again.") => {
  const d = e?.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d) && d[0]?.msg) return d[0].msg;
  return e?.response ? fallback : "Can't reach getPackd right now. Check your connection and try again.";
};

export const qs = (params) => {
  const u = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") u.set(k, v);
  });
  return u.toString();
};
