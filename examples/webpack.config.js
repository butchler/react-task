var path = require('path');

module.exports = {
  entry: {
    proc: path.join(__dirname, 'proc', 'index.js'),
    counters: path.join(__dirname, 'counters', 'index.js'),
    'redux-counters': path.join(__dirname, 'redux-counters', 'index.js'),
  },
  output: {
    path: __dirname,
    filename: '[name]/bundle.js',
  },
  resolve: {
    root: path.join(__dirname, '..'),
  },
  module: {
    loaders: [
      { test: /\.js$/, exclude: /node_modules/, loader: 'babel-loader' },
    ]
  },
};
