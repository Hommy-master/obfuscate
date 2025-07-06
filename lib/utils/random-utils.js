class RandomUtils {
    static randomIdentifier() {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const length = Math.floor(Math.random() * 5) + 4; // 4-8字符
        let result = '';

        // 确保首字符不是数字
        result += chars[Math.floor(Math.random() * chars.length)];

        for (let i = 1; i < length; i++) {
            const pool = chars + '0123456789';
            result += pool[Math.floor(Math.random() * pool.length)];
        }

        return result;
    }

    static randomBool(probability = 0.5) {
        return Math.random() < probability;
    }

    static randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // 生成随机的混淆标记
    static randomObfuscationMarker() {
        const prefixes = [
            'PROCESSED', 'COMPILED', 'OPTIMIZED', 'ENHANCED', 'TRANSFORMED',
            'MINIFIED', 'BUNDLED', 'COMPRESSED', 'ENCODED', 'SECURED',
            'GENERATED', 'BUILT', 'PACKED', 'MODIFIED', 'CONVERTED',
            'PREPARED', 'RENDERED', 'FORMATTED', 'PROTECTED', 'UPDATED'
        ];
        
        const suffixes = [
            'CODE', 'SCRIPT', 'DATA', 'CONTENT', 'FILE', 'RESOURCE',
            'ASSET', 'MODULE', 'COMPONENT', 'ELEMENT', 'BLOCK', 'SECTION',
            'PART', 'SEGMENT', 'PIECE', 'FRAGMENT', 'CHUNK', 'UNIT'
        ];
        
        const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
        const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
        const randomNum = this.randomInt(1000, 9999);
        const timestamp = Date.now().toString(36);
        
        return `${prefix}_${suffix}_${randomNum}_${timestamp}`;
    }

    // 生成随机的HTML注释标记
    static randomHtmlComment() {
        const marker = this.randomObfuscationMarker();
        return `<!-- ${marker} -->`;
    }

    // 生成随机的CSS/JS注释标记
    static randomCodeComment() {
        const marker = this.randomObfuscationMarker();
        return `/* ${marker} */`;
    }

    // 生成随机CSS类名
    static randomClassName() {
        const prefixes = ['fx', 'ui', 'app', 'css', 'cls', 'key', 'txt', 'data', 'elem', 'item'];
        const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
        const suffix = this.randomIdentifier();
        return `${prefix}-${suffix}`;
    }

    // 生成随机HTML属性
    static randomAttribute() {
        const attrs = [
            'data-key',
            'data-id', 
            'data-value',
            'data-item',
            'data-elem',
            'class',
            'id',
            'style'
        ];
        
        const attr = attrs[Math.floor(Math.random() * attrs.length)];
        const value = this.randomIdentifier();
        
        if (attr === 'style') {
            const styles = [
                'display:inline',
                'visibility:hidden;position:absolute',
                'font-size:0',
                'line-height:0',
                'opacity:0.01'
            ];
            return `${attr}="${styles[Math.floor(Math.random() * styles.length)]}"`;
        }
        
        return `${attr}="${value}"`;
    }

    // 生成不可见字符
    static randomInvisibleChar() {
        const invisibleChars = [
            '&#8203;',  // 零宽空格
            '&#8204;',  // 零宽非连字符
            '&#8205;',  // 零宽连字符
            '&#8288;',  // 单词连接符
            '&#65279;', // 零宽不间断空格
            '&nbsp;',   // 非间断空格（有时不可见）
        ];
        
        return invisibleChars[Math.floor(Math.random() * invisibleChars.length)];
    }

    // 随机选择混淆方式
    static randomObfuscationMethod() {
        const methods = ['span', 'invisible', 'mixed'];
        return methods[Math.floor(Math.random() * methods.length)];
    }
}

module.exports = RandomUtils;