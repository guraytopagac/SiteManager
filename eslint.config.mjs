import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";

const BROWSER_SCRIPTS = ["electron/windows/**/guide.js", "electron/windows/**/splash.js", "public/*.js"];

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
      "no-restricted-imports": restrictedImports([...NODE_ONLY_MODULES, SWEETALERT]),
    },
  },
  {
    files: ["src/utils/alert.js"],
    rules: {
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
    files: ["*.js", "*.mjs"],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: commonRules,
  },
]);
