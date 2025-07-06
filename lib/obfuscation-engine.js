const path = require('path');
const fs = require('fs-extra');
const HtmlObfuscator = require('./core/html-obfuscator');
const CssObfuscator = require('./core/css-obfuscator');
const JsObfuscator = require('./core/js-obfuscator');
// const TsObfuscator = require('./core/ts-obfuscator'); // 添加 TypeScript 混淆器
const BackupManager = require('./utils/backup-manager');
const { walkDir } = require('./utils/file-utils');
const { MAX_SAFE_STRING_LENGTH, WARNING_SIZE } = require('./utils/const');

class ObfuscationEngine {
    constructor(targetDir) {
        this.targetDir = targetDir;
        this.mapping = {
            globals: new Map(),      // 存储全局变量映射
            // classes: new Map(),      // 存储类名映射
            // ids: new Map(),          // 存储 ID 映射
            // classSelectors: new Map(),  // 存储带点号的选择器映射
            // idSelectors: new Map(),      // 存储带井号的选择器映射
            // complexSelectors: new Map() // 复合选择器映射
        };
    }

    async run() {
        // 进行源码备份和copy
        const backupManager = new BackupManager(this.targetDir);
        const { isFirstRun } = await backupManager.prepare();
        this.workDir = backupManager.workDir; // 获取新的工作目录路径

        // try {

        // 1. 收集全局映射关系
        // await this.collectMappings();

        // 2. 执行混淆
        await this.processFiles();

        // 3. 应用结果
        await backupManager.applyResults();
        // } catch (error) {
        //     // console.error('❌Error 处理失败:', error.message);
        //     // 清理工作目录
        //     await fs.remove(this.workDir);
        // }

        console.log(`Obfuscation complete! ${isFirstRun ? 'Initial' : 'Subsequent'} run`);
    }

    async collectMappings() {
        // 扫描所有文件建立映射关系
        const files = await walkDir(this.workDir);

        for (const file of files) {
            const ext = path.extname(file);

            // if (ext === '.html') {
            //     await HtmlObfuscator.collectMappings(file, this.mapping);
            // } else if (ext === '.css') {
            //     await CssObfuscator.collectMappings(file, this.mapping);
            // } else if (ext === '.js') {
            //     await JsObfuscator.collectMappings(file, this.mapping);
            // }
            if (['.js', '.ts', '.tsx'].includes(ext)) {
                // 对于 JS 和 TS 文件都收集全局映射
                await JsObfuscator.collectMappings(file, this.mapping);
            }
        }
    }

    async processFiles() {
        const files = await walkDir(this.workDir);

        for (const file of files) {
            const ext = path.extname(file);
            const stats = await fs.stat(file);

            if (!['.html', '.css', '.js'].includes(ext)) {
                continue;
            }


            // 检查文件大小
            if (stats.size > MAX_SAFE_STRING_LENGTH) {
                console.warn(`🚫 Skipping large file (${(stats.size / 1024 / 1024).toFixed(2)}MB): ${file}`);
                continue;
            } else if (stats.size > WARNING_SIZE) {
                console.warn(`⚠️ Processing large file (${(stats.size / 1024).toFixed(2)}KB): ${file}`);
            }

            let content = await fs.readFile(file, 'utf8');

            if (this.isAlreadyObfuscated(content)) {
                console.log(`🚫 Skipping already obfuscated: ${file}`);
                continue;
            }
            try {
                if (ext === '.html') {
                    content = await HtmlObfuscator.obfuscate(content, this.mapping);
                    // 添加混淆标记
                    content = `<!-- OBFUSCATED ${Date.now()} -->\n${content}`;
                } else {
                    if (ext === '.css') {
                        content = await CssObfuscator.obfuscate(content, this.mapping);
                    } else if (ext === '.js') {
                        content = await JsObfuscator.obfuscate(content, this.mapping, file);
                        // } else if (ext === '.ts' || ext === '.tsx') {
                        //     content = await TsObfuscator.obfuscate(content, this.mapping, file);
                    }
                    // 添加混淆标记
                    content = `/* OBFUSCATED ${Date.now()} */\n${content}`;
                }
            } catch (e) {
                console.error(`❌ Error processing ${file}:`, e.message);
            }

            await fs.writeFile(file, content);
        }
    }

    isAlreadyObfuscated(content) {
        return content.includes('/* OBFUSCATED') ||
            content.includes('// OBFUSCATED') ||
            content.includes('<!-- OBFUSCATED');
    }
}

module.exports = ObfuscationEngine;