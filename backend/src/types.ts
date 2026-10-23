export type Inclusion = boolean | "partial";
export type Inclusions = Record<string, Inclusion>;

export interface Destination {
  slug: string;
  name: string;
  region: string;
  countries: string[];
  dtype: string;
  climate: string[];
  lat: number;
  lng: number;
  meeting: string;
  end: string;
  places: string[];
  highlights: string[];
  image: string | null;
  visa_easy: boolean;
  flight_est: number;
}

export interface Leader {
  name: string;
  gender: string;
  years: number;
  trips_led: number;
  certs: string[];
  bio: string;
}

export interface Operator {
  id: string;
  name: string;
  category: string;
  bio: string;
  website: string;
  instagram: string;
  verified_status: string;
  verification: Record<string, boolean>;
  years_active: number | null;
  rating: number | null;
  review_count: number;
  leaders: Leader[];
  sample: boolean;
  /** "import" for operators and trips read from operators' own sites. */
  source?: string;
  trips_imported?: boolean;
  /** Instagram followers of the operator's confirmed account, and when the figure was read. */
  instagram_followers?: number | null;
  instagram_followers_at?: string | null;
  /** "instagram-api", "qoruz", or "manual" for a hand-entered figure. */
  instagram_followers_source?: string | null;
  /** Star ratings from Google Maps and Tripadvisor listings confirmed as the operator's own. */
  external_ratings?: ExternalRating[];
  /** A few reviews from those listings (the most relevant ones each site gives out). */
  external_reviews?: ExternalReview[];
}

export interface ExternalRating {
  source: "google" | "tripadvisor";
  rating: number;
  count: number;
  /** The listing on Google Maps or Tripadvisor. */
  url: string;
  /** Tripadvisor's own rating-bubbles image, which its terms ask to be shown with the rating. */
  rating_image?: string | null;
  as_of: string;
}

export interface ExternalReview {
  source: "google" | "tripadvisor";
  author: string;
  author_url?: string | null;
  author_photo?: string | null;
  rating: number;
  title?: string | null;
  text: string;
  date: string | null;
  /** "2 months ago", as Google words it. */
  relative?: string | null;
  url?: string | null;
}

export interface ItineraryDay {
  day: number;
  title: string;
  description: string;
  place: string;
  stay: string | null;
  meals: string[];
}

export interface Trip {
  id: string;
  operator_id: string;
  title: string;
  destination_slug: string;
  destinations: string[];
  country: string[];
  domestic_or_international: string;
  climate_tags: string[];
  meeting_point: string;
  end_point: string;
  duration_days: number;
  categories: string[];
  audience_tags: string[];
  pace: string | null;
  difficulty: string | null;
  stay_tier: string | null;
  room_sharing: string;
  private_room?: boolean;
  min_group: number | null;
  max_group: number | null;
  age_band: string | null;
  gender_policy: string;
  kid_friendly: boolean;
  senior_friendly: boolean;
  medical_support: boolean;
  visa_required: boolean;
  visa_easy?: boolean;
  diet_options: string[];
  itinerary_days: ItineraryDay[];
  inclusions: Inclusions;
  /** The operator's own inclusion bullet points (imported trips). */
  inclusion_list?: string[];
  exclusions: string[];
  cancellation_policy: string;
  leader: Leader | null;
  women_leader?: boolean;
  image?: string | null;
  review_count?: number;
  sample: boolean;
  source?: string;
  /** The trip's page on the operator's site. */
  url?: string | null;
}

export interface Departure {
  id: string;
  trip_id: string;
  start_date: string;
  end_date: string;
  price_inr: number;
  seats_total: number | null;
  seats_left: number | null;
  status: string;
  last_verified_at: string;
}

export interface GroupStats {
  departure_id: string;
  booked_count: number;
  age_median: number;
  age_range: [number, number];
  gender_split: { female: number; male: number };
  solo_ratio: number;
}

export interface Review {
  id: string;
  trip_id: string;
  author: string;
  rating: number;
  breakdown: Record<string, number>;
  text: string;
  date: string;
  sample: boolean;
}
