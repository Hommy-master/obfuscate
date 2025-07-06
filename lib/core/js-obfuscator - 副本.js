const fs = require('fs-extra');
const { transform } = require('@babel/core');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const t = require('@babel/types');
const RandomUtils = require('../utils/random-utils');

class JsObfuscator {
    static async collectMappings(filePath, mapping) {
        const js = await fs.readFile(filePath, 'utf8');
        this._analyzeGlobals(js, mapping);
    }

    static obfuscate(js, mapping) {
        return this._transformJs(js, mapping);
    }

    static _analyzeGlobals(js, mapping) {
        const ast = parser.parse(js, {
            sourceType: 'script',
            plugins: ['jsx']
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
            }
        });
    }

    static _transformJs(js, mapping) {
        const result = transform(js, {
            plugins: [
                this._mappingPlugin(mapping),
                this._deadCodePlugin(),
                this._manglePlugin(mapping)
            ],
            configFile: false
        });
        return result.code;
    }

    static _mappingPlugin(mapping) {
        return {
            visitor: {
                // StringLiteral(path) {
                //     let value = path.node.value;

                //     // 处理带点号或井号的选择器
                //     if (mapping.classSelectors.has(value)) {
                //         path.node.value = mapping.classSelectors.get(value);
                //     }
                //     else if (mapping.idSelectors.has(value)) {
                //         path.node.value = mapping.idSelectors.get(value);
                //     }
                //     // 处理普通类名和ID
                //     else if (mapping.classes.has(value)) {
                //         path.node.value = mapping.classes.get(value);
                //     }
                //     else if (mapping.ids.has(value)) {
                //         path.node.value = mapping.ids.get(value);
                //     }
                // },

                // // 处理 classList 操作
                // CallExpression(path) {
                //     const { node } = path;
                //     const { callee } = node;

                //     // 检查是否是 classList.add/remove/toggle 等操作
                //     if (callee.object &&
                //         callee.object.property &&
                //         callee.object.property.name === 'classList' &&
                //         ['add', 'remove', 'toggle', 'contains'].includes(callee.property.name)) {

                //         // 处理每个参数
                //         node.arguments.forEach(arg => {
                //             if (t.isStringLiteral(arg)) {
                //                 const value = arg.value;
                //                 if (mapping.classes.has(value)) {
                //                     arg.value = mapping.classes.get(value);
                //                 }
                //             }
                //         });
                //     }

                //     // 处理 jQuery 的 addClass/removeClass 等操作
                //     if (callee.property &&
                //         ['addClass', 'removeClass', 'toggleClass', 'hasClass'].includes(callee.property.name)) {

                //         // 处理每个参数
                //         node.arguments.forEach(arg => {
                //             if (t.isStringLiteral(arg)) {
                //                 const value = arg.value;
                //                 if (mapping.classes.has(value)) {
                //                     arg.value = mapping.classes.get(value);
                //                 }
                //             }
                //         });
                //     }
                // },

                // // 处理 className 赋值
                // AssignmentExpression(path) {
                //     const { node } = path;
                //     if (node.left.property && node.left.property.name === 'className') {
                //         if (t.isStringLiteral(node.right)) {
                //             const value = node.right.value;
                //             if (mapping.classes.has(value)) {
                //                 node.right.value = mapping.classes.get(value);
                //             }
                //         }
                //     }
                // },

                Identifier(path) {
                    // 处理全局变量
                    if (mapping.globals.has(path.node.name)) {
                        path.node.name = mapping.globals.get(path.node.name);
                    }
                }
            }
        };
    }

    static _deadCodePlugin() {
        return {
            visitor: {
                Program: {
                    enter(path) {
                        if (RandomUtils.randomBool(0.5)) {
                            const deadFunction = t.functionDeclaration(
                                t.identifier(RandomUtils.randomIdentifier()),
                                [],
                                t.blockStatement([
                                    t.variableDeclaration(
                                        'var',
                                        Array.from({ length: RandomUtils.randomInt(3, 10) }, () =>
                                            t.variableDeclarator(
                                                t.identifier(RandomUtils.randomIdentifier()),
                                                t.numericLiteral(Math.random())
                                            )
                                        )
                                    )
                                ])
                            );

                            path.node.body.unshift(deadFunction);
                        }
                    }
                }
            }
        };
    }

    static _manglePlugin(mapping) {
        return {
            visitor: {
                Scope(path) {
                    if (path.scope.parent) { // 非全局作用域
                        path.scope.rename.bind(path.scope);

                        Object.entries(path.scope.bindings).forEach(([name, binding]) => {
                            if (!mapping.globals.has(name)) {
                                const newName = RandomUtils.randomIdentifier();
                                path.scope.rename(name, newName);
                            }
                        });
                    }
                }
            }
        };
    }
}

module.exports = JsObfuscator;