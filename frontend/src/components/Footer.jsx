import { Link } from "react-router-dom";
import { Instagram, Linkedin, Mail } from "lucide-react";
import { COLLECTIONS, hidden } from "@/lib/constants";
import { useApp } from "@/context/AppState";

// getPackd's own accounts: each icon shows in the bottom row once its link is filled in
const CONTACT = [
  { label: "Instagram", Icon: Instagram, href: "" }, // e.g. https://instagram.com/getpackd
  { label: "LinkedIn", Icon: Linkedin, href: "" }, // e.g. https://www.linkedin.com/company/getpackd
  { label: "Email", Icon: Mail, href: "" }, // e.g. mailto:hello@getpackd.com
].filter((c) => c.href);

// Airbnb's footer, in the home page's colours: a slim band a shade darker than the page, three columns of links under
// short bold headings, and one row at the bottom with the © and the currency.
const COLUMNS = [
  ["Explore", [
    ["/search", "Every departure", "footer-explore-link"],
    // in sentence case, as Airbnb writes its links: "Women-only trips"
    ...Object.entries(COLLECTIONS).map(([slug, c]) => [`/trips/${slug}`, c.title[0] + c.title.slice(1).toLowerCase(), `footer-cat-${slug}`]),
  ]],
  ["Operators", [
    ["/operators", "All operators", "footer-all-operators-link"],
    ["/list-your-departures", "List your departures", "footer-operators-link"],
  ]],
  ["getPackd", [
    ["/about", "About us", "footer-about-link"],
    ["/visas", "Visas", "footer-visas-link"],
    ...(hidden("alerts") ? [] : [["/alerts", "Price alerts", "footer-alerts-link"]]),
    ["/shortlist", "Your shortlist", "footer-shortlist-link"],
  ]],
];

export default function Footer() {
  const { currency, setCurrency } = useApp();
  return (
    <footer className="mt-16 border-t border-[#e7dece] bg-[#f1eadd] text-[14px] leading-[18px] text-[#16181b]" data-testid="site-footer">
      <div className="mx-auto max-w-[1280px] px-6 sm:px-10">
        <div className="grid divide-y divide-[#e7dece] py-8 md:grid-cols-3 md:gap-6 md:divide-y-0 md:py-12">
          {COLUMNS.map(([heading, links]) => (
            <div key={heading} className="py-6 first:pt-0 last:pb-0 md:py-0">
              <h3 className="text-[14px] font-semibold">{heading}</h3>
              <ul className="mt-3 space-y-3">
                {links.map(([to, label, id]) => (
                  <li key={to}><Link to={to} data-testid={id} className="hover:underline">{label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3 border-t border-[#e7dece] py-6 md:flex-row md:items-center md:justify-between">
          <p className="text-[#5b6066]">
            © {new Date().getFullYear()} getPackd <span aria-hidden>·</span> Dates and prices come from each operator's own website; check there before you book.
          </p>
          <div className="flex items-center gap-5 font-semibold">
            <button data-testid="footer-currency" onClick={() => setCurrency(currency === "inr" ? "usd" : "inr")} className="hover:underline" title="Currency for international trips">
              {currency === "inr" ? "₹ INR" : "$ USD"}
            </button>
            {CONTACT.map(({ label, Icon, href }) => (
              <a key={label} href={href} aria-label={label} data-testid={`footer-contact-${label.toLowerCase()}`}
                {...(href.startsWith("mailto:") ? {} : { target: "_blank", rel: "noreferrer" })} className="transition-opacity hover:opacity-70">
                <Icon size={18} strokeWidth={1.8} />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
