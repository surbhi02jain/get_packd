import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { statedGroupSize } from "../src/groupSize.js";

describe("stated group size", () => {
  it("reads the ways operators word it", () => {
    assert.deepEqual(statedGroupSize("👩 Trip Type Women Only 👥 Group Size Max 20 📄 Trip brochure"), { min: null, max: 20 });
    assert.deepEqual(statedGroupSize("7 Days Duration 12–14 Group Size Alpine Camps Accommodation"), { min: 12, max: 14 });
    assert.deepEqual(statedGroupSize("customer satisfaction. Group Size - 12 to 25 Age group - 18 to 35"), { min: 12, max: 25 });
    assert.deepEqual(statedGroupSize("Age Group: 18–40 years (kids not permitted) Group Size: Limited to 18 travelers Difficulty"), { min: null, max: 18 });
    assert.deepEqual(statedGroupSize("Trek Difficulty Difficult Trek Group Size 12 max Trek Distance 42 Km"), { min: null, max: 12 });
    assert.deepEqual(statedGroupSize("Trek Group Size 2 - 5 max Trek Distance 110 Km"), { min: 2, max: 5 });
    assert.deepEqual(statedGroupSize("Location Chikmagalur For ages 10 Max group size 20 pax Best Season"), { min: null, max: 20 });
    assert.deepEqual(statedGroupSize("Duration 6N/7D Difficulty Moderate Group Size 12–18 travelers Day-wise"), { min: 12, max: 18 });
    assert.deepEqual(statedGroupSize("Group size: Up to 20 trekkers. Male to female ratio about 7:3."), { min: null, max: 20 });
    assert.deepEqual(statedGroupSize("We try to reduce overcrowding by travelling in small groups of maximum 12 people."), { min: null, max: 12 });
  });

  it("ignores reviews, hedged answers and ages", () => {
    assert.equal(statedGroupSize("We were a group of 12 people on the Fachu Kandi Pass Trek."), null);
    assert.equal(statedGroupSize("What is the Group Size? Group size is usually around 15 - 20 (For peak season group size will be 20 - 40)"), null);
    assert.equal(statedGroupSize("Age group - 18 to 35"), null);
    assert.equal(statedGroupSize("Dates 11-21 Mar Group Size 15 people avg. Trip Style Self-drive"), null);
    assert.equal(statedGroupSize("Upcoming departures 25 Dec 2026 – 2 Jan 2027 ₹1,79,999"), null);
  });

  it("takes the first statement on the page", () => {
    assert.deepEqual(statedGroupSize("Group Size 12 max ... most companies run 20–30+ people ... small groups of maximum 15 people"), { min: null, max: 12 });
  });
});
