import assert from "node:assert/strict";
import test from "node:test";
import { buildCsvDocument, csvCell, parseCsv } from "./csv";

test("parses quoted commas, escaped quotes, and multiline cells", () => {
  assert.deepEqual(
    parseCsv('\uFEFFid,title,tags\r\n1,"A title, with comma","One; ""Two""\nThree"\r\n'),
    [
      ["id", "title", "tags"],
      ["1", "A title, with comma", 'One; "Two"\nThree'],
    ],
  );
});

test("rejects malformed CSV quote placement", () => {
  assert.throws(() => parseCsv('id,title\n1,un"closed'), /Malformed CSV quoting/);
  assert.throws(() => parseCsv('id,title\n1,"unclosed'), /unterminated/);
});

test("csvCell quotes cells and defuses spreadsheet formulas", () => {
  assert.equal(csvCell(null), '""');
  assert.equal(csvCell(42), '"42"');
  assert.equal(csvCell('Plain "quoted" text'), '"Plain ""quoted"" text"');
  assert.equal(csvCell("=SUM(A1)"), '"\'=SUM(A1)"');
  assert.equal(csvCell(" +1"), '"\' +1"');
  assert.equal(csvCell("-1"), '"\'-1"');
  assert.equal(csvCell("@handle"), '"\'@handle"');
});

test("buildCsvDocument joins rows with CRLF and prefixes a BOM", () => {
  assert.equal(
    buildCsvDocument([
      ["a", "b"],
      ["c", null],
    ]),
    '\uFEFF"a","b"\r\n"c",""',
  );
});
