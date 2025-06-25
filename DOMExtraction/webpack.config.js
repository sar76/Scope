const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const webpack = require("webpack");
const dotenv = require("dotenv");

// Load environment variables from .env file
const env = dotenv.config({ path: "./.env" }).parsed || {};
const envKeys = Object.keys(env).reduce((prev, next) => {
  prev[`process.env.${next}`] = JSON.stringify(env[next]);
  return prev;
}, {});

module.exports = (envArg, argv) => {
  const isProduction = argv.mode === "production";

  return {
    entry: {
      background: "./src/background/index.js",
      content: "./src/content/index.js",
      popup: "./src/popup/index.js",
    },
    output: {
      path: path.resolve(__dirname, "build"),
      filename: "[name].bundle.js",
      clean: true,
    },
    mode: isProduction ? "production" : "development",
    devtool: isProduction ? "source-map" : "eval-source-map",
    optimization: {
      minimize: isProduction,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: isProduction,
            },
            mangle: true,
          },
          extractComments: false,
        }),
      ],
      splitChunks: {
        chunks: "all",
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: "vendors",
            chunks: "all",
            priority: 10,
          },
          shared: {
            name: "shared",
            chunks: "all",
            minChunks: 2,
            enforce: true,
            priority: 5,
            test: /[\\/]src[\\/]shared[\\/]/,
          },
        },
      },
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
            options: {
              presets: [
                [
                  "@babel/preset-env",
                  {
                    targets: {
                      chrome: "88",
                    },
                  },
                ],
              ],
            },
          },
        },
        {
          test: /\.css$/,
          use: ["style-loader", "css-loader"],
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: "./src/popup/popup.html",
        filename: "popup.html",
        chunks: ["popup", "shared", "vendors"],
        inject: "body",
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: "manifest.json",
            to: "manifest.json",
            transform: (content) => {
              const manifest = JSON.parse(content.toString());
              // Update manifest to point to bundled files
              manifest.background.service_worker = "background.bundle.js";
              manifest.content_scripts[0].js = ["content.bundle.js"];
              manifest.action.default_popup = "popup.html";
              return JSON.stringify(manifest, null, 2);
            },
          },
          {
            from: "scraper_imresizer.png",
            to: "scraper_imresizer.png",
          },
        ],
      }),
      new webpack.DefinePlugin(envKeys),
    ],
    resolve: {
      extensions: [".js", ".json"],
      alias: {
        "@shared": path.resolve(__dirname, "src/shared"),
        "@content": path.resolve(__dirname, "src/content"),
        "@popup": path.resolve(__dirname, "src/popup"),
        "@background": path.resolve(__dirname, "src/background"),
      },
    },
    performance: {
      hints: isProduction ? "warning" : false,
      maxEntrypointSize: 512000,
      maxAssetSize: 512000,
    },
  };
};
