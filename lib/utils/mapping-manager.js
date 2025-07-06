const fs = require('fs-extra');
const path = require('path');

class MappingManager {
    constructor() {
        this.mappings = {
            globals: new Map(),      // 全局变量映射
            files: new Map(),        // 文件路径映射
            directories: new Map(),  // 目录路径映射
            ids: new Map(),          // ID映射
            classes: new Map(),      // 类名映射
            // 保留原有的映射，但暂时屏蔽
            // classSelectors: new Map(),
            // idSelectors: new Map(),
            // complexSelectors: new Map()
        };
    }

    // 获取所有映射
    getAllMappings() {
        const result = {};
        for (const [key, value] of Object.entries(this.mappings)) {
            if (value instanceof Map) {
                result[key] = Object.fromEntries(value);
            } else {
                result[key] = value;
            }
        }
        return result;
    }

    // 添加文件映射
    addFile(originalPath, newPath) {
        this.mappings.files.set(originalPath, newPath);
        console.log(`📁 文件映射: ${originalPath} -> ${newPath}`);
    }

    // 添加目录映射
    addDirectory(originalPath, newPath) {
        this.mappings.directories.set(originalPath, newPath);
        console.log(`📂 目录映射: ${originalPath} -> ${newPath}`);
    }

    // 添加ID映射
    addId(originalId, newId) {
        this.mappings.ids.set(originalId, newId);
        console.log(`🆔 ID映射: ${originalId} -> ${newId}`);
    }

    // 添加类名映射
    addClass(originalClass, newClass) {
        this.mappings.classes.set(originalClass, newClass);
        console.log(`🏷️ 类名映射: ${originalClass} -> ${newClass}`);
    }

    // 添加全局变量映射
    addGlobal(originalName, newName) {
        this.mappings.globals.set(originalName, newName);
        console.log(`🌐 全局变量映射: ${originalName} -> ${newName}`);
    }

    // 获取文件映射
    getFileMapping(originalPath) {
        return this.mappings.files.get(originalPath);
    }

    // 获取目录映射
    getDirectoryMapping(originalPath) {
        return this.mappings.directories.get(originalPath);
    }

    // 获取ID映射
    getIdMapping(originalId) {
        return this.mappings.ids.get(originalId);
    }

    // 获取类名映射
    getClassMapping(originalClass) {
        return this.mappings.classes.get(originalClass);
    }

    // 获取全局变量映射
    getGlobalMapping(originalName) {
        return this.mappings.globals.get(originalName);
    }

    // 清空所有映射
    clear() {
        for (const mapping of Object.values(this.mappings)) {
            if (mapping instanceof Map) {
                mapping.clear();
            }
        }
    }

    // 保存映射到文件
    async saveToFile(filePath) {
        const mappingData = this.getAllMappings();
        await fs.writeFile(filePath, JSON.stringify(mappingData, null, 2), 'utf8');
        console.log(`💾 映射已保存到: ${filePath}`);
    }

    // 从文件加载映射
    async loadFromFile(filePath) {
        if (await fs.pathExists(filePath)) {
            const mappingData = JSON.parse(await fs.readFile(filePath, 'utf8'));
            for (const [key, value] of Object.entries(mappingData)) {
                if (this.mappings[key] instanceof Map) {
                    this.mappings[key].clear();
                    for (const [k, v] of Object.entries(value)) {
                        this.mappings[key].set(k, v);
                    }
                }
            }
            console.log(`📂 映射已从文件加载: ${filePath}`);
        }
    }

    // 统计映射数量
    getStats() {
        const stats = {};
        for (const [key, value] of Object.entries(this.mappings)) {
            if (value instanceof Map) {
                stats[key] = value.size;
            }
        }
        return stats;
    }
}

module.exports = MappingManager; 