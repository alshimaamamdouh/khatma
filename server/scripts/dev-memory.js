// Runs the API on :3000 against a throwaway in-memory MongoDB. Used by Playwright; never uses a real database.
const { MongoMemoryServer } = require('mongodb-memory-server');

(async () => {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  const app = require('../index');
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Test API (in-memory DB) on http://localhost:${port}`));
})();
