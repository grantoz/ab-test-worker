const path = require('path')

module.exports = {
  entry: {
    bundle: path.join(__dirname, './src/index.js'),
  },

  output: {
    filename: 'bundle.js',
    path: path.join(__dirname, 'dist'),
  },

  mode: process.env.NODE_ENV || 'development',

  devtool: false,

  watchOptions: {
    ignored: /node_modules|dist/g,
  },

  resolve: {
    extensions: ['.js', '.json'],
    plugins: [],
  },
}
