const fs = require('fs-extra');
const cheerio = require('cheerio');
const crypto = require('crypto');
const shuffle = require('shuffle-array');
const RandomUtils = require('../utils/random-utils');
const CssObfuscator = require('./css-obfuscator');
const JsObfuscator = require('./js-obfuscator');
// const TsObfuscator = require('./ts-obfuscator'); // 添加 TypeScript 支持
const KeywordObfuscator = require('./keyword-obfuscator'); // 添加关键词混淆器
// const BufferPolyfill = require('../utils/buffer-polyfill');

class HtmlObfuscator {
    static keywordObfuscator = null;

    // 初始化关键词混淆器
    static async initKeywordObfuscator() {
        if (!this.keywordObfuscator) {
            this.keywordObfuscator = new KeywordObfuscator();
            await this.keywordObfuscator.loadKeywords();
        }
    }

    static async collectMappings(filePath, mapping) {
        // 保持原有的注释状态 - 不收集类名和ID映射
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

        // 保持原有的注释逻辑 - 不处理类名和ID映射
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
                        console.error('CSS混淆失败:', error);
                        $el.text(originalCSS); // 出错时保留原始CSS
                    })
            );
        });

        // 等待所有混淆操作完成
        await Promise.all(stylePromises);

        $('script').each((i, el) => {
            if (!$(el).attr('src')) {
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

        // 获取HTML字符串
        let htmlResult = $.html();

        // 初始化并应用关键词混淆
        try {
            await this.initKeywordObfuscator();
            if (this.keywordObfuscator && this.keywordObfuscator.keywords.length > 0) {
                console.log('🔤 开始关键词混淆处理...');
                htmlResult = this.keywordObfuscator.obfuscateKeywords(htmlResult);
            }
        } catch (error) {
            console.warn('⚠️ 关键词混淆失败:', error.message);
        }

        return htmlResult;
    }


}

module.exports = HtmlObfuscator;