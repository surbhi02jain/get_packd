import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart } from "lucide-react";
import { useApp } from "@/context/AppState";

export function HeartButton({ id, className = "" }) {
  const { hearts, toggleHeart } = useApp();
  const on = hearts.includes(id);
  const [burst, setBurst] = useState(0);
  return (
    <button
      data-testid={`heart-btn-${id}`}
      aria-label={on ? "Remove from shortlist" : "Save to shortlist"}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!on) setBurst((b) => b + 1); toggleHeart(id); }}
      className={`relative grid h-9 w-9 place-items-center rounded-full bg-white/90 text-midnight shadow-soft backdrop-blur transition-transform hover:scale-110 ${className}`}
    >
      <motion.span animate={on ? { scale: [1, 1.35, 1] } : { scale: 1 }} transition={{ duration: 0.35 }}>
        <Heart size={17} className={on ? "fill-coral text-coral" : ""} />
      </motion.span>
      <AnimatePresence>
        {burst > 0 && on && (
          <motion.span key={burst} className="pointer-events-none absolute inset-0" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.7 }}>
            {[...Array(8)].map((_, i) => (
              <motion.span key={i} className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-coral"
                initial={{ x: 0, y: 0 }} animate={{ x: Math.cos((i / 8) * 6.28) * 22, y: Math.sin((i / 8) * 6.28) * 22 }} transition={{ duration: 0.5 }} />
            ))}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
