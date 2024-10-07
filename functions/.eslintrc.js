module.exports = {
  env: {
    es6: true,
    node: true,
  },
  parserOptions: {
    'ecmaVersion': 2018,
  },
  extends: [
    'eslint:recommended',
    'google',
  ],
  rules: {
    'no-restricted-globals': ['error', 'name', 'length'],
    'prefer-arrow-callback': 'error',
    'quotes': ['error', 'single', {'allowTemplateLiterals': true}],
    'linebreak-style': ['error', 'windows'],
    'max-len': ['error', 120],
    'padded-blocks': 'off',
    'require-jsdoc': 'off',
    'guard-for-in': 'off',
    'no-case-declarations': 'off',
  },
  overrides: [
    {
      files: ['**/*.spec.*'],
      env: {
        mocha: true,
      },
      rules: {

      },
    },
  ],
  globals: {},
};
