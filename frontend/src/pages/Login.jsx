import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import Navbar from "@/components/Navbar";
import { PassportStamp } from "@/components/Stamp";
import { useApp } from "@/context/AppState";
import { errorText, http } from "@/lib/api";

// Log in and sign up, as an open passport on the home page's warm paper. Neither is ever required: an account only
// keeps your shortlist on every device. Signing up fills in the photo page as you type (your name, your signature, the
// machine-readable lines at the bottom); logging in opens on the stamps page. Either way a stamp thumps down at the end.

const COVER = "#0c393f"; // the dark teal of the logo's outlines
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const today = new Date();
const issued = `${String(today.getDate()).padStart(2, "0")} ${MONTHS[today.getMonth()]} ${today.getFullYear()}`;
const isoToday = today.toISOString().slice(0, 10);
// faint wavy security lines, like a passport page's background
const GUILLOCHE = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='22'><path d='M0 11 Q15 1 30 11 T60 11 T90 11 T120 11' fill='none' stroke='%230c393f' stroke-opacity='.07'/><path d='M0 17 Q15 7 30 17 T60 17 T90 17 T120 17' fill='none' stroke='%230c393f' stroke-opacity='.045'/></svg>")`;

/** The two machine-readable lines at the foot of a passport's photo page, spelled from the name being typed. */
function mrz(name) {
  const words = name.toUpperCase().normalize("NFD").replace(/[^A-Z ]/g, "").trim().split(/\s+/).filter(Boolean);
  const sur = words.length > 1 ? words[words.length - 1] : words[0] || "TRAVELLER";
  const given = words.length > 1 ? words.slice(0, -1).join("<") : "";
  const pad = (s) => (s + "<".repeat(44)).slice(0, 44);
  let h = 7; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 9999991;
  const yymmdd = isoToday.slice(2).replaceAll("-", "");
  return [pad(`P<GPK${sur}<<${given}`), pad(`GP${String(h).padStart(7, "0")}<4GPK${yymmdd}<<GROUP<TRIPS`)];
}

function Field({ label, children, className = "" }) {
  return (
    <div className={className}>
      <dt className="text-[9.5px] font-medium uppercase tracking-[.16em] text-[#5f656b]">{label}</dt>
      <dd className="mt-0.5 text-[14px] font-medium uppercase tracking-[.06em] text-[#16181b]">{children}</dd>
    </div>
  );
}

/** Signing up: the photo page, filling in as you type. */
function PhotoPage({ name }) {
  const [l1, l2] = mrz(name);
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-[.2em] text-[#5f656b]">
        <span>Traveller's passport</span><span>getPackd</span>
      </div>
      <div className="mt-7 flex gap-5 sm:gap-6">
        <div className="shrink-0">
          <div className="grid h-[132px] w-[104px] place-items-center rounded-md border border-[#e7dece] bg-[#f1eadd]">
            <img src={`${process.env.PUBLIC_URL}/logo.png`} alt="" className="h-20 w-auto opacity-90" draggable={false} />
          </div>
          {/* the holder's signature: the name in handwriting */}
          <div className="mt-2 h-8 w-[104px] overflow-hidden border-b border-[#d8cdb9] text-center font-['Caveat'] text-[22px] leading-8 text-[#16181b]" data-testid="passport-signature">
            {name.trim().split(/\s+/)[0] || ""}
          </div>
          <p className="mt-1 text-center text-[8.5px] uppercase tracking-[.16em] text-[#5f656b]">Signature</p>
        </div>
        <dl className="grid min-w-0 flex-1 content-start gap-3.5">
          <Field label="Name">
            <span data-testid="passport-name" className={`block truncate ${name.trim() ? "" : "text-[#b5ada0]"}`}>{name.trim() || "Your name"}</span>
          </Field>
          <Field label="Date of issue">{issued}</Field>
          <Field label="Place of issue">getPackd</Field>
          <Field label="Valid for">Every group trip</Field>
        </dl>
      </div>
      <div className="mt-auto pt-8 font-['Jost'] text-[9px] font-medium leading-[1.7] tracking-[.18em] text-[#16181b]/75 sm:text-[10.5px]" data-testid="passport-mrz" aria-hidden>
        <p className="overflow-hidden whitespace-nowrap">{l1}</p>
        <p className="overflow-hidden whitespace-nowrap">{l2}</p>
      </div>
    </div>
  );
}

const STAMPS = [
  { destination: "Ladakh", rim: "ARRIVED", sub: "GROUP TRIP", className: "left-[4%] top-[10%] h-36 w-36 text-[#0c393f]/75", tilt: 6 },
  { destination: "Kerala", rim: "ARRIVED", sub: "GROUP TRIP", className: "right-[6%] top-[24%] h-32 w-32 text-[#c9302a]/70", tilt: 22 },
  { destination: "Bali", rim: "ARRIVED", sub: "GROUP TRIP", className: "bottom-[16%] left-[22%] h-[124px] w-[124px] text-[#16181b]/60", tilt: -14 },
];

/** Logging in: the stamps page, the stamps landing one after another. */
function StampsPage() {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const ts = STAMPS.map((_, i) => setTimeout(() => setShown(i + 1), 350 + i * 420));
    return () => ts.forEach(clearTimeout);
  }, []);
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-[.2em] text-[#5f656b]">
        <span>Visas &amp; entries</span><span>07</span>
      </div>
      <div className="relative min-h-[300px] flex-1">
        {STAMPS.slice(0, shown).map(({ tilt, className, ...s }) => (
          <div key={s.destination} className={`absolute ${className}`} style={{ rotate: `${tilt}deg` }}>
            <PassportStamp {...s} className="h-full w-full" />
          </div>
        ))}
      </div>
      <p className="font-['Caveat'] text-[24px] leading-tight text-[#16181b]/80">Your shortlist is right where you left it.</p>
    </div>
  );
}

const inputCls = "mt-1 w-full border-b border-[#d8cdb9] bg-transparent py-2 text-[16px] text-[#16181b] outline-none transition-colors placeholder:text-[#b5ada0] focus:border-coral";
const labelCls = "block text-[11px] font-medium uppercase tracking-[.14em] text-[#5f656b]";

export default function Login({ mode = "login" }) {
  const signup = mode === "signup";
  const { user, hearts, signIn } = useApp();
  const nav = useNavigate();
  const { state } = useLocation();
  const from = state?.from && !/^\/(login|signup)/.test(state.from) ? state.from : "/";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  // the left page swings open from the spine on wide screens; on phones the pages stack, so it just fades in
  const wide = useMemo(() => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches, []);

  useEffect(() => setError(""), [mode]);
  if (user && !done) return <Navigate to={from} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (signup && !name.trim()) return setError("Tell us your name");
    if (!email.trim()) return setError("Add your email");
    if (signup && password.length < 8) return setError("Use at least 8 characters for the password");
    if (!password) return setError("Add your password");
    setBusy(true);
    try {
      const { data } = await http.post(signup ? "/auth/signup" : "/auth/login", { ...(signup ? { name } : {}), email, password, hearts });
      setDone(data.user);
      signIn(data.token, data.user);
      setTimeout(() => nav(from, { replace: true }), 1800);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen overflow-x-clip bg-[#f8f4ec]">
        <Navbar />
        <main id="main" className="relative mx-auto max-w-[1040px] px-4 pb-20 pt-8 sm:px-8 sm:pt-12">
          {/* the passport: a teal cover round two paper pages */}
          <div className="relative rounded-[26px] p-2.5 shadow-[0_24px_60px_-28px_rgba(12,57,63,.55),0_2px_6px_rgba(22,24,27,.08)] sm:p-3" style={{ background: COVER, perspective: 1800 }} data-testid="passport">
            <div className="relative grid grid-cols-1 overflow-hidden rounded-[18px] md:grid-cols-2" style={{ backgroundColor: "#fffdf9", backgroundImage: GUILLOCHE }}>
              <motion.section
                initial={wide ? { rotateY: 75, opacity: 0.4 } : { opacity: 0 }} animate={wide ? { rotateY: 0, opacity: 1 } : { opacity: 1 }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} style={{ transformOrigin: "right center" }}
                className="order-2 border-t border-[#e7dece] p-6 sm:p-9 md:order-1 md:min-h-[520px] md:border-t-0" data-testid={signup ? "passport-photo-page" : "passport-stamps-page"}>
                <AnimatePresence mode="wait">
                  <motion.div key={mode} className="h-full" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.25 }}>
                    {signup ? <PhotoPage name={name} /> : <StampsPage />}
                  </motion.div>
                </AnimatePresence>
              </motion.section>

              <section className="relative order-1 flex flex-col p-6 sm:p-9 md:order-2">
                <p className="text-[11px] font-medium uppercase tracking-[.14em] text-[#5f656b]">{signup ? "Sign up" : "Log in"} · optional</p>
                <h1 className="mt-3 text-[clamp(2rem,3.4vw,2.7rem)] font-light leading-[1.05] tracking-[-.015em] text-[#16181b]">
                  {signup ? "Get your passport." : "Welcome back."}
                </h1>
                <p className="mt-3 max-w-[380px] text-[15px] leading-relaxed text-[#5b6066]">
                  {signup ? "Keep your shortlist on every device. Searching, saving and booking all work without an account." : "Log in to see your shortlist on any device."}
                </p>

                <form onSubmit={submit} noValidate className="mt-7 space-y-5" data-testid="auth-form">
                  {signup && (
                    <label className={labelCls}>Name
                      <input data-testid="auth-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={60} placeholder="As you'd like to be called" className={inputCls} />
                    </label>
                  )}
                  <label className={labelCls}>Email
                    <input data-testid="auth-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" className={inputCls} />
                  </label>
                  <label className={labelCls}>Password
                    <span className="relative block">
                      <input data-testid="auth-password" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                        autoComplete={signup ? "new-password" : "current-password"} placeholder={signup ? "At least 8 characters" : ""} className={`${inputCls} pr-10`} />
                      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}
                        className="absolute bottom-1.5 right-0 p-1.5 text-[#5f656b] transition-colors hover:text-[#16181b]">{show ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                    </span>
                  </label>
                  {error && <p role="alert" data-testid="auth-error" className="text-[14px] text-[#c9302a]">{error}</p>}
                  <button type="submit" disabled={busy} data-testid="auth-submit"
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-coral px-6 py-3.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60">
                    {busy ? "Stamping…" : signup ? "Issue my passport" : "Log in"} {!busy && <ArrowRight size={16} />}
                  </button>
                </form>

                <p className="mt-6 text-[14px] text-[#5b6066]">
                  {signup ? "Already have one? " : "New here? "}
                  <Link to={signup ? "/login" : "/signup"} state={{ from }} replace data-testid="auth-switch" className="font-medium text-coral underline-offset-2 hover:underline">
                    {signup ? "Log in" : "Get a passport"}
                  </Link>
                </p>
                {signup && <p className="mt-auto pt-6 text-[12px] text-[#5f656b]">Your email is only used to log you in.</p>}

                {/* the stamp at the end */}
                <AnimatePresence>
                  {done && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-10 grid place-items-center bg-[#fffdf9]/75 backdrop-blur-[1.5px]" data-testid="auth-done">
                      <div className="text-center">
                        <PassportStamp destination={done.name.split(/\s+/)[0]} ring={signup ? "WELCOME ABOARD ✦ GETPACKD ✦" : "WELCOME BACK ✦ GETPACKD ✦"} sub={issued} className="mx-auto h-52 w-52 text-coral" />
                        <p className="mt-3 font-['Caveat'] text-[26px] text-[#16181b]">{signup ? `Welcome aboard, ${done.name.split(/\s+/)[0]}!` : `Good to see you, ${done.name.split(/\s+/)[0]}.`}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>

              {/* the spine */}
              <span className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-12 -translate-x-1/2 bg-[linear-gradient(90deg,transparent,rgba(12,57,63,.09)_45%,rgba(12,57,63,.16)_50%,rgba(12,57,63,.09)_55%,transparent)] md:block" aria-hidden />
            </div>
          </div>

          <p className="mt-7 text-center text-[14px] text-[#5b6066]">
            No account needed to search, save or book.{" "}
            <Link to={from} data-testid="auth-skip" className="font-medium text-[#16181b] underline-offset-2 hover:underline">Skip for now</Link>
          </p>
        </main>
      </div>
    </MotionConfig>
  );
}
