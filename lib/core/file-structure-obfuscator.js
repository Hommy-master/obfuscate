const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

class FileStructureObfuscator {
  constructor(mappingManager) {
    this.mappingManager = mappingManager;
    this.preservedDirectories = new Set([
      'node_modules', '.git', '.vscode', '.idea', 
      'dist', 'build', 'coverage', 'test', 'tests',
      '.svn', '.hg', 'vendor', 'packages'
    ]);
    
    this.preservedFiles = new Set([
      'package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
      '.gitignore', '.gitattributes', 'README.md', 'LICENSE', 'CHANGELOG.md',
      'tsconfig.json', 'webpack.config.js', 'vite.config.js', 'rollup.config.js'
    ]);
  }

  async process(projectPath) {
    try {
      console.log('🔄 开始静态资源随机化处理...');
      
      // 扫描项目结构
      const structure = await this.scanProjectStructure(projectPath);
      console.log(`📁 扫描到 ${structure.directories.length} 个目录, ${structure.files.length} 个文件`);
      
      // 生成新的目录结构
      const newStructure = this.generateObfuscatedStructure(structure);
      console.log(`🎲 生成 ${newStructure.newDirectories.length} 个新目录`);
      
      // 执行文件移动
      await this.reorganizeFiles(projectPath, newStructure);
      
      // 更新所有文件中的路径引用
      await this.updatePathReferences(projectPath);

      console.log('✅ 静态资源随机化处理完成');
      return {
        success: true,
        originalStructure: structure,
        newStructure: newStructure
      };
    } catch (error) {
      console.error('❌ 文件结构混淆失败:', error.message);
      throw new Error(`文件结构混淆失败: ${error.message}`);
    }
  }

  async scanProjectStructure(projectPath) {
    const structure = {
      directories: [],
      files: []
    };

    const scanDirectory = async (dirPath, relativePath = '') => {
      const items = await fs.readdir(dirPath);
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const relativeItemPath = path.join(relativePath, item);
        const stat = await fs.stat(fullPath);

        if (stat.isDirectory()) {
          // 跳过保留的目录
          if (this.preservedDirectories.has(item) || item.startsWith('.')) {
            continue;
          }

          structure.directories.push({
            name: item,
            path: relativeItemPath,
            fullPath: fullPath
          });

          // 递归扫描子目录
          await scanDirectory(fullPath, relativeItemPath);
        } else {
          // 跳过保留的文件
          if (this.preservedFiles.has(item) || item.startsWith('.')) {
            continue;
          }

          structure.files.push({
            name: item,
            path: relativeItemPath,
            fullPath: fullPath,
            directory: relativePath
          });
        }
      }
    };

    await scanDirectory(projectPath);
    return structure;
  }

  generateObfuscatedStructure(originalStructure) {
    const newStructure = {
      directoryMapping: new Map(),
      fileMapping: new Map(),
      newDirectories: []
    };

    // 生成扁平化的随机目录结构
    const maxDepth = 3;
    const dirCount = Math.min(10, Math.max(3, Math.floor(originalStructure.directories.length / 2)));

    // 创建随机目录名
    for (let i = 0; i < dirCount; i++) {
      const depth = Math.floor(Math.random() * maxDepth) + 1;
      const dirPath = this.generateRandomDirectoryPath(depth);
      newStructure.newDirectories.push(dirPath);
    }

    // 如果没有生成足够的目录，添加一些默认目录
    if (newStructure.newDirectories.length === 0) {
      newStructure.newDirectories.push(
        this.generateRandomString(8),
        path.join(this.generateRandomString(6), this.generateRandomString(8)),
        path.join(this.generateRandomString(5), this.generateRandomString(7), this.generateRandomString(6))
      );
    }

    // 将原始目录映射到新目录
    const shuffledOriginalDirs = this.shuffleArray([...originalStructure.directories]);
    shuffledOriginalDirs.forEach((dir, index) => {
      const targetDirIndex = index % newStructure.newDirectories.length;
      const targetDir = newStructure.newDirectories[targetDirIndex];
      newStructure.directoryMapping.set(dir.path, targetDir);
    });

    // 分离需要保持在根目录的文件和需要移动的文件
    const filesToMove = [];
    const preservedFiles = [];
    
    originalStructure.files.forEach(file => {
      // 检查是否为需要保持在根目录的文件
      if (file.name.toLowerCase() === 'index.html' && file.directory === '') {
        preservedFiles.push(file);
        console.log(`🔒 保持文件在根目录: ${file.name}`);
      } else if (this.isImportantFile(file.name)) {
        preservedFiles.push(file);
        console.log(`🔒 保持重要文件: ${file.name}`);
      } else {
        filesToMove.push(file);
      }
    });

    // 随机分配需要移动的文件到新目录
    const shuffledFiles = this.shuffleArray([...filesToMove]);
    shuffledFiles.forEach((file, index) => {
      const targetDirIndex = index % newStructure.newDirectories.length;
      const targetDir = newStructure.newDirectories[targetDirIndex];
      
      // 生成新文件名（可选）
      const newFileName = this.shouldRenameFile(file.name) 
        ? this.generateObfuscatedFileName(file.name, path.extname(file.name))
        : file.name;
      
      const newFilePath = path.join(targetDir, newFileName);
      
      newStructure.fileMapping.set(file.path, newFilePath);
    });

    // 保持在根目录的文件不添加到映射中，这样它们就不会被移动
    preservedFiles.forEach(file => {
      console.log(`⏭️ 跳过移动文件: ${file.path} (保持在根目录)`);
    });

    return newStructure;
  }

  async reorganizeFiles(projectPath, newStructure) {
    // 创建新目录
    for (const newDir of newStructure.newDirectories) {
      const fullDirPath = path.join(projectPath, newDir);
      await fs.ensureDir(fullDirPath);
      console.log(`📁 创建目录: ${newDir}`);
    }

    // 移动文件
    for (const [originalPath, newPath] of newStructure.fileMapping) {
      const sourceFullPath = path.join(projectPath, originalPath);
      const targetFullPath = path.join(projectPath, newPath);

      try {
        // 检查目标文件是否存在
        const targetExists = await fs.pathExists(targetFullPath);
        if (targetExists) {
          // 如果是系统文件，先删除目标文件
          const fileName = path.basename(originalPath);
          if (fileName === '.DS_Store' || fileName.startsWith('.')) {
            await fs.remove(targetFullPath);
          } else {
            console.warn(`⚠️ 目标文件已存在，跳过移动: ${originalPath} -> ${newPath}`);
            continue;
          }
        }

        await fs.move(sourceFullPath, targetFullPath);
        console.log(`📝 移动文件: ${originalPath} -> ${newPath}`);
        
        // 记录映射关系 - 使用相对路径
        const relativeOriginalPath = originalPath.replace(/\\/g, '/');
        const relativeNewPath = newPath.replace(/\\/g, '/');
        this.mappingManager.addFile(relativeOriginalPath, relativeNewPath);
      } catch (error) {
        console.warn(`❌ 文件移动失败 ${originalPath} -> ${newPath}:`, error.message);
      }
    }

    // 清理空的原始目录
    await this.cleanEmptyDirectories(projectPath);
  }

  async updatePathReferences(projectPath) {
    try {
      console.log('🔄 开始统一更新文件引用...');
      
      // 获取所有HTML、CSS、JS文件
      const htmlFiles = await this.findFiles(projectPath, /\.(html|htm)$/i);
      const cssFiles = await this.findFiles(projectPath, /\.css$/i);
      const jsFiles = await this.findFiles(projectPath, /\.js$/i);
      
      const allFiles = [...htmlFiles, ...cssFiles, ...jsFiles];
      console.log(`📄 找到 ${htmlFiles.length} 个HTML文件，${cssFiles.length} 个CSS文件，${jsFiles.length} 个JS文件`);
      
      // 获取文件映射
      const allMappings = this.mappingManager.getAllMappings();
      
      if (!allMappings.files || Object.keys(allMappings.files).length === 0) {
        console.log('📭 无文件映射需要更新');
        return;
      }
      
      // 更新每个文件中的路径引用
      for (const filePath of allFiles) {
        await this.updateFilePathReferences(filePath, allMappings, projectPath);
      }
      
      console.log('✅ 所有文件引用更新完成');
    } catch (error) {
      console.warn('❌ 更新路径引用失败:', error.message);
    }
  }

  async updateFilePathReferences(filePath, allMappings, projectPath) {
    try {
      let content = await fs.readFile(filePath, 'utf8');
      let updated = false;
      
      // 更新文件路径引用
      if (allMappings.files && Object.keys(allMappings.files).length > 0) {
        for (const [originalPath, newPath] of Object.entries(allMappings.files)) {
          const escapedOriginalPath = this.escapeRegExp(originalPath);
          
          // 1. HTML 属性中的路径 (src, href, data-src 等)
          const htmlAttrPattern = new RegExp(`((?:src|href|data-src|data-href)\\s*=\\s*["'])([^"']*?)${escapedOriginalPath}(["'])`, 'gi');
          const newContent1 = content.replace(htmlAttrPattern, (match, prefix, pathPrefix, suffix) => {
            return `${prefix}${pathPrefix}${newPath}${suffix}`;
          });
          if (newContent1 !== content) {
            content = newContent1;
            updated = true;
          }
          
          // 2. CSS 中的 url() 
          const cssUrlPattern = new RegExp(`(url\\s*\\(\\s*["']?)([^"']*?)${escapedOriginalPath}(["']?\\s*\\))`, 'gi');
          const newContent2 = content.replace(cssUrlPattern, (match, prefix, pathPrefix, suffix) => {
            return `${prefix}${pathPrefix}${newPath}${suffix}`;
          });
          if (newContent2 !== content) {
            content = newContent2;
            updated = true;
          }
          
          // 3. JavaScript import/require 语句
          const jsImportPattern = new RegExp(`((?:import|require)\\s*\\(\\s*["'])([^"']*?)${escapedOriginalPath}(["']\\s*\\))`, 'gi');
          const newContent3 = content.replace(jsImportPattern, (match, prefix, pathPrefix, suffix) => {
            return `${prefix}${pathPrefix}${newPath}${suffix}`;
          });
          if (newContent3 !== content) {
            content = newContent3;
            updated = true;
          }
          
          // 4. ES6 import 语句
          const es6ImportPattern = new RegExp(`(import\\s+[^"']*?["'])([^"']*?)${escapedOriginalPath}(["'])`, 'gi');
          const newContent4 = content.replace(es6ImportPattern, (match, prefix, pathPrefix, suffix) => {
            return `${prefix}${pathPrefix}${newPath}${suffix}`;
          });
          if (newContent4 !== content) {
            content = newContent4;
            updated = true;
          }
        }
      }
      
      // 更新ID引用（针对JavaScript文件）
      if (path.extname(filePath) === '.js' && allMappings.ids && Object.keys(allMappings.ids).length > 0) {
        for (const [originalId, newId] of Object.entries(allMappings.ids)) {
          // 匹配各种ID选择器格式
          const patterns = [
            // jQuery选择器: $('#id'), $("#id"), $('selector#id')
            new RegExp(`(['"\`])#${this.escapeRegExp(originalId)}\\b`, 'g'),
            // document.getElementById('id')
            new RegExp(`getElementById\\s*\\(\\s*['"\`]${this.escapeRegExp(originalId)}['"\`]\\s*\\)`, 'g'),
            // querySelector('#id')
            new RegExp(`querySelector\\s*\\(\\s*['"\`]#${this.escapeRegExp(originalId)}\\b`, 'g'),
            // querySelectorAll('#id')
            new RegExp(`querySelectorAll\\s*\\(\\s*['"\`]#${this.escapeRegExp(originalId)}\\b`, 'g'),
          ];
          
          for (const pattern of patterns) {
            if (pattern.test(content)) {
              if (pattern.source.includes('getElementById')) {
                content = content.replace(pattern, `getElementById('${newId}')`);
              } else if (pattern.source.includes('querySelector')) {
                content = content.replace(pattern, `querySelector('#${newId}'`);
              } else if (pattern.source.includes('querySelectorAll')) {
                content = content.replace(pattern, `querySelectorAll('#${newId}'`);
              } else {
                // jQuery选择器
                content = content.replace(pattern, `$1#${newId}`);
              }
              updated = true;
              console.log(`✅ 更新JavaScript中的ID引用: ${originalId} -> ${newId}`);
            }
          }
        }
      }
      
      if (updated) {
        await fs.writeFile(filePath, content, 'utf8');
        console.log(`✅ 文件引用更新: ${path.relative(projectPath, filePath)}`);
      }
    } catch (error) {
      console.warn(`❌ 更新文件引用失败 ${filePath}:`, error.message);
    }
  }

  async cleanEmptyDirectories(projectPath) {
    const cleanDirectory = async (dirPath) => {
      try {
        const items = await fs.readdir(dirPath);
        
        // 递归清理子目录
        for (const item of items) {
          const itemPath = path.join(dirPath, item);
          const stat = await fs.stat(itemPath);
          
          if (stat.isDirectory() && !this.preservedDirectories.has(item)) {
            await cleanDirectory(itemPath);
          }
        }

        // 检查目录是否为空
        const updatedItems = await fs.readdir(dirPath);
        if (updatedItems.length === 0 && dirPath !== projectPath) {
          await fs.rmdir(dirPath);
          console.log(`🗑️ 清理空目录: ${path.relative(projectPath, dirPath)}`);
        }
      } catch (error) {
        // 忽略清理失败
      }
    };

    await cleanDirectory(projectPath);
  }

  generateRandomDirectoryPath(depth) {
    const segments = [];
    for (let i = 0; i < depth; i++) {
      segments.push(this.generateRandomDirectoryName());
    }
    return segments.join(path.sep);
  }

  generateRandomDirectoryName() {
    const prefixes = ['app', 'src', 'lib', 'mod', 'core', 'util', 'com', 'data', 'res', 'assets'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = this.generateRandomString(6);
    return `${prefix}_${suffix}`;
  }

  generateObfuscatedFileName(originalName, extension) {
    const baseName = path.basename(originalName, extension);
    
    // 保留重要文件名
    const importantFiles = ['index', 'main', 'app', 'config'];
    if (importantFiles.includes(baseName.toLowerCase())) {
      return originalName;
    }

    // 生成新文件名
    const prefixes = ['file', 'mod', 'comp', 'item', 'data', 'core', 'res', 'asset'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = this.generateRandomString(8);
    
    return `${prefix}_${suffix}${extension}`;
  }

  shouldRenameFile(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    const baseName = path.basename(fileName, ext).toLowerCase();
    
    // 不重命名重要文件
    const importantFiles = ['index', 'main', 'app', 'config'];
    if (importantFiles.includes(baseName)) {
      return false;
    }
    
    // 静态资源文件可以重命名
    const renameableExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf'];
    return renameableExtensions.includes(ext);
  }

  isImportantFile(fileName) {
    const baseName = path.basename(fileName, path.extname(fileName)).toLowerCase();
    const importantFiles = ['index', 'main', 'app', 'config'];
    return importantFiles.includes(baseName);
  }

  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  async findFiles(dirPath, pattern) {
    const files = [];
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);
      
      // 跳过node_modules和隐藏目录
      if (item.name.startsWith('.') || this.preservedDirectories.has(item.name)) {
        continue;
      }
      
      if (item.isDirectory()) {
        const subFiles = await this.findFiles(fullPath, pattern);
        files.push(...subFiles);
      } else if (pattern.test(item.name)) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  generateRandomString(length) {
    return crypto.randomBytes(length).toString('hex').substring(0, length);
  }

  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

module.exports = FileStructureObfuscator; 