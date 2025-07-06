const fs = require('fs-extra');
const path = require('path');

class BackupManager {
    constructor(targetDir) {
        this.targetDir = targetDir;
        const fileName = path.basename(targetDir);
        // 将备份目录放在目标目录的父目录中，避免循环
        this.backupDir = path.join(path.dirname(targetDir), `${fileName}_original_backup`);
        this.workDir = path.join(path.dirname(targetDir), `${fileName}_obfuscation_work`);
    }

    async prepare() {
        // 检查是否已备份
        if (await fs.pathExists(this.backupDir)) {
            // 确保工作目录不存在
            if (await fs.pathExists(this.workDir)) {
                await fs.remove(this.workDir);
            }
            await fs.copy(this.backupDir, this.workDir);
            return { isFirstRun: false };
        }

        // 首次运行创建备份
        await fs.ensureDir(this.backupDir);
        await fs.copy(this.targetDir, this.backupDir);

        // 创建工作目录
        await fs.ensureDir(this.workDir);
        await fs.copy(this.targetDir, this.workDir);

        return { isFirstRun: true };
    }

    async applyResults() {
        // 清空目标目录
        await fs.emptyDir(this.targetDir);
        console.log('清空目标目录原信息完成');
        // 将混淆结果复制回目标目录
        await fs.copy(this.workDir, this.targetDir);
        console.log('将混淆结果复制回目标目录完成');
        // 清理工作目录
        await fs.remove(this.workDir);
        console.log('清理混淆结果备份目录完成');
    }
}

module.exports = BackupManager;