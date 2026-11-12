/**
 * Pre-computed arrays for better minification and performance
 * These replace comma-separated strings that were previously split at runtime
 */

// Pre-computed mask arrays (replaces Mask.Text.split(), etc.)
export const MaskTextList = ["address", "password", "contact"];
export const MaskDisableList = ["radio", "checkbox", "range", "button", "reset", "submit"];
export const MaskExcludeList = ["password", "secret", "pass", "social", "ssn", "code", "hidden"];
export const MaskTagsList = ["INPUT", "SELECT", "TEXTAREA"];

// Pre-computed exclude class names (replaces Constant.ExcludeClassNames.split())
export const ExcludeClassNamesList = ["load", "active", "fixed", "visible", "focus", "show", "collaps", "animat"];
