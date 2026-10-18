import assert from "node:assert/strict";
import test from "node:test";
import {
  isValidIsbn10,
  isValidIsbn13,
  isbn10ToIsbn13,
  normalizeIsbn,
  toIsbn13,
} from "./isbn";

test("normalizeIsbn strips separators and upper-cases X", () => {
  assert.equal(normalizeIsbn(" 978-0-316-20685-3 "), "9780316206853");
  assert.equal(normalizeIsbn("0-8044-2957-x"), "080442957X");
  assert.equal(normalizeIsbn("0.8044.2957.X"), "080442957X");
});

test("isValidIsbn10 checks the weighted digit and accepts X", () => {
  assert.equal(isValidIsbn10("0316206857"), true);
  assert.equal(isValidIsbn10("0-316-20685-7"), true);
  assert.equal(isValidIsbn10("080442957X"), true);
  assert.equal(isValidIsbn10("0316206858"), false);
  assert.equal(isValidIsbn10("031620685"), false);
  assert.equal(isValidIsbn10("03162068XY"), false);
  assert.equal(isValidIsbn10(""), false);
});

test("isValidIsbn13 requires the 978/979 prefix and a valid check digit", () => {
  assert.equal(isValidIsbn13("9780316206853"), true);
  assert.equal(isValidIsbn13("978-0-316-20685-3"), true);
  assert.equal(isValidIsbn13("9798400000003"), true);
  assert.equal(isValidIsbn13("9780316206854"), false);
  // Valid EAN-13 checksum but not a book prefix.
  assert.equal(isValidIsbn13("5901234123457"), false);
  assert.equal(isValidIsbn13("978031620685"), false);
  assert.equal(isValidIsbn13(""), false);
});

test("isbn10ToIsbn13 converts with the recomputed check digit", () => {
  assert.equal(isbn10ToIsbn13("0316206857"), "9780316206853");
  assert.equal(isbn10ToIsbn13("080442957X"), "9780804429573");
  assert.equal(isbn10ToIsbn13("0316206858"), null);
});

test("toIsbn13 accepts ISBN-10, ISBN-13, and rejects other input", () => {
  assert.equal(toIsbn13("0316206857"), "9780316206853");
  assert.equal(toIsbn13("978-0-316-20685-3"), "9780316206853");
  assert.equal(toIsbn13("9780316206853"), "9780316206853");
  assert.equal(toIsbn13("5901234123457"), null);
  assert.equal(toIsbn13("9780316206854"), null);
  assert.equal(toIsbn13("not an isbn"), null);
  assert.equal(toIsbn13(""), null);
});