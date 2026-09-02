export default {
  '*.{js,mjs,ts,tsx}': ['eslint --fix', 'prettier --write'],
  '*.{json,md,yaml,yml,css}': 'prettier --write',
}
