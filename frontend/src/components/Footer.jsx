import { Link } from "react-router-dom";
import { CATEGORY_PAGES } from "@/lib/constants";

export default function Footer() {
  return (
    <footer className="relative mt-24 overflow-hidden bg-midnight text-sand grain">
      <div className="relative z-10 mx-auto grid max-w-[1400px] gap-10 px-4 py-16 sm:px-8 md:grid-cols-4">
        <div className="md:col-span-2">
          <p className="font-display text-3xl">Wayfind</p>
          <p className="mt-3 max-w-sm text-sm text-sand/70">Group departures from Indian operators in one place. Trips, dates and prices are read from each operator's own website — always check the operator's page before you book.</p>
        </div>
        <div className="space-y-2 text-sm">
          <p className="label-mono !text-sand/50">Collections</p>
          {Object.entries(CATEGORY_PAGES).map(([slug, c]) => (
            <Link key={slug} to={`/trips/${slug}`} className="block text-sand/80 hover:text-coral" data-testid={`footer-cat-${slug}`}>{c.title}</Link>
          ))}
        </div>
        <div className="space-y-2 text-sm">
          <p className="label-mono !text-sand/50">Wayfind</p>
          <Link to="/operators" className="block text-sand/80 hover:text-coral" data-testid="footer-all-operators-link">All operators</Link>
          <Link to="/list-your-departures" className="block text-sand/80 hover:text-coral" data-testid="footer-operators-link">List your departures</Link>
          <Link to="/alerts" className="block text-sand/80 hover:text-coral" data-testid="footer-alerts-link">Alerts</Link>
          <Link to="/admin" className="block text-sand/80 hover:text-coral" data-testid="footer-admin-link">Admin</Link>
        </div>
      </div>
    </footer>
  );
}
