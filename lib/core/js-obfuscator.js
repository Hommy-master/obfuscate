const fs = require('fs-extra');
const { transform } = require('@babel/core');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
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
            // 检查 mapping.globals 是否存在且为 Map
            if (!mapping.globals || typeof mapping.globals.has !== 'function') {
                console.warn('全局变量映射对象无效');
                return;
            }

            const ast = parser.parse(js, {
                sourceType: this.isModule ? 'module' : 'script',
                plugins: [
                    'jsx',
                    'typescript',
                    'decorators-legacy',
                    'classProperties',
                    'objectRestSpread',
                    'functionBind',
                    'exportDefaultFrom',
                    'dynamicImport',
                    'optionalChaining',
                    'nullishCoalescingOperator'
                ]
            });

            traverse(ast, {
                VariableDeclarator(path) {
                    if (t.isIdentifier(path.node.id) && path.scope.parent === null) {
                        const name = path.node.id.name;
                        if (!mapping.globals.has(name) && this._shouldObfuscateGlobal(name)) {
                            mapping.globals.set(name, this._generateGlobalName());
                        }
                    }
                },
                FunctionDeclaration(path) {
                    if (t.isIdentifier(path.node.id) && path.scope.parent === null) {
                        const name = path.node.id.name;
                        if (!mapping.globals.has(name) && this._shouldObfuscateGlobal(name)) {
                            mapping.globals.set(name, this._generateGlobalName());
                        }
                    }
                },
                ClassDeclaration(path) {
                    if (t.isIdentifier(path.node.id) && path.scope.parent === null) {
                        const name = path.node.id.name;
                        if (!mapping.globals.has(name) && this._shouldObfuscateGlobal(name)) {
                            mapping.globals.set(name, this._generateGlobalName());
                        }
                    }
                },

            });
        } catch (error) {
            console.warn(`JavaScript 全局分析失败 ${filePath}:`, error.message);
        }
    }

    static _shouldObfuscateGlobal(name) {
        // 保留的全局变量名
        const reserved = new Set([
            'window', 'document', 'console', 'Array', 'Object', 'String', 'Number', 'Boolean',
            'Date', 'Math', 'JSON', 'Promise', 'setTimeout', 'setInterval', 'clearTimeout',
            'clearInterval', 'require', 'module', 'exports', '__dirname', '__filename',
            'process', 'global', 'Buffer', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
            'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI'
        ]);
        return !reserved.has(name) && name.length > 2 && !/^[A-Z_]+$/.test(name);
    }

    static _generateGlobalName() {
        return RandomUtils.randomIdentifier();
    }



    static _applyGlobalMappings(js, mapping) {
        try {
            // 检查 mapping.globals 是否存在且为 Map
            if (!mapping.globals || typeof mapping.globals.has !== 'function') {
                console.warn('全局变量映射对象无效');
                return js;
            }

            // 如果没有全局变量映射，直接返回
            if (mapping.globals.size === 0) {
                return js;
            }

            const ast = parser.parse(js, {
                sourceType: this.isModule ? 'module' : 'script',
                plugins: [
                    'jsx',
                    'typescript',
                    'decorators-legacy',
                    'classProperties',
                    'objectRestSpread',
                    'functionBind',
                    'exportDefaultFrom',
                    'dynamicImport',
                    'optionalChaining',
                    'nullishCoalescingOperator'
                ]
            });

            traverse(ast, {
                Identifier(path) {
                    const name = path.node.name;
                    if (mapping.globals.has(name) && path.isReferencedIdentifier()) {
                        path.node.name = mapping.globals.get(name);
                    }
                }
            });

            const { code } = generate(ast, {
                compact: false,
                comments: false,
                retainLines: false
            });

            return code;
        } catch (error) {
            console.warn('全局变量映射应用失败:', error.message);
            return js;
        }
    }

    static _advancedObfuscate(js) {
        try {
            const { obfuscationOptions } = require('../utils/const');
            const obfuscationResult = jsObfuscate(js, obfuscationOptions);
            return obfuscationResult.getObfuscatedCode();
        } catch (error) {
            console.warn('高级混淆失败:', error.message);
            return js;
        }
    }

    static isESModuleWithBabel(js, filePath) {
        try {
            const ast = parser.parse(js, {
                sourceType: 'unambiguous',
                plugins: [
                    'jsx',
                    'typescript',
                    'decorators-legacy',
                    'classProperties',
                    'objectRestSpread',
                    'functionBind',
                    'exportDefaultFrom',
                    'dynamicImport',
                    'optionalChaining',
                    'nullishCoalescingOperator'
                ]
            });

            let isModule = false;
            
            traverse(ast, {
                ImportDeclaration() {
                    isModule = true;
                },
                ExportDefaultDeclaration() {
                    isModule = true;
                },
                ExportNamedDeclaration() {
                    isModule = true;
                }
            });

            return isModule;
        } catch (error) {
            console.warn(`模块类型检测失败 ${filePath}:`, error.message);
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
}

module.exports = JsObfuscator;