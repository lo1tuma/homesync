'use strict';

var fs = require('fs'),
    path = require('path'),
    Promise = require('bluebird'),
    homedir = require('homedir'),
    ignore = require('ignore'),
    ignoreFileName = '.homesyncignore';

Promise.promisifyAll(fs);

function filterIgnores(folderToSync, paths) {
    return ignore()
        .addIgnoreFile(path.join(folderToSync, ignoreFileName))
        .addIgnoreFile(path.join(folderToSync, '.gitignore'))
        .filter(paths);
}

function resolveFullPaths(folderToSync, paths) {
    return paths.map(function (sourcePath) {
        return path.resolve(folderToSync, sourcePath);
    });
}

function getPathType(stats) {
    if (stats.isDirectory()) {
        return 'dir';
    }
    return 'file';
}

function removeSymlink(targetPath, stats) {
    if (!stats.isSymbolicLink()) {
        throw new Error(targetPath + ' already exists and is not a symlink');
    }

    return fs.unlinkAsync(targetPath);
}

function clearExistingSymlink(targetPath) {
    return fs.existsAsync(targetPath)
        .catch(function () {
            return fs.lstatAsync(targetPath)
                .then(removeSymlink.bind(null, targetPath));
        });
}

function syncPath(targetFolder, sourcePath) {
    var base = path.basename(sourcePath),
        targetPath = path.join(targetFolder, base),
        createSymlink = fs.symlinkAsync.bind(fs, sourcePath, targetPath);

    return fs.lstatAsync(sourcePath)
        .tap(clearExistingSymlink.bind(null, targetPath))
        .then(getPathType)
        .then(createSymlink);
}

function syncPaths(paths) {
    var targetFolder = homedir(),
        promises = paths.map(syncPath.bind(null, targetFolder));

    return Promise.all(promises);
}

module.exports = function homesync(folder) {
    var folderToSync = path.resolve(process.cwd(), folder);

    return fs.readdirAsync(folderToSync)
        .then(filterIgnores.bind(null, folderToSync))
        .then(resolveFullPaths.bind(null, folderToSync))
        .then(syncPaths);
};
