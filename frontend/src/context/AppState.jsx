import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { toast } from "sonner";

const Ctx = createContext(null);
const load = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };

export function AppStateProvider({ children }) {
  const [hearts, setHearts] = useState(() => load("wf_hearts", []));
  const [compare, setCompare] = useState(() => load("wf_compare", []));
  const [currency, setCurrency] = useState(() => load("wf_cur", "inr"));
  // the site is dark by default; the moon/sun button in the nav switches to the light theme
  const [dark, setDark] = useState(() => load("wf_theme_dark", true));
  const [quiz, setQuiz] = useState(() => load("wf_quiz", null));

  useEffect(() => localStorage.setItem("wf_hearts", JSON.stringify(hearts)), [hearts]);
  useEffect(() => localStorage.setItem("wf_compare", JSON.stringify(compare)), [compare]);
  useEffect(() => localStorage.setItem("wf_cur", JSON.stringify(currency)), [currency]);
  useEffect(() => localStorage.setItem("wf_quiz", JSON.stringify(quiz)), [quiz]);
  useEffect(() => {
    localStorage.setItem("wf_theme_dark", JSON.stringify(dark));
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const toggleHeart = useCallback((id) => setHearts((h) => (h.includes(id) ? h.filter((x) => x !== id) : [...h, id])), []);
  const toggleCompare = useCallback((card) => setCompare((c) => {
    if (c.find((x) => x.dep_id === card.dep_id)) return c.filter((x) => x.dep_id !== card.dep_id);
    if (c.length >= 4) { toast.error("You can compare up to 4 departures"); return c; }
    return [...c, { dep_id: card.dep_id, title: card.title, image: card.image, true_price: card.true_price, dtype: card.dtype }];
  }), []);

  return (
    <Ctx.Provider value={{ hearts, toggleHeart, compare, toggleCompare, setCompare, currency, setCurrency, dark, setDark, quiz, setQuiz }}>
      {children}
    </Ctx.Provider>
  );
}

export const useApp = () => useContext(Ctx);
