const webpack = require('webpack');

module.exports = function override(config) {
  config.resolve.fallback = {
    ...config.resolve.fallback,
    assert: require.resolve('assert'),
    buffer: require.resolve('buffer'),
    crypto: require.resolve('crypto-browserify'),
    http: require.resolve('stream-http'),
    https: require.resolve('https-browserify'),
    stream: require.resolve('stream-browserify'),
    url: require.resolve('url/'),
    zlib: require.resolve('browserify-zlib'),
    vm: require.resolve('vm-browserify'),
  };

  config.plugins = [
    ...config.plugins,
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'], 
    }),
  ];

  config.module.rules = [
    ...config.module.rules,
    {
      test: /\.m?[jt]sx?$/,
      enforce: 'pre',
      use: ['source-map-loader'],
    },
    {
      test: /\.m?[jt]sx?$/,
      resolve: {
        fullySpecified: false,
      },
    },
  ];

  config.ignoreWarnings = [/Failed to parse source map/];

  return config;
};