const path = require('path');
const fs = require('fs-extra');
const HtmlObfuscator = require('./core/html-obfuscator');
const CssObfuscator = require('./core/css-obfuscator');
const JsObfuscator = require('./core/js-obfuscator');
// const TsObfuscator = require('./core/ts-obfuscator'); // 添加 TypeScript 混淆器
const FileStructureObfuscator = require('./core/file-structure-obfuscator'); // 添加文件结构混淆器
const BackupManager = require('./utils/backup-manager');
const MappingManager = require('./utils/mapping-manager'); // 添加映射管理器
const RandomUtils = require('./utils/random-utils'); // 添加随机工具
const { walkDir } = require('./utils/file-utils');
const sh = require('shorthash');
const cheerio = require('cheerio');
const { MAX_SAFE_STRING_LENGTH, WARNING_SIZE } = require('./utils/const');

class ObfuscationEngine {
    constructor(targetDir, outputDir = '.', outCount = 1) {
        this.targetDir = targetDir;
        this.outputDir = outputDir === '.' ? path.dirname(targetDir) : outputDir; // 如果输出目录是当前目录，则使用目标目录的父目录
        this.outCount = outCount; // 混淆结果数量
        this.mappingManager = new MappingManager(); // 使用新的映射管理器
        this.fileStructureObfuscator = new FileStructureObfuscator(this.mappingManager); // 初始化文件结构混淆器

        // 生成随机混淆标记，确保同一次运行的一致性
        this.htmlMarker = RandomUtils.randomHtmlComment();
        this.codeMarker = RandomUtils.randomCodeComment();

        // 为了向后兼容，保留原有的 mapping 对象结构
        this.mapping = {
            globals: this.mappingManager.mappings.globals,
            // classes: this.mappingManager.mappings.classes,  // 保持原有的注释状态
            // ids: this.mappingManager.mappings.ids,          // 保持原有的注释状态
            // classSelectors: new Map(),
            // idSelectors: new Map(),
            // complexSelectors: new Map()
        };
    }

    async run() {
        // 进行源码备份和copy
        const backupManager = new BackupManager(this.targetDir, this.outputDir, this.outCount);
        const { isFirstRun } = await backupManager.prepare();
        this.workDirs = backupManager.workDirs; // 获取新的工作目录路径

        // 1. 收集全局映射关系
        // await this.collectMappings();

        // 这里一定要使用for 而不是 map + Promise.all, 要不顺序不对，影响混淆效果
        const len = this.workDirs.length;
        for (let i = 0; i < len; i++) {
            const workDir = this.workDirs[i];
            const count = i + 1;
            try {
                // 1. 静态资源随机化处理
                console.log(`🔄 开始执行第【${count}】次静态资源随机化处理...`);
                await this.fileStructureObfuscator.process(workDir);

                // 2. 执行混淆
                await this.processFiles(workDir);

                // 3. 保存映射关系到文件（可选，用于调试）
                const mappingFilePath = path.join(path.dirname(this.targetDir), 'obfuscation-mapping.json');
                await this.mappingManager.saveToFile(mappingFilePath);

                // 4. 输出统计信息
                const stats = this.mappingManager.getStats();
                console.log(`📊 当前执行第【${count}】次混淆统计信息:`, stats);

            } catch (error) {
                console.error(`❌当前执行第【${count}】次混淆流程时失败:`, error.message);
                // throw error; // 如果需要在失败时就终止抛出异常可以放开注释
            }
        }

        console.log(`🎉 当前执行的【${this.outCount}】次混淆流程均已完成! ${isFirstRun ? '首次' : '后续'} 运行`);
    }

    async collectMappings() {
        console.log('🔍 开始收集全局映射关系...');

        // 扫描所有文件建立映射关系
        const files = await walkDir(this.workDir[0]);

        for (const file of files) {
            const ext = path.extname(file);
            // 先注释掉，后面再按需放开优化
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

        console.log('✅ 全局映射关系收集完成');
    }

    async processFiles(workDir) {
        console.log('🚀 开始处理文件混淆...');

        const files = await walkDir(workDir);

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
                console.log(`⏭️ Skipping already obfuscated: ${file}`);
                continue;
            }

            try {
                if (ext === '.html') {
                    content = await HtmlObfuscator.obfuscate(content, this.mapping);
                    // 添加随机混淆标记
                    content = `${this.htmlMarker}\n${content}`;
                } else {
                    if (ext === '.css') {
                        content = await CssObfuscator.obfuscate(content, this.mapping);
                    } else if (ext === '.js') {
                        content = await JsObfuscator.obfuscate(content, this.mapping, file);
                        //} else if (ext === '.ts' || ext === '.tsx') {
                        //   content = await TsObfuscator.obfuscate(content, this.mapping, file);
                    }
                    // 添加随机混淆标记
                    content = `${this.codeMarker}\n${content}`;
                }
            } catch (e) {
                console.error(`❌Error processing ${file}:`, e.message);
                continue;
            }


            if (ext === ".html") {
                // 交叉class
                const $ = cheerio.load(content);
                $("*").each(function () {
                    const currentClass = $(this).attr("class");
                    if (currentClass) {
                        let arrs = currentClass.split(" ");
                        let newClass = arrs.map((item) => {
                            let h = sh.unique(item);
                            return h;
                        });
                        arrs.forEach((item, i) => {
                            if (i % 2 == 0) {
                                let randomNum = Math.floor(Math.random() * arrs.length) + 1;
                                let str = arrs.splice(randomNum, 1, newClass[i]);
                                randomNum = Math.floor(Math.random() * arrs.length) + 1;
                                arrs.splice(randomNum, 0, str);
                            }
                        });
                        newClass = arrs.join(" ");
                        $(this).attr("class", newClass);
                    }
                });
                content = $.html();
            }

            await fs.writeFile(file, content);
            console.log(`✅ 处理完成: ${path.relative(workDir, file)}`);
        }

        console.log('🎯 所有文件混淆处理完成');
    }

    isAlreadyObfuscated(content) {
        // 检查是否包含各种混淆标记的模式
        const patterns = [
            /\/\*\s*[A-Z_]+_[A-Z_]+_\d+_[a-z0-9]+\s*\*\//,  // CSS/JS 随机标记
            /<!--\s*[A-Z_]+_[A-Z_]+_\d+_[a-z0-9]+\s*-->/,   // HTML 随机标记
            /\/\*\s*OBFUSCATED/,                               // 旧的固定标记（向后兼容）
            /<!--\s*OBFUSCATED/,                               // 旧的固定标记（向后兼容）
            /\/\/\s*OBFUSCATED/                                // 旧的固定标记（向后兼容）
        ];

        return patterns.some(pattern => pattern.test(content));
    }
}

module.exports = ObfuscationEngine;