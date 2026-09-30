import tseslint from 'typescript-eslint';
export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/.next/**', '**/.expo/**', '**/dist/**', '**/next-env.d.ts', '**/expo-env.d.ts', '**/.venv/**'] },
  ...tseslint.configs.recommended,
);
