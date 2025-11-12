const base = require('../../packages/config/tailwind.base.cjs');
module.exports = {
  ...base,
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}'
  ]
};


