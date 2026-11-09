var test = require('node:test');
var assert = require('node:assert/strict');
var once = require('node:events').once;
var crypto = require('node:crypto');
var pool = require('../db');
var roulette = require('../roulette');
var evaluateBet = roulette.evaluateBet;

var savedRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  selected_bet: 'red',
  stake_credits: 37,
  result_number: 0,
  created_at: new Date('2026-11-09T04:00:00.000Z')
};

// These guards stay active between per-test mocks and prevent real database access.
test.mock.method(pool, 'connect', function() {
  throw new Error('Real PostgreSQL connections are disabled in API tests.');
});
test.mock.method(pool, 'query', function() {
  throw new Error('This API test must mock pool.query.');
});
test.mock.method(crypto, 'randomInt', function() {
  return 0;
});
test.mock.method(crypto, 'randomUUID', function() {
  return savedRecord.id;
});

var app = require('../app');
var server;
var baseUrl;

test.before(async function() {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = 'http://127.0.0.1:' + server.address().port;
});

test.after(async function() {
  try {
    if (server && server.listening) {
      await new Promise(function(resolve, reject) {
        server.close(function(error) {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
        server.closeAllConnections();
      });
    }
  } finally {
    test.mock.restoreAll();
    await pool.end();
  }
});

async function requestJson(path, options) {
  var response = await fetch(baseUrl + path, Object.assign({
    signal: AbortSignal.timeout(5000)
  }, options));
  assert.match(response.headers.get('content-type') || '', /^application\/json\b/);
  return { status: response.status, body: await response.json() };
}

function assertExperimentResponse(actual, record) {
  var expected = Object.assign(
    { id: record.id },
    evaluateBet(record.selected_bet, record.stake_credits, record.result_number),
    { createdAt: record.created_at.toISOString() }
  );
  var fractionalFields = ['winProbability', 'lossProbability', 'expectedNetReturnCredits'];
  assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort());
  Object.keys(expected).forEach(function(field) {
    if (fractionalFields.includes(field)) {
      assert.ok(Math.abs(actual[field] - expected[field]) < 1e-12, field);
    } else {
      assert.equal(actual[field], expected[field], field);
    }
  });
}

test('preserves the existing homepage', async function() {
  var response = await fetch(baseUrl + '/', { signal: AbortSignal.timeout(5000) });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Welcome to Express/);
});

test('health checks the required table and accepts an empty table', async function(t) {
  var query = t.mock.method(pool, 'query', async function() {
    return { rows: [] };
  });
  var spin = t.mock.method(roulette, 'spinRoulette');
  var response = await requestJson('/health');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: 'ok' });
  assert.equal(query.mock.callCount(), 1);
  assert.match(query.mock.calls[0].arguments[0], /SELECT id, selected_bet, stake_credits, result_number, created_at/);
  assert.match(query.mock.calls[0].arguments[0], /FROM public\.experiments LIMIT 0$/);
  assert.equal(spin.mock.callCount(), 0);
});

test('health failures return safe JSON for normal and case-insensitive paths', async function(t) {
  t.mock.method(pool, 'query', async function() {
    throw Object.assign(new Error('Internal database details'), { code: 'ECONNREFUSED' });
  });
  for (var path of ['/health', '/HEALTH/']) {
    var response = await requestJson(path);
    assert.equal(response.status, 503);
    assert.deepEqual(response.body, { error: 'Database unavailable.' });
  }
});

test('history returns an empty experiments array', async function(t) {
  t.mock.method(pool, 'query', async function() {
    return { rows: [] };
  });
  var response = await requestJson('/api/experiments');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { experiments: [] });
});

test('history maps saved rows through evaluateBet without spinning', async function(t) {
  var records = [savedRecord, Object.assign({}, savedRecord, {
    id: '22222222-2222-4222-8222-222222222222', selected_bet: 'black',
    stake_credits: 1000, result_number: 2
  })];
  t.mock.method(pool, 'query', async function() {
    return { rows: records };
  });
  var evaluate = t.mock.method(roulette, 'evaluateBet');
  var spin = t.mock.method(roulette, 'spinRoulette');
  var response = await requestJson('/api/experiments');
  assert.equal(response.status, 200);
  assert.equal(response.body.experiments.length, records.length);
  records.forEach(function(record, index) {
    assertExperimentResponse(response.body.experiments[index], record);
    assert.deepEqual(evaluate.mock.calls[index].arguments, [
      record.selected_bet, record.stake_credits, record.result_number
    ]);
  });
  assert.equal(evaluate.mock.callCount(), records.length);
  assert.equal(spin.mock.callCount(), 0);
});

test('history uses newest-first SQL with the ID tie-breaker and a fixed limit of 20', async function(t) {
  var records = Array.from({ length: 20 }, function(value, index) {
    return Object.assign({}, savedRecord, {
      id: '00000000-0000-4000-8000-' + String(20 - index).padStart(12, '0'),
      created_at: new Date(index < 10 ? '2026-11-09T04:00:00Z' : '2026-11-08T04:00:00Z')
    });
  });
  var query = t.mock.method(pool, 'query', async function() {
    return { rows: records };
  });
  var response = await requestJson('/api/experiments?limit=1000');
  assert.equal(response.status, 200);
  assert.equal(response.body.experiments.length, 20);
  assert.deepEqual(response.body.experiments.map(function(record) { return record.id; }),
    records.map(function(record) { return record.id; }));
  assert.equal(query.mock.callCount(), 1);
  assert.match(query.mock.calls[0].arguments[0], /ORDER BY created_at DESC, id DESC LIMIT 20$/);
});

test('history reports database connection, readiness and driver timeout failures as 503', async function(t) {
  var failure;
  t.mock.method(pool, 'query', async function() {
    throw failure;
  });
  var failures = [
    { code: 'ECONNREFUSED' }, { code: '08006' }, { code: '28P01' },
    { code: '53300' }, { code: '57P01' }, { code: '42P01' }, { code: '42501' },
    { message: 'Query read timeout' },
    { message: 'Connection terminated due to connection timeout' },
    { message: 'timeout exceeded when trying to connect' },
    { message: 'Connection terminated unexpectedly' }
  ];
  for (var details of failures) {
    failure = Object.assign(new Error('Internal database details'), details);
    var response = await requestJson('/api/experiments');
    assert.equal(response.status, 503, failure.code || failure.message);
    assert.deepEqual(response.body, { error: 'Database unavailable.' });
  }
});

test('unexpected history errors return 500 without internal details', async function(t) {
  t.mock.method(pool, 'query', async function() {
    throw Object.assign(new Error('Internal SQL details'), { code: '42601' });
  });
  var response = await requestJson('/api/experiments');
  assert.equal(response.status, 500);
  assert.deepEqual(response.body, { error: 'Internal server error.' });
});

[
  { selectedBet: 'red', stakeCredits: 1 },
  { selectedBet: 'red', stakeCredits: 1000 },
  { selectedBet: 'black', stakeCredits: 1 },
  { selectedBet: 'black', stakeCredits: 1000 }
].forEach(function(input) {
  test('POST spins and inserts once for ' + input.selectedBet + ' at ' + input.stakeCredits + ' credits', async function(t) {
    var record = Object.assign({}, savedRecord, {
      selected_bet: input.selectedBet, stake_credits: input.stakeCredits
    });
    var query = t.mock.method(pool, 'query', async function() {
      return { rows: [record] };
    });
    var spin = t.mock.method(roulette, 'spinRoulette');
    var createId = t.mock.method(crypto, 'randomUUID');
    var response = await requestJson('/api/experiments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input)
    });
    assert.equal(response.status, 201);
    assertExperimentResponse(response.body, record);
    assert.equal(spin.mock.callCount(), 1);
    assert.deepEqual(spin.mock.calls[0].arguments, [input.selectedBet, input.stakeCredits]);
    assert.equal(createId.mock.callCount(), 1);
    assert.equal(query.mock.callCount(), 1);
    assert.match(query.mock.calls[0].arguments[0], /^INSERT INTO public\.experiments /);
    assert.match(query.mock.calls[0].arguments[0], /VALUES \(\$1, \$2, \$3, \$4\) RETURNING /);
    assert.deepEqual(query.mock.calls[0].arguments[1], [record.id, input.selectedBet, input.stakeCredits, 0]);
  });
});

test('POST builds its response from the row returned by PostgreSQL', async function(t) {
  var returnedRecord = Object.assign({}, savedRecord, {
    id: '33333333-3333-4333-8333-333333333333', result_number: 1
  });
  t.mock.method(pool, 'query', async function() {
    return { rows: [returnedRecord] };
  });
  var response = await requestJson('/api/experiments', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ selectedBet: 'red', stakeCredits: 37 })
  });
  assert.equal(response.status, 201);
  assertExperimentResponse(response.body, returnedRecord);
});

test('invalid JSON objects and values never invoke spin or database insert', async function(t) {
  var query = t.mock.method(pool, 'query', async function() {
    throw new Error('Invalid input must not query PostgreSQL.');
  });
  var spin = t.mock.method(roulette, 'spinRoulette');
  var invalidBodies = [
    null, [], 'red', 37, {}, { selectedBet: 'red' }, { stakeCredits: 37 },
    { selectedBet: 'red', stakeCredits: 37, resultNumber: 1 },
    { selectedBet: 'red', stakeCredits: 37, id: savedRecord.id },
    { selectedBet: 'green', stakeCredits: 37 }, { selectedBet: 'Red', stakeCredits: 37 },
    { selectedBet: null, stakeCredits: 37 }, { selectedBet: ' red', stakeCredits: 37 },
    { selectedBet: 'red', stakeCredits: '37' }, { selectedBet: 'red', stakeCredits: null },
    { selectedBet: 'red', stakeCredits: true }, { selectedBet: 'red', stakeCredits: 0 },
    { selectedBet: 'red', stakeCredits: -1 }, { selectedBet: 'red', stakeCredits: 1.5 },
    { selectedBet: 'red', stakeCredits: 1001 }
  ];
  for (var body of invalidBodies) {
    var response = await requestJson('/api/experiments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.equal(typeof response.body.error, 'string');
  }
  assert.equal(spin.mock.callCount(), 0);
  assert.equal(query.mock.callCount(), 0);
});

test('malformed JSON returns a safe 400 without spin or insert', async function(t) {
  var query = t.mock.method(pool, 'query');
  var spin = t.mock.method(roulette, 'spinRoulette');
  var response = await requestJson('/api/experiments', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"selectedBet":'
  });
  assert.equal(response.status, 400);
  assert.deepEqual(response.body, { error: 'Invalid JSON body.' });
  assert.equal(spin.mock.callCount(), 0);
  assert.equal(query.mock.callCount(), 0);
});

test('unsupported or missing POST media types return 415 without spin or insert', async function(t) {
  var query = t.mock.method(pool, 'query');
  var spin = t.mock.method(roulette, 'spinRoulette');
  for (var headers of [
    { 'Content-Type': 'text/plain' }, {}, { 'Content-Type': 'application/json; charset=iso-8859-1' }
  ]) {
    var response = await requestJson('/api/experiments', {
      method: 'POST', headers: headers,
      body: Buffer.from(JSON.stringify({ selectedBet: 'red', stakeCredits: 37 }))
    });
    assert.equal(response.status, 415);
    assert.equal(typeof response.body.error, 'string');
  }
  assert.equal(spin.mock.callCount(), 0);
  assert.equal(query.mock.callCount(), 0);
});

test('oversized JSON returns 413 without spin or insert', async function(t) {
  var query = t.mock.method(pool, 'query');
  var spin = t.mock.method(roulette, 'spinRoulette');
  var response = await requestJson('/api/experiments', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ selectedBet: 'x'.repeat(101 * 1024), stakeCredits: 37 })
  });
  assert.equal(response.status, 413);
  assert.deepEqual(response.body, { error: 'JSON body is too large.' });
  assert.equal(spin.mock.callCount(), 0);
  assert.equal(query.mock.callCount(), 0);
});

[
  { code: 'ECONNREFUSED', status: 503, message: 'Database unavailable.' },
  { code: '42601', status: 500, message: 'Internal server error.' }
].forEach(function(failure) {
  test('POST handles database error ' + failure.code + ' without returning 201', async function(t) {
    var query = t.mock.method(pool, 'query', async function() {
      throw Object.assign(new Error('Internal database details'), { code: failure.code });
    });
    var spin = t.mock.method(roulette, 'spinRoulette');
    var response = await requestJson('/api/experiments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectedBet: 'black', stakeCredits: 37 })
    });
    assert.equal(response.status, failure.status);
    assert.deepEqual(response.body, { error: failure.message });
    assert.equal(spin.mock.callCount(), 1);
    assert.equal(query.mock.callCount(), 1);
  });
});

test('unexpected spin failures return 500 without an insert or retry', async function(t) {
  var query = t.mock.method(pool, 'query');
  var spin = t.mock.method(roulette, 'spinRoulette', function() {
    throw new Error('Internal spin details');
  });
  var response = await requestJson('/api/experiments', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ selectedBet: 'red', stakeCredits: 37 })
  });
  assert.equal(response.status, 500);
  assert.deepEqual(response.body, { error: 'Internal server error.' });
  assert.equal(spin.mock.callCount(), 1);
  assert.equal(query.mock.callCount(), 0);
});

test('unknown API routes return JSON 404 responses', async function() {
  var response = await requestJson('/API/EXPERIMENTS/missing');
  assert.equal(response.status, 404);
  assert.deepEqual(response.body, { error: 'Not found.' });
});
