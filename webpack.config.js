
const path = require('path');

module.exports = {
    entry: './src/index.ts',
    devtool: 'inline-source-map',
    devServer: {
        contentBase: path.join(__dirname, 'public')
    },
    module: {
      rules: [
        {
            enforce: 'pre',
            test: /\.tsx?$/,
            loader: 'eslint-loader',
            exclude: /node_modules/,
            options: {
                fix: true,
                formatter: require('eslint-friendly-formatter'),
                configFile: path.resolve(__dirname, '.eslintrc')
            }
        },
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
      ],
    },
    resolve: {
      extensions: [ '.ts', '.js' ],
    },
    output: {
      filename: 'bundle.js',
      path: path.resolve(__dirname, 'dist'),
    },
  };