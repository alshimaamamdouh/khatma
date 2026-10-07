const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongod;
let server;
let baseUrl;

// Starts an in-memory MongoDB and the API on a random port. Never touches a real database.
async function start() {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  const app = require('../index');
  await new Promise(resolve => { server = app.listen(0, resolve); });
  baseUrl = `http://localhost:${server.address().port}/api`;
}

async function stop() {
  await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  await mongod.stop();
}

async function call(method, path, { body, headers = {} } = {}) {
  const res = await fetch(baseUrl + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function createKhatma(overrides = {}) {
  const body = {
    name: 'ختمة تجربة',
    accessCode: 'code' + Math.random().toString(36).slice(2, 10),
    adminPassword: 'secret-pass',
    startDate: '2026-01-04',
    rotationType: 'weekly',
    ...overrides
  };
  const res = await call('POST', '/khatma', { body });
  return { id: res.data.id, code: body.accessCode, password: body.adminPassword, res };
}

module.exports = { start, stop, call, createKhatma };
