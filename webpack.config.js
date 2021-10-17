const
    Encore = require('@symfony/webpack-encore'),
    WebpackElectroshotPlugin = require('webpack-electroshot-plugin'),
    HtmlWebpackPlugin = require('html-webpack-plugin'),
    path = require('path'),
    fs = require('fs'),
    yaml = require('js-yaml'),
    webpack = require('webpack')
;

if (!Encore.isRuntimeEnvironmentConfigured()) {
    Encore.configureRuntimeEnvironment(process.env.NODE_ENV || 'dev');
}

Encore
    .setOutputPath( __dirname + '/build/')
    .setPublicPath('/')
    .addEntry('main', './assets/js/main.js')
    .cleanupOutputBeforeBuild()
    .enableBuildNotifications()
    .enableSingleRuntimeChunk()
    .enableSourceMaps(!Encore.isProduction())
    .enableVersioning(Encore.isProduction())
    .enableSassLoader(
        options => {
            options.implementation = require('sass')
        }
    )
    .enableVueLoader(() => {}, {runtimeCompilerBuild: false})
    .addRule({
            test: /\.ya?ml$/,
            type: 'json',
            use: 'yaml-loader'
    })
    .addRule({
            test: /\.hbs$/,
            loader: "handlebars-loader",

    })
    .addPlugin(
        new HtmlWebpackPlugin({
            title: 'MekDrop.Name',
            filename: 'index.html',
            inject: false,
            template: path.resolve() + '/templates/index.hbs',
            minify: Encore.isProduction(),
            hash: true,
            xhtml: false,
            templateParameters: {
                base_domain: fs.readFileSync(path.resolve() + '/CNAME').toString().trim(),
                site_screenshot: 'screenshot.png',
                links: yaml.load(
                    fs.readFileSync(path.resolve() + '/data/links.yml')
                ),
                config: yaml.load(
                    fs.readFileSync(path.resolve() + '/data/config.yml')
                )
            },
        })
    )
    .addPlugin(
        new WebpackElectroshotPlugin({
            filename: `screenshot.png`,
            format: 'png',
            url: 'index.html',
            delay: 1000,
            resolution: 1280,
        })
    )
    .addPlugin(
        new webpack.DefinePlugin({
            __VUE_PROD_DEVTOOLS__: Encore.isProduction(),
            __VUE_OPTIONS_API__: true,
        })
    )
;

var config = Encore.getWebpackConfig();
config.resolve.alias.vue = "vue/dist/vue.esm-bundler.js";

module.exports = config;