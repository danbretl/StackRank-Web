import { test } from "node:test";
import assert from "node:assert/strict";

import {
  advanceRankSession,
  createRankSession,
  insertSettledRankSession,
} from "../lib/rank-session.js";

test("empty rankings settle without a comparison", () => {
  const session = createRankSession({ item: "Dune", rankingLength: 0 });
  assert.deepEqual(session, {
    status: "settled",
    item: "Dune",
    rankingLength: 0,
    comparisons: 0,
    insertionIndex: 0,
  });
  assert.deepEqual(insertSettledRankSession([], session), ["Dune"]);
});

test("rank sessions can land at every insertion slot", () => {
  const count = 7;
  for (let target = 0; target <= count; target += 1) {
    let session = createRankSession({ item: { target }, rankingLength: count, randomFn: () => 0.5 });
    while (session.status === "comparing") {
      session = advanceRankSession(session, target <= session.comparisonIndex);
    }
    assert.equal(session.insertionIndex, target);
    const ranking = Array.from({ length: count }, (_, index) => index);
    const inserted = insertSettledRankSession(ranking, session, (item, meta) => ({ ...item, ...meta }));
    assert.equal(inserted[target].target, target);
    assert.equal(inserted[target].insertionIndex, target);
  }
});

test("settled sessions refuse a ranking whose length changed mid-session", () => {
  let session = createRankSession({ item: "Book", rankingLength: 1, randomFn: () => 0.5 });
  session = advanceRankSession(session, true);
  assert.equal(session.status, "settled");
  assert.equal(insertSettledRankSession(["Existing", "Concurrent"], session), null);
});
