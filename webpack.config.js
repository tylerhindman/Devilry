const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: {
    'devilry': './client/js/devilry.js'  },
  output: {
      filename: '[name].bundle.js',
      path: path.resolve(__dirname,'client/dist/'),
      clean: true
  },
  module: {
    rules: [
      {
        test: /\.html$/i,
        use: 'html-loader'
      },
      {
          test: /\.(png|jpg)$/i,
          type: 'asset/resource',
          generator: {
              filename: 'images/[name]-[hash][ext]'
          }
      }
    ]
  },
  plugins: [
      new HtmlWebpackPlugin({
          template: './client/index.html',
          filename: 'index.html',
          //inject: false
      })
  ],
};