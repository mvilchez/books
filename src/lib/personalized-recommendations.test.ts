import assert from "node:assert/strict";
import test from "node:test";
import { preferenceProfileFromWeights } from "./personalized-recommendations";

test("builds stable top preferences from persisted vector weights", () => {
  const profile = preferenceProfileFromWeights({
    authorWeights: { "ursula le guin": 2, "isaac asimov": 4, "octavia butler": 3, "mary shelley": 1 },
    genreWeights: { Fantasy: 3, Science: 5, History: 1, Horror: 2 },
    tagWeights: { "GENRE:fantasy": 4, "SUBJECT:space": 6, "GENRE:history": 2 },
  });

  assert.deepEqual(profile.topAuthors, [
    "isaac asimov",
    "octavia butler",
    "ursula le guin",
  ]);
  assert.deepEqual(profile.topGenres, ["Science", "Fantasy", "Horror"]);
  assert.deepEqual(profile.topTags, [
    "SUBJECT:space",
    "GENRE:fantasy",
    "GENRE:history",
  ]);
});

test("ignores malformed and non-positive vector entries", () => {
  const profile = preferenceProfileFromWeights({
    authorWeights: { invalid: -1, "not numeric": "3" },
    genreWeights: [],
    tagWeights: null,
  });

  assert.deepEqual(profile.topAuthors, []);
  assert.deepEqual(profile.topGenres, []);
  assert.deepEqual(profile.topTags, []);
});
