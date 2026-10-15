import assert from "node:assert/strict";
import test from "node:test";
import {
  parseCommonsPortrait,
  parseWikidataPortraitEntity,
  parseWikidataSearchMatch,
  type AuthorPortraitIdentity,
} from "./wikimedia-author-portraits";

const author: AuthorPortraitIdentity = { id: "author-1", name: "Ada Lovelace" };

test("Wikidata lookup accepts one exact label and a unique human image", () => {
  assert.equal(
    parseWikidataSearchMatch(
      {
        search: [
          { id: "Q7259", label: "Ada Lovelace" },
          { id: "Q30128828", label: "Ada Lovelace Award" },
        ],
      },
      author,
    ),
    "Q7259",
  );
  assert.equal(
    parseWikidataSearchMatch(
      {
        search: [
          { id: "Q7259", label: "Ada Lovelace" },
          { id: "Q9999", label: "Ada Lovelace" },
        ],
      },
      author,
    ),
    null,
  );

  const entity = {
    entities: {
      Q7259: {
        claims: {
          P31: [{ mainsnak: { datavalue: { value: { id: "Q5" } } } }],
          P18: [
            {
              mainsnak: {
                datavalue: { value: "Ada_Lovelace.jpg" },
              },
            },
          ],
        },
      },
    },
  };
  assert.deepEqual(parseWikidataPortraitEntity(entity, author, "Q7259"), {
    authorId: "author-1",
    authorName: "Ada Lovelace",
    wikidataId: "Q7259",
    fileName: "Ada_Lovelace.jpg",
  });

  const multipleImages = structuredClone(entity);
  multipleImages.entities.Q7259.claims.P18.push({
    mainsnak: { datavalue: { value: "Another_Ada.jpg" } },
  });
  assert.equal(
    parseWikidataPortraitEntity(multipleImages, author, "Q7259"),
    null,
  );
});

test("Commons portrait metadata requires a trusted image, source, artist, and license", () => {
  const candidate = {
    authorId: author.id,
    authorName: author.name,
    wikidataId: "Q7259",
    fileName: "Ada_Lovelace.jpg",
  };
  const response = {
    query: {
      pages: {
        "1": {
          title: "File:Ada Lovelace.jpg",
          imageinfo: [
            {
              thumburl:
                        "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a1/Ada_Lovelace.jpg/320px-Ada_Lovelace.jpg?utm_source=commons",
              descriptionurl:
                "https://commons.wikimedia.org/wiki/File:Ada_Lovelace.jpg",
              extmetadata: {
                Artist: { value: "<a>Augusta Ada King</a> &amp; archive" },
                LicenseShortName: { value: "Public domain" },
                LicenseUrl: {
                  value: "https://creativecommons.org/publicdomain/zero/1.0/",
                },
              },
            },
          ],
        },
      },
    },
  };

  assert.deepEqual(parseCommonsPortrait(response, candidate), {
    authorId: candidate.authorId,
    authorName: candidate.authorName,
    wikidataId: candidate.wikidataId,
    portraitUrl:
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a1/Ada_Lovelace.jpg/320px-Ada_Lovelace.jpg",
    portraitSourceUrl:
      "https://commons.wikimedia.org/wiki/File:Ada_Lovelace.jpg",
    portraitArtist: "Augusta Ada King & archive",
    portraitLicense: "Public domain",
    portraitLicenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  });

  const missingCredit = structuredClone(response);
  Reflect.deleteProperty(
    missingCredit.query.pages["1"].imageinfo[0].extmetadata,
    "Artist",
  );
  Reflect.deleteProperty(
    missingCredit.query.pages["1"].imageinfo[0].extmetadata,
    "LicenseShortName",
  );
  assert.equal(parseCommonsPortrait(missingCredit, candidate), null);

  const untrustedImage = structuredClone(response);
  untrustedImage.query.pages["1"].imageinfo[0].thumburl =
    "https://untrusted.example/portrait.jpg";
  assert.equal(parseCommonsPortrait(untrustedImage, candidate), null);
});
