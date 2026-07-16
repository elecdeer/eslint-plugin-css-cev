import { describe, expect, test } from "vite-plus/test";
import {
  defaultComponentPattern,
  defaultElementPattern,
  defaultVariantPattern,
  isDataAttributeName,
  isValidComponentName,
  isValidElementName,
  isValidVariantAttributeName,
} from "../src/lib/naming.ts";

describe("defaultComponentPattern (PascalCase)", () => {
  test.each([["Button"], ["ButtonGroup"], ["A"], ["Button2"]])(
    "%s is a valid Component name",
    (name) => {
      expect(isValidComponentName(name, defaultComponentPattern)).toBe(true);
    },
  );

  test.each([["button"], ["button-group"], [""], ["2Button"], ["Button_Group"]])(
    "%s is not a valid Component name",
    (name) => {
      expect(isValidComponentName(name, defaultComponentPattern)).toBe(false);
    },
  );
});

describe("defaultElementPattern (camelCase, single word allowed)", () => {
  test.each([["title"], ["iconWrapper"], ["a"], ["title2"]])(
    "%s is a valid Element name",
    (name) => {
      expect(isValidElementName(name, defaultElementPattern)).toBe(true);
    },
  );

  test.each([["Title"], ["icon-wrapper"], [""], ["2title"]])(
    "%s is not a valid Element name",
    (name) => {
      expect(isValidElementName(name, defaultElementPattern)).toBe(false);
    },
  );
});

describe("defaultVariantPattern (kebab-case data attribute)", () => {
  test.each([["data-is-active"], ["data-x"], ["data-a-b-c"]])(
    "%s is a valid Variant attribute name",
    (name) => {
      expect(isValidVariantAttributeName(name, defaultVariantPattern)).toBe(true);
    },
  );

  test.each([
    ["data-isActive"],
    ["data-"],
    ["data-Is-Active"],
    ["aria-expanded"],
    ["data-is--active"],
  ])("%s is not a valid Variant attribute name", (name) => {
    expect(isValidVariantAttributeName(name, defaultVariantPattern)).toBe(false);
  });
});

describe("isDataAttributeName", () => {
  test("returns true for data-* attribute names", () => {
    expect(isDataAttributeName("data-active")).toBe(true);
    expect(isDataAttributeName("data-")).toBe(true);
  });

  test("returns false for non data-* attribute names", () => {
    expect(isDataAttributeName("aria-expanded")).toBe(false);
    expect(isDataAttributeName("disabled")).toBe(false);
  });
});
