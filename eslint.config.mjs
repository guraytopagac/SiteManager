import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";

const commonRules = {
  "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
  "no-console": ["warn", { allow: ["error", "warn"] }],
};

export default defineConfig([
  globalIgnores(["dist", "dist_electron", "out", "node_modules"]),
  {
    files: ["src/**/*.{js,jsx}"],
    extends: [js.configs.recommended, reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: commonRules,
  },
  {
    files: ["electron/**/*.js", "database/**/*.js"],
    ignores: ["electron/windows/**/guide.js", "electron/windows/**/splash.js"],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: commonRules,
  },
  {
    files: ["electron/windows/**/guide.js", "electron/windows/**/splash.js"],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: commonRules,
  },
]);
