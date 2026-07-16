import css from "@eslint/css";
import { Linter } from "eslint";
import { describe, expect, test } from "vite-plus/test";
import plugin from "../src/index.ts";

const linter = new Linter();

const baseConfig = {
  files: ["**/*.css"],
  plugins: { css, cev: plugin },
  language: "css/css",
  rules: {
    "cev/selector-format": "error",
    "cev/no-descendant-combinator": "error",
  },
} satisfies Linter.Config;

describe("plugin E2E (Linter.verify)", () => {
  test("valid CEV code produces no messages", () => {
    const code = ".Button { > .title {} > .icon {} &[data-is-active] {} &:hover {} }";
    const messages = linter.verify(code, baseConfig, "test.css");
    expect(messages).toEqual([]);
  });

  test("a flat (non-nested) selector is reported by both rules", () => {
    const messages = linter.verify(".Button .title {}", baseConfig, "test.css");
    const ruleIds = messages.map((message) => message.ruleId);
    expect(ruleIds).toContain("cev/selector-format");
    expect(ruleIds).toContain("cev/no-descendant-combinator");
  });

  test("an invalid Component name is reported with a name and location", () => {
    const messages = linter.verify(".button {}", baseConfig, "test.css");
    expect(messages).toHaveLength(1);
    expect(messages[0]?.ruleId).toBe("cev/selector-format");
    expect(messages[0]?.messageId).toBe("invalidComponentName");
  });

  test("@keyframes selectors are not misdetected as CEV violations", () => {
    const code = "@keyframes spin { from { color: red; } to { color: blue; } }";
    const messages = linter.verify(code, baseConfig, "test.css");
    expect(messages).toEqual([]);
  });

  test(":global escape hatch is exempt from both rules", () => {
    const messages = linter.verify(":global(.foo .bar) {}", baseConfig, "test.css");
    expect(messages).toEqual([]);
  });

  test("selector-format options are honored end-to-end", () => {
    const messages = linter.verify(
      ".button-group {}",
      {
        ...baseConfig,
        rules: {
          "cev/selector-format": ["error", { componentPattern: "^[a-z][a-z-]*$" }],
        },
      },
      "test.css",
    );
    expect(messages).toEqual([]);
  });
});

describe("configs.recommended", () => {
  test("recommended config enables both rules as error", () => {
    const messages = linter.verify(
      ".button .title {}",
      [{ files: ["**/*.css"], plugins: { css }, language: "css/css" }, plugin.configs.recommended],
      "test.css",
    );
    const ruleIds = messages.map((message) => message.ruleId);
    expect(ruleIds).toContain("cev/selector-format");
    expect(ruleIds).toContain("cev/no-descendant-combinator");
    for (const message of messages) {
      expect(message.severity).toBe(2);
    }
  });
});

describe("plugin metadata", () => {
  test("meta and rules are exposed", () => {
    expect(plugin.meta.name).toBe("eslint-plugin-css-cev");
    expect(Object.keys(plugin.rules)).toEqual(["selector-format", "no-descendant-combinator"]);
  });
});
