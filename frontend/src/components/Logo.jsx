// getPackd brand: a backpack with a tick on its pocket ("packed"), and the wordmark beside it.
export function LogoMark({ className = "h-8 w-8" }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#FF6B4A" />
      <path d="M12.5 9.5V8a3.5 3.5 0 0 1 7 0v1.5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <rect x="8" y="9.5" width="16" height="16.5" rx="5" fill="#fff" />
      <path d="M8.6 14.2 Q16 16.6 23.4 14.2" fill="none" stroke="#FF6B4A" strokeWidth="1.4" strokeLinecap="round" />
      <rect x="11.5" y="17.5" width="9" height="6" rx="2" fill="none" stroke="#FF6B4A" strokeWidth="1.4" />
      <path d="M13.9 20.6l1.5 1.4 2.8-2.9" fill="none" stroke="#FF6B4A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark({ className = "text-xl" }) {
  return (
    <span className={`font-display tracking-tight ${className}`}>
      <span className="font-normal opacity-75">get</span><span className="font-semibold">Packd</span>
    </span>
  );
}

export default function Logo({ markClassName, wordClassName }) {
  return (
    <span className="flex items-center gap-2" aria-label="getPackd">
      <LogoMark className={markClassName} />
      <Wordmark className={wordClassName} />
    </span>
  );
}
