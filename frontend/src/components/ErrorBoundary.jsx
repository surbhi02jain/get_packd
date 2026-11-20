import { Component } from "react";
import { track } from "@/lib/analytics";

/**
 * If a page throws while drawing, this shows a short message with a way out instead of a blank screen, and reports
 * the error to the analytics (Admin → Analytics → Errors). App.js keys it by the page, so going to another page clears it.
 */
export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error(error);
    track("client_error", { message: String(error?.message || error).slice(0, 280) });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main id="main" className="grid min-h-screen place-items-center bg-[#f8f4ec] px-5 text-center" data-testid="page-error">
        <div className="max-w-md">
          <h1 className="text-[clamp(1.8rem,4vw,2.6rem)] font-light text-[#16181b]">Something went wrong on this page</h1>
          <p className="mt-3 text-[15px] text-[#5b6066]">Sorry about that. Reloading usually fixes it; if not, the rest of the site still works.</p>
          <p className="mt-8 flex flex-wrap justify-center gap-3 text-[15px] font-semibold">
            <button onClick={() => window.location.reload()} className="rounded-xl bg-coral px-5 py-2.5 text-white">Reload the page</button>
            <a href="/" className="rounded-xl border border-[#e7dece] px-5 py-2.5 text-[#16181b]">Go to the home page</a>
          </p>
        </div>
      </main>
    );
  }
}
