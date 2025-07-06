const fs = require('fs-extra');
const path = require('path');

async function walkDir(dir) {
    let results = [];
    const list = await fs.readdir(dir);

    for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = await fs.stat(fullPath);

        if (stat.isDirectory()) {
            results = results.concat(await walkDir(fullPath));
        } else {
            results.push(fullPath);
        }
    }

    return results;
}

module.exports = {
    walkDir
};