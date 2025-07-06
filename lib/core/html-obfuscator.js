const fs = require('fs-extra');
const cheerio = require('cheerio');
const crypto = require('crypto');
const shuffle = require('shuffle-array');
const RandomUtils = require('../utils/random-utils');
const CssObfuscator = require('./css-obfuscator');
const JsObfuscator = require('./js-obfuscator');
// const TsObfuscator = require('./ts-obfuscator'); // 添加 TypeScript 支持
// const BufferPolyfill = require('../utils/buffer-polyfill');

class HtmlObfuscator {
    static async collectMappings(filePath, mapping) {
        // const html = await fs.readFile(filePath, 'utf8');
        // const $ = cheerio.load(html);

        // // 收集类和ID
        // $('[class]').each((i, el) => {
        //     const classes = $(el).attr('class').split(/\s+/);
        //     classes.forEach(cls => {
        //         if (!mapping.classes.has(cls)) {
        //             const obf = RandomUtils.randomIdentifier();
        //             mapping.classes.set(cls, obf);
        //             mapping.classSelectors.set(`.${cls}`, `.${obf}`);
        //         }
        //     });
        // });

        // $('[id]').each((i, el) => {
        //     const id = $(el).attr('id');
        //     if (!mapping.ids.has(id)) {
        //         const obf = RandomUtils.randomIdentifier();
        //         mapping.ids.set(id, obf);
        //         mapping.idSelectors.set(`#${id}`, `#${obf}`);
        //     }
        // });
    }

    static async obfuscate(html, mapping, options = {}) {
        const $ = cheerio.load(html, {
            decodeEntities: false // 防止自动解码实体
        });

        const {
            hexEncode = true,
            unicodeEncode = true,
            addWhitespace = true,
            shuffleElements = true,
            removeComments = true,
            compressWhitespace = true
        } = options;

        // // 混淆类和ID
        // $('[class]').each((i, el) => {
        //     const newClasses = $(el).attr('class').split(/\s+/)
        //         .map(cls => mapping.classes.get(cls) || cls)
        //         .join(' ');
        //     $(el).attr('class', newClasses);
        // });

        // $('[id]').each((i, el) => {
        //     const id = $(el).attr('id');
        //     if (mapping.ids.has(id)) {
        //         $(el).attr('id', mapping.ids.get(id));
        //     }
        // });


        const stylePromises = [];

        // 混淆内联样式和脚本
        $('style').each((i, el) => {
            const $el = $(el);
            const originalCSS = $el.text();
            stylePromises.push(
                CssObfuscator.obfuscate(originalCSS, mapping)
                    .then(obfuscatedCSS => {
                        $el.text(obfuscatedCSS);
                    })
                    .catch(error => {
                        console.error('❌ CSS混淆失败:', error);
                        $el.text(originalCSS); // 出错时保留原始CSS
                    })
            );
        });

        // 等待所有混淆操作完成
        await Promise.all(stylePromises);

        $('script').each((i, el) => {
            if (!$(el).attr('src')) {
                // const scriptType = $(el).attr('type') || 'text/javascript';

                // if (scriptType.includes('typescript') || scriptType.includes('ts')) {
                //     $(el).text(TsObfuscator.obfuscate($(el).text(), mapping));
                // } else {
                //     $(el).text(JsObfuscator.obfuscate($(el).text(), mapping));
                // } 
                $(el).text(JsObfuscator.obfuscate($(el).text(), mapping));
            }
        });

        // 移除注释
        if (removeComments) {
            $('*').contents().each(function () {
                if (this.type === 'comment') {
                    $(this).remove();
                }
            });
        }

        // 处理所有文本节点 // 压缩空白
        if (hexEncode || unicodeEncode || addWhitespace) {
            $('body, head').find('*').contents().each(function () {
                // 只处理文本节点，跳过脚本和样式
                if (this.type === 'text' &&
                    this.parentNode &&
                    !['script', 'style', 'code', 'pre'].includes(this.parentNode.tagName)) {
                    const originalText = $(this).text();
                    const obfuscatedText = HtmlObfuscator._obfuscateText(originalText, options);
                    const bkText = obfuscatedText
                        .replace(/\s+/g, ' ')
                        .trim()
                    $(this).replaceWith(bkText);
                }
            });
        }

        // // 打乱元素顺序
        // if (shuffleElements) {
        //     this._shuffleChildElements($('body'), $);
        //     this._shuffleChildElements($('head'), $);
        // }

        // 插入随机死代码
        $('body').append(`<div style="display:none!important" class="${RandomUtils.randomIdentifier()}"></div>`);

        // // 注入 Buffer polyfill（如果需要）
        // const hasScript = $('script').length > 0;
        // if (hasScript) {
        //     $('script').first().before(`<script>${BufferPolyfill.inject()}</script>`);
        // } else {
        //     $('body').append(`<script>${BufferPolyfill.inject()}</script>`);
        // }

        return $.html();
    }

    /**
     * 混淆文本内容
     * @param {string} text - 原始文本
     * @param {Object} options - 混淆选项
     * @returns {string} 混淆后的文本
     */
    static _obfuscateText(text, options) {
        let result = text;

        // 字符编码转换
        if (options.hexEncode || options.unicodeEncode) {
            result = result.split('').map(char => {
                // 保留空白字符
                if (/\s/.test(char)) return char;

                // 随机决定是否编码
                if (Math.random() > 0.7) return char;

                if (options.hexEncode && Math.random() > 0.5) {
                    // 十六进制编码
                    return `&#x${char.charCodeAt(0).toString(16)};`;
                } else if (options.unicodeEncode) {
                    // Unicode编码
                    return `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`;
                }
                return char;
            }).join('');
        }

        // 添加随机空白
        if (options.addWhitespace) {
            const whitespaceChars = [' ', '\t', '\n', '\r'];
            result = result.split('').map(char => {
                if (Math.random() > 0.9) {
                    // 随机插入空白字符
                    const ws = whitespaceChars[crypto.randomInt(0, whitespaceChars.length)];
                    return char + ws.repeat(crypto.randomInt(1, 3));
                }
                return char;
            }).join('');
        }

        return result;
    }

    /**
     * 打乱子元素顺序
     * @param {Cheerio} $parent - Cheerio父元素选择器
     * @param {Cheerio} $ - Cheerio实例
     */
    static _shuffleChildElements($parent, $) {
        // 只处理元素节点
        if (!$parent || !$parent.length) return;

        // 收集直接子元素节点
        const children = $parent.children().toArray();

        // 过滤掉不应被打乱的元素
        const childElements = children.filter(child =>
            child.type === 'tag' &&
            !['script', 'style', 'noscript', 'link', 'meta'].includes(child.tagName)
        );

        // 打乱顺序
        if (childElements.length > 1) {
            shuffle(childElements);

            // 清空父元素
            $parent.empty();

            // 重新附加子元素
            childElements.forEach(child => {
                $parent.append(child);
            });
        }

        // 递归处理子节点
        $parent.children().each((i, el) => {
            this._shuffleChildElements($(el), $);
        });
    }

    static _addDeadCode() {
        return '';
    }
}

module.exports = HtmlObfuscator;