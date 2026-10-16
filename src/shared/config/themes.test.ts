import { test } from "node:test";
import assert from "node:assert/strict";
import { isAppThemeId } from "./themes.ts";

test("saved theme accepts supported choices and rejects corrupt/prototype values", () => {
  for (const theme of ["light", "dark", "nord", "solarized"]) assert.ok(isAppThemeId(theme));
  for (const value of [null, undefined, {}, "", "unknown", "toString", "__proto__"])
    assert.equal(isAppThemeId(value), false);
});
