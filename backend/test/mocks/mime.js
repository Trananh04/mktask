const mimeTypes = require('mime-types');

module.exports = {
  define() {
    return undefined;
  },
  getType(path) {
    return mimeTypes.lookup(path) || null;
  },
  getExtension(type) {
    return mimeTypes.extension(type) || null;
  },
};
