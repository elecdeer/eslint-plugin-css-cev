/**
 * Rule to disallow the descendant combinator (` `) in selectors. CEV
 * requires every relationship between a Component, its Elements, and its
 * Variants to be expressed with CSS nesting (`>` or `&`), so an implicit
 * descendant combinator is always unexpected.
 */
import type { CSSRuleDefinition } from "@eslint/css";
import { hasGlobalEscape } from "../lib/selector.ts";

export type NoDescendantCombinatorRuleDefinition = CSSRuleDefinition<{
  RuleOptions: [];
  MessageIds: "unexpectedDescendantCombinator";
}>;

const noDescendantCombinator: NoDescendantCombinatorRuleDefinition = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow the descendant combinator in selectors",
      url: "https://github.com/elecdeer/eslint-plugin-css-cev#no-descendant-combinator",
    },
    messages: {
      unexpectedDescendantCombinator:
        'Unexpected descendant combinator in selector "{{selector}}". Use an explicit child combinator (">") or CEV nesting ("&") instead.',
    },
    schema: [],
  },
  create(context) {
    const { sourceCode } = context;

    return {
      Selector(node) {
        if (hasGlobalEscape(node)) {
          return;
        }
        for (const [index, child] of node.children.entries()) {
          if (child.type !== "Combinator" || child.name !== " ") {
            continue;
          }
          // The descendant combinator itself has no location (it is a
          // whitespace token with `loc: null` in css-tree), so its location
          // is derived from the surrounding nodes, falling back to the
          // enclosing Selector.
          const start = node.children[index - 1]?.loc?.end;
          const end = node.children[index + 1]?.loc?.start;
          const data = { selector: sourceCode.getText(node) };
          if (start !== undefined && end !== undefined) {
            context.report({
              loc: { start, end },
              messageId: "unexpectedDescendantCombinator",
              data,
            });
          } else {
            context.report({
              node,
              messageId: "unexpectedDescendantCombinator",
              data,
            });
          }
        }
      },
    };
  },
};

export default noDescendantCombinator;
