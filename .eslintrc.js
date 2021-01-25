module.exports = {
  root: true,
  env: {
    node: true
  },
  'extends': [
    'plugin:vue/vue3-essential',
    'eslint:recommended'
  ],
  parserOptions: {
    parser: 'babel-eslint'
  },
  rules: {
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off'
    'vue/no-unused-components': 'off',
    'no-unused-vars': 'off',
    'no-useless-escape': 'off',
    'no-empty': 'off',
    'no-unreachable': 'off',
    'no-constant-condition': 'off',
    'vue/no-unused-vars': 'off',
  }
}
