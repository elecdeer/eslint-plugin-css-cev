import css from "@eslint/css";
import { RuleTester } from "eslint";
import { describe, it } from "vite-plus/test";
import noDescendantCombinator from "../src/rules/no-descendant-combinator.ts";

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
  plugins: { css },
  language: "css/css",
});

ruleTester.run("no-descendant-combinator", noDescendantCombinator, {
  valid: [
    // 子孫結合子を含まないセレクタ
    ".Button {}",
    ".Button { > .title {} }",
    ".Button { &[data-is-active] {} }",
    ".Button { &:hover {} }",
    // :global / :local を含むセレクタはスキップされる
    ":global(.foo .bar) {}",
    ".Button { &:local(.foo .bar) {} }",
  ],
  invalid: [
    {
      // 単純な子孫結合子
      code: ".Foo .bar {}",
      errors: [{ messageId: "unexpectedDescendantCombinator" }],
    },
    {
      // ネストされたルール内の子孫結合子
      code: ".Button { .foo .bar {} }",
      errors: [{ messageId: "unexpectedDescendantCombinator" }],
    },
    {
      // :has() 内の子孫結合子も自然に検出される
      code: ".Button:has(.a .b) {}",
      errors: [{ messageId: "unexpectedDescendantCombinator" }],
    },
    {
      // 複数の子孫結合子はそれぞれ結合子自身の位置で報告される
      code: ".a .b .c {}",
      errors: [
        {
          messageId: "unexpectedDescendantCombinator",
          line: 1,
          column: 3,
          endColumn: 4,
        },
        {
          messageId: "unexpectedDescendantCombinator",
          line: 1,
          column: 6,
          endColumn: 7,
        },
      ],
    },
  ],
});
