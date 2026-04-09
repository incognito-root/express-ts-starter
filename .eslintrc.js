module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    project: "./tsconfig.json",
  },
  plugins: ["@typescript-eslint", "import"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "plugin:import/recommended",
    "plugin:import/typescript",
    "prettier",
  ],
  rules: {
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-explicit-any": "warn",
    // Allow async functions as Express callbacks — Express 5 natively catches
    // rejected promises from async route handlers and passes them to next(err).
    // Only suppress the arguments check; other misuses remain errors.
    "@typescript-eslint/no-misused-promises": [
      "error",
      { checksVoidReturn: { arguments: false } },
    ],
    "import/order": [
      "error",
      {
        groups: [
          "builtin",
          "external",
          "internal",
          "parent",
          "sibling",
          "index",
        ],
        "newlines-between": "always",
        alphabetize: { order: "asc", caseInsensitive: true },
      },
    ],

    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: [
              "**/utils/prismaClient",
              "../utils/prismaClient",
              "../../utils/prismaClient",
              "../../../utils/prismaClient",
            ],
            message:
              "❌ REPOSITORY PATTERN VIOLATION: Direct Prisma client imports are ONLY allowed in the repository layer (src/repositories/). Services, controllers, and middleware must use repositories to access data.",
          },
        ],
      },
    ],
  },
  overrides: [
    {
      files: ["src/repositories/**/*.ts"],
      rules: {
        "no-restricted-imports": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unsafe-assignment": "off",
        "@typescript-eslint/no-unsafe-member-access": "off",
        "@typescript-eslint/no-unsafe-call": "off",
        "@typescript-eslint/no-unsafe-return": "off",
        "@typescript-eslint/require-await": "off",
      },
    },
    {
      files: ["src/controllers/**/*.ts", "src/middlewares/**/*.ts"],
      rules: {
        // These access req/res dynamic properties that TypeScript can't fully type
        "@typescript-eslint/no-unsafe-assignment": "warn",
        "@typescript-eslint/no-unsafe-member-access": "warn",
        "@typescript-eslint/no-unsafe-call": "warn",
      },
    },
    {
      files: ["src/services/**/*.ts"],
      rules: {
        // Services should be fully typed — these are warnings to surface
        // remaining any-typed patterns without breaking the build
        "@typescript-eslint/no-unsafe-assignment": "warn",
        "@typescript-eslint/no-unsafe-member-access": "warn",
        "@typescript-eslint/no-unsafe-call": "warn",
        "@typescript-eslint/no-unsafe-argument": "warn",
        "@typescript-eslint/no-unsafe-return": "warn",
      },
    },
    {
      files: ["prisma/**/*.ts", "scripts/**/*.ts"],
      rules: {
        "no-restricted-imports": "off",
        "@typescript-eslint/no-var-requires": "off",
      },
    },
  ],
  settings: {
    "import/resolver": {
      typescript: {
        alwaysTryTypes: true,
        project: "./tsconfig.json",
      },
    },
  },
};
