// Blueprint drawings for the four feature cards: pale line art on a navy grid, with a soft glow on the live parts.

const COLS = "ABCDEFG".split("");

function Frame({ id, children }) {
  return (
    <svg viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" className="block h-full w-full" aria-hidden>
      <defs>
        <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <rect width="400" height="250" fill="#344d61" />
      {COLS.map((c, i) => (
        <g key={c}>
          <text x={30 + i * 57} y="12" fontSize="6" fill="#9cb2c1" fontFamily="ui-monospace, monospace" textAnchor="middle">({c})</text>
          <line x1={58 + i * 57} y1="18" x2={58 + i * 57} y2="250" stroke="#41596e" strokeWidth="0.6" />
        </g>
      ))}
      <line x1="0" y1="18" x2="400" y2="18" stroke="#41596e" strokeWidth="0.6" />
      <g stroke="#d9eef1" fill="none" strokeWidth="1" strokeLinejoin="round" strokeLinecap="round">{children(`url(#${id}-glow)`)}</g>
    </svg>
  );
}

const T = ({ x, y, s = 6.5, w = 600, a = "start", o = 1, children }) => (
  <text x={x} y={y} fontSize={s} fontWeight={w} textAnchor={a} fill="#e6f4f6" stroke="none" opacity={o} fontFamily="'Inter Tight', ui-sans-serif, sans-serif" letterSpacing=".04em">{children}</text>
);

export function SearchArt() {
  const rows = [["14 DEC", "SPITI"], ["20 DEC", "LADAKH"], ["26 DEC", "KERALA"], ["02 JAN", "GOA"]];
  return (
    <Frame id="bp-search">
      {(glow) => (
        <>
          {/* the map table, in isometric */}
          <path d="M22 150 L112 104 L200 148 L110 194 Z" />
          <path d="M22 150 L22 158 L110 202 L200 156 L200 148" opacity=".7" />
          <path d="M110 194 L110 202" opacity=".7" />
          <path d="M48 150 L70 128 L84 140 L100 116 L122 138 L136 128 L160 148" opacity=".85" />
          <path d="M70 128 L66 134 M100 116 L96 124 M100 116 L104 123" opacity=".6" />
          <path d="M44 162 C70 150 84 170 108 158 S150 150 176 154" strokeDasharray="2 3" opacity=".75" />
          <path d="M44 162 C70 150 84 170 108 158 S150 150 176 154" stroke="#ffffff" strokeWidth="1.4" filter={glow} strokeDasharray="40 200" />
          {[[44, 162], [108, 158], [176, 154]].map(([x, y]) => (
            <g key={x}><path d={`M${x} ${y - 4} c-4 -6 -6 -9 -6 -12 a6 6 0 0 1 12 0 c0 3 -2 6 -6 12 z`} fill="#344d61" /><circle cx={x} cy={y - 16} r="1.8" /></g>
          ))}
          {/* the cable into the departures log */}
          <path d="M196 150 C214 150 214 118 230 118" />
          <circle cx="230" cy="118" r="2.4" fill="#ffffff" filter={glow} />
          <rect x="222" y="76" width="166" height="146" rx="4" fill="#344d61" />
          <T x={234} y={92} s={8}>DEPARTURES</T>
          <rect x="340" y="84" width="38" height="12" rx="6" />
          <circle cx="348" cy="90" r="2" fill="#ffffff" stroke="none" filter={glow} />
          <T x={354} y={92.5} s={6}>LIVE</T>
          <line x1="236" y1="110" x2="236" y2="210" opacity=".6" />
          {rows.map(([d, p], i) => (
            <g key={p}>
              <circle cx="236" cy={118 + i * 26} r="2.2" fill={i === 0 ? "#ffffff" : "#344d61"} filter={i === 0 ? glow : undefined} />
              <T x={244} y={120.5 + i * 26} s={6} w={500} o={0.85}>{d}</T>
              <rect x="276" y={111 + i * 26} width="44" height="14" rx="2" />
              <T x={298} y={120.5 + i * 26} s={6} a="middle">{p}</T>
              <rect x="328" y={115 + i * 26} width={46 - i * 6} height="5" rx="2.5" fill="#d9eef1" stroke="none" opacity=".35" />
            </g>
          ))}
        </>
      )}
    </Frame>
  );
}

export function CompareArt() {
  const cards = [["OPERATOR A", "₹16.4k", [60, 44, 52]], ["OPERATOR B", "₹15.9k", [70, 58, 38]], ["OPERATOR C", "₹18.2k", [48, 64, 30]]];
  return (
    <Frame id="bp-compare">
      {(glow) => (
        <>
          <path d="M28 64 L300 40 L330 196 L52 228 Z" fill="#344d61" />
          <path d="M28 64 L28 70 L52 234 L330 202 L330 196" opacity=".6" />
          {cards.map(([n, p, bars], i) => {
            const x = 52 + i * 86, y = 66 - i * 7;
            return (
              <g key={n} transform={`translate(${x} ${y}) skewY(-5)`}>
                <rect width="74" height="128" rx="3" />
                <T x={8} y={14} s={6}>{n}</T>
                <T x={8} y={34} s={12} w={500}>{p}</T>
                <T x={8} y={44} s={5} w={500} o={0.7}>TRUE PRICE</T>
                {bars.map((b, k) => <rect key={k} x="8" y={56 + k * 12} width={b * 0.8} height="4" rx="2" fill="#d9eef1" stroke="none" opacity={0.3 + k * 0.1} />)}
                {[0, 1, 2].map((k) => <path key={k} d={`M8 ${98 + k * 9} l3 3 l6 -6`} opacity={k === 2 && i === 2 ? 0.25 : 0.9} />)}
                {[0, 1, 2].map((k) => <line key={k} x1="22" y1={100 + k * 9} x2={58 - k * 6} y2={100 + k * 9} opacity=".45" />)}
              </g>
            );
          })}
          {/* the loupe over the middle trip */}
          <circle cx="178" cy="110" r="40" fill="#3b5970" fillOpacity=".55" />
          <circle cx="178" cy="110" r="40" filter={glow} />
          <circle cx="178" cy="110" r="46" opacity=".4" />
          <path d="M209 140 L248 186" strokeWidth="5" opacity=".9" />
          <path d="M248 186 L262 204 M232 212 L292 212" opacity=".8" />
          <ellipse cx="262" cy="214" rx="30" ry="6" opacity=".7" />
          {[[160, 96], [170, 120], [192, 104], [186, 126], [198, 90], [156, 116]].map(([x, y], k) => (
            <circle key={k} cx={x} cy={y} r={k % 2 ? 1.6 : 2.4} fill="#ffffff" stroke="none" filter={glow} />
          ))}
          <path d="M160 96 L170 120 L186 126 L192 104 L198 90" opacity=".8" />
        </>
      )}
    </Frame>
  );
}

export function ShortlistArt() {
  const rows = [["Spiti Winter Expedition", "₹18.5k"], ["Ladakh Bike Trip", "₹24.9k"], ["Meghalaya Backpacking", "₹21.0k"], ["Kerala Backwaters", "₹9.4k"]];
  return (
    <Frame id="bp-short">
      {(glow) => (
        <>
          <path d="M24 46 L262 38 L272 184 L30 196 Z" fill="#344d61" />
          <T x={38} y={62} s={7.5}>YOUR SHORTLIST</T>
          <rect x="196" y="51" width="58" height="14" rx="2" />
          <T x={225} y={60.5} s={5.5} a="middle">SHARE LIST</T>
          <line x1="34" y1="72" x2="262" y2="67" opacity=".5" />
          {rows.map(([n, p], i) => (
            <g key={n} transform={`translate(38 ${82 + i * 26})`}>
              <path d="M6 13 C-4 6 0 -2 6 3 C12 -2 16 6 6 13 Z" fill={i < 3 ? "#ffffff" : "none"} stroke={i < 3 ? "none" : "#d9eef1"} filter={i === 0 ? glow : undefined} opacity={i < 3 ? 0.9 : 0.8} />
              <T x={22} y={10} s={6.5} w={500}>{n}</T>
              <T x={212} y={10} s={6.5} a="end">{p}</T>
              <line x1="0" y1="20" x2="214" y2="20" opacity=".25" />
            </g>
          ))}
          {/* sent to the group */}
          <path d="M268 112 C292 112 296 92 312 92" strokeDasharray="2 3" />
          <path d="M306 87 l7 5 l-7 5" />
          <rect x="318" y="58" width="62" height="118" rx="10" fill="#344d61" />
          <rect x="342" y="64" width="14" height="3" rx="1.5" opacity=".6" />
          <rect x="326" y="80" width="42" height="16" rx="6" />
          <rect x="332" y="102" width="40" height="16" rx="6" fill="#d9eef1" fillOpacity=".2" />
          <rect x="326" y="124" width="36" height="16" rx="6" />
          <T x={331} y={90.5} s={5.5} w={500}>3 trips ♥</T>
          <T x={337} y={112.5} s={5.5} w={500}>spiti?!</T>
          <T x={331} y={134.5} s={5.5} w={500}>in!</T>
          <circle cx="349" cy="164" r="5" opacity=".7" />
        </>
      )}
    </Frame>
  );
}

export function BookArt() {
  return (
    <Frame id="bp-book">
      {(glow) => (
        <>
          {/* the trip, as a ticket */}
          <path d="M26 62 H186 a8 8 0 0 0 0 16 V170 a8 8 0 0 0 0 16 H26 Z" fill="#344d61" />
          <line x1="150" y1="66" x2="150" y2="182" strokeDasharray="3 3" opacity=".6" />
          <T x={38} y={84} s={6} o={0.8}>GROUP DEPARTURE</T>
          <T x={38} y={104} s={13} w={500}>SPITI VALLEY</T>
          <T x={38} y={122} s={6.5} w={500} o={0.85}>8 DAYS · 14 DEC · DELHI</T>
          <T x={38} y={150} s={5.5} o={0.7}>TRUE PRICE</T>
          <T x={38} y={166} s={11} w={500}>₹18,450</T>
          {[0, 3, 5, 9, 11, 14, 18, 20, 23].map((x, i) => <line key={i} x1={158 + x} y1="90" x2={158 + x} y2="160" strokeWidth={i % 3 ? 1 : 2} opacity=".85" />)}
          {/* straight to the operator's own page */}
          <path d="M192 124 C220 124 226 100 250 100" stroke="#ffffff" strokeWidth="1.4" filter={glow} />
          <path d="M244 95 l7 5 l-7 5" stroke="#ffffff" filter={glow} />
          <rect x="258" y="52" width="128" height="150" rx="5" fill="#344d61" />
          <line x1="258" y1="66" x2="386" y2="66" opacity=".6" />
          {[266, 273, 280].map((x) => <circle key={x} cx={x} cy="59" r="1.8" opacity=".7" />)}
          <rect x="290" y="55" width="86" height="8" rx="4" opacity=".6" />
          <T x={296} y={61.3} s={4.6} w={500} o={0.8}>operator's site ↗</T>
          <rect x="268" y="76" width="108" height="50" rx="3" opacity=".7" />
          <path d="M268 116 L292 96 L304 108 L322 88 L346 112 L376 98" opacity=".6" />
          <line x1="268" y1="138" x2="350" y2="138" opacity=".45" />
          <line x1="268" y1="148" x2="330" y2="148" opacity=".45" />
          <line x1="268" y1="158" x2="342" y2="158" opacity=".45" />
          <rect x="268" y="172" width="54" height="18" rx="3" fill="#d9eef1" fillOpacity=".18" filter={glow} />
          <T x={295} y={183.5} s={6.5} a="middle">BOOK</T>
          <T x={332} y={184} s={5} w={500} o={0.7}>no fee</T>
        </>
      )}
    </Frame>
  );
}
