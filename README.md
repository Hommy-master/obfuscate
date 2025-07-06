# 安装依赖

```
pnpm install
```

# 运行

```
pnpm start ./demo

或者

node ./bin/obfuscate.js ./demo

待修改：node ./bin/obfuscate.js ./bmivo.buzz_CdjJM -o . -n 3
输出：
./bmivo.buzz_CdjJM_1
./bmivo.buzz_CdjJM_2
./bmivo.buzz_CdjJM_3
```

# 要求

```
1. 代码函数名、变量名、类名、ID名替换
2. 增加垃圾代码 + 30%
3. 代码结构混淆
4. 代码对比，相似度低于10%
```

# 注意

```
类名、ID名暂屏蔽处理
```
