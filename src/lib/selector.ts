/**
 * Pure selector-classification logic for the `cev/selector-format` rule.
 *
 * These functions only inspect plain `@eslint/css-tree` AST nodes; they know
 * nothing about ESLint, `context.report`, or source text, which keeps them
 * easy to unit test directly against parser output.
 */
import type { AttributeSelector, CssNodePlain, SelectorPlain } from "@eslint/css-tree";
import type { NamingPatterns } from "./naming.ts";
import {
  isDataAttributeName,
  isValidComponentName,
  isValidElementName,
  isValidVariantAttributeName,
} from "./naming.ts";

/**
 * The message identifiers a `selector-format` violation can be reported
 * with. Kept in sync with `meta.messages` in `src/rules/selector-format.ts`.
 */
export type SelectorFormatMessageId =
  | "invalidComponentName"
  | "expectedComponentSelector"
  | "expectedSingleComponent"
  | "invalidElementName"
  | "elementMustUseChildCombinator"
  | "invalidVariantName"
  | "variantMustUseNesting"
  | "expectedNestedSelector";

/**
 * A single selector-format violation: the message to report, the smallest
 * AST node that represents it, and any interpolation data the message needs
 * beyond what the rule fills in itself (e.g. the offending name).
 */
export type SelectorViolation = {
  messageId: SelectorFormatMessageId;
  node: CssNodePlain;
  data?: Record<string, string>;
};

/**
 * At-rules whose block is "transparent": a `Rule` nested directly inside one
 * of these is still treated as top-level for CEV purposes (e.g.
 * `@media { .Button {} }` validates `.Button` as a top-level Component).
 * Any other at-rule with a block (`@keyframes`, `@font-face`, ...) is opaque:
 * rules nested inside it are skipped entirely.
 */
const transparentAtruleNames = new Set([
  "media",
  "supports",
  "container",
  "layer",
  "scope",
  "starting-style",
]);

/**
 * Checks whether an at-rule name is opaque, i.e. rules nested inside its
 * block should be skipped by `selector-format` (`@keyframes`, `@font-face`,
 * `@property`, etc.), as opposed to "transparent" at-rules like `@media`.
 */
export function isOpaqueAtrule(name: string): boolean {
  return !transparentAtruleNames.has(name.toLowerCase());
}

/**
 * Checks whether a selector contains a `:global(...)` or `:local(...)`
 * pseudo-class, the CSS Modules escape hatch. Such selectors are exempt from
 * CEV naming/nesting validation entirely.
 */
export function hasGlobalEscape(selector: SelectorPlain): boolean {
  return selector.children.some(
    (child) =>
      child.type === "PseudoClassSelector" && (child.name === "global" || child.name === "local"),
  );
}

/**
 * Validates a top-level selector (a `Selector` that is not nested inside
 * another `Rule`). Top-level selectors must be exactly one Component class
 * selector (e.g. `.Button`).
 */
export function analyzeTopLevelSelector(
  selector: SelectorPlain,
  patterns: NamingPatterns,
): SelectorViolation[] {
  const [first, ...rest] = selector.children;
  if (first === undefined) {
    return [];
  }

  if (first.type !== "ClassSelector") {
    return [{ messageId: "expectedComponentSelector", node: selector }];
  }

  const violations: SelectorViolation[] = [];
  if (!isValidComponentName(first.name, patterns.component)) {
    violations.push({
      messageId: "invalidComponentName",
      node: first,
      data: { name: first.name },
    });
  }
  if (rest.length > 0) {
    violations.push({ messageId: "expectedSingleComponent", node: selector });
  }
  return violations;
}

/**
 * Validates a selector nested inside another `Rule`. It must be either an
 * Element selector (`> .element`) or a Variant selector (`&[data-*]`).
 */
export function analyzeNestedSelector(
  selector: SelectorPlain,
  patterns: NamingPatterns,
): SelectorViolation[] {
  const first = selector.children[0];
  if (first === undefined) {
    return [];
  }

  if (first.type === "Combinator" && first.name === ">") {
    return analyzeElementSelector(selector, patterns);
  }
  if (first.type === "NestingSelector") {
    return analyzeVariantSelector(selector, patterns);
  }
  if (first.type === "ClassSelector") {
    // Implicit descendant combinator, e.g. `.foo {}` written directly inside
    // a nested block instead of `> .foo {}`.
    return [{ messageId: "elementMustUseChildCombinator", node: selector }];
  }
  if (first.type === "AttributeSelector" && isDataAttributeName(first.name.name)) {
    // Implicit descendant combinator on a Variant attribute, e.g.
    // `[data-x] {}` instead of `&[data-x] {}`.
    return [{ messageId: "variantMustUseNesting", node: selector }];
  }
  return [{ messageId: "expectedNestedSelector", node: selector }];
}

/**
 * Validates an Element selector, i.e. one starting with `> .element`.
 * Exactly one child combinator followed by exactly one Element class
 * selector is expected; trailing pseudo-classes/pseudo-elements and
 * non-`data-*` attribute selectors are allowed.
 */
function analyzeElementSelector(
  selector: SelectorPlain,
  patterns: NamingPatterns,
): SelectorViolation[] {
  const [, second, ...rest] = selector.children;
  if (second === undefined || second.type !== "ClassSelector") {
    return [{ messageId: "expectedNestedSelector", node: selector }];
  }

  const violations: SelectorViolation[] = [];
  if (!isValidElementName(second.name, patterns.element)) {
    violations.push({
      messageId: "invalidElementName",
      node: second,
      data: { name: second.name },
    });
  }

  let hasStructuralViolation = false;
  for (const node of rest) {
    if (node.type === "Combinator" || node.type === "ClassSelector") {
      // `> .a > .b` or `> .a.b`: only a single Element is allowed.
      hasStructuralViolation = true;
      continue;
    }
    if (node.type === "AttributeSelector" && isDataAttributeName(node.name.name)) {
      // `> .el[data-x]`: Variants must use `&[data-*]` nesting instead.
      violations.push({ messageId: "variantMustUseNesting", node });
    }
  }
  if (hasStructuralViolation) {
    violations.push({ messageId: "expectedNestedSelector", node: selector });
  }

  return violations;
}

/**
 * Validates a Variant selector, i.e. one starting with the nesting selector
 * `&`. Only `data-*` attribute selectors (kebab-case validated) and other
 * pseudo-classes/pseudo-elements/attribute selectors may follow.
 */
function analyzeVariantSelector(
  selector: SelectorPlain,
  patterns: NamingPatterns,
): SelectorViolation[] {
  const [, ...rest] = selector.children;
  if (rest.length === 0) {
    // `&` alone.
    return [{ messageId: "expectedNestedSelector", node: selector }];
  }

  const violations: SelectorViolation[] = [];
  let hasStructuralViolation = false;
  for (const node of rest) {
    if (node.type === "ClassSelector" || node.type === "Combinator") {
      // `&.foo` or `& > .el`: not a Variant selector.
      hasStructuralViolation = true;
      continue;
    }
    if (node.type === "AttributeSelector" && isDataAttributeName(node.name.name)) {
      checkVariantAttributeName(node, patterns, violations);
    }
    // Non-`data-*` attribute selectors, pseudo-classes and pseudo-elements
    // (e.g. `&:hover`, `&::before`, `&[aria-expanded]`) are unrestricted.
  }
  if (hasStructuralViolation) {
    violations.push({ messageId: "expectedNestedSelector", node: selector });
  }

  return violations;
}

/**
 * Checks a single `data-*` attribute selector's name against the Variant
 * pattern, pushing an `invalidVariantName` violation if it does not match.
 */
function checkVariantAttributeName(
  node: AttributeSelector,
  patterns: NamingPatterns,
  violations: SelectorViolation[],
): void {
  const name = node.name.name;
  if (!isValidVariantAttributeName(name, patterns.variant)) {
    violations.push({ messageId: "invalidVariantName", node, data: { name } });
  }
}
