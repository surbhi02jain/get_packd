import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { http, saveToken, savedToken } from "@/lib/api";

const Ctx = createContext(null);
const load = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

export function AppStateProvider({ children }) {
  const [hearts, setHearts] = useState(() => load("wf_hearts", []));
  const [compare, setCompare] = useState(() => load("wf_compare", []));
  const [currency, setCurrency] = useState(() => load("wf_cur", "inr"));
  // the site is dark by default; the moon/sun button in the nav switches to the light theme
  const [dark, setDark] = useState(() => load("wf_theme_dark", true));
  const [quiz, setQuiz] = useState(() => load("wf_quiz", null));
  // an account is optional: without one the shortlist lives on this device; with one it's kept on the account too
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(() => !!savedToken());
  const onServer = useRef(null); // the hearts the account last had, so only real changes are sent

  useEffect(() => localStorage.setItem("wf_hearts", JSON.stringify(hearts)), [hearts]);
  useEffect(() => localStorage.setItem("wf_compare", JSON.stringify(compare)), [compare]);
  useEffect(() => localStorage.setItem("wf_cur", JSON.stringify(currency)), [currency]);
  useEffect(() => localStorage.setItem("wf_quiz", JSON.stringify(quiz)), [quiz]);
  useEffect(() => {
    localStorage.setItem("wf_theme_dark", JSON.stringify(dark));
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const adopt = useCallback((u) => {
    onServer.current = u.hearts;
    setUser(u);
    setHearts(u.hearts);
  }, []);

  // a saved session: check it's still good and take the account's shortlist (the account is the source of truth)
  useEffect(() => {
    if (!savedToken()) return;
    http.get("/auth/me").then((r) => adopt(r.data.user)).catch((e) => {
      if (e.response?.status === 401) saveToken(null); // expired or logged out elsewhere; offline keeps the token
    }).finally(() => setChecking(false));
  }, [adopt]);

  // while logged in, send shortlist changes to the account (a moment after the last tap)
  useEffect(() => {
    if (!user || !onServer.current || same(hearts, onServer.current)) return undefined;
    const t = setTimeout(() => {
      http.put("/me/hearts", { hearts }).then(() => { onServer.current = hearts; }).catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, [hearts, user]);

  /** After signup or login: keep the token and take the account (its hearts already include this device's). */
  const signIn = useCallback((token, u) => { saveToken(token); adopt(u); }, [adopt]);
  /** Log out: forget the session here and on the server; the shortlist stays on the account, not on this device. */
  const signOut = useCallback(async () => {
    await http.post("/auth/logout").catch(() => {});
    saveToken(null);
    onServer.current = null;
    setUser(null);
    setHearts([]);
    toast.success("Logged out. Your shortlist is saved on your account.");
  }, []);

  const toggleHeart = useCallback((id) => setHearts((h) => (h.includes(id) ? h.filter((x) => x !== id) : [...h, id])), []);
  /**
   * What the server found when it looked up the saved departures: `moved` (old id → the id it has now, after the trip
   * was renamed or its date dropped) and `missing` (trips no longer listed). The shortlist then keeps only what it can
   * show, so the heart's count matches the page.
   */
  const settleHearts = useCallback((moved = {}, missing = []) => setHearts((h) => {
    const next = [...new Set(h.filter((id) => !missing.includes(id)).map((id) => moved[id] ?? id))];
    return same(next, h) ? h : next;
  }), []);
  const toggleCompare = useCallback((card) => setCompare((c) => {
    if (c.find((x) => x.dep_id === card.dep_id)) return c.filter((x) => x.dep_id !== card.dep_id);
    if (c.length >= 4) { toast.error("You can compare up to 4 trips"); return c; }
    return [...c, { dep_id: card.dep_id, title: card.title, image: card.image, dest_slug: card.dest_slug, true_price: card.true_price, dtype: card.dtype }];
  }), []);

  return (
    <Ctx.Provider value={{ hearts, toggleHeart, settleHearts, compare, toggleCompare, setCompare, currency, setCurrency, dark, setDark, quiz, setQuiz, user, checking, signIn, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export const useApp = () => useContext(Ctx);
