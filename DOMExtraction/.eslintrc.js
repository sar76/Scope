module.exports = {
  env: {
    browser: true,
    es2021: true,
    webextensions: true,
  },
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  rules: {
    // Error handling
    "no-console": "warn",
    "no-debugger": "error",

    // Code quality
    "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "no-undef": "error",
    "no-redeclare": "error",

    // Best practices
    eqeqeq: ["error", "always"],
    curly: ["error", "all"],
    "no-eval": "error",
    "no-implied-eval": "error",
    "no-new-func": "error",

    // ES6+
    "prefer-const": "error",
    "no-var": "error",
    "object-shorthand": "error",
    "prefer-template": "error",

    // Async/Await
    "no-async-promise-executor": "error",
    "require-await": "error",

    // Documentation
    "valid-jsdoc": "warn",

    // Spacing and formatting
    indent: ["error", 2],
    quotes: ["error", "single"],
    semi: ["error", "always"],
    "comma-dangle": ["error", "always-multiline"],
    "no-trailing-spaces": "error",
    "eol-last": "error",
  },
  globals: {
    chrome: "readonly",
  },
};
