const fs = require('fs-extra');
const { transform } = require('@babel/core');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const t = require('@babel/types');
const { obfuscate: jsObfuscate } = require('javascript-obfuscator');
// const { Buffer } = require('buffer');
const RandomUtils = require('../utils/random-utils');
const { getObfuscationOptions, MAX_SAFE_STRING_LENGTH } = require('../utils/const');

class JsObfuscator {
    constructor() {
        this.isModule = false;
    }
    static async collectMappings(filePath, mapping) {
        // const stats = await fs.stat(filePath);
        // if (stats.size > MAX_SAFE_STRING_LENGTH) {
        //     console.warn(`Skipping large file for mapping collection: ${filePath}`);
        //     return;
        // }

        // const js = await fs.readFile(filePath, 'utf8');
        // // 自动检测是否为模块
        // this.isModule = this.isESModuleWithBabel(js, filePath);
        // this._analyzeGlobals(js, mapping);
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
        // const globalVarTransformed = this._applyGlobalMappings(js, mapping);

        // 3. 使用 javascript-obfuscator 进行高级混淆
        console.log(`使用 javascript-obfuscator 进行高级混淆：${filePath}`);
        return this._advancedObfuscate(js);
    }

    static _getAST = (js) => {
        const ast = parser.parse(js, {
            sourceType: this.isModule ? 'module' : 'script',
            plugins: [
                'jsx',
                'typescript',
                this.isModule ? 'importMeta' : null
            ].filter(Boolean),
            allowReturnOutsideFunction: true,
            allowAwaitOutsideFunction: true,
            allowImportExportEverywhere: true,
            allowSuperOutsideMethod: true,
            allowUndeclaredExports: true,
            // 添加优化选项
            compact: true, // 输出紧凑代码
            minified: true, // 最小化输出
            comments: false // 移除注释
        });

        return ast;
    }

    static _analyzeGlobals(js, mapping, filePath) {
        try {
            const ast = this._getAST(js);

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

            console.error(`❌ 获取全局变量 JS解析错误 ${filePath}:`, e.message);
            // if (e.loc) {
            //     console.error(`❌ At line ${e.loc.line}, column ${e.loc.column}`);
            //     const lines = js.split('\n');
            //     const errorLine = lines[e.loc.line - 1];
            //     console.error(`❌ Source snippet: ${errorLine}`);
            // }
            // throw e;
        }
    }

    // 检测是否为 ES 模块
    static isESModuleWithBabel(code, filename) {
        try {
            const ast = this._getAST(code);

            // 检测是否有 import/export 节点
            let hasESMSyntax = false;
            traverse(ast, {
                ImportDeclaration() { hasESMSyntax = true; },
                ExportDeclaration() { hasESMSyntax = true; },
                Import() { hasESMSyntax = true; }
            });

            return hasESMSyntax;
        } catch (e) {
            console.error(`❌ 检测是否Module 解析错误 ${filename}:`, e.message);
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
    //         console.error('❌ Base64 transform error:', e);
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
            // 增强混淆配置
            const obfuscationOptions = getObfuscationOptions(js);
            const result = jsObfuscate(js, obfuscationOptions);
            return result.getObfuscatedCode();
        } catch (e) {
            console.error('❌ 进行JS高级混淆出错:', e.message);
            return js;
        }
    }
}

module.exports = JsObfuscator;