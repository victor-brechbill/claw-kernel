import { describe, expect, it } from "vitest";
import { readNumberParam, readStringParam } from "./common.js";

describe("readStringParam value-shape hints", () => {
  it("missing param throws with expected type", () => {
    expect(() => readStringParam({}, "name", { required: true })).toThrow(
      "name required (expected: string)",
    );
  });

  it("null param throws with expected type", () => {
    expect(() => readStringParam({ name: null }, "name", { required: true })).toThrow(
      "name required (expected: string)",
    );
  });

  it("undefined param throws with expected type", () => {
    expect(() => readStringParam({ name: undefined }, "name", { required: true })).toThrow(
      "name required (expected: string)",
    );
  });

  it("wrong type number throws with got hint", () => {
    expect(() => readStringParam({ name: 42 }, "name", { required: true })).toThrow(
      "name must be a string, got number",
    );
  });

  it("wrong type boolean throws with got hint", () => {
    expect(() => readStringParam({ name: true }, "name", { required: true })).toThrow(
      "name must be a string, got boolean",
    );
  });

  it("wrong type object throws with got hint", () => {
    expect(() => readStringParam({ name: {} }, "name", { required: true })).toThrow(
      "name must be a string, got object",
    );
  });

  it("empty string with required throws with expected type", () => {
    expect(() => readStringParam({ name: "  " }, "name", { required: true })).toThrow(
      "name required (expected: string)",
    );
  });

  it("uses label in error message", () => {
    expect(() =>
      readStringParam({ name: 42 }, "name", { required: true, label: "Display Name" }),
    ).toThrow("Display Name must be a string, got number");
  });
});

describe("readNumberParam value-shape hints", () => {
  it("missing param throws with expected type", () => {
    expect(() => readNumberParam({}, "count", { required: true })).toThrow(
      "count required (expected: number)",
    );
  });

  it("null param throws with expected type", () => {
    expect(() => readNumberParam({ count: null }, "count", { required: true })).toThrow(
      "count required (expected: number)",
    );
  });

  it("undefined param throws with expected type", () => {
    expect(() => readNumberParam({ count: undefined }, "count", { required: true })).toThrow(
      "count required (expected: number)",
    );
  });

  it("wrong type object throws with got hint", () => {
    expect(() => readNumberParam({ count: {} }, "count", { required: true })).toThrow(
      "count must be a number, got object",
    );
  });

  it("wrong type boolean throws with got hint", () => {
    expect(() => readNumberParam({ count: true }, "count", { required: true })).toThrow(
      "count must be a number, got boolean",
    );
  });

  it("non-numeric string throws with got hint", () => {
    expect(() => readNumberParam({ count: "abc" }, "count", { required: true })).toThrow(
      "count must be a number, got string",
    );
  });

  it("uses label in error message", () => {
    expect(() =>
      readNumberParam({ count: {} }, "count", { required: true, label: "Item Count" }),
    ).toThrow("Item Count must be a number, got object");
  });
});
