// getPackd brand: the illustrated mark (the backpack and its plane trail, cut out of the user's logo artwork; public/logo.png)
// and the wordmark beside it.
export function LogoMark({ className = "h-10 w-auto" }) {
  return <img src={`${process.env.PUBLIC_URL}/logo.png`} alt="" aria-hidden="true" draggable={false} className={`select-none ${className}`} />;
}

export function Wordmark({ className = "text-[17px]" }) {
  return (
    <span className={`font-['Fraunces',Georgia,serif] tracking-tight ${className}`}>
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
