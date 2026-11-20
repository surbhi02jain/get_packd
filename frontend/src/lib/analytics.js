import { API } from "./api";

// getPackd's own analytics (backend/src/analytics.ts): a small event per page view, search, save, share and click
// through to an operator. No cookies; the server keeps no IP address. Sent with sendBeacon, which still goes out when
// the visitor is leaving for the operator's site, as plain text so it needs no CORS preflight.
const OFF_KEY = "wf_no_track";

/** Whether this browser is left out of the counts (the site owner's own visits; set from /admin). */
export const trackingOff = () => { try { return localStorage.getItem(OFF_KEY) === "1"; } catch { return false; } };
export const setTrackingOff = (off) => { try { off ? localStorage.setItem(OFF_KEY, "1") : localStorage.removeItem(OFF_KEY); } catch { /* private mode */ } };

// where a visit came from (another site's name only), sent once per visit
function referrer() {
  try {
    if (sessionStorage.getItem("wf_ref_sent")) return "";
    sessionStorage.setItem("wf_ref_sent", "1");
    const r = document.referrer ? new URL(document.referrer) : null;
    return r && r.host !== window.location.host ? r.host : "";
  } catch { return ""; }
}

export function track(type, props = {}) {
  if (process.env.NODE_ENV === "test" || trackingOff() || window.location.pathname.startsWith("/admin")) return;
  try {
    const body = JSON.stringify({ type, path: window.location.pathname, ref: type === "page_view" ? referrer() : "", props });
    const url = `${API}/events`;
    if (navigator.sendBeacon?.(url, new Blob([body], { type: "text/plain" }))) return;
    fetch(url, { method: "POST", body, keepalive: true, headers: { "Content-Type": "text/plain" } }).catch(() => {});
  } catch { /* analytics never gets in the way */ }
}
