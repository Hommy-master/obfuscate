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
}

module.exports = RandomUtils;