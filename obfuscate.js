const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator'); // 确保正确加载模块

// 配置混淆选项
const obfuscationOptions = {
  compact: true,
  controlFlowFlattening: true,
  deadCodeInjection: true,
  identifierNamesGenerator: 'hexadecimal',
  stringArray: true,
  stringArrayThreshold: 0.75,
  rotateStringArray: true,
  // 更多配置项可以根据需要添加
};

// 递归处理目录中的文件
function processDirectory(dir) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stats = fs.statSync(filePath);

    if (stats.isDirectory()) {
      // 如果是目录，递归处理
      processDirectory(filePath);
    } else if (path.extname(file) === '.js') {
      // 如果是 .js 文件，进行混淆
      obfuscateFile(filePath);
    }
  });
}

// 混淆单个文件
function obfuscateFile(filePath) {
  const sourceCode = fs.readFileSync(filePath, 'utf8');
  const obfuscatedCode = JavaScriptObfuscator.obfuscate(sourceCode, obfuscationOptions).getObfuscatedCode();

  // 将混淆后的代码写回文件
  fs.writeFileSync(filePath, obfuscatedCode, 'utf8');
  console.log(`混淆完成: ${filePath}`);
}

// 主函数
function main() {
  const targetDirectory = process.argv[2]; // 从命令行参数获取目标目录
  if (!targetDirectory) {
    console.error('请指定目标目录');
    process.exit(1);
  }

  if (!fs.existsSync(targetDirectory)) {
    console.error('指定的目录不存在');
    process.exit(1);
  }

  console.log(`开始混淆目录: ${targetDirectory}`);
  processDirectory(targetDirectory);
  console.log('所有文件混淆完成！');
}

// 执行主函数
main();