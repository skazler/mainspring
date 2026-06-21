import tseslint from "typescript-eslint";
import noFloatMoney from "./eslint-rules/no-float-money.js";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/build/**",
      "**/dist/**",
      "**/.svelte-kit/**",
      "**/target/**",
      "**/drizzle/**",
    ],
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { sourceType: "module" },
    },
    plugins: {
      mainspring: { rules: { "no-float-money": noFloatMoney } },
    },
    rules: {
      "mainspring/no-float-money": "error",
    },
  },
);
