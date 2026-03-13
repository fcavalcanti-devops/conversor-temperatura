const path = require('path');

module.exports = {
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.js'],
    root: path.resolve(__dirname),
  },
};
