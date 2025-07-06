const path = require('path');
const fs = require('fs-extra');
const HtmlObfuscator = require('./core/html-obfuscator');
const CssObfuscator = require('./core/css-obfuscator');
const JsObfuscator = require('./core/js-obfuscator');
const TsObfuscator = require('./core/ts-obfuscator'); // 添加 TypeScript 混淆器
const FileStructureObfuscator = require('./core/file-structure-obfuscator'); // 添加文件结构混淆器
const BackupManager = require('./utils/backup-manager');
const MappingManager = require('./utils/mapping-manager'); // 添加映射管理器
const RandomUtils = require('./utils/random-utils'); // 添加随机工具
const { walkDir } = require('./utils/file-utils');
const { MAX_SAFE_STRING_LENGTH, WARNING_SIZE } = require('./utils/const');

class ObfuscationEngine {
    constructor(targetDir) {
        this.targetDir = targetDir;
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
        const backupManager = new BackupManager(this.targetDir);
        const { isFirstRun } = await backupManager.prepare();
        this.workDir = backupManager.workDir; // 获取新的工作目录路径

        try {
            // 1. 静态资源随机化处理
            console.log('🔄 开始静态资源随机化处理...');
            await this.fileStructureObfuscator.process(this.workDir);
            
            // 2. 收集全局映射关系
            await this.collectMappings();

            // 3. 执行混淆
            await this.processFiles();

            // 4. 应用结果
            await backupManager.applyResults();
            
            // 5. 保存映射关系到文件（可选，用于调试）
            const mappingFilePath = path.join(path.dirname(this.targetDir), 'obfuscation-mapping.json');
            await this.mappingManager.saveToFile(mappingFilePath);
            
            // 6. 输出统计信息
            const stats = this.mappingManager.getStats();
            console.log('📊 混淆统计信息:', stats);
            
        } catch (error) {
            console.error('❌Error 处理失败:', error.message);
            // 清理工作目录
            await fs.remove(this.workDir);
            throw error;
        }

        console.log(`🎉 Obfuscation complete! ${isFirstRun ? 'Initial' : 'Subsequent'} run`);
    }

    async collectMappings() {
        console.log('🔍 开始收集全局映射关系...');
        
        // 扫描所有文件建立映射关系
        const files = await walkDir(this.workDir);

        for (const file of files) {
            const ext = path.extname(file);

            // 保持原有逻辑：只对 JS 和 TS 文件收集全局变量映射
            if (['.js', '.ts', '.tsx'].includes(ext)) {
                await JsObfuscator.collectMappings(file, this.mapping);
            }
        }
        
        console.log('✅ 全局映射关系收集完成');
    }

    async processFiles() {
        console.log('🚀 开始处理文件混淆...');
        
        const files = await walkDir(this.workDir);

        for (const file of files) {
            const ext = path.extname(file);
            const stats = await fs.stat(file);

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
                    } else if (ext === '.ts' || ext === '.tsx') {
                        content = await TsObfuscator.obfuscate(content, this.mapping, file);
                    }
                    // 添加随机混淆标记
                    content = `${this.codeMarker}\n${content}`;
                }
            } catch (e) {
                console.error(`❌Error processing ${file}:`, e.message);
                continue;
            }

            await fs.writeFile(file, content);
            console.log(`✅ 处理完成: ${path.relative(this.workDir, file)}`);
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