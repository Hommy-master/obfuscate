const fs = require('fs-extra');
const path = require('path');

const dirMark = '_OBF_DIR';
class BackupManager {
    constructor(targetDir, outputDir = '.', outCount = 1) {
        this.targetDir = targetDir;
        this.outCount = outCount;
        // 如果输出目录是当前目录，则使用目标目录的父目录(避免直接放目标目录造成循序等)；否则使用指定的输出目录
        this.outputDir = outputDir === '.' ? path.dirname(targetDir) : outputDir;
        // 不需要备份了，直接将目标目录内容复制 n 分作文混淆结果目录
        // // 将备份目录放在目标目录的父目录中，避免循环
        // this.backupDir = path.join(dirName, `${fileName}_original_backup`);

        // 创建新副本 混淆结果目录放在指定输出目录且使用目标文件名加上 "_OBF_DIR{i}" 后缀
        const copyPromises = [];
        for (let i = 1; i <= outCount; i++) {
            const workDir = path.join(this.outputDir, `${path.basename(targetDir)}${dirMark}${i}`);
            copyPromises.push(workDir);
        }
        this.workDirs = copyPromises;
    }

    async prepare() {
        // 检测是否有旧的混淆目录，有则删除，且返回是否是第一次运行
        console.log(`开始准备copy文件到所有的混淆目录...`);
        const isFirstRun = await this.deleteDirByPrefix();

        await Promise.all(this.workDirs.map(async (workDir) => {
            // 确保工作目录存在 
            await fs.ensureDir(workDir);
            // 复制目标目录内容到工作目录

            await fs.copy(this.targetDir, workDir);
            console.log(`✅ 已将目标目录内容复制到混淆目录: ${workDir}`);
        }));

        console.log(`✅ 成功copy ${this.outCount} 份混淆目录`);

        return { isFirstRun: !!isFirstRun };
    }

    async deleteDirByPrefix() {
        let isFirstRun = true; // 假设第一次运行
        const outputDir = this.outputDir;
        const baseName = path.basename(this.targetDir);
        try {
            const items = await fs.promises.readdir(outputDir);
            for (const item of items) {
                let itemPath = path.join(outputDir, item);
                const stats = await fs.promises.stat(itemPath);

                if (stats.isDirectory() && item.startsWith(`${baseName}${dirMark}`)) {
                    await fs.promises.rm(path.join(outputDir, item), {
                        recursive: true,
                        force: true
                    });
                    isFirstRun = false; // 如果找到旧副本，则不是第一次运行
                }
            }
            console.log(`✅ 已删除 ${outputDir} 中所有以 "${baseName}${dirMark}" 开头的目录`);
        } catch (err) {
            console.error(`删除目录 ${outputDir} 中目录时出错:`, err.message);
        }
        return isFirstRun;
    }
}

module.exports = BackupManager;