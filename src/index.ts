/**
 * eslint-plugin-css-cev: enforce the CEV (Component / Element / Variant) CSS
 * architecture for @eslint/css.
 */
import type { Linter } from "eslint";
import pkg from "../package.json" with { type: "json" };
import noDescendantCombinator, {
  type NoDescendantCombinatorRuleDefinition,
} from "./rules/no-descendant-combinator.ts";
import selectorFormat, { type SelectorFormatRuleDefinition } from "./rules/selector-format.ts";

/**
 * The plugin object shape. Annotated explicitly so declaration emit does not
 * have to name internal types from transitive dependencies.
 */
type CevPlugin = {
  meta: {
    name: string;
    version: string;
  };
  rules: {
    "selector-format": SelectorFormatRuleDefinition;
    "no-descendant-combinator": NoDescendantCombinatorRuleDefinition;
  };
  configs: {
    recommended: Linter.Config;
  };
};

const plugin: CevPlugin = {
  meta: {
    name: "eslint-plugin-css-cev",
    version: pkg.version,
  },
  rules: {
    "selector-format": selectorFormat,
    "no-descendant-combinator": noDescendantCombinator,
  },
  // configs は plugin 自身を参照するため定義後に代入する (typescript-eslint と
  // 同じパターン)。初期化順の都合でこの 1 箇所のみ型アサーションを使う。
  configs: {} as CevPlugin["configs"],
};

Object.assign(plugin.configs, {
  recommended: {
    name: "cev/recommended",
    plugins: {
      cev: plugin,
    },
    rules: {
      "cev/selector-format": "error",
      "cev/no-descendant-combinator": "error",
    },
  } satisfies Linter.Config,
});

export default plugin;
export type { SelectorFormatOptions } from "./rules/selector-format.ts";
