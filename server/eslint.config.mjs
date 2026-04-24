// @ts-check

import eslint from "@eslint/js";
import { defineConfig } from 'eslint/config';
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    ignores: ["node_modules"],
    extends: [eslint.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.ts"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.node,
    },
  }
);
