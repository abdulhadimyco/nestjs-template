const config = {
  "*.ts": [
    "eslint --fix --max-warnings 0 --no-warn-ignored",
    "prettier --write",
  ],
  "*.{js,mjs,cjs,json,md,yml,yaml}": "prettier --write",
  "**/*.ts": () => "tsc --noEmit -p tsconfig.json",
};

export default config;
