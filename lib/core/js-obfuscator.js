const fs = require('fs-extra');
const { transform } = require('@babel/core');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const t = require('@babel/types');
const { obfuscate: jsObfuscate } = require('javascript-obfuscator');
// const { Buffer } = require('buffer');
const RandomUtils = require('../utils/random-utils');
const { MAX_SAFE_STRING_LENGTH } = require('../utils/const');

class JsObfuscator {
    constructor() {
        this.isModule = false;
    }
    static async collectMappings(filePath, mapping) {
        const stats = await fs.stat(filePath);
        if (stats.size > MAX_SAFE_STRING_LENGTH) {
            console.warn(`Skipping large file for mapping collection: ${filePath}`);
            return;
        }

        const js = await fs.readFile(filePath, 'utf8');
        // 自动检测是否为模块
        this.isModule = this.isESModuleWithBabel(js, filePath);
        this._analyzeGlobals(js, mapping);
    }

    static obfuscate(js, mapping, filePath) {
        this.isModule = this.isESModuleWithBabel(js);
        // // 1. 如果文件太大，跳过 Base64 编码
        // let base64Transformed = js;
        //     try {
        //         base64Transformed = this._encodeStringsToBase64(js);
        //     } catch (e) {
        //         console.error('Base64 transform skipped:', e.message);
        //     }

        // 2. 应用全局变量映射
        const globalVarTransformed = this._applyGlobalMappings(js, mapping);

        // 3. 使用 javascript-obfuscator 进行高级混淆
        console.log(`使用 javascript-obfuscator 进行高级混淆：${filePath}`);
        return this._advancedObfuscate(globalVarTransformed);
    }

    static _analyzeGlobals(js, mapping, filePath) {
        try {
            const ast = parser.parse(js, {
                sourceType: this.isModule ? 'module' : 'script',
                plugins: [
                    'jsx',
                    'typescript',
                    this.isModule ? 'importMeta' : null
                ].filter(Boolean),
                allowUndeclaredExports: true,
                // 添加优化选项
                compact: true, // 输出紧凑代码
                minified: true, // 最小化输出
                comments: false // 移除注释
            });

            traverse(ast, {
                VariableDeclarator(path) {
                    if (!path.scope.parent) { // 顶级作用域
                        const name = path.node.id.name;
                        if (!mapping.globals.has(name)) {
                            mapping.globals.set(name, RandomUtils.randomIdentifier());
                        }
                    }
                },
                FunctionDeclaration(path) {
                    if (!path.scope.parent) {
                        const name = path.node.id.name;
                        if (!mapping.globals.has(name)) {
                            mapping.globals.set(name, RandomUtils.randomIdentifier());
                        }
                    }
                },
                ClassDeclaration(path) {
                    if (!path.scope.parent) {
                        const name = path.node.id.name;
                        if (!mapping.globals.has(name)) {
                            mapping.globals.set(name, RandomUtils.randomIdentifier());
                        }
                    }
                },
                TSInterfaceDeclaration(path) {
                    // 处理 TypeScript 接口声明
                    const name = path.node.id.name;
                    if (!mapping.globals.has(name)) {
                        mapping.globals.set(name, RandomUtils.randomIdentifier());
                    }
                }
            });
        } catch (e) {
            // 添加更详细的错误信息
            console.error(`Error parsing file: ${filePath}`);
            console.error(`Error details: ${e.message}`);
            if (e.loc) {
                console.error(`At line ${e.loc.line}, column ${e.loc.column}`);
                const lines = js.split('\n');
                const errorLine = lines[e.loc.line - 1];
                console.error(`Source snippet: ${errorLine}`);
            }
            throw e;
        }
    }

    // 检测是否为 ES 模块
    static _checkIsModule(js, filePath) {
        // 根据文件扩展名判断
        if (filePath) {
            const ext = filePath.split('.').pop().toLowerCase();
            if (['mjs', 'esm', 'es6'].includes(ext)) return true;
        }

        // 根据内容判断
        return true || /(^|\n)\s*(import|export)\s+/.test(js);
    }

    static isESModuleWithBabel(code, filename) {
        try {
            const ast = parser.parse(code, {
                sourceType: 'unambiguous', // 让 Babel 自动检测
                plugins: [
                    'jsx',
                    'typescript'
                ],
                allowImportExportEverywhere: true,
                errorRecovery: true
            });

            // 检测是否有 import/export 节点
            let hasESMSyntax = false;
            traverse(ast, {
                ImportDeclaration() { hasESMSyntax = true; },
                ExportDeclaration() { hasESMSyntax = true; },
                Import() { hasESMSyntax = true; }
            });

            return hasESMSyntax;
        } catch (e) {
            console.error(`解析错误 ${filename}:`, e.message);
            return false;
        }
    }

    // // Base64 编码字符串字面量
    // static _encodeStringsToBase64(js) {
    //     try {
    //         const { code } = transform(js, {
    //             plugins: [this._safeBase64EncodePlugin()],
    //             configFile: false
    //         });
    //         return code;
    //     } catch (e) {
    //         console.error('Base64 transform error:', e);
    //         return js; // 出错时返回原始内容
    //     }
    // }

    // 应用全局变量映射
    static _applyGlobalMappings(js, mapping) {
        const { code } = transform(js, {
            plugins: [this._globalMappingPlugin(mapping)],
            configFile: false,
            sourceType: this.isModule ? 'module' : 'script',
            // 添加优化选项
            compact: true, // 输出紧凑代码
            minified: true, // 最小化输出
            comments: false // 移除注释
        });
        return code;
    }

    static _globalMappingPlugin(mapping) {
        return {
            visitor: {
                Identifier(path) {
                    if (mapping.globals.has(path.node.name)) {
                        path.node.name = mapping.globals.get(path.node.name);
                    }
                }
            }
        };
    }

    // 使用 javascript-obfuscator 进行高级混淆
    static _advancedObfuscate(js) {
        try {
            const isSmallFile = js.length < 500 * 1024;
            // 增强混淆配置
            const obfuscationOptions = {
                // 基础配置
                compact: true, // true 压缩输出代码（删除换行和缩进）
                disableConsoleOutput: false, // true 禁用所有 console 调用
                // log: false, // false 在控制台显示混淆过程日志 调试时开启
                numbersToExpressions: false, // false 将数字转换为表达式 增加混淆度但影响可读性 建议不开启
                // optionsPreset: 'high-obfuscation', // 'default' 预设配置方案 可选值: 'default' 'low-obfuscation', 'medium-obfuscation', 'high-obfuscation'

                // 标识符混淆配置
                identifierNamesGenerator: 'hexadecimal', // hexadecimal 标识符生成策略 可选值: 'dictionary', 'hexadecimal', 'mangled', 'mangled-shuffled'  ✅ 推荐: 'mangled'（短变量名）或 'hexadecimal'（高强度混淆）
                // identifiersDictionary: [], // 自定义标识符字典 （当使用 dictionary 模式时）示例: ["a", "b", "c"]
                identifiersPrefix: 'obf_', // '' 为所有标识符添加前缀
                renameGlobals: false, // false 是否混淆全局变量和函数名 警告：可能导致外部依赖失效
                reservedNames: ["defaultBuiltinList",], // [] 保留的标识符列表（不会被混淆）关键：用于保护公共API 📝 示例: ['init', 'publicApi'] defaultBuiltinList: 直接保留全局变量
                reservedStrings: ["^on[A-Z].*", "Config$"], // [] 使用正则保留匹配的标识符 示例: ['^on.*'] 保留所有 "on" 开头的函数
                transformObjectKeys: false, // false 混淆对象键名 注意：可能影响性能

                // 控制流混淆配置
                controlFlowFlattening: isSmallFile, // false 启用控制流平坦化 高强度混淆：打乱代码执行顺序  仅对小文件启用控制流平坦化
                controlFlowFlatteningThreshold: 0.75, // 0.75 控制流平坦化应用比例 (0-1) 推荐值: 0.75（平衡安全与性能）
                deadCodeInjection: isSmallFile, // true 注入无用代码 警告：显著增加代码体积（约30%）  仅对小文件启用死代码注入
                deadCodeInjectionThreshold: 0.4, // 0.4 无用代码注入比例 (0-1)  建议值: 0.3-0.5

                // 字符串处理配置
                stringArray: true, // true 启用字符串数组混淆 ✅ 核心功能：集中存储并加密所有字符串
                stringArrayEncoding: ['base64'], // false  字符串编码方式  可选值: 'none', 'base64', 'rc4'  🔒 推荐: ['base64'] 或 ['rc4']（更高安全）
                // stringArrayIndexesType: ['hexadecimal-number'], // ['hexadecimal-number'] 字符串数组索引类型 可选值: 'hexadecimal-number', 'hexadecimal-numeric-string'
                stringArrayIndexShift: true, // false 对字符串数组索引进行位移 🔐 增强保护：防止直接访问
                stringArrayRotate: true, // true 随机旋转字符串数组 ✅ 推荐开启
                stringArrayShuffle: true, // true 随机打乱字符串数组 ✅ 推荐开启
                // stringArrayWrappersCount: 5, // 1 字符串访问包装器数量  📈 增加复杂度：值越高混淆越强
                // stringArrayWrappersChainedCalls: true, // true 链式调用包装器 🔗 增强混淆效果
                stringArrayWrappersParametersMaxCount: 2, // 1 包装器参数最大数量  🔧 调整：值越高混淆度越强
                stringArrayWrappersType: 'function',// variable 包装器类型 可选值: 'variable', 'function'
                stringArrayThreshold: isSmallFile ? 0.75 : 0.5, // 0.8 启用字符串数组的阈值 (0-1)  🔧 调整：值越高处理的字符串越多 对大文件使用更低阈值

                // 调试保护配置
                debugProtection: false, // false 启用调试保护 ⚠️ 警告：可能导致浏览器卡死（生产环境慎用）
                debugProtectionInterval: 0, // 0 调试保护检查间隔（毫秒）⏱️ 值越高性能影响越小 40000
                domainLock: [], // [] 域名锁定列表（防止代码在非指定域名运行） 🔒 安全增强：防止代码被盗用 📝 示例: ['example.com', 'subdomain.example.com']
                // domainLockRedirectUrl: // about:blank 域名不匹配时重定向URL
                forceTransformStrings: [], // [] 强制转换特定字符串  📝 示例: ['password', 'token']
                selfDefending: true, // false 启用自防御（防止代码格式化）  ✅ 推荐开启

                // 转换与注入配置
                simplify: true, // true 简化代码结构  ⚖️ 平衡：开启可减小体积但降低混淆度
                splitStrings: true, // false 分割长字符串 📝 示例: 'hello' → 'hel' + 'lo'
                splitStringsChunkLength: 10, // 10 字符串分割块长度 🔧 配合 splitStrings 使用
                unicodeEscapeSequence: false, // false 使用Unicode转义序列  🔡 增强混淆但增加体积

                // 排除与保留配置
                exclude: [
                    "**/node_modules/**",
                    "**/vendor/**",
                    "**/*.min.js",
                    "**/chunk-vendors*.js"
                ], // [] 排除的文件/目录 🌟 关键：用于保护第三方库  📝 示例: ['**/vendor/**', '**/*.min.js']
                // ignoreImports: false, // false 忽略导入的模块（不混淆导入的代码） 推荐开启：防止破坏模块系统
                // reservedQuotedPropertyNames: [], // [] 保留的引号属性名（不会被混淆）  📝 示例: 示例: ['$super', 'protectedProperty']
                // sourceMap: false, // false 生成Source Map ⚠️ 安全警告：生产环境应关闭
                // sourceMapMode: 'separate', // separate Source Map生成模式  可选值: 'inline', 'separate'

                // 性能与优化配置
                // target: "browser", // browser 目标环境  可选值: 'browser', 'browser-no-eval', 'node'  ✅ 根据运行环境选择
                // seed: 0 // 0 随机种子（用于生成随机标识符）  🔧 调整：可设置为固定值以复现混淆结果
            };
            const result = jsObfuscate(js, obfuscationOptions);
            return result.getObfuscatedCode();
        } catch (e) {
            console.error('Advanced obfuscation error:', e);
            return js;
        }
    }
}

module.exports = JsObfuscator;