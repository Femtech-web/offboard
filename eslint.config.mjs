import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  prettier,
  {
    rules: {
      "no-console": ["error", { allow: ["info", "error"] }],
    },
  },
  {
    files: ["src/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='style']",
          message: "Use Tailwind utilities for interface styling.",
        },
        {
          selector: "JSXElement[openingElement.name.name='style']",
          message: "Use Tailwind utilities instead of handwritten CSS.",
        },
      ],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/worker/src/**"],
              message:
                "Keep provider credentials in the worker; use an authenticated application boundary to request provider operations.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "coverage/**",
    "next-env.d.ts",
    "privates-notes/**",
    ".local/**",
    "marketing/offboard-film/**",
  ]),
]);
