import css from "@eslint/css";
import { RuleTester } from "eslint";
import { describe, it } from "vite-plus/test";
import selectorFormat from "../src/rules/selector-format.ts";

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
  plugins: { css },
  language: "css/css",
});

ruleTester.run("selector-format", selectorFormat, {
  valid: [
    // トップレベル: 単一の正しい Component セレクタ
    ".Button {}",
    ".ButtonGroup { color: red; }",
    // カンマ区切りのセレクタリストは各セレクタを独立に検証する
    ".A, .B {}",
    // Element: 子結合子でのネスト、1 語も許容
    ".Button { > .title {} }",
    ".Button { > .icon {} }",
    // Element の後続に擬似クラス/擬似要素/data-以外の属性は許容
    ".Button { > .item:first-child {} }",
    ".Button { > .item::before {} }",
    ".Button { > .item[aria-hidden] {} }",
    // Variant: nesting セレクタでの data-* 属性
    ".Button { &[data-is-active] {} }",
    ".Button { &[data-a][data-b] {} }",
    // Variant の後続に擬似クラス/擬似要素/data-以外の属性は許容
    ".Button { &:hover {} }",
    ".Button { &::before {} }",
    ".Button { &[aria-expanded] {} }",
    // @media 等の透過 at-rule 内はトップレベル扱い
    "@media (min-width: 100px) { .Button {} }",
    "@supports (display: flex) { .Button { > .title {} } }",
    // Component 内の @media: 中のルールはネスト文脈のまま検証される
    ".Button { @media (min-width: 100px) { > .title {} } }",
    // @keyframes 等の不透過 at-rule 内は検証対象外 (from/to が誤検出されない)
    "@keyframes spin { from { color: red; } to { color: blue; } }",
    // :global / :local を含むセレクタは検証対象外
    ":global(.foo) {}",
    ".Button { &:local(.bar) {} }",
    // ネストが深くても Element/Variant として妥当なら valid
    ".Button { > .title { &[data-is-active] {} } }",
  ],
  invalid: [
    {
      // トップレベル: Component 以外の先頭
      code: "div {}",
      errors: [{ messageId: "expectedComponentSelector" }],
    },
    {
      code: "[data-x] {}",
      errors: [{ messageId: "expectedComponentSelector" }],
    },
    {
      // トップレベル: PascalCase 違反
      code: ".button {}",
      errors: [{ messageId: "invalidComponentName", data: { name: "button" } }],
    },
    {
      // トップレベル: 複合セレクタ (.A.B)
      code: ".A.B {}",
      errors: [{ messageId: "expectedSingleComponent" }],
    },
    {
      // トップレベル: 複雑セレクタ (.A, .B が両方 comma 内で1つずつ検証、B側で違反)
      code: ".A, .b {}",
      errors: [{ messageId: "invalidComponentName", data: { name: "b" } }],
    },
    {
      code: ".A:hover {}",
      errors: [{ messageId: "expectedSingleComponent" }],
    },
    {
      // トップレベルのフラット記法 (ネスト必須)
      code: ".Button > .title {}",
      errors: [{ messageId: "expectedSingleComponent" }],
    },
    {
      // 暗黙の子孫結合子 (フラット記法)
      code: ".Button { .foo {} }",
      errors: [{ messageId: "elementMustUseChildCombinator" }],
    },
    {
      // Element: camelCase 違反
      code: ".Button { > .Title {} }",
      errors: [{ messageId: "invalidElementName", data: { name: "Title" } }],
    },
    {
      // Element の後ろに Variant を直接書く (nesting を使うべき)
      code: ".Button { > .el[data-x] {} }",
      errors: [{ messageId: "variantMustUseNesting" }],
    },
    {
      // 複数 Element の連結
      code: ".Button { > .a > .b {} }",
      errors: [{ messageId: "expectedNestedSelector" }],
    },
    {
      code: ".Button { > .a.b {} }",
      errors: [{ messageId: "expectedNestedSelector" }],
    },
    {
      // Variant の暗黙子孫
      code: ".Button { [data-x] {} }",
      errors: [{ messageId: "variantMustUseNesting" }],
    },
    {
      // Variant: kebab-case 違反
      code: ".Button { &[data-isActive] {} }",
      errors: [{ messageId: "invalidVariantName", data: { name: "data-isActive" } }],
    },
    {
      // & のみ
      code: ".Button { & {} }",
      errors: [{ messageId: "expectedNestedSelector" }],
    },
    {
      // &.foo は Variant ではない
      code: ".Button { &.foo {} }",
      errors: [{ messageId: "expectedNestedSelector" }],
    },
    {
      // & > .el は Element の書き方ではない
      code: ".Button { & > .el {} }",
      errors: [{ messageId: "expectedNestedSelector" }],
    },
    {
      // @media 透過: 内側のトップレベル違反も検出する
      code: "@media (min-width: 100px) { .button {} }",
      errors: [{ messageId: "invalidComponentName", data: { name: "button" } }],
    },
  ],
});

describe("selector-format options", () => {
  ruleTester.run("selector-format (custom patterns)", selectorFormat, {
    valid: [
      {
        // componentPattern を kebab-case に上書き
        code: ".button-group {}",
        options: [{ componentPattern: "^[a-z][a-z-]*$" }],
      },
      {
        // elementPattern をスネークケースに上書き
        code: ".Button { > .icon_wrapper {} }",
        options: [{ elementPattern: "^[a-z][a-z_]*$" }],
      },
      {
        // variantPattern を緩めて camelCase の data-* も許可
        code: ".Button { &[data-isActive] {} }",
        options: [{ variantPattern: "^data-[a-zA-Z]+$" }],
      },
    ],
    invalid: [
      {
        code: ".Button {}",
        options: [{ componentPattern: "^[a-z][a-z-]*$" }],
        errors: [{ messageId: "invalidComponentName", data: { name: "Button" } }],
      },
    ],
  });
});
