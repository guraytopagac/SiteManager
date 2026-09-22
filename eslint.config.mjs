// Four blocks, each carrying both its globals and its module kind. Declaring the kind is the point: an import
// written into a file that uses the other module system then fails to parse instead of failing later.

import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";

// Single owner of the classic script list, read twice below: once by their own block and once by the
// exclusions of the Node block. A new window script goes here.
const BROWSER_SCRIPTS = ["electron/windows/**/guide.js", "electron/windows/**/splash.js", "public/*.js"];

// Two written rules turned into checks. The renderer may not reach Node, and dialogs may only be opened
// through the one wrapper, so neither depends on being remembered.
const NODE_ONLY_MODULES = ["electron", "fs", "path", "better-sqlite3"].map((name) => ({
  name,
  message: "The renderer has no Node access. Go through window.electronAPI.",
}));

function restrictedImports(paths) {
  return ["error", { paths, patterns: ["node:*"] }];
}

const commonRules = {
  "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
  // Only these two survive, which is why even informational lines are written as warnings.
  "no-console": ["warn", { allow: ["error", "warn"] }],
  // Smart, so the deliberate loose null checks in the validation layer stay legal.
  eqeqeq: ["error", "smart"],
  "no-var": "error",
  "prefer-const": "error",
  "no-unused-expressions": "error",
};

export default defineConfig([
  globalIgnores(["dist", "dist_electron"]),
  {
    files: ["src/**/*.{js,jsx}"],
    extends: [js.configs.recommended, reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      ...commonRules,
      "no-restricted-imports": restrictedImports(NODE_ONLY_MODULES),
    },
  },
  {
    files: ["electron/**/*.js", "database/**/*.js"],
    ignores: BROWSER_SCRIPTS,
    extends: [js.configs.recommended],
    languageOptions: {
      globals: { ...globals.node },
      sourceType: "commonjs",
    },
    rules: commonRules,
  },
  {
    files: BROWSER_SCRIPTS,
    extends: [js.configs.recommended],
    languageOptions: {
      globals: { ...globals.browser },
      sourceType: "script",
    },
    rules: commonRules,
  },
  {
    // Without this block the two config files at the repository root match nothing and count as linted with
    // not a single rule applied. Printing the resolved config for one of them shows whether it still holds.
    files: ["*.js", "*.mjs"],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: commonRules,
  },
]);
