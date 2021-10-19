const
    Encore = require('@symfony/webpack-encore'),
    HtmlWebpackPlugin = require('html-webpack-plugin'),
    path = require('path'),
    fs = require('fs'),
    yaml = require('js-yaml'),
    webpack = require('webpack'),
    puppeteer = require('puppeteer')
;

if (!Encore.isRuntimeEnvironmentConfigured()) {
    Encore.configureRuntimeEnvironment(process.env.NODE_ENV || 'dev');
}

Encore
    .setOutputPath(__dirname + '/build/')
    .setPublicPath('./')
    .addEntry('main', './assets/js/main.js')
    .addStyleEntry('icons', './assets/scss/icons.scss')
    .addStyleEntry('primevue', './assets/scss/primevue.scss')
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
        new webpack.DefinePlugin({
            __VUE_PROD_DEVTOOLS__: Encore.isProduction(),
            __VUE_OPTIONS_API__: true,
        })
    )
;

if (Encore.isProduction()) {
    Encore.addPlugin(
        {
            apply: (compiler) => {
                compiler.hooks.afterEmit.tap('AfterEmitPlugin', (compilation) => {
                    console.log('Taking screenshot...');
                    const doScreenshot = async function () {
                        const browser = await puppeteer.launch({
                            args: ['--no-sandbox', '--disable-setuid-sandbox'],
                            executablePath: process.env.PUPPETEER_EXEC_PATH
                        });
                        const page = await browser.newPage();
                        page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
                        await page.setExtraHTTPHeaders({
                            'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8'
                        });
                        await page.goto(`file://${__dirname}/build/index.html`);
                        await page.screenshot({
                            path: `${__dirname}/build/screenshot.png`,
                            fullPage: true
                        });
                        await page.close();
                        await browser.close()
                    };
                    doScreenshot();
                });
            }
        }
    );
}

var config = Encore.getWebpackConfig();
config.resolve.alias.vue = "vue/dist/vue.esm-bundler.js";

module.exports = config;