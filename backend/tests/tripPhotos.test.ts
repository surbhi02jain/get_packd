import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { looksLikeLogo, pagePhotos, settlePhotos } from "../src/tripPhotos.js";

// a site where every page has the same og:image (the logo) and one photo of its own
const page = (own: string) => `<html><head><meta property="og:image" content="https://op.example/og/logo.webp">
  <script type="application/ld+json">{"@type":"Product","image":["https://cdn.op.example/trips/${own}.jpg"]}</script></head>
  <body><img src="https://op.example/assets/site-logo.png"><img src="https://cdn.op.example/banner/footer-hills.jpg">
  <img src="https://cdn.op.example/illustration_web/route.webp"></body></html>`;
const loads = async () => true;

describe("trip photos", () => {
  it("reads a page's photos, best first, without logos or drawings", () => {
    const photos = pagePhotos(page("kedarkantha"), "https://op.example/trips/kedarkantha");
    assert.equal(photos[0], "https://cdn.op.example/trips/kedarkantha.jpg");
    assert.ok(photos.includes("https://cdn.op.example/banner/footer-hills.jpg"));
    assert.ok(!photos.some((p) => /logo|illustration/.test(p)));
  });

  it("knows a logo by its file name, not its host", () => {
    assert.ok(looksLikeLogo("https://site.example/uploads/cropped-PTT-logo-2.png"));
    assert.ok(!looksLikeLogo("https://logout.world/media/event/2215/Bhutan.jpg"));
    assert.ok(looksLikeLogo("https://i.ytimg.com/vi/abc/hqdefault.jpg"));
  });

  it("gives trips that share a site-wide image, or have none, the photo only their own page shows", async () => {
    const trips = [
      { url: "https://op.example/trips/kedarkantha", image: "https://op.example/og/og.webp", destination_slug: "uttarakhand" },
      { url: "https://op.example/trips/hampta", image: "https://op.example/og/og.webp", destination_slug: "himachal" },
      { url: "https://op.example/trips/goa", image: null, destination_slug: "goa" },
    ];
    const pages: Record<string, string> = Object.fromEntries(trips.map((t) => [t.url, page(t.url.split("/").pop()!)]));
    await settlePhotos(trips, async (u) => pages[u] ?? null, loads);
    assert.deepEqual(trips.map((t) => t.image), [
      "https://cdn.op.example/trips/kedarkantha.jpg", "https://cdn.op.example/trips/hampta.jpg", "https://cdn.op.example/trips/goa.jpg"]);
  });

  it("drops a photo shared across places when no page has one of its own, and keeps one shared by two editions of a trip", async () => {
    const bare = `<html><head><meta property="og:image" content="https://op.example/group.jpg"></head></html>`;
    const trips = [
      { url: "https://op.example/bir", image: "https://op.example/group.jpg", destination_slug: "himachal" },
      { url: "https://op.example/bhutan", image: "https://op.example/group.jpg", destination_slug: "bhutan" },
      { url: "https://op.example/hampi", image: "https://op.example/hampi.jpg", destination_slug: "karnataka" },
      { url: "https://op.example/hampi-nye", image: "https://op.example/hampi.jpg", destination_slug: "karnataka" },
    ];
    await settlePhotos(trips, async () => bare, loads);
    assert.deepEqual(trips.map((t) => t.image), [null, null, "https://op.example/hampi.jpg", "https://op.example/hampi.jpg"]);
  });

  it("replaces a photo that no longer loads", async () => {
    const trips = [{ url: "https://op.example/trips/sindhudurg", image: "https://op.example/deleted.png", destination_slug: "maharashtra" }];
    await settlePhotos(trips, async () => page("sindhudurg"), async (src) => !src.includes("deleted"));
    assert.equal(trips[0].image, "https://cdn.op.example/trips/sindhudurg.jpg");
  });
});
