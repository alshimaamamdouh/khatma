const { initDB } = require('../server/db/init');
const app = require('../server/index');

let initialized = false;

module.exports = async (req, res) => {
  if (!initialized) {
    await initDB();
    initialized = true;
  }
  return app(req, res);
};
