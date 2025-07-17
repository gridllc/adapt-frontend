
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginJs from "@eslint/js";
import pluginReact from "eslint-plugin-react";
// Using the 'next' version for flat config support
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginReactRefresh from "eslint-plugin-react-refresh";

export default tseslint.config(
  // Global ignores
  {
    ignores: ["dist/**"],
  },

  // Base configs for all files
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,

  // Configuration for React/TSX files
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      react: pluginReact,
      "react-hooks": pluginReactHooks,
      "react-refresh": pluginReactRefresh,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      // Rules from React plugins
      ...pluginReact.configs.recommended.rules,
      ...pluginReact.configs["jsx-runtime"].rules,
      ...pluginReactHooks.configs.recommended.rules,

      // React Refresh rule
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],

      // Custom rule preferences
      "react/prop-types": "off", // Not needed with TypeScript
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },

  // Configuration for JS config files (e.g., vite.config.js, tailwind.config.js)
  {
    files: ["*.js", "*.cjs"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  }
);
