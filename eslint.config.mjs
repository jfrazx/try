// @ts-check
import { defineConfig, globalIgnores } from 'eslint/config';
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier/flat';

export default defineConfig([
  globalIgnores(['dist/**', 'build/**', 'coverage/**', 'docs/api/**']),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: { sourceType: 'module' },
    },
    rules: {
      // The decorators are generic over user-supplied shapes. `any` is
      // load-bearing in their signatures rather than a gap in the typing.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-use-before-define': 'off',
      '@typescript-eslint/no-empty-function': 'off',

      // `T extends Function` is how this library says "a class constructor":
      // it constrains TryClassWrapper, keys the static manager and decorator
      // maps, and matches the signature of the `construct` proxy trap's
      // `newTarget`. Narrowing it would change the exported generic bounds,
      // which is a public type-API change, not a lint fix.
      '@typescript-eslint/no-unsafe-function-type': 'off',

      // Class/interface declaration merging is the library's extension idiom.
      // `OptionsContainer` gets its typed properties this way because the
      // values are installed via Object.defineProperty, and consumers use the
      // same pattern to pick up `.try` -- see `Gambler` in test/lib/gambler.ts.
      '@typescript-eslint/no-unsafe-declaration-merging': 'off',

      // An underscore prefix is this codebase's existing marker for a
      // deliberately unused binding.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // The library's extension pattern relies on empty interfaces.
      '@typescript-eslint/no-empty-object-type': 'off',

      'lines-between-class-members': [
        'error',
        'always',
        { exceptAfterSingleLine: true },
      ],
    },
  },
  {
    files: ['test/**/*.ts'],
    languageOptions: { globals: { ...globals.jest } },
    rules: {
      // The specs use @ts-ignore and @ts-expect-error deliberately, to assert
      // that the decorators reject invalid targets at compile time.
      '@typescript-eslint/ban-ts-comment': 'off',
    },
  },
  prettier,
]);
