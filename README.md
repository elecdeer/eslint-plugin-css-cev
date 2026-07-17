# eslint-plugin-css-cev

ESLint plugin for [@eslint/css](https://github.com/eslint/css) that enforces **CEV** (Component / Element / Variant), a CSS architecture based on [RSCSS](https://ricostacruz.com/rscss/), designed for CSS Modules.

## The CEV architecture

| Classification | Naming convention                                | How to write it                                   |
| -------------- | ------------------------------------------------ | ------------------------------------------------- |
| **Component**  | PascalCase (`Button`)                            | A single top-level class selector                 |
| **Element**    | camelCase, single word allowed (`icon`, `label`) | Nested with a child combinator: `> .element`      |
| **Variant**    | kebab-case `data-*` attribute (`data-is-active`) | Nested with the CSS nesting selector: `&[data-*]` |

A Component maps 1:1 to a React component. Elements are the pieces inside it, and Variants are the states/conditions it can be in.

```css
/* Button.module.css */
.Button {
  display: inline-flex;
  align-items: center;

  > .icon {
    margin-right: 4px;
  }

  > .label {
    font-weight: 600;
  }

  &[data-is-active] {
    background: blue;
    color: white;
  }

  &:hover {
    opacity: 0.85;
  }
}
```

```tsx
// Button.tsx
import styles from "./Button.module.css";

function Button({ isActive }: { isActive?: boolean }) {
  return (
    <button className={styles.Button} data-is-active={isActive || undefined}>
      <span className={styles.icon} aria-hidden />
      <span className={styles.label}>Click me</span>
    </button>
  );
}
```

## Installation

```bash
pnpm add -D eslint-plugin-css-cev @eslint/css
```

```bash
npm install --save-dev eslint-plugin-css-cev @eslint/css
```

`eslint` (>= 9.15.0, flat config) and `@eslint/css` (>= 1.0.0) are peer dependencies and must be installed alongside this plugin.

## Usage

```js
// eslint.config.js
import css from "@eslint/css";
import cev from "eslint-plugin-css-cev";

export default [
  {
    files: ["**/*.css"],
    plugins: { css },
    language: "css/css",
  },
  cev.configs.recommended,
];
```

`cev.configs.recommended` enables both rules as `"error"` and already registers the `cev` plugin itself, so `plugins` in your own config block only needs `css` alongside it (the `language: "css/css"` setup that `@eslint/css` requires).

To configure the rules individually instead of using the recommended config:

```js
import css from "@eslint/css";
import cev from "eslint-plugin-css-cev";

export default [
  {
    files: ["**/*.css"],
    plugins: { css, cev },
    language: "css/css",
    rules: {
      "cev/selector-format": "error",
      "cev/no-descendant-combinator": "error",
    },
  },
];
```

## Rules

### selector-format

`cev/selector-format` enforces the Component / Element / Variant selector shapes described above.

```css
/* ✓ Good */
.Button {
  > .icon {
  }
  &[data-is-active] {
  }
}

/* ✗ Bad: flat, non-nested syntax */
.Button > .icon {
}

/* ✗ Bad: Component is not PascalCase */
.button {
}

/* ✗ Bad: more than one class at the top level */
.Button.Active {
}

/* ✗ Bad: Element written without a child combinator */
.Button {
  .icon {
  }
}

/* ✗ Bad: Variant written without the nesting selector */
.Button {
  [data-is-active] {
  }
}
```

#### Options

Each option is a string that is compiled with `new RegExp` and overrides the corresponding default naming pattern.

| Option             | Default                                                    |
| ------------------ | ---------------------------------------------------------- |
| `componentPattern` | `^[A-Z][a-zA-Z0-9]*$` (PascalCase)                         |
| `elementPattern`   | `^[a-z][a-zA-Z0-9]*$` (camelCase, single word allowed)     |
| `variantPattern`   | `^data-[a-z][a-z0-9]*(-[a-z0-9]+)*$` (kebab-case `data-*`) |

```js
{
  rules: {
    "cev/selector-format": [
      "error",
      { componentPattern: "^[a-z][a-z-]*$" }, // e.g. allow kebab-case Components instead
    ],
  },
}
```

### no-descendant-combinator

`cev/no-descendant-combinator` disallows the descendant combinator (a bare space between compound selectors), since CEV expresses every Component/Element/Variant relationship through CSS nesting (`>` or `&`) instead.

```css
/* ✓ Good */
.Button {
  > .icon {
  }
}

/* ✗ Bad */
.Button .icon {
}
```

## Notes

- `:global(...)` and `:local(...)` selectors are CSS Modules escape hatches; both rules skip any selector that contains one entirely.
- `selector-format` treats `@media`, `@supports`, `@container`, `@layer`, `@scope`, and `@starting-style` as "transparent": rules inside them are validated as if the at-rule were not there. Other at-rules with a block (`@keyframes`, `@font-face`, `@property`, ...) are skipped entirely, so selectors like `from`/`to` inside `@keyframes` are never misdetected as CEV violations.

## License

MIT
