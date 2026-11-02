import assert from "node:assert/strict";
import test from "node:test";
import {
  commonNationality,
  exactOpenLibraryAuthorMatches,
  parseOpenLibraryWikidataId,
  parseWikidataCitizenshipIds,
  parseWikidataCountryCodes,
  parseWikidataId,
  parseWikidataNameSearchResults,
} from "./author-nationality";

test("finds all exact Open Library author-name matches", () => {
  const candidates = [
    { authorId: "OL1A", name: "Ada Lovelace" },
    { authorId: "OL2A", name: "Ada Lovelace biography" },
    { authorId: "OL3A", name: "Ada Lovelace" },
  ];
  assert.deepEqual(
    exactOpenLibraryAuthorMatches(candidates, "ada lovelace"),
    [candidates[0], candidates[2]],
  );
  assert.deepEqual(
    exactOpenLibraryAuthorMatches(candidates.slice(0, 2), "Ada Lovelace"),
    [candidates[0]],
  );
});

test("accepts a nationality only when all exact matches agree", () => {
  assert.equal(commonNationality(["GB", "GB", "GB"]), "GB");
  assert.equal(commonNationality(["GB", "US"]), null);
  assert.equal(commonNationality(["GB", null]), "GB");
  assert.equal(commonNationality([null, null]), null);
  assert.equal(commonNationality([]), null);
});

test("parses a Wikidata entity ID only from a valid ID or entity URL", () => {
  assert.equal(parseWikidataId("Q7259"), "Q7259");
  assert.equal(parseWikidataId("https://www.wikidata.org/wiki/Q7259"), "Q7259");
  assert.equal(parseWikidataId("Q7x"), null);
  assert.equal(parseWikidataId("https://example.com/Q7259"), null);
  assert.equal(
    parseOpenLibraryWikidataId(
      { name: "Ada Lovelace", remote_ids: { wikidata: "Q7259" } },
      "Ada Lovelace",
    ),
    "Q7259",
  );
  assert.equal(
    parseOpenLibraryWikidataId(
      { name: "Another Author", remote_ids: { wikidata: "Q7259" } },
      "Ada Lovelace",
    ),
    null,
  );
});

test("keeps only exact-name Wikidata search results and deduplicates IDs", () => {
  assert.deepEqual(
    parseWikidataNameSearchResults(
      {
        search: [
          { id: "Q7259", label: "Ada Lovelace" },
          { id: "Q123", label: "Ada Lovelace (mathematician)" },
          { id: "Q7259", label: "A. Lovelace" },
          { id: "Q999", label: "ada lovelace" },
        ],
      },
      "Ada Lovelace",
    ),
    ["Q7259", "Q999"],
  );
  assert.deepEqual(
    parseWikidataNameSearchResults({ search: [] }, "Ada Lovelace"),
    [],
  );
});

test("reads non-deprecated country-of-citizenship claims", () => {
  assert.deepEqual(
    parseWikidataCitizenshipIds(
      {
        entities: {
          Q7259: {
            claims: {
              P27: [
                { mainsnak: { datavalue: { value: { id: "Q145" } } } },
                {
                  rank: "deprecated",
                  mainsnak: { datavalue: { value: { id: "Q30" } } },
                },
              ],
            },
          },
        },
      },
      "Q7259",
    ),
    ["Q145"],
  );
});

test("reads only valid ISO alpha-2 country codes and deduplicates results", () => {
  const makeEntity = (code: unknown) => ({
    claims: {
      P297: [{ mainsnak: { datavalue: { value: code } } }],
    },
  });
  assert.deepEqual(
    parseWikidataCountryCodes(
      {
        entities: {
          Q145: makeEntity("GB"),
          Q30: makeEntity("US"),
          Q999: makeEntity("gbr"),
          Q112: makeEntity(123),
        },
      },
      ["Q145", "Q30", "Q999", "Q112", "Q145"],
    ),
    ["GB", "US"],
  );
});
