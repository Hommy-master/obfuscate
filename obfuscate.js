const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');
const { parse } = require('node-html-parser');
const css = require('css');

// 增强混淆配置
const obfuscationOptions = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 1,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,
  debugProtection: true,
  debugProtectionInterval: 4000,
  disableConsoleOutput: true,
  identifierNamesGenerator: 'hexadecimal',
  identifiersPrefix: 'obf_',
  log: false,
  numbersToExpressions: true,
  renameGlobals: true,
  selfDefending: true,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 5,
  stringArray: true,
  stringArrayEncoding: ['rc4'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 5,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 5,
  stringArrayWrappersType: 'function',
  stringArrayThreshold: 1,
  transformObjectKeys: true,
  unicodeEscapeSequence: true
};

// 全局映射表用于CSS类名/ID混淆
const cssMappings = new Map();

// 生成随机标识符
function generateRandomIdentifier(length = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '_';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 混淆CSS内容
function obfuscateCss(cssContent) {
  try {
    const ast = css.parse(cssContent);
    
    // 混淆选择器
    const processSelectors = (selectors) => {
      return selectors.split(/\s*,\s*/).map(selectorGroup => {
        return selectorGroup.split(/(?=[>\s+~.:[#])/).map(part => {
          return part.replace(/([.#])([\w-]+)/g, (match, prefix, name) => {
            if (!cssMappings.has(name)) {
              cssMappings.set(name, generateRandomIdentifier());
            }
            return prefix + cssMappings.get(name);
          });
        }).join('');
      }).join(',');
    };
    
    // 遍历所有规则
    ast.stylesheet.rules.forEach(rule => {
      if (rule.type === 'rule') {
        rule.selectors = rule.selectors.map(processSelectors);
      }
      
      // 混淆声明值中的关键字符串
      if (rule.declarations) {
        rule.declarations.forEach(decl => {
          if (decl.type === 'declaration') {
            // 混淆URL中的文件名
            if (decl.value.includes('url(')) {
              decl.value = decl.value.replace(/url\((['"]?)(.*?)\1\)/gi, (match, quote, url) => {
                const ext = path.extname(url);
                const base = path.basename(url, ext);
                const dir = path.dirname(url);
                const obfBase = Buffer.from(base).toString('base64').replace(/=/g, '');
                return `url(${quote}${dir ? dir + '/' : ''}${obfBase}${ext}${quote})`;
              });
            }
            
            // 混淆关键字符串
            decl.value = decl.value.replace(/\b[a-z]+\b/gi, word => {
              if (word.length > 3 && Math.random() > 0.7) {
                return Buffer.from(word).toString('base64').replace(/=/g, '');
              }
              return word;
            });
          }
        });
      }
    });
    
    // 生成混淆后的CSS
    let output = css.stringify(ast, { compress: true });
    
    // 进一步压缩和混淆
    output = output
      .replace(/\s*([{}:;,])\s*/g, '$1')
      .replace(/\/\*.*?\*\//g, '')
      .replace(/#[0-9a-f]{3,6}/gi, match => {
        // 简化颜色代码
        if (match.length === 7 && match[1] === match[2] && match[3] === match[4] && match[5] === match[6]) {
          return '#' + match[1] + match[3] + match[5];
        }
        return match;
      });
    
    return output;
  } catch (e) {
    console.error(`CSS解析失败，使用压缩代替: ${e.message}`);
    return cssContent
      .replace(/\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gm, '$1')
      .replace(/\s+/g, ' ')
      .replace(/\s*([{}:;,])\s*/g, '$1')
      .trim();
  }
}

// 混淆HTML内容
function obfuscateHtml(htmlContent) {
  const root = parse(htmlContent);
  
  // 混淆脚本内容
  root.querySelectorAll('script').forEach(scriptNode => {
    if (scriptNode.childNodes.length > 0) {
      const child = scriptNode.childNodes[0];
      if (child && child.rawText) {
        try {
          const obfuscatedCode = JavaScriptObfuscator.obfuscate(
            child.rawText, 
            obfuscationOptions
          ).getObfuscatedCode();
          scriptNode.set_content(obfuscatedCode);
        } catch (e) {
          console.error(`脚本混淆失败: ${e.message}`);
        }
      }
    }
  });
  
  // 混淆内联事件处理程序
  root.querySelectorAll('*').forEach(element => {
    Object.keys(element.attributes).forEach(attr => {
      if (attr.startsWith('on') && element.attributes[attr]) {
        try {
          const obfuscatedCode = JavaScriptObfuscator.obfuscate(
            `(function(){${element.attributes[attr]}})`,
            obfuscationOptions
          ).getObfuscatedCode();
          
          element.setAttribute(attr, obfuscatedCode.replace(/\s+/g, ''));
        } catch (e) {
          console.error(`事件属性混淆失败: ${e.message}`);
        }
      }
    });
  });
  
  // 混淆CSS类名和ID
  root.querySelectorAll('*').forEach(element => {
    // 混淆类名
    if (element.attributes.class) {
      const classes = element.attributes.class.split(/\s+/).map(c => {
        if (!cssMappings.has(c)) {
          cssMappings.set(c, generateRandomIdentifier());
        }
        return cssMappings.get(c);
      }).join(' ');
      element.setAttribute('class', classes);
    }
    
    // 混淆ID
    if (element.attributes.id) {
      const id = element.attributes.id;
      if (!cssMappings.has(id)) {
        cssMappings.set(id, generateRandomIdentifier());
      }
      element.setAttribute('id', cssMappings.get(id));
    }
  });
  
  // 混淆样式标签
  root.querySelectorAll('style').forEach(styleNode => {
    if (styleNode.childNodes.length > 0) {
      const child = styleNode.childNodes[0];
      if (child && child.rawText) {
        try {
          styleNode.set_content(obfuscateCss(child.rawText));
        } catch (e) {
          console.error(`样式混淆失败: ${e.message}`);
        }
      }
    }
  });
  
  // 混淆内联样式
  root.querySelectorAll('[style]').forEach(element => {
    try {
      const styleValue = element.getAttribute('style');
      const obfuscatedStyle = obfuscateCss(`*{${styleValue}}`)
        .replace(/^\*\{|}$/g, '')
        .trim();
      element.setAttribute('style', obfuscatedStyle);
    } catch (e) {
      console.error(`内联样式混淆失败: ${e.message}`);
    }
  });
  
  // 混淆文本节点
  const textNodes = [];
  const walk = node => {
    if (node.nodeType === 3 && node.parentNode) { // 文本节点
      const parentTag = node.parentNode.rawTagName;
      if (parentTag && !['script', 'style', 'textarea', 'pre', 'code'].includes(parentTag.toLowerCase())) {
        textNodes.push(node);
      }
    } else if (node.childNodes) {
      node.childNodes.forEach(walk);
    }
  };
  walk(root);
  
  textNodes.forEach(node => {
    const text = node.rawText;
    if (text.trim().length > 0) {
      // 保留首尾空格，只混淆中间内容
      const leadingSpace = text.match(/^\s*/)[0];
      const trailingSpace = text.match(/\s*$/)[0];
      const content = text.trim();
      
      // 对文本进行Base64编码
      const encoded = Buffer.from(content).toString('base64');
      const newText = `${leadingSpace}<span style="display:none">${Math.random().toString(36).substr(2)}</span><script>document.write(atob('${encoded}'))</script>${trailingSpace}`;
      node.replaceWith(newText, { innerHTML: true });
    }
  });
  
  // 混淆属性名
  root.querySelectorAll('*').forEach(element => {
    Object.keys(element.attributes).forEach(attr => {
      if (!['src', 'href', 'class', 'id', 'style'].includes(attr) && 
          !attr.startsWith('on') && 
          attr.length > 3 && 
          Math.random() > 0.3) {
        const newAttr = generateRandomIdentifier(3);
        const value = element.attributes[attr];
        element.removeAttribute(attr);
        element.setAttribute(newAttr, value);
      }
    });
  });
  
  // 混淆HTML标签
  const tagMappings = new Map();
  root.querySelectorAll('*').forEach(element => {
    const tag = element.rawTagName.toLowerCase();
    if (!tagMappings.has(tag)) {
      tagMappings.set(tag, generateRandomIdentifier(3));
    }
    element.rawTagName = tagMappings.get(tag);
    element.rawAttrs = element.rawAttrs || '';
  });
  
  return root.toString();
}

// 混淆文件内容
function obfuscateFile(filePath, content) {
  const ext = path.extname(filePath).toLowerCase();
  
  switch (ext) {
    case '.js':
      return JavaScriptObfuscator.obfuscate(content, obfuscationOptions).getObfuscatedCode();
    
    case '.html':
      return obfuscateHtml(content);
    
    case '.css':
      return obfuscateCss(content);
    
    default:
      return content;
  }
}

// 递归处理目录
function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stats = fs.statSync(filePath);
    
    if (stats.isDirectory()) {
      processDirectory(filePath);
    } else {
      try {
        const sourceCode = fs.readFileSync(filePath, 'utf8');
        const obfuscatedCode = obfuscateFile(filePath, sourceCode);
        
        fs.writeFileSync(filePath, obfuscatedCode, 'utf8');
        console.log(`混淆完成: ${filePath}`);
      } catch (e) {
        console.error(`处理文件失败 ${filePath}: ${e.message}`);
      }
    }
  });
}

// 主函数
function main() {
  const targetDirectory = process.argv[2];
  if (!targetDirectory) {
    console.error('请指定目标目录');
    process.exit(1);
  }
  
  if (!fs.existsSync(targetDirectory)) {
    console.error('指定的目录不存在');
    process.exit(1);
  }
  
  console.log(`开始混淆目录: ${targetDirectory}`);
  
  // 重置全局映射
  cssMappings.clear();
  
  // 处理目录
  processDirectory(targetDirectory);
  
  console.log('所有文件混淆完成！');
}

// 执行
main();