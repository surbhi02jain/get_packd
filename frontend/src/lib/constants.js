import {
  Mountain, Compass, Gem, Backpack, UtensilsCrossed, Palmtree, PawPrint, Flower2, Bike, Camera,
  PartyPopper, Laptop, Snowflake,
} from "lucide-react";

export const USD_RATE = 85;

export const PERSONAS = [
  ["solo_woman", "Solo woman"], ["solo_man", "Solo man"], ["friends", "Friends"], ["couple", "Couple"],
  ["parents", "Parents"], ["family", "Family with kids"], ["senior_solo", "60+ solo"],
  ["senior_group", "60+ with friends/spouse"], ["corporate", "Corporate / college group"],
];

export const STYLES = {
  hiking: { label: "Hiking & trekking", icon: Mountain, color: "#15803D", anim: "hiker" },
  offbeat: { label: "Offbeat", icon: Compass, color: "#EA580C", anim: "sunrise" },
  luxury: { label: "Luxury", icon: Gem, color: "#BE185D", anim: "sparkle" },
  backpacking: { label: "Budget backpacking", icon: Backpack, color: "#0D9488" },
  culture_food: { label: "Culture & food", icon: UtensilsCrossed, color: "#D97706" },
  beaches: { label: "Beaches & islands", icon: Palmtree, color: "#0284C7" },
  wildlife: { label: "Wildlife & safari", icon: PawPrint, color: "#65A30D" },
  spiritual: { label: "Spiritual & wellness", icon: Flower2, color: "#9333EA" },
  roadtrip: { label: "Road trips & biking", icon: Bike, color: "#DC2626" },
  photography: { label: "Photography", icon: Camera, color: "#475569" },
  party: { label: "Party & festival", icon: PartyPopper, color: "#DB2777" },
  workation: { label: "Workations", icon: Laptop, color: "#4F46E5" },
  winter: { label: "Winter & snow", icon: Snowflake, color: "#0EA5E9" },
};

export const LABELS = {
  audience: { solo: "Solo friendly", friends: "Friends", couples: "Couples", parents: "Parents", family: "Family / kids", seniors_solo: "60+ solo friendly", seniors_group: "60+ groups", corporate: "Corporate" },
  as: Object.fromEntries(PERSONAS),
  gender: { women_only: "Women-only", mixed: "Mixed" },
  age: { "18-25": "18–25", "25-35": "25–35", "35-45": "35–45", "45-60": "45–60", "60+": "60+" },
  size: { small: "Small (<10)", medium: "Medium (10–20)", large: "Large (20+)" },
  dtype: { domestic: "Domestic", international: "International" },
  climate: { snow: "Snow", beach: "Beach", mountains: "Mountains", desert: "Desert", jungle: "Jungle", city: "City" },
  dur: { "2-5": "2–5 days", "6-9": "6–9 days", "10-14": "10–14 days", "15+": "15+ days" },
  style: Object.fromEntries(Object.entries(STYLES).map(([k, v]) => [k, v.label])),
  pace: { slow: "Slow & chill", moderate: "Moderate", adventurous: "Adventurous" },
  difficulty: { easy: "Easy", moderate: "Moderate", hard: "Hard" },
  stay: { hostel: "Hostel", budget: "Budget", comfort: "Comfort", luxury: "Luxury" },
  diet: { veg: "Veg", nonveg: "Non-veg", vegan: "Vegan", jain: "Jain" },
  incl: { meals: "Meals included", permits_visa: "Permits / visa included", flights: "Flights included", insurance: "Insurance" },
  trust: { verified: "Verified operators only", women_leader: "Women trip leader", medical: "Medical support", solo_friendly: "Solo-traveller friendly" },
  op_type: { community: "Community / creator", scuba: "Scuba diving", women_specialist: "Women-only specialist", hostel: "Hostel / backpacker brand", aggregator: "Marketplace / aggregator", legacy: "Large tour company", trekking: "Trekking specialist", seniors: "60+ / senior-focused", luxury: "Luxury small-group" },
  solo_many: { 1: "Many solo travellers" }, private_room: { 1: "Private room available" }, visa_easy: { 1: "Visa-free / on arrival" },
};

export const STATUS = {
  open: { label: "Open", cls: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300" },
  filling: { label: "Filling fast", cls: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300" },
  confirmed: { label: "Confirmed", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  cancelled: { label: "Cancelled", cls: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" },
};

export const CATEGORY_PAGES = {
  "women-only-trips": { title: "Women-only Trips", sub: "Women-only group departures from the operators who run them, side by side.", params: { gender: "women_only" } },
  "solo-travel-60-plus": { title: "Solo Travel for 60+", sub: "Group departures suited to solo travellers over 60.", params: { audience: "seniors_solo" } },
  "luxury-escapes": { title: "Luxury Escapes", sub: "Group departures the operators themselves describe as luxury or premium.", params: { style: "luxury" } },
  "offbeat-journeys": { title: "Offbeat Journeys", sub: "Places the itineraries forgot.", params: { style: "offbeat" } },
  "spiti-group-trips-october": { title: "Spiti Group Trips in October", sub: "Compare every Spiti departure in October side by side.", params: { q: "spiti", start: "2026-10-01", end: "2026-10-31", flex: "0" } },
};
