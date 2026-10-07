const crypto = require('crypto');

// Random secret that proves "this phone confirmed this participant's name".
function newToken() {
  return crypto.randomBytes(24).toString('hex');
}

module.exports = { newToken };
