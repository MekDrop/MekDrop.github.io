const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

/**
 * @param {string} root
 * @param {string[]} files
 * @returns {string}
 */
function sourceStamp(root, files) {
  const hash = createHash("sha256");
  for (const file of [...files].sort()) {
    hash.update(file);
    hash.update(readFileSync(resolve(root, file)));
  }

  return hash.digest("hex");
}

module.exports = { sourceStamp };
