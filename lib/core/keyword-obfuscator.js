const fs = require('fs-extra');
const path = require('path');
const RandomUtils = require('../utils/random-utils');

class KeywordObfuscator {
    constructor() {
        this.keywords = [];
        this.keywordsLoaded = false;
        this.debug = false; // 调试模式
    }

    // 加载关键词列表
    async loadKeywords() {
        if (this.keywordsLoaded) {
            return;
        }

        try {
            const keywordFilePath = path.join(__dirname, '../../key.txt');
            if (await fs.pathExists(keywordFilePath)) {
                const content = await fs.readFile(keywordFilePath, 'utf8');
                this.keywords = content.split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 0);
                this.keywordsLoaded = true;
                console.log(`📝 加载了 ${this.keywords.length} 个关键词`);
            }
        } catch (error) {
            console.warn('⚠️ 关键词文件加载失败:', error.message);
            this.keywordsLoaded = true; // 防止重复尝试
        }
    }

    // 混淆HTML内容中的关键词
    obfuscateKeywords(htmlContent) {
        if (this.keywords.length === 0) {
            return htmlContent;
        }

        let result = htmlContent;
        let obfuscatedCount = 0;

        // 按长度降序排序，优先处理长关键词避免子串问题
        const sortedKeywords = [...this.keywords].sort((a, b) => b.length - a.length);

        // 记录已处理的位置，避免重复处理
        const processedRanges = [];

        for (const keyword of sortedKeywords) {
            // 处理所有关键词，不跳过短关键词
            if (keyword.length === 0) continue; // 只跳过空字符串

            // 使用全局匹配查找所有位置
            const regex = new RegExp(this.escapeRegExp(keyword), 'gi');
            let match;
            const matches = [];
            
            // 收集所有匹配
            while ((match = regex.exec(result)) !== null) {
                matches.push({
                    match: match[0],
                    offset: match.index,
                    length: match[0].length
                });
                
                // 防止无限循环
                if (regex.lastIndex === match.index) {
                    regex.lastIndex++;
                }
            }

            // 从后往前处理（避免索引变化）
            for (let i = matches.length - 1; i >= 0; i--) {
                const matchInfo = matches[i];
                const { match: matchText, offset, length } = matchInfo;
                
                // 检查是否与已处理的范围重叠
                const overlaps = processedRanges.some(range => 
                    (offset >= range.start && offset < range.end) ||
                    (offset + length > range.start && offset + length <= range.end) ||
                    (offset < range.start && offset + length > range.end)
                );
                
                if (overlaps) {
                    continue; // 跳过重叠的匹配
                }
                
                // 检查匹配位置是否在HTML标签内
                if (this.isInsideHtmlTag(result, offset, length)) {
                    continue; // 在标签内，不进行混淆
                }
                
                // 进行混淆
                const obfuscatedText = this.obfuscateKeyword(matchText);
                const beforeChange = result;
                result = result.slice(0, offset) + obfuscatedText + result.slice(offset + length);
                
                // 调试信息
                if (this.debug) {
                    console.log(`  混淆关键词: "${matchText}" → "${obfuscatedText}" (位置: ${offset})`);
                    console.log(`  变化前: "${beforeChange}"`);
                    console.log(`  变化后: "${result}"`);
                }
                
                // 记录已处理的范围
                processedRanges.push({
                    start: offset,
                    end: offset + obfuscatedText.length
                });
                
                obfuscatedCount++;
            }
        }

        if (obfuscatedCount > 0) {
            console.log(`🔤 混淆了 ${obfuscatedCount} 个关键词`);
        }

        return result;
    }

    // 检查位置是否在HTML标签内
    isInsideHtmlTag(content, offset, length) {
        // 向前查找最近的 < 和 >
        let openTag = content.lastIndexOf('<', offset);
        let closeTag = content.lastIndexOf('>', offset);
        
        // 如果在标签内（最近的<在最近的>之后）
        if (openTag > closeTag && openTag !== -1) {
            // 继续查找标签结束
            let tagEnd = content.indexOf('>', offset + length);
            if (tagEnd !== -1) {
                // 进一步检查是否在标签属性中
                const tagContent = content.substring(openTag, tagEnd + 1);
                
                // 检查是否在引号内的属性值中
                const beforeMatch = content.substring(openTag, offset);
                const quotesBefore = (beforeMatch.match(/"/g) || []).length;
                const singleQuotesBefore = (beforeMatch.match(/'/g) || []).length;
                
                // 如果引号数量是奇数，说明在属性值内
                if (quotesBefore % 2 === 1 || singleQuotesBefore % 2 === 1) {
                    return true;
                }
                
                // 检查是否在脚本或样式标签内
                const scriptMatch = /<(script|style)[^>]*>/i.exec(tagContent);
                if (scriptMatch) {
                    return false; // 脚本和样式标签内的内容不算标签内
                }
                
                return true; // 在其他标签内
            }
        }
        
        return false;
    }

    // 对单个关键词进行混淆
    obfuscateKeyword(keyword) {
        const method = RandomUtils.randomObfuscationMethod();
        
        switch (method) {
            case 'span':
                return this.obfuscateWithSpan(keyword);
            case 'invisible':
                return this.obfuscateWithInvisibleChars(keyword);
            case 'mixed':
                return this.obfuscateWithMixed(keyword);
            default:
                return this.obfuscateWithSpan(keyword);
        }
    }

    // 使用span标签混淆
    obfuscateWithSpan(keyword) {
        const chars = [...keyword]; // 支持多字节字符
        const spanCount = RandomUtils.randomInt(1, Math.max(1, chars.length));
        let result = '';
        let hasSpan = false; // 确保至少有一个span

        for (let i = 0; i < chars.length; i++) {
            const char = chars[i];
            
            // 随机决定是否用span包装，或者确保至少有一个span
            const shouldWrap = (i < spanCount && RandomUtils.randomBool(0.7)) || 
                              (!hasSpan && i === chars.length - 1);
            
            if (shouldWrap) {
                const attrs = RandomUtils.randomBool(0.6) ? ` ${RandomUtils.randomAttribute()}` : '';
                result += `<span${attrs}>${char}</span>`;
                hasSpan = true;
            } else {
                result += char;
            }
        }

        return result;
    }

    // 使用不可见字符混淆
    obfuscateWithInvisibleChars(keyword) {
        const chars = [...keyword];
        if (chars.length <= 1) {
            // 对于单字符，直接添加不可见字符
            return chars[0] + RandomUtils.randomInvisibleChar();
        }
        
        const insertCount = RandomUtils.randomInt(1, Math.max(1, chars.length - 1));
        let result = '';
        let hasInvisible = false; // 确保至少有一个不可见字符

        for (let i = 0; i < chars.length; i++) {
            result += chars[i];
            
            // 随机插入不可见字符（不在最后一个字符后）
            const shouldInsert = (i < chars.length - 1 && i < insertCount && RandomUtils.randomBool(0.5)) ||
                                (!hasInvisible && i === chars.length - 2); // 倒数第二个字符确保插入
            
            if (i < chars.length - 1 && shouldInsert) {
                result += RandomUtils.randomInvisibleChar();
                hasInvisible = true;
            }
        }

        return result;
    }

    // 混合模式：span + 不可见字符
    obfuscateWithMixed(keyword) {
        const chars = [...keyword];
        const spanCount = RandomUtils.randomInt(1, Math.max(1, Math.ceil(chars.length / 2)));
        const invisibleCount = RandomUtils.randomInt(1, Math.max(1, Math.ceil(chars.length / 3)));
        let result = '';
        let hasSpan = false;
        let hasInvisible = false;

        for (let i = 0; i < chars.length; i++) {
            const char = chars[i];
            
            // 随机决定是否用span包装，确保至少有一个span
            const shouldSpan = (i < spanCount && RandomUtils.randomBool(0.4)) ||
                              (!hasSpan && i === chars.length - 1);
            
            if (shouldSpan) {
                const attrs = RandomUtils.randomBool(0.5) ? ` ${RandomUtils.randomAttribute()}` : '';
                result += `<span${attrs}>${char}</span>`;
                hasSpan = true;
            } else {
                result += char;
            }
            
            // 随机插入不可见字符，确保至少有一个不可见字符
            const shouldInsert = (i < chars.length - 1 && i < invisibleCount && RandomUtils.randomBool(0.3)) ||
                                (!hasInvisible && i === chars.length - 2 && chars.length > 1);
            
            if (i < chars.length - 1 && shouldInsert) {
                result += RandomUtils.randomInvisibleChar();
                hasInvisible = true;
            }
        }

        // 如果两种方式都没有应用，强制应用一种
        if (!hasSpan && !hasInvisible && chars.length > 0) {
            if (RandomUtils.randomBool()) {
                // 应用span到第一个字符
                const firstChar = chars[0];
                const attrs = RandomUtils.randomBool(0.5) ? ` ${RandomUtils.randomAttribute()}` : '';
                result = `<span${attrs}>${firstChar}</span>` + result.slice(1);
            } else {
                // 插入不可见字符
                const pos = RandomUtils.randomInt(0, Math.max(0, chars.length - 1));
                result = result.slice(0, pos) + RandomUtils.randomInvisibleChar() + result.slice(pos);
            }
        }

        return result;
    }

    // 特殊处理：为整个关键词添加干扰元素
    addNoiseElements(keyword) {
        const noiseElements = [
            `<span style="display:none">${RandomUtils.randomIdentifier()}</span>`,
            `<span style="font-size:0">${RandomUtils.randomIdentifier()}</span>`,
            `<span style="position:absolute;left:-9999px">${RandomUtils.randomIdentifier()}</span>`,
            `<!-- ${RandomUtils.randomIdentifier()} -->`,
        ];

        const noise = noiseElements[Math.floor(Math.random() * noiseElements.length)];
        const position = RandomUtils.randomInt(0, keyword.length);
        
        return keyword.slice(0, position) + noise + keyword.slice(position);
    }

    // 转义正则表达式特殊字符
    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}

module.exports = KeywordObfuscator; 