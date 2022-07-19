const fs = require('fs');
const path = require('path');

function isExistingFile(dirpath) {
    return fs.existsSync(dirpath)
}

function isExistingDirectory(dirpath) {
    return fs.existsSync(dirpath) && fs.statSync(dirpath).isDirectory()
}

function isJsFile(filename) {
    return /\.js$/i.test(filename)
}

function parseFilePaths(args) {
    const files = [];

    function addTestsToList(dir) {
        fs.readdirSync(dir).forEach((file) => {
            if (isJsFile(file)) {
                files.push(path.join(dir, file));
            }
        })
    }

    /* If specified - via command-line arg - file(s) or a directory for tests to be found */
    if (args.length > 0) {
        args.forEach((fileOrFolder) => {
            if (isExistingDirectory(fileOrFolder)) {
                addTestsToList(fileOrFolder);
            } else {
                files.push(fileOrFolder);
            }
        })
    }

    /* If files aren't specified as CLI args, check for a 'test/' or 'tests/' directory and look for JS files there */
    if (files.length === 0) {
        if (isExistingDirectory('test')) {
            addTestsToList('test');
        } else if (isExistingDirectory('tests')) {
            addTestsToList('tests');
        }
    }

    return files;
}

module.exports = {
    parseFilePaths,
    isExistingDirectory,
    isExistingFile,
    isJsFile
}
