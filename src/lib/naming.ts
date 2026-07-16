/**
 * Default naming patterns for the CEV (Component / Element / Variant) CSS
 * architecture, and the small predicate helpers used to check names against
 * them.
 */

/**
 * Default pattern for Component class names: PascalCase (e.g. `Button`).
 * A Component maps 1:1 to a React component and is written as a top-level
 * class selector.
 */
export const defaultComponentPattern = /^[A-Z][a-zA-Z0-9]*$/;

/**
 * Default pattern for Element class names: camelCase (e.g. `title`).
 * A single word (e.g. `title`) is allowed since Elements are already scoped
 * by CSS Modules; use `elementPattern` to require multiple words if desired.
 */
export const defaultElementPattern = /^[a-z][a-zA-Z0-9]*$/;

/**
 * Default pattern for Variant attribute names: kebab-case after the
 * `data-` prefix (e.g. `data-is-active`). `data-isActive` does not match.
 */
export const defaultVariantPattern = /^data-[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/**
 * The resolved set of naming patterns for all three CEV classifications.
 */
export type NamingPatterns = {
  component: RegExp;
  element: RegExp;
  variant: RegExp;
};

/**
 * Checks whether a class name conforms to the Component naming pattern.
 */
export function isValidComponentName(name: string, pattern: RegExp): boolean {
  return pattern.test(name);
}

/**
 * Checks whether a class name conforms to the Element naming pattern.
 */
export function isValidElementName(name: string, pattern: RegExp): boolean {
  return pattern.test(name);
}

/**
 * Checks whether an attribute name conforms to the Variant naming pattern.
 * The pattern is matched against the full attribute name, including the
 * `data-` prefix.
 */
export function isValidVariantAttributeName(name: string, pattern: RegExp): boolean {
  return pattern.test(name);
}

/**
 * Checks whether an attribute name is a `data-*` attribute, i.e. a candidate
 * for the Variant classification. Attribute selectors for anything else
 * (e.g. `aria-*`) are out of scope for CEV naming validation.
 */
export function isDataAttributeName(name: string): boolean {
  return name.startsWith("data-");
}
