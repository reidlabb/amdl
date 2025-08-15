import typescriptEslint from "typescript-eslint";
import stylistic from "@stylistic/eslint-plugin";

export default [
    ...typescriptEslint.configs.strict,
    ...typescriptEslint.configs.stylistic,
    {
        plugins: {
            "@typescript-eslint": typescriptEslint.plugin,
            "@stylistic": stylistic
        }
    },
    {
        ignores: [
            "**/dist/**",
            "**/result/**",
            "**/node_modules/**"
        ]
    },
    {
        rules: {
            "@stylistic/indent": ["error", 4],
            "@stylistic/quotes": ["error", "double"],
            "@stylistic/semi": ["error", "always"],
            "@stylistic/comma-dangle": ["error", "never"],

            // TODO: make imports forced to be dynamic

            "@stylistic/member-delimiter-style": [
                "error",
                {
                    multilineDetection: "brackets",
                    multiline: {
                        delimiter: "semi",
                        requireLast: true
                    },
                    singleline: {
                        delimiter: "comma",
                        requireLast: false
                    }
                }
            ],

            "@typescript-eslint/explicit-function-return-type": "error",
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    varsIgnorePattern: "^_",
                    argsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_",
                    caughtErrors: "all",
                    destructuredArrayIgnorePattern: "^_"
                }
            ]
        }
    }
];
