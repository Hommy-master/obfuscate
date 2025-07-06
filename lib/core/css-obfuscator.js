const fs = require('fs-extra');
const postcss = require('postcss');
const valueParser = require('postcss-value-parser');
const cssnano = require('cssnano');
const RandomUtils = require('../utils/random-utils');

class CssObfuscator {
    static async collectMappings(filePath, mapping) {
    }

    static async obfuscate(css, mapping) {
        try {
            const result = await this._processCss(css, mapping);
            return result;
        } catch (error) {
            console.error("CSS处理失败:", error);
            // 失败时返回原始CSS作为回退
            return css;
        }
    }

    static async _processCss(css, mapping) {
        const plugins = [];

        // 添加压缩插件
        plugins.push(cssnano({
            preset: ['default', {
                discardComments: { removeAll: true },
                normalizeWhitespace: true,
                colormin: true,
                minifySelectors: true,
                minifyParams: true,
                mergeIdents: false,
                reduceIdents: false,
                discardUnused: false
            }]
        }));

        plugins.push(this._addDeadCode());
        try {
            // 处理 CSS
            const processor = postcss(plugins);
            const result = await processor.process(css, {
                from: undefined,
                map: false
            });

            return result.css;
        } catch (error) {
            console.error("PostCSS处理错误:", error);
            throw error;
        }
    }

    static _addDeadCode() {
        return {
            postcssPlugin: 'css-dead-code',
            OnceExit(root) {
                const deadSelector = `.${Date.now().toString(36)}_${RandomUtils.randomIdentifier()}`;
                root.append(`${deadSelector}{position:absolute;top:-9999px;left:-9999px;opacity:0;pointer-events:none;}`);
            }
        };
    }
}

CssObfuscator._addDeadCode.postcss = true;

module.exports = CssObfuscator;