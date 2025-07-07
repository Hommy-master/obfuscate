#!/usr/bin/env node
const fs = require('fs-extra');
const path = require('path');
const ObfuscationEngine = require('../lib/obfuscation-engine');
const { MAX_OBS_COUNT } = require('../lib/utils/const');

const args = process.argv.slice(2);
if (!args.length) {
    console.error('Usage: obfuscate <target-directory>');
    process.exit(1);
}

// 解析为绝对路径
const targetDir = path.resolve(args[0]);
// 初始化输出目录和输出数量
let outputDir = '.';
let outCount = 1;
for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    const argNext = args[i + 1];
    if (arg === '-o' && argNext) {
        // 创建输出目录（如果不存在）
        if (!fs.existsSync(argNext)) {
            fs.mkdirSync(argNext, { recursive: true });
        }
        outputDir = path.resolve(argNext);
        i++;
    } else if (arg === '-n' && argNext) {
        outCount = +argNext;
        if (isNaN(outCount) || outCount < 1) {
            // console.error('错误: -n 参数必须是大于0的整数');
            // process.exit(1);
            outCount = 1; // 如果无效，默认为1
        }
        i++;
    }
}

const engine = new ObfuscationEngine(targetDir, outputDir, Math.min(outCount, MAX_OBS_COUNT));

engine.run().catch(err => {
    console.error('Obfuscation failed:', err);
    process.exit(1);
});