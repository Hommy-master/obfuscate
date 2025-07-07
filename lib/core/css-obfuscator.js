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
        // 这个处理一定要有，针对已编译的不正常内容处理
        // 没有的话可能会出现样式不正常问题
        const newCss = css.replace(/[\r\n]+/g, ' ');

        // 添加压缩插件
        plugins.push(cssnano({
            preset: ['default', {
                // 禁用所有可能改变类名/变量名的优化
                discardUnused: false,
                reduceIdents: false,
                mergeIdents: false,
                normalizeCharset: false,
                // 保留自定义属性（CSS变量）
                normalizeUrl: false,
                // 其他安全设置
                minifyFontValues: { removeQuotes: false },
                minifyParams: false,
                minifySelectors: false,

                // 保留关键结构
                cssDeclarationSorter: false,
                discardOverridden: false,
                discardDuplicates: false
            }]
        }));

        plugins.push(this._addDeadCode());

        try {
            // 处理 CSS
            const processor = postcss(plugins);
            const result = await processor.process(newCss, {
                from: undefined // 显式声明无需文件关联
            });

            return result.css;
        } catch (error) {
            console.error("PostCSS处理错误:", error);
            throw error; // 抛出错误给上层
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