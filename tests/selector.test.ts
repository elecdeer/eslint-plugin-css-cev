import { parse, toPlainObject } from "@eslint/css-tree";
import type { SelectorPlain } from "@eslint/css-tree";
import { describe, expect, test } from "vite-plus/test";
import {
  defaultComponentPattern,
  defaultElementPattern,
  defaultVariantPattern,
  type NamingPatterns,
} from "../src/lib/naming.ts";
import {
  analyzeNestedSelector,
  analyzeTopLevelSelector,
  hasGlobalEscape,
  isOpaqueAtrule,
} from "../src/lib/selector.ts";

const patterns: NamingPatterns = {
  component: defaultComponentPattern,
  element: defaultElementPattern,
  variant: defaultVariantPattern,
};

/**
 * Parses `${prelude} {}` and returns the first `Selector` of the first
 * `Rule`'s prelude, for feeding fixtures into the pure analyzer functions.
 */
function parseSelector(prelude: string): SelectorPlain {
  const stylesheet = toPlainObject(parse(`${prelude} {}`, { positions: false }));
  if (stylesheet.type !== "StyleSheet") {
    throw new Error(`expected a StyleSheet for "${prelude}"`);
  }
  const rule = stylesheet.children[0];
  if (rule === undefined || rule.type !== "Rule") {
    throw new Error(`expected a Rule for "${prelude}"`);
  }
  if (rule.prelude.type !== "SelectorList") {
    throw new Error(`expected a SelectorList prelude for "${prelude}"`);
  }
  const selector = rule.prelude.children[0];
  if (selector === undefined || selector.type !== "Selector") {
    throw new Error(`expected at least one selector for "${prelude}"`);
  }
  return selector;
}

describe("analyzeTopLevelSelector", () => {
  test("a lone valid Component selector is valid", () => {
    expect(analyzeTopLevelSelector(parseSelector(".Button"), patterns)).toEqual([]);
  });

  test.each([["div"], [":root"], ["[data-x]"], ["*"]])(
    "%s is not a Component selector",
    (prelude) => {
      const violations = analyzeTopLevelSelector(parseSelector(prelude), patterns);
      expect(violations).toHaveLength(1);
      expect(violations[0]?.messageId).toBe("expectedComponentSelector");
    },
  );

  test("PascalCase violation is reported as invalidComponentName", () => {
    const violations = analyzeTopLevelSelector(parseSelector(".button"), patterns);
    expect(violations).toEqual([
      {
        messageId: "invalidComponentName",
        node: expect.objectContaining({ type: "ClassSelector", name: "button" }),
        data: { name: "button" },
      },
    ]);
  });

  test.each([[".A.B"], [".A:hover"], [".A > .b"]])(
    "%s (compound/complex) is reported as expectedSingleComponent",
    (prelude) => {
      const violations = analyzeTopLevelSelector(parseSelector(prelude), patterns);
      expect(violations).toHaveLength(1);
      expect(violations[0]?.messageId).toBe("expectedSingleComponent");
    },
  );

  test("an invalid name combined with extra parts reports both violations", () => {
    const violations = analyzeTopLevelSelector(parseSelector(".bad.other"), patterns);
    expect(violations.map((v) => v.messageId)).toEqual([
      "invalidComponentName",
      "expectedSingleComponent",
    ]);
  });

  test(".A, .B (comma list) validates each selector independently", () => {
    const stylesheet = toPlainObject(parse(".A, .B {}", { positions: false }));
    if (stylesheet.type !== "StyleSheet") {
      throw new Error("expected a StyleSheet");
    }
    const rule = stylesheet.children[0];
    if (rule === undefined || rule.type !== "Rule" || rule.prelude.type !== "SelectorList") {
      throw new Error("expected a SelectorList prelude");
    }
    for (const selector of rule.prelude.children) {
      if (selector.type !== "Selector") {
        throw new Error("expected a Selector");
      }
      expect(analyzeTopLevelSelector(selector, patterns)).toEqual([]);
    }
  });
});

describe("analyzeNestedSelector", () => {
  test.each([["> .el"], ["> .title"], ["> .el:first-child"]])(
    "%s is a valid Element selector",
    (prelude) => {
      expect(analyzeNestedSelector(parseSelector(prelude), patterns)).toEqual([]);
    },
  );

  test("camelCase violation is reported as invalidElementName", () => {
    const violations = analyzeNestedSelector(parseSelector("> .Element"), patterns);
    expect(violations).toEqual([
      {
        messageId: "invalidElementName",
        node: expect.objectContaining({ type: "ClassSelector", name: "Element" }),
        data: { name: "Element" },
      },
    ]);
  });

  test("> .el[data-x] requires the Variant to use nesting", () => {
    const violations = analyzeNestedSelector(parseSelector("> .el[data-x]"), patterns);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.messageId).toBe("variantMustUseNesting");
  });

  test.each([["> .a > .b"], ["> .a.b"]])(
    "%s (more than one Element) is reported as expectedNestedSelector",
    (prelude) => {
      const violations = analyzeNestedSelector(parseSelector(prelude), patterns);
      expect(violations).toHaveLength(1);
      expect(violations[0]?.messageId).toBe("expectedNestedSelector");
    },
  );

  test(".foo (implicit descendant) requires the child combinator", () => {
    const violations = analyzeNestedSelector(parseSelector(".foo"), patterns);
    expect(violations).toEqual([
      {
        messageId: "elementMustUseChildCombinator",
        node: expect.objectContaining({ type: "Selector" }),
      },
    ]);
  });

  test("[data-x] (implicit descendant) requires nesting", () => {
    const violations = analyzeNestedSelector(parseSelector("[data-x]"), patterns);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.messageId).toBe("variantMustUseNesting");
  });

  test.each([["&[data-a][data-b]"], ["&:hover"], ["&::before"], ["&[aria-expanded]"]])(
    "%s is a valid Variant selector",
    (prelude) => {
      expect(analyzeNestedSelector(parseSelector(prelude), patterns)).toEqual([]);
    },
  );

  test("kebab-case violation is reported as invalidVariantName", () => {
    const violations = analyzeNestedSelector(parseSelector("&[data-isActive]"), patterns);
    expect(violations).toEqual([
      {
        messageId: "invalidVariantName",
        node: expect.objectContaining({ type: "AttributeSelector" }),
        data: { name: "data-isActive" },
      },
    ]);
  });

  test.each([["& > .el"], ["&.foo"], ["&"]])("%s is not a Variant selector", (prelude) => {
    const violations = analyzeNestedSelector(parseSelector(prelude), patterns);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.messageId).toBe("expectedNestedSelector");
  });

  test("an unrecognized selector head falls back to expectedNestedSelector", () => {
    const violations = analyzeNestedSelector(parseSelector("div"), patterns);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.messageId).toBe("expectedNestedSelector");
  });
});

describe("isOpaqueAtrule", () => {
  test.each([["media"], ["supports"], ["container"], ["layer"], ["scope"], ["starting-style"]])(
    "@%s is transparent (not opaque)",
    (name) => {
      expect(isOpaqueAtrule(name)).toBe(false);
    },
  );

  test.each([["keyframes"], ["font-face"], ["page"], ["property"]])("@%s is opaque", (name) => {
    expect(isOpaqueAtrule(name)).toBe(true);
  });

  test("matching is case-insensitive", () => {
    expect(isOpaqueAtrule("MEDIA")).toBe(false);
    expect(isOpaqueAtrule("KEYFRAMES")).toBe(true);
  });
});

describe("hasGlobalEscape", () => {
  test.each([[":global(.foo)"], [":local(.foo)"]])(
    "%s is a global/local escape hatch",
    (prelude) => {
      expect(hasGlobalEscape(parseSelector(prelude))).toBe(true);
    },
  );

  test.each([[".Button"], ["&[data-x]"], ["> .el"]])(
    "%s is not a global/local escape hatch",
    (prelude) => {
      expect(hasGlobalEscape(parseSelector(prelude))).toBe(false);
    },
  );
});
