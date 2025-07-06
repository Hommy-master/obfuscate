const { transform } = require('@babel/core');
const JsObfuscator = require('./js-obfuscator'); // 复用 JS 混淆逻辑

class TsObfuscator {
    static obfuscate(tsCode, mapping) {
        // 1. 移除类型注解（但保留类型信息用于混淆）
        const strippedCode = this._stripTypes(tsCode);

        // 2. 应用 JS 混淆逻辑
        const obfuscatedJs = JsObfuscator.obfuscate(strippedCode, mapping);

        // 3. 重新添加类型声明（与混淆后的变量名匹配）
        return this._restoreTypes(obfuscatedJs, mapping);
    }

    // 移除类型注解，但保留类型信息
    static _stripTypes(tsCode) {
        const { code } = transform(tsCode, {
            presets: ['@babel/preset-typescript'],
            plugins: [
                '@babel/plugin-transform-typescript',
                this._typeMappingPlugin()
            ],
            configFile: false,
            filename: 'file.ts'
        });
        return code;
    }

    // 收集类型信息
    static _typeMappingPlugin() {
        return {
            visitor: {
                TSTypeAliasDeclaration(path) {
                    // 保留类型别名信息
                    path.skip();
                },
                TSTypeAnnotation(path) {
                    // 保留类型注解信息
                    path.skip();
                },
                TSInterfaceDeclaration(path) {
                    // 保留接口信息
                    path.skip();
                }
            }
        };
    }

    // 重新添加类型声明（使用混淆后的变量名）
    static _restoreTypes(jsCode, mapping) {
        const { code } = transform(jsCode, {
            plugins: [this._restoreTypesPlugin(mapping)],
            configFile: false
        });
        return code;
    }

    static _restoreTypesPlugin(mapping) {
        return {
            visitor: {
                VariableDeclarator(path) {
                    const id = path.node.id;
                    if (id.typeAnnotation && mapping.globals.has(id.name)) {
                        // 使用混淆后的变量名更新类型注解
                        const newName = mapping.globals.get(id.name);
                        id.name = newName;
                    }
                },
                FunctionDeclaration(path) {
                    const id = path.node.id;
                    if (id && id.typeAnnotation && mapping.globals.has(id.name)) {
                        // 使用混淆后的函数名更新类型注解
                        const newName = mapping.globals.get(id.name);
                        id.name = newName;
                    }
                },
                ClassDeclaration(path) {
                    const id = path.node.id;
                    if (id && id.typeAnnotation && mapping.globals.has(id.name)) {
                        // 使用混淆后的类名更新类型注解
                        const newName = mapping.globals.get(id.name);
                        id.name = newName;
                    }
                }
            }
        };
    }
}

module.exports = TsObfuscator;