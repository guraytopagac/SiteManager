import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";

// Classic scripts pulled in with a <script src>. They are neither CommonJS nor modules, so they
// need their own block. The list is used twice, once to exclude them from the Node block.
const BROWSER_SCRIPTS = ["electron/windows/**/guide.js", "electron/windows/**/splash.js", "public/*.js"];

// The renderer talks to the main process only through window.electronAPI. Lint enforces it here,
// so a stray import is caught before it reaches a build.
const NODE_ONLY_MODULES = ["electron", "fs", "path", "better-sqlite3"].map((name) => ({
  name,
  message: "The renderer has no Node access. Go through window.electronAPI.",
}));

const SWEETALERT = {
  name: "sweetalert2",
  message: "Dialogs go through src/utils/alert.js.",
};

function restrictedImports(paths) {
  return ["error", { paths, patterns: ["node:*"] }];
}

const commonRules = {
  "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
  "no-console": ["warn", { allow: ["error", "warn"] }],
  // smart keeps the deliberate `== null` checks in the validators legal.
  eqeqeq: ["error", "smart"],
  "no-var": "error",
  "prefer-const": "error",
  "no-unused-expressions": "error",
};

export default defineConfig([
  // node_modules is ignored by eslint itself, so it is not repeated here.
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
      "no-restricted-imports": restrictedImports([...NODE_ONLY_MODULES, SWEETALERT]),
    },
  },
  {
    // The one file allowed to reach SweetAlert. Everything else it may not import still stands.
    files: ["src/utils/alert.js"],
    rules: {
      "no-restricted-imports": restrictedImports(NODE_ONLY_MODULES),
    },
  },
  {
    // sourceType is what turns the "do not mix module systems" rule into a parse error.
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
    // Config files in the project root. Without this block they match no other one, which means
    // eslint parses them and applies no rule at all.
    files: ["*.js", "*.mjs"],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: commonRules,
  },
]);
