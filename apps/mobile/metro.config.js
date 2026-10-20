const fs = require("fs");
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

// On Windows inside OneDrive or cloud-synced folders, files have the
// FILE_ATTRIBUTE_REPARSE_POINT attribute. Node's `fs.Dirent` on Windows
// treats all reparse points as symlinks (isSymbolicLink() === true, isFile() === false).
// However, OneDrive cloud sync files are not actual symlinks; fs.readlink fails with EINVAL
// and Metro's file map crawler and on-demand fallback fail to index or resolve them.
// We patch Dirent methods on win32 to verify with fs.lstatSync when an entry is flagged as a symlink.
if (process.platform === "win32") {
  const origIsSymbolicLink = fs.Dirent.prototype.isSymbolicLink;
  const origIsFile = fs.Dirent.prototype.isFile;
  const origIsDirectory = fs.Dirent.prototype.isDirectory;

  function getRealStat(dirent) {
    if (dirent._realStat !== undefined) return dirent._realStat;
    try {
      const parent = dirent.parentPath || dirent.path;
      if (parent) {
        dirent._realStat = fs.lstatSync(path.join(parent, dirent.name));
        return dirent._realStat;
      }
    } catch {
      // fallback
    }
    dirent._realStat = null;
    return null;
  }

  fs.Dirent.prototype.isSymbolicLink = function () {
    const isSym = origIsSymbolicLink.call(this);
    if (!isSym) return false;
    const stat = getRealStat(this);
    return stat ? stat.isSymbolicLink() : isSym;
  };

  fs.Dirent.prototype.isFile = function () {
    const isF = origIsFile.call(this);
    if (isF) return true;
    const stat = getRealStat(this);
    return stat ? stat.isFile() : isF;
  };

  fs.Dirent.prototype.isDirectory = function () {
    const isD = origIsDirectory.call(this);
    if (isD) return true;
    const stat = getRealStat(this);
    return stat ? stat.isDirectory() : isD;
  };
}

const config = getDefaultConfig(__dirname);

module.exports = config;