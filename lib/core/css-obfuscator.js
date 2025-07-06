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

        // plugins.push(this._addDeadCode());

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
        try {
            // 处理 CSS
            const processor = postcss(plugins);
            const result = await processor.process(newCss);

            return result.css;
        } catch (error) {
            console.error("PostCSS处理错误:", error);
            throw error; // 抛出错误给上层
        }
    }

    // static _createPlugin(mapping, isCollection) {
    //     return {
    //         postcssPlugin: 'css-obfuscator',
    //         Rule(rule) {
    //             rule.selector = rule.selector.split(/\s*,\s*/).map(selector => {
    //                 return selector.replace(/([.#])([\w-]+)/g, (match, prefix, name) => {
    //                     if (isCollection) {
    //                         const mapKey = prefix === '.' ? 'classes' : 'ids';
    //                         if (!mapping[mapKey].has(name)) {
    //                             const obf = RandomUtils.randomIdentifier();
    //                             mapping[mapKey].set(name, obf);

    //                             // 存储带符号的选择器
    //                             const selector = prefix + name;
    //                             const selectorMap = prefix === '.' ? 'classSelectors' : 'idSelectors';
    //                             mapping[selectorMap].set(selector, prefix + obf);
    //                         }
    //                         return match; // 收集时不修改
    //                     }

    //                     const newName = mapping[prefix === '.' ? 'classes' : 'ids'].get(name);
    //                     return newName ? `${prefix}${newName}` : match;
    //                 });
    //             }).join(', ');
    //         }
    //     };
    // }

    // 类名混淆插件（可选）
    static _classObfuscationPlugin(mapping) {
        return {
            postcssPlugin: 'class-obfuscator',
            Rule(rule) {
                // 处理选择器
                const transformed = rule.selector.split(/\s*,\s*/).map(selector => {
                    return selector.replace(/([.#])([\w-]+)/g, (match, prefix, name) => {
                        if (prefix === '.' && mapping?.classes?.has(name)) {
                            return `.${mapping.classes.get(name)}`;
                        }
                        return match;
                    });
                }).join(', ');

                rule.selector = transformed;
            }
        };
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

// CssObfuscator._createPlugin.postcss = true;
CssObfuscator._addDeadCode.postcss = true;

module.exports = CssObfuscator;