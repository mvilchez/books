import assert from "node:assert/strict";
import test from "node:test";
import { decodeSagaRouteName } from "./saga-route";

test("decodes percent-encoded saga names with spaces", () => {
  assert.equal(
    decodeSagaRouteName("Ciclo%20Barroco%3A%20El%20Sistema%20del%20Mundo"),
    "Ciclo Barroco: El Sistema del Mundo",
  );
});

test("decodes percent-encoded non-ASCII saga names", () => {
  assert.equal(
    decodeSagaRouteName("Canci%C3%B3n%20de%20hielo%20y%20fuego"),
    "Canción de hielo y fuego",
  );
  assert.equal(
    decodeSagaRouteName("Cr%C3%B3nicas%20de%20Cadwal"),
    "Crónicas de Cadwal",
  );
});

test("leaves already decoded names untouched", () => {
  assert.equal(decodeSagaRouteName("Ciclo Barroco"), "Ciclo Barroco");
  assert.equal(decodeSagaRouteName("Millennium"), "Millennium");
});

test("trims surrounding whitespace from the decoded name", () => {
  assert.equal(decodeSagaRouteName("%20Ciclo%20Barroco%20"), "Ciclo Barroco");
  assert.equal(decodeSagaRouteName("  Ciclo Barroco  "), "Ciclo Barroco");
});

test("returns null for malformed or empty names", () => {
  assert.equal(decodeSagaRouteName("%E0%A4%A"), null);
  assert.equal(decodeSagaRouteName("%"), null);
  assert.equal(decodeSagaRouteName(""), null);
  assert.equal(decodeSagaRouteName("   "), null);
  assert.equal(decodeSagaRouteName(null), null);
  assert.equal(decodeSagaRouteName(undefined), null);
});

test("round-trips every encoded form of a saga name", () => {
  const name = "Ciclo Barroco: El Sistema del Mundo";
  assert.equal(decodeSagaRouteName(encodeURIComponent(name)), name);
});
