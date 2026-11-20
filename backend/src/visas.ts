// Visa and entry rules for Indian passport holders, for the countries getPackd has international trips to.
// Hand-written from official portals and recent reports; rules change often, so each entry links the official site
// and the page shows when this was last checked. Update VISAS_CHECKED whenever an entry is re-checked.

export const VISAS_CHECKED = "2026-10-24";

/** How hard entry is, easiest first; the page groups and sorts by it. */
export const VISA_KINDS = ["none", "free", "permit", "eta", "arrival", "evisa", "visa"] as const;
export type VisaKind = (typeof VISA_KINDS)[number];

export interface VisaInfo {
  key: string;
  country: string;
  flag: string;
  kind: VisaKind;
  headline: string;
  stay: string;
  cost: string;
  apply: string;
  documents: string[];
  notes: string[];
  official: { label: string; url: string }[];
  /** For a group of countries under one visa (Schengen): the countries it covers. Each gets its own card on the page. */
  members?: string[];
  /** On a member country's card: the group it belongs to, e.g. "Schengen". */
  group?: string;
}

export const VISAS: VisaInfo[] = [
  {
    key: "nepal", country: "Nepal", flag: "🇳🇵", kind: "none",
    headline: "No visa needed",
    stay: "No set limit", cost: "Free", apply: "Nothing to apply for",
    documents: ["Indian passport, or original Election Commission voter ID with photo", "For flights a passport is safest; airlines may not take other IDs"],
    notes: ["Aadhaar, PAN and driving licences are not accepted as entry documents", "Trekking areas need their own permits; operators usually arrange them"],
    official: [{ label: "Nepal Department of Immigration", url: "https://www.immigration.gov.np/" }, { label: "Embassy of India, Kathmandu", url: "https://www.indembkathmandu.gov.in/" }],
  },
  {
    key: "bhutan", country: "Bhutan", flag: "🇧🇹", kind: "permit",
    headline: "No visa, but an entry permit and a daily fee",
    stay: "As per your permit", cost: "SDF ₹1,200 per person per night", apply: "Online at immi.gov.bt, or at Phuentsholing or Paro on arrival",
    documents: ["Indian passport valid 6+ months, or original voter ID", "2 recent passport photos", "Hotel bookings or itinerary", "Proof of SDF payment", "Birth certificate for children travelling without a passport"],
    notes: ["Aadhaar, PAN, driving licences and OCI cards are not accepted", "Children under 5 pay no SDF; check the rate for older children", "Day visits to border towns: SDF waived for up to 24 hours"],
    official: [{ label: "Bhutan Department of Immigration", url: "https://immi.gov.bt/" }],
  },
  {
    key: "thailand", country: "Thailand", flag: "🇹🇭", kind: "free",
    headline: "Visa-free for 30 days",
    stay: "30 days (cut from 60 on 15 Sep 2026); one extension may be granted", cost: "Free", apply: "Fill in the TDAC arrival card online in the 3 days before you land",
    documents: ["Passport valid 6+ months", "Thailand Digital Arrival Card (TDAC)", "Return or onward ticket", "Proof of funds, if asked"],
    notes: ["This rule changed recently; check before you fly", "For longer stays apply for an e-Visa at thaievisa.go.th"],
    official: [{ label: "Thailand Digital Arrival Card", url: "https://tdac.immigration.go.th/" }, { label: "Thai e-Visa", url: "https://www.thaievisa.go.th/" }],
  },
  {
    key: "malaysia", country: "Malaysia", flag: "🇲🇾", kind: "free",
    headline: "Visa-free for 30 days, until 31 Dec 2026",
    stay: "30 days", cost: "Free", apply: "Fill in the MDAC arrival card online in the 3 days before you land",
    documents: ["Passport valid 6+ months", "Malaysia Digital Arrival Card (MDAC)", "Return ticket", "Hotel booking and proof of funds, if asked"],
    notes: ["The exemption runs to 31 Dec 2026; for trips in 2027, check again", "The 30 days can't be extended inside Malaysia"],
    official: [{ label: "Immigration Department of Malaysia", url: "https://www.imi.gov.my/" }],
  },
  {
    key: "kazakhstan", country: "Kazakhstan", flag: "🇰🇿", kind: "free",
    headline: "Visa-free for 14 days",
    stay: "14 days per visit, up to 42 days in any 180", cost: "Free", apply: "Nothing to apply for",
    documents: ["Passport valid 6+ months", "Return ticket", "Hotel booking"],
    notes: ["The 14 days can't be extended", "Longer stays need an e-visa, which needs a Kazakh invitation"],
    official: [{ label: "Kazakhstan Ministry of Foreign Affairs", url: "https://www.gov.kz/memleket/entities/mfa" }],
  },
  {
    key: "srilanka", country: "Sri Lanka", flag: "🇱🇰", kind: "eta",
    headline: "Free ETA, applied for before you fly",
    stay: "30 days, extendable", cost: "Free for Indians since 25 May 2026", apply: "Online at eta.gov.lk",
    documents: ["Passport valid 6+ months", "Return or onward ticket", "Address of your first stay"],
    notes: ["Only the tourist ETA is free; a business ETA is paid", "Use only eta.gov.lk; look-alike sites charge fees"],
    official: [{ label: "Sri Lanka ETA", url: "https://www.eta.gov.lk/" }],
  },
  {
    key: "indonesia", country: "Indonesia (Bali)", flag: "🇮🇩", kind: "arrival",
    headline: "Visa on arrival, or e-VOA online",
    stay: "30 days, extendable once by 30", cost: "IDR 500,000 (about ₹2,700), plus IDR 150,000 Bali tourist levy", apply: "e-VOA at evisa.imigrasi.go.id before you fly, or at the airport",
    documents: ["Passport valid 6+ months with 2 blank pages", "Return or onward ticket", "An internationally enabled Visa or Mastercard for the e-VOA; RuPay cards often fail"],
    notes: ["Pay the Bali levy at lovebali.baliprov.go.id", "Indonesia has been adding an online arrival card; check whether you need it before you fly"],
    official: [{ label: "Indonesia e-Visa / e-VOA", url: "https://evisa.imigrasi.go.id/" }, { label: "Bali tourist levy", url: "https://lovebali.baliprov.go.id/" }],
  },
  {
    key: "laos", country: "Laos", flag: "🇱🇦", kind: "arrival",
    headline: "Visa on arrival, or e-Visa",
    stay: "30 days", cost: "About USD 35–50; check the current fee", apply: "At international entry points, or e-Visa at laoevisa.gov.la",
    documents: ["Passport valid 6+ months with 2 blank pages", "Passport photo", "US dollars in cash for the visa on arrival"],
    notes: ["Fees quoted online vary; the official portal has the current one"],
    official: [{ label: "Laos e-Visa", url: "https://laoevisa.gov.la/" }],
  },
  {
    key: "vietnam", country: "Vietnam", flag: "🇻🇳", kind: "evisa",
    headline: "e-Visa needed",
    stay: "Up to 90 days", cost: "USD 25 single entry, USD 50 multiple", apply: "Online at evisa.gov.vn, about 3–5 working days",
    documents: ["Passport valid 6+ months", "Passport-size photo and a scan of your passport photo page", "Entry and exit airports, given on the form"],
    notes: ["Agency sites charge several times the official fee; apply on evisa.gov.vn", "The fee isn't refunded if the visa is refused"],
    official: [{ label: "Vietnam e-Visa", url: "https://evisa.gov.vn/" }],
  },
  {
    key: "cambodia", country: "Cambodia", flag: "🇰🇭", kind: "evisa",
    headline: "e-Visa needed",
    stay: "30 days", cost: "USD 30 plus a processing fee", apply: "Online at evisa.gov.kh, about 3 working days",
    documents: ["Passport valid 6+ months", "Passport-size photo", "e-Arrival card, for air arrivals"],
    notes: ["The e-Arrival card is free and separate from the visa"],
    official: [{ label: "Cambodia e-Visa", url: "https://www.evisa.gov.kh/" }],
  },
  {
    key: "georgia", country: "Georgia", flag: "🇬🇪", kind: "evisa",
    headline: "e-Visa needed",
    stay: "Up to 30 days", cost: "About USD 20 plus a service fee", apply: "Online at evisa.gov.ge; apply at least 2 weeks ahead",
    documents: ["Passport valid 6+ months", "Travel medical insurance for the whole stay (required since 1 Jan 2026)", "Hotel bookings and return ticket", "Recent bank statement"],
    notes: ["Holders of some valid foreign visas or residence permits (such as US, UK or Schengen) may be able to enter visa-free; confirm on the official site before relying on it"],
    official: [{ label: "Georgia e-Visa", url: "https://www.evisa.gov.ge/" }, { label: "Georgia consular information", url: "https://www.geoconsul.gov.ge/" }],
  },
  {
    key: "uae", country: "UAE (Dubai)", flag: "🇦🇪", kind: "visa",
    headline: "Visa needed before you fly; on arrival only with a US, UK or EU visa",
    stay: "30 or 60 days on a tourist visa; 14 days on arrival", cost: "Tourist visa about ₹6,500–8,500 via airlines or agents; AED 100 on arrival", apply: "Through your airline, hotel or a travel agent, or online with ICP or GDRFA",
    documents: ["Passport valid 6+ months", "Passport-size photo", "Return ticket and hotel booking", "For visa on arrival: a valid US visa or green card, or a UK or EU visa or residence permit"],
    notes: ["Many group-trip operators arrange the visa for you; check the trip's inclusions"],
    official: [{ label: "UAE ICP", url: "https://icp.gov.ae/" }, { label: "GDRFA Dubai", url: "https://gdrfad.gov.ae/" }],
  },
  {
    key: "singapore", country: "Singapore", flag: "🇸🇬", kind: "visa",
    headline: "Visa needed, through an authorised agent",
    stay: "As granted, often up to 30 days", cost: "Set by the agent; check before you apply", apply: "Through Singapore's authorised visa agents in India",
    documents: ["Passport valid 6+ months", "Completed Form 14A", "Recent passport photo", "Return ticket and hotel booking"],
    notes: ["Also fill in the free SG Arrival Card in the 3 days before you land", "Visa-free transit for under 96 hours may apply in some cases; check ICA's conditions"],
    official: [{ label: "Singapore ICA", url: "https://www.ica.gov.sg/enter-transit-depart/entering-singapore" }],
  },

  // ---------- destinations without trips yet ----------
  {
    key: "maldives", country: "Maldives", flag: "🇲🇻", kind: "arrival",
    headline: "Free visa on arrival",
    stay: "30 days, extendable up to 90", cost: "Free", apply: "On arrival at Velana airport; fill in the IMUGA traveller declaration online in the 96 hours before",
    documents: ["Passport valid 6+ months", "IMUGA traveller declaration (QR code)", "Confirmed resort or hotel booking", "Return ticket and enough funds"],
    notes: [],
    official: [{ label: "Maldives Immigration", url: "https://immigration.gov.mv/" }, { label: "IMUGA declaration", url: "https://imuga.immigration.gov.mv/" }],
  },
  {
    key: "mauritius", country: "Mauritius", flag: "🇲🇺", kind: "arrival",
    headline: "Free visa on arrival",
    stay: "Usually up to 60 days; sources differ, so check", cost: "Free", apply: "On arrival; check whether an online arrival form is needed",
    documents: ["Passport valid 6+ months", "Return ticket", "Hotel booking", "Proof of funds, if asked"],
    notes: [],
    official: [{ label: "Mauritius Passport and Immigration Office", url: "https://passport.govmu.org/" }],
  },
  {
    key: "seychelles", country: "Seychelles", flag: "🇸🇨", kind: "eta",
    headline: "No visa, but an online Travel Authorisation first",
    stay: "Visitor permit on arrival, often up to 3 months", cost: "Travel Authorisation about €10–12; visitor permit free", apply: "Online on the official Seychelles TA portal before you fly",
    documents: ["Passport valid 6+ months", "Approved Travel Authorisation", "Return ticket", "Hotel booking and proof of funds"],
    notes: ["Airlines check the Travel Authorisation at check-in", "Only use the official portal; agents add large fees"],
    official: [{ label: "Seychelles Travel Authorisation", url: "https://seychelles.govtas.com/" }],
  },
  {
    key: "philippines", country: "Philippines", flag: "🇵🇭", kind: "free",
    headline: "Visa-free for 14 days; 30 days with a US, UK or Schengen visa",
    stay: "14 days (can't be extended); 30 days if you hold a valid US, UK, Canada, Australia, Japan, Singapore or Schengen visa or residence", cost: "Free", apply: "Register on eTravel before you fly",
    documents: ["Passport valid 6+ months", "eTravel registration", "Return or onward ticket", "Hotel booking and proof of funds"],
    notes: ["For longer stays without a qualifying visa, apply for a Philippine visa in advance"],
    official: [{ label: "Philippine Bureau of Immigration", url: "https://immigration.gov.ph/" }, { label: "eTravel", url: "https://etravel.gov.ph/" }],
  },
  {
    key: "hongkong", country: "Hong Kong", flag: "🇭🇰", kind: "eta",
    headline: "Free online pre-arrival registration",
    stay: "14 days per visit", cost: "Free", apply: "Pre-arrival registration (PAR) online before you fly, usually approved quickly",
    documents: ["Passport valid 6+ months", "Approved pre-arrival registration", "Return ticket"],
    notes: ["Longer stays need a full visit visa", "Not needed if you only transit without leaving the airport"],
    official: [{ label: "Hong Kong Immigration Department", url: "https://www.immd.gov.hk/" }],
  },
  {
    key: "macau", country: "Macau", flag: "🇲🇴", kind: "free",
    headline: "Visa-free, reportedly for 30 days",
    stay: "Reported as 30 days; check", cost: "Free", apply: "Nothing to apply for",
    documents: ["Passport valid 6+ months", "Return or onward ticket", "Hotel booking and proof of funds"],
    notes: [],
    official: [{ label: "Macau Public Security Police", url: "https://www.fsm.gov.mo/psp/eng/" }],
  },
  {
    key: "japan", country: "Japan", flag: "🇯🇵", kind: "evisa",
    headline: "Visa needed; single-entry e-Visa available",
    stay: "Up to 90 days", cost: "Visa fee ₹500, plus VFS service charge", apply: "Through VFS Global in India; single-entry tourist e-Visa through Japan's eVISA system",
    documents: ["Passport valid for the trip", "Visa form and recent photo", "Day-by-day itinerary and bookings", "Bank statements and income tax returns"],
    notes: ["The ₹500 fee for Indians applies from 1 July 2026; check the embassy page for the current amount"],
    official: [{ label: "Embassy of Japan in India", url: "https://www.in.emb-japan.go.jp/itpr_en/Visa.html" }, { label: "Japan eVISA", url: "https://www.evisa.mofa.go.jp/" }],
  },
  {
    key: "southkorea", country: "South Korea", flag: "🇰🇷", kind: "visa",
    headline: "Visa needed",
    stay: "Up to 90 days on a single-entry visa", cost: "About ₹3,600 single entry, plus centre charges", apply: "Through the Korean visa application centre in India; about 10 working days",
    documents: ["Passport valid 6+ months", "Visa form and photo", "Bank statements and income proof", "Flight and hotel bookings"],
    notes: ["K-ETA is not open to Indian passport holders", "Also fill in the free e-Arrival Card online before you land"],
    official: [{ label: "Embassy of Korea in India", url: "https://overseas.mofa.go.kr/in-en/index.do" }],
  },
  {
    key: "china", country: "China", flag: "🇨🇳", kind: "visa",
    headline: "Visa needed",
    stay: "As granted, often 30 days", cost: "₹2,900 single entry (reduced fees run to 31 Dec 2026), plus centre service fee", apply: "Online form, then one visit to a Chinese Visa Application Service Center (Delhi, Mumbai or Kolkata); about 4 working days",
    documents: ["Passport valid 6+ months with blank pages", "Online application form and photo", "Flight and hotel bookings, or an invitation"],
    notes: ["Fingerprints are waived for short stays until 31 Dec 2026"],
    official: [{ label: "Chinese Visa Application Service Center", url: "https://www.visaforchina.cn/" }],
  },
  {
    key: "tibet", country: "Tibet & Kailash", flag: "🏔️", kind: "visa",
    headline: "Chinese group visa plus Tibet Travel Permit, arranged by an operator",
    stay: "For the tour dates", cost: "Included in most tour prices; check", apply: "Through a licensed operator, or the MEA's Kailash Mansarovar Yatra",
    documents: ["Passport valid 6+ months", "Passport scans and photos for the operator", "Medical fitness certificate for Kailash"],
    notes: ["Start 3–4 months ahead; permits can take 45–60 days", "Independent travel isn't allowed in Tibet"],
    official: [{ label: "Kailash Mansarovar Yatra (MEA)", url: "https://kmy.gov.in/" }],
  },
  {
    key: "uzbekistan", country: "Uzbekistan", flag: "🇺🇿", kind: "evisa",
    headline: "e-Visa needed",
    stay: "Up to 30 days", cost: "About USD 20", apply: "Online at e-visa.gov.uz, about 2–3 working days",
    documents: ["Passport valid 6+ months", "Passport photo"],
    notes: [],
    official: [{ label: "Uzbekistan e-Visa", url: "https://e-visa.gov.uz/" }],
  },
  {
    key: "kyrgyzstan", country: "Kyrgyzstan", flag: "🇰🇬", kind: "evisa",
    headline: "e-Visa needed",
    stay: "Up to 30 days", cost: "About USD 30–50", apply: "Online at evisa.e-gov.kg; some applicants need an invitation letter",
    documents: ["Passport valid 6+ months", "Passport photo", "Invitation letter, if asked"],
    notes: ["Check whether you need an invitation letter before you apply"],
    official: [{ label: "Kyrgyzstan e-Visa", url: "https://www.evisa.e-gov.kg/" }],
  },
  {
    key: "azerbaijan", country: "Azerbaijan", flag: "🇦🇿", kind: "evisa",
    headline: "e-Visa needed",
    stay: "Up to 30 days", cost: "About USD 20–26", apply: "Online through ASAN Visa, about 3 working days",
    documents: ["Passport valid 6+ months", "Passport scan"],
    notes: [],
    official: [{ label: "Azerbaijan ASAN Visa", url: "https://evisa.gov.az/" }],
  },
  {
    key: "armenia", country: "Armenia", flag: "🇦🇲", kind: "evisa",
    headline: "e-Visa needed",
    stay: "21 or 120 days", cost: "From about USD 10 (AMD 3,000) for 21 days; check", apply: "Online at evisa.mfa.am",
    documents: ["Passport valid 6+ months", "Travel health insurance", "Return ticket and bank statement, or a qualifying foreign visa or residence permit"],
    notes: ["Some travellers with valid residence permits may enter without a visa under a temporary scheme; check the dates"],
    official: [{ label: "Armenia e-Visa", url: "https://evisa.mfa.am/" }],
  },
  {
    key: "turkey", country: "Turkey", flag: "🇹🇷", kind: "visa",
    headline: "Visa needed; e-Visa only with a US, UK, Schengen or Irish visa",
    stay: "30 days on the e-Visa", cost: "e-Visa about USD 43; sticker visa about USD 60 plus service charges", apply: "e-Visa at evisa.gov.tr if you hold a qualifying visa or residence; otherwise a sticker visa through the visa centre",
    documents: ["Passport valid 6+ months", "Valid US, UK, Schengen or Irish visa or residence permit, for the e-Visa", "Flight and hotel bookings", "Bank statements, for the sticker visa"],
    notes: ["The sticker visa takes about 4–12 working days and needs biometrics"],
    official: [{ label: "Turkey e-Visa", url: "https://www.evisa.gov.tr/" }],
  },
  {
    key: "russia", country: "Russia", flag: "🇷🇺", kind: "evisa",
    headline: "Unified e-Visa",
    stay: "Up to 16 days, single entry", cost: "About USD 52", apply: "Online on the unified e-visa site; decided within 4 days",
    documents: ["Passport valid 6+ months", "Passport photo", "Travel medical insurance"],
    notes: ["Longer trips need a regular visa with an invitation"],
    official: [{ label: "Russia unified e-Visa", url: "https://evisa.kdmid.ru/" }],
  },
  {
    key: "schengen", country: "Schengen area (29 countries)", flag: "🇪🇺", kind: "visa",
    headline: "One Schengen visa covers all 29 countries",
    members: ["Austria", "Belgium", "Bulgaria", "Croatia", "Czechia", "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", "Hungary",
      "Iceland", "Italy", "Latvia", "Liechtenstein", "Lithuania", "Luxembourg", "Malta", "Netherlands", "Norway", "Poland", "Portugal",
      "Romania", "Slovakia", "Slovenia", "Spain", "Sweden", "Switzerland"],
    stay: "Up to 90 days in any 180", cost: "€90 (children 6–11 €45, under 6 free), plus VFS or BLS charges", apply: "At the visa centre for the country you'll spend longest in; about 15 days, longer in summer",
    documents: ["Passport valid 3+ months after you leave, issued in the last 10 years", "Visa form and photo", "Travel insurance covering €30,000", "Flight and hotel bookings, day-by-day itinerary", "Bank statements, income tax returns and leave letter"],
    notes: ["Apply up to 6 months ahead; appointments fill up from March to August", "Indians who used earlier Schengen visas well can get multi-year visas under the 'cascade' rules",
      "On your first entry, fingerprints and a photo are taken at the border for the EU Entry/Exit System", "Not covered: the UK, Ireland and Cyprus need their own visas"],
    official: [{ label: "EU visa policy", url: "https://home-affairs.ec.europa.eu/policies/schengen-borders-and-visa/visa-policy_en" }],
  },
  {
    key: "uk", country: "United Kingdom", flag: "🇬🇧", kind: "visa",
    headline: "Standard Visitor visa needed",
    stay: "Up to 6 months", cost: "£135 for 6 months", apply: "Online on GOV.UK, then biometrics at a VFS centre; about 3 weeks",
    documents: ["Passport", "Bank statements and income proof", "Leave letter from your employer", "Trip plan and bookings"],
    notes: ["A UK visitor visa can also cover Ireland under the British Irish Visa Scheme"],
    official: [{ label: "GOV.UK Standard Visitor", url: "https://www.gov.uk/standard-visitor" }],
  },
  {
    key: "ireland", country: "Ireland", flag: "🇮🇪", kind: "visa",
    headline: "Visa needed, unless your UK visitor visa covers it",
    stay: "Up to 90 days", cost: "Check the current fee", apply: "Irish short-stay visa through the shared UK–Ireland visa centres, or enter on a UK visitor visa under the British Irish Visa Scheme",
    documents: ["Passport", "Bank statements and income proof", "Flight and hotel bookings"],
    notes: ["Under the British Irish Visa Scheme you must enter the UK first, then travel on to Ireland"],
    official: [{ label: "Embassy of Ireland, India", url: "https://www.ireland.ie/en/india/newdelhi/services/visas/visas-for-ireland/" }],
  },
  {
    key: "usa", country: "United States", flag: "🇺🇸", kind: "visa",
    headline: "B1/B2 visitor visa needed",
    stay: "Decided at entry, often up to 6 months", cost: "USD 185, plus a new USD 250 visa integrity fee where it applies", apply: "Online DS-160 form, then an interview at a US consulate in India",
    documents: ["Passport", "DS-160 confirmation and photo", "Interview appointment letter", "Bank statements, income proof and ties to India"],
    notes: ["Interview waits in India run several months; book well ahead", "The fee is not refunded if refused"],
    official: [{ label: "US travel.state.gov", url: "https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visitor.html" }, { label: "US visa appointments, India", url: "https://www.ustraveldocs.com/in/" }],
  },
  {
    key: "canada", country: "Canada", flag: "🇨🇦", kind: "visa",
    headline: "Visitor visa needed",
    stay: "Up to 6 months", cost: "CAD 100, plus CAD 85 biometrics", apply: "Online with IRCC, then biometrics at a VFS centre; allow several weeks",
    documents: ["Passport", "Bank statements and income proof", "Travel plan", "Ties to India, such as job or property"],
    notes: [],
    official: [{ label: "Visit Canada (IRCC)", url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada.html" }],
  },
  {
    key: "australia", country: "Australia", flag: "🇦🇺", kind: "evisa",
    headline: "Visitor visa (subclass 600), applied online",
    stay: "Up to 3, 6 or 12 months", cost: "About AUD 200–250; fees rise each 1 July", apply: "Online through ImmiAccount; biometrics may be asked",
    documents: ["Passport", "Bank statements and income proof", "Travel plan", "Health insurance recommended"],
    notes: [],
    official: [{ label: "Australia Visitor visa 600", url: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/visitor-600" }],
  },
  {
    key: "newzealand", country: "New Zealand", flag: "🇳🇿", kind: "evisa",
    headline: "Visitor visa, applied online",
    stay: "Up to 9 months", cost: "About NZD 341 plus the International Visitor Levy; check", apply: "Online with Immigration New Zealand",
    documents: ["Passport", "Bank statements and income proof", "Return ticket and itinerary"],
    notes: [],
    official: [{ label: "Immigration New Zealand", url: "https://www.immigration.govt.nz/new-zealand-visas/visas/visa/visitor-visa" }],
  },
  {
    key: "egypt", country: "Egypt", flag: "🇪🇬", kind: "evisa",
    headline: "e-Visa needed",
    stay: "30 days", cost: "About USD 30 single entry", apply: "Online at visa2egypt.gov.eg",
    documents: ["Passport valid 6+ months", "Hotel bookings and return ticket"],
    notes: ["Visa on arrival is reported only for Indians who hold and have used a US, UK, Schengen or GCC visa; the e-Visa is the safer route"],
    official: [{ label: "Egypt e-Visa", url: "https://www.visa2egypt.gov.eg/" }],
  },
  {
    key: "jordan", country: "Jordan", flag: "🇯🇴", kind: "arrival",
    headline: "Visa on arrival, or covered by the Jordan Pass",
    stay: "30 days", cost: "JOD 40, waived with a Jordan Pass if you stay the minimum nights", apply: "On arrival at Amman airport and most land borders (not King Hussein Bridge)",
    documents: ["Passport valid 6+ months", "Jordan Pass, if you bought one", "Hotel booking and return ticket"],
    notes: ["The Jordan Pass also covers Petra entry and is usually cheaper overall"],
    official: [{ label: "Jordan Pass", url: "https://www.jordanpass.jo/" }],
  },
  {
    key: "oman", country: "Oman", flag: "🇴🇲", kind: "evisa",
    headline: "e-Visa needed; on arrival only with a US, UK, Schengen and some other visas",
    stay: "Up to 30 days", cost: "Check the current fee", apply: "Online through Royal Oman Police e-Visa",
    documents: ["Passport valid 6+ months", "Hotel booking and return ticket", "For visa on arrival: a valid US, UK, Canada, Australia, Japan or Schengen visa or residence"],
    notes: [],
    official: [{ label: "Oman e-Visa (Royal Oman Police)", url: "https://evisa.rop.gov.om/" }],
  },
  {
    key: "morocco", country: "Morocco", flag: "🇲🇦", kind: "evisa",
    headline: "e-Visa needed",
    stay: "Up to 30 days", cost: "About MAD 700 (₹6,000)", apply: "Online on the official Morocco e-Visa portal",
    documents: ["Passport valid 6+ months", "Hotel bookings and return ticket", "Bank statements"],
    notes: ["Holders of some valid US, UK or Schengen visas may be exempt; check before applying"],
    official: [{ label: "Morocco e-Visa", url: "https://www.acces-maroc.ma/" }],
  },
  {
    key: "kenya", country: "Kenya", flag: "🇰🇪", kind: "eta",
    headline: "Electronic Travel Authorisation (eTA) needed",
    stay: "Up to 90 days", cost: "About USD 30–34", apply: "Online at etakenya.go.ke, between 90 and 3 days before travel; about 3 days",
    documents: ["Passport valid 6+ months", "Return ticket", "Hotel bookings or safari itinerary", "Yellow fever certificate if arriving from a risk country"],
    notes: ["Only use etakenya.go.ke; look-alike sites charge more"],
    official: [{ label: "Kenya eTA", url: "https://www.etakenya.go.ke/" }],
  },
  {
    key: "tanzania", country: "Tanzania (incl. Zanzibar)", flag: "🇹🇿", kind: "evisa",
    headline: "e-Visa, or visa on arrival",
    stay: "Up to 90 days", cost: "USD 50", apply: "e-Visa online (about 10 days), or on arrival paying in USD notes",
    documents: ["Passport valid 6+ months", "Return ticket", "Yellow fever certificate if arriving from a risk country"],
    notes: ["The e-Visa avoids long queues on arrival", "Covers both the mainland and Zanzibar"],
    official: [{ label: "Tanzania e-Visa", url: "https://visa.immigration.go.tz/" }],
  },
  {
    key: "southafrica", country: "South Africa", flag: "🇿🇦", kind: "visa",
    headline: "Visa needed; an online ETA is being introduced",
    stay: "Up to 90 days", cost: "Check the current fee and VFS charges", apply: "Through the VFS visa centre in India; check whether the new ETA is open to Indians",
    documents: ["Passport valid 30+ days after you leave, with 2 blank pages", "Bank statements and income proof", "Flight and hotel bookings", "Yellow fever certificate if arriving from a risk country"],
    notes: [],
    official: [{ label: "South Africa Home Affairs", url: "http://www.dha.gov.za/" }],
  },
  {
    key: "peru", country: "Peru", flag: "🇵🇪", kind: "visa",
    headline: "Visa-free with a US, UK, Schengen, Canada or Australia visa; otherwise embassy visa",
    stay: "Up to 180 days a year with a qualifying visa", cost: "Free with a qualifying visa", apply: "No application with a qualifying visa; otherwise through the Peruvian embassy",
    documents: ["Passport valid 6+ months", "A US, UK, Schengen, Canadian or Australian visa or residence valid 6+ months", "Return ticket"],
    notes: ["Peru has no visa on arrival or e-Visa for Indians"],
    official: [{ label: "Peru Migraciones", url: "https://www.gob.pe/migraciones" }],
  },
  {
    key: "brazil", country: "Brazil", flag: "🇧🇷", kind: "visa",
    headline: "Visa needed",
    stay: "Up to 90 days", cost: "About ₹8,000–11,000; check", apply: "Through the Brazilian embassy or consulate in India (no e-Visa for Indians)",
    documents: ["Passport valid 6+ months", "Bank statements and income proof", "Flight and hotel bookings"],
    notes: ["Visas for Indians can now be issued for up to 10 years, at the consulate's discretion"],
    official: [{ label: "Brazil Ministry of Foreign Affairs", url: "https://www.gov.br/mre/en" }],
  },
  {
    key: "argentina", country: "Argentina", flag: "🇦🇷", kind: "visa",
    headline: "Visa-free with a valid US visa; otherwise AVE or embassy visa",
    stay: "Up to 90 days", cost: "Free with a US visa; check the AVE fee", apply: "No application with a valid US visa; with a Schengen visa use the online AVE; otherwise apply at the embassy",
    documents: ["Passport valid 6+ months", "Valid US visa, or the approved AVE", "Return ticket and hotel bookings"],
    notes: [],
    official: [{ label: "Argentina Migraciones", url: "https://www.argentina.gob.ar/interior/migraciones" }],
  },
  {
    key: "chile", country: "Chile", flag: "🇨🇱", kind: "visa",
    headline: "Visa-free with a US visa; otherwise embassy visa",
    stay: "Up to 90 days", cost: "Free with a US visa; tourist visa about USD 42", apply: "No application with a US visa valid 6+ months (not a C visa); otherwise through the Chilean embassy",
    documents: ["Passport valid 6+ months", "Valid US visa, or a Chilean tourist visa", "Return ticket"],
    notes: [],
    official: [{ label: "Embassy of Chile in India", url: "https://www.chile.gob.cl/india/" }],
  },
  {
    key: "antarctica", country: "Antarctica", flag: "🇦🇶", kind: "permit",
    headline: "No visa for Antarctica; you need one for the port you sail from",
    stay: "For the expedition", cost: "Permits handled by the expedition operator", apply: "Get entry for Argentina (Ushuaia) or Chile (Punta Arenas); see those countries",
    documents: ["Passport valid 6+ months", "Entry to Argentina or Chile", "Travel insurance with emergency evacuation cover, required by operators"],
    notes: [],
    official: [{ label: "IAATO (Antarctic tour operators)", url: "https://iaato.org/" }],
  },
];

const FLAGS: Record<string, string> = {
  Austria: "🇦🇹", Belgium: "🇧🇪", Bulgaria: "🇧🇬", Croatia: "🇭🇷", Czechia: "🇨🇿", Denmark: "🇩🇰", Estonia: "🇪🇪", Finland: "🇫🇮", France: "🇫🇷",
  Germany: "🇩🇪", Greece: "🇬🇷", Hungary: "🇭🇺", Iceland: "🇮🇸", Italy: "🇮🇹", Latvia: "🇱🇻", Liechtenstein: "🇱🇮", Lithuania: "🇱🇹",
  Luxembourg: "🇱🇺", Malta: "🇲🇹", Netherlands: "🇳🇱", Norway: "🇳🇴", Poland: "🇵🇱", Portugal: "🇵🇹", Romania: "🇷🇴", Slovakia: "🇸🇰",
  Slovenia: "🇸🇮", Spain: "🇪🇸", Sweden: "🇸🇪", Switzerland: "🇨🇭",
};
const memberKey = (group: VisaInfo, name: string) => `${group.key}-${name.toLowerCase().replace(/[^a-z]+/g, "")}`;

/** A member country's own card: the group's rules, with where to apply for that country. */
function memberCard(group: VisaInfo, name: string): VisaInfo {
  return {
    ...group, key: memberKey(group, name), country: name, flag: FLAGS[name] ?? group.flag, members: undefined, group: "Schengen",
    headline: "Schengen visa needed",
    apply: `At ${name}'s visa centre in India if ${name} is your main destination (or your first stop, when stays are equal); about 15 days`,
    notes: [`The same visa also covers the other ${group.members!.length - 1} Schengen countries`, ...group.notes],
  };
}

/** Every card on the visas page: groups are split into one card per member country. */
export const ALL_VISAS: VisaInfo[] = VISAS.flatMap((v) => (v.members ? v.members.map((m) => memberCard(v, m)) : [v]));
// group cards stay reachable by key, so a trip covering many members (Europe) can show the one summary
const BY_KEY = new Map([...VISAS, ...ALL_VISAS].map((v) => [v.key, v]));

/** Which countries each international destination covers. */
export const DEST_COUNTRIES: Record<string, string[]> = {
  nepal: ["nepal"], bhutan: ["bhutan"], thailand: ["thailand"], kazakhstan: ["kazakhstan"], srilanka: ["srilanka"],
  bali: ["indonesia"], vietnam: ["vietnam"], cambodia: ["cambodia", "laos"], georgia: ["georgia"], dubai: ["uae"],
  singapore: ["singapore", "malaysia"],
  maldives: ["maldives"], mauritius: ["mauritius"], seychelles: ["seychelles"], philippines: ["philippines"],
  hongkong: ["hongkong", "macau"], japan: ["japan"], korea: ["southkorea"], china: ["china"], tibet: ["tibet"],
  uzbekistan: ["uzbekistan"], kyrgyzstan: ["kyrgyzstan"], azerbaijan: ["azerbaijan"], armenia: ["armenia"], turkey: ["turkey"],
  russia: ["russia"], switzerland: ["schengen-switzerland"], europe: ["schengen"], iceland: ["schengen-iceland"],
  nordics: ["schengen-norway", "schengen-sweden", "schengen-finland", "schengen-denmark", "schengen-iceland"],
  uk: ["uk", "ireland"], usa: ["usa"], canada: ["canada"], australia: ["australia"], newzealand: ["newzealand"],
  egypt: ["egypt"], jordan: ["jordan"], oman: ["oman"], morocco: ["morocco"], kenya: ["kenya"], tanzania: ["tanzania"],
  southafrica: ["southafrica"], peru: ["peru"], southamerica: ["brazil", "argentina", "chile", "peru"], antarctica: ["antarctica", "argentina", "chile"],
};

export function visasFor(destSlug: string | null | undefined): VisaInfo[] {
  const cards = (destSlug ? DEST_COUNTRIES[destSlug] ?? [] : []).map((k) => BY_KEY.get(k)).filter((v) => v !== undefined);
  // three or more countries under one visa (a Nordics trip) read better as that visa's single summary
  const groups = new Set(cards.map((v) => v.group));
  if (cards.length >= 3 && groups.size === 1 && cards[0].group) return VISAS.filter((v) => v.members && cards[0].key.startsWith(`${v.key}-`));
  return cards;
}
