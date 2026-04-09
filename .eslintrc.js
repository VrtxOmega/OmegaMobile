module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    'no-unused-vars': 'warn',
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    'react-hooks/exhaustive-deps': 'warn'
  }
};
