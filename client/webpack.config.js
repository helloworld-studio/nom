const webpack = require('webpack');

module.exports = {
    // ... existing config ...
    resolve: {
        fallback: {
            "fs": false,
            "os": require.resolve("os-browserify/browser"),
            "path": require.resolve("path-browserify")
        }
    },
    plugins: [
        new webpack.ProvidePlugin({
            process: 'process/browser',
            Buffer: ['buffer', 'Buffer']
        })
    ]
};