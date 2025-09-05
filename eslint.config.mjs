import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
	{
		files: ["**/*.{js,mjs,cjs}"],
		plugins: { js },
		extends: ["js/recommended"],
		languageOptions: { globals: globals.browser },
		rules: {

			/**
			 * Safety / correctness
			*/
			// disallow using variables that are not defined
			"no-undef": "error",
			// flag dead vars but tolerate rest patterns
			"no-unused-vars": ["warn", { args: "after-used", ignoreRestSiblings: true }],
			// code after return/throw/etc.
			"no-unreachable": "error",
			// assignment inside conditionals (likely bug)
			"no-cond-assign": ["error", "always"],
			// allow while(true) but catch others
			"no-constant-condition": ["error", { checkLoops: false }],
			// switch cases must break/return
			"no-fallthrough": "error",
			// bad regexes
			"no-invalid-regexp": "error",
			// require Number.isNaN / isNaN for NaN checks
			"use-isnan": "error",
			// typeof comparisons must use valid strings
			"valid-typeof": "error",
			// require === and !==
			"eqeqeq": ["error", "always"],

			/**
			 * Modern JS posture
			 */
			// forbid var
			"no-var": "error",
			// suggest const when not reassigned
			"prefer-const": "warn",
			// prefer template strings
			"prefer-template": "warn",
			// {x:x} → {x}
			"object-shorthand": ["warn", "always"],

			/**
			 * Import / module hygiene
			 */
			// merge repeated imports
			"no-duplicate-imports": "error",
			// avoid pointless renames in import/export
			"no-useless-rename": "error",

			/**
			 * Readability / consistency
			 */
			// prefer else-if chains
			"no-lonely-if": "warn",
			// avoid else after return
			"no-else-return": "warn",
			// `// comment` spacing
			"spaced-comment": ["warn", "always", { markers: ["/"] }],
			// spaces around =>
			"arrow-spacing": "error",
			// disallow spaces inside ( )
			"space-in-parens": ["error", "never"],

			/**
			 * Layout & formatting
			 */
			// tabs for indentation
			indent: ["error", "tab"],
			// newline at EOF
			"eol-last": ["error", "always"],
			// no trailing whitespace
			"no-trailing-spaces": "error",
			// double quotes (allow single if escaping)
			quotes: ["error", "double", { avoidEscape: true }],
			// require semicolons
			semi: ["error", "always"],
			// trailing commas on multi-line
			"comma-dangle": ["error", "always-multiline"],
			// spaces inside { }
			"object-curly-spacing": ["error", "always"],
			// no spaces inside [ ]
			"array-bracket-spacing": ["error", "never"],
			// braces for all control flow
			curly: ["error", "all"],
			// ≤ 1 blank line
			"no-multiple-empty-lines": ["error", { max: 1 }],
			// spaces around operators
			"space-infix-ops": "error",
			// one true brace style
			"brace-style": ["error", "1tbs"],
			// spacing around keywords: `if (x) {`
			"keyword-spacing": ["error", { before: true, after: true }],
			// soft wrap guide at 120 chars (ignore URLs)
			"max-len": ["warn", { code: 120, ignoreUrls: true }],
		},
	},
]);
