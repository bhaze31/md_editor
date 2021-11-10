const path = require('path');

module.exports = {
  entry: './main.js',
  output: {
    filename: 'script.js',
    path: path.resolve(__dirname, 'public')
  }
}
