/**
 * Rule to enforce the CEV (Component / Element / Variant) CSS selector
 * format:
 *
 * - Component: a single top-level PascalCase class selector (`.Button`).
 * - Element: a camelCase class selector nested with a child combinator
 *   (`> .element`).
 * - Variant: a kebab-case `data-*` attribute selector nested with the CSS
 *   nesting selector (`&[data-active]`).
 */
import type { CSSRuleDefinition } from "@eslint/css";
import type { RulePlain } from "@eslint/css-tree";
import {
  defaultComponentPattern,
  defaultElementPattern,
  defaultVariantPattern,
  type NamingPatterns,
} from "../lib/naming.ts";
import {
  analyzeNestedSelector,
  analyzeTopLevelSelector,
  hasGlobalEscape,
  isOpaqueAtrule,
  type SelectorFormatMessageId,
  type SelectorViolation,
} from "../lib/selector.ts";

/**
 * User-facing options for `cev/selector-format`. Each pattern is a string
 * (compiled with `new RegExp`) that overrides the corresponding CEV
 * classification's default naming pattern.
 */
export type SelectorFormatOptions = {
  componentPattern?: string;
  elementPattern?: string;
  variantPattern?: string;
};

export type SelectorFormatRuleDefinition = CSSRuleDefinition<{
  RuleOptions: [SelectorFormatOptions?];
  MessageIds: SelectorFormatMessageId;
}>;

/**
 * Resolves a single option pattern string into a `RegExp`, falling back to
 * the provided default when the option is not set.
 */
function resolvePattern(pattern: string | undefined, fallback: RegExp): RegExp {
  return pattern === undefined ? fallback : new RegExp(pattern);
}

const selectorFormat: SelectorFormatRuleDefinition = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Enforce the CEV (Component / Element / Variant) CSS selector format",
      url: "https://github.com/elecdeer/eslint-plugin-css-cev#selector-format",
    },
    messages: {
      invalidComponentName:
        'Component class name ".{{name}}" does not match the configured component naming pattern (PascalCase by default).',
      expectedComponentSelector:
        'Expected a single top-level Component class selector (e.g. ".Button"), but found "{{selector}}".',
      expectedSingleComponent:
        'Expected a single Component class selector, but found "{{selector}}". Express additional conditions with nested Element/Variant selectors instead.',
      invalidElementName:
        'Element class name ".{{name}}" does not match the configured element naming pattern (camelCase by default).',
      elementMustUseChildCombinator:
        'Element selectors must use an explicit child combinator (e.g. "> .element"), but found "{{selector}}".',
      invalidVariantName:
        'Variant attribute "[{{name}}]" does not match the configured variant naming pattern (kebab-case data-* attribute by default).',
      variantMustUseNesting:
        'Variant (data-*) selectors must be written with the nesting selector (e.g. "&[data-active]"), but found "{{selector}}".',
      expectedNestedSelector:
        'Unexpected nested selector "{{selector}}". Expected an Element ("> .element") or Variant ("&[data-*]") selector.',
    },
    schema: [
      {
        type: "object",
        properties: {
          componentPattern: { type: "string" },
          elementPattern: { type: "string" },
          variantPattern: { type: "string" },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const [options] = context.options;
    const patterns: NamingPatterns = {
      component: resolvePattern(options?.componentPattern, defaultComponentPattern),
      element: resolvePattern(options?.elementPattern, defaultElementPattern),
      variant: resolvePattern(options?.variantPattern, defaultVariantPattern),
    };
    const { sourceCode } = context;

    const ruleStack: RulePlain[] = [];
    let opaqueAtruleDepth = 0;

    /**
     * Reports every violation found for a rule's selector list, filling in
     * the `selector` text (source text of the reported node) that every
     * message uses alongside any violation-specific data.
     */
    function reportViolations(violations: SelectorViolation[]): void {
      for (const violation of violations) {
        context.report({
          node: violation.node,
          messageId: violation.messageId,
          data: {
            ...violation.data,
            selector: sourceCode.getText(violation.node),
          },
        });
      }
    }

    return {
      Atrule(node) {
        if (isOpaqueAtrule(node.name)) {
          opaqueAtruleDepth += 1;
        }
      },
      "Atrule:exit"(node) {
        if (isOpaqueAtrule(node.name)) {
          opaqueAtruleDepth -= 1;
        }
      },
      Rule(node) {
        const isTopLevel = ruleStack.length === 0;
        ruleStack.push(node);
        if (opaqueAtruleDepth > 0 || node.prelude.type !== "SelectorList") {
          return;
        }

        for (const selector of node.prelude.children) {
          // A SelectorList's children are always Selector nodes; this guard
          // only exists to satisfy the plain AST's generic `CssNodePlain[]`
          // typing.
          if (selector.type !== "Selector") {
            continue;
          }
          if (hasGlobalEscape(selector)) {
            continue;
          }
          const violations = isTopLevel
            ? analyzeTopLevelSelector(selector, patterns)
            : analyzeNestedSelector(selector, patterns);
          reportViolations(violations);
        }
      },
      "Rule:exit"() {
        ruleStack.pop();
      },
    };
  },
};

export default selectorFormat;
