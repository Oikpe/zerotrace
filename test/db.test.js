var test = require('node:test');
var assert = require('node:assert/strict');
var randomUUID = require('node:crypto').randomUUID;
var pool = require('../db');

var insertExperimentSql =
  'INSERT INTO public.experiments (id, selected_bet, stake_credits, result_number) ' +
  'VALUES ($1, $2, $3, $4) ' +
  'RETURNING id, selected_bet, stake_credits, result_number, created_at';

async function beginTestTransaction(t) {
  var client = await pool.connect();
  t.after(async function() {
    try {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });
  await client.query('BEGIN');
  return client;
}

test.after(async function() {
  await pool.end();
});

test('connects to PostgreSQL and verifies the required table schema', async function() {
  var tableResult = await pool.query(
    'SELECT id, selected_bet, stake_credits, result_number, created_at ' +
    'FROM public.experiments LIMIT 0'
  );
  assert.equal(tableResult.rows.length, 0);

  var schemaResult = await pool.query(
    'SELECT column_name, data_type, is_nullable FROM information_schema.columns ' +
    'WHERE table_schema = $1 AND table_name = $2 ORDER BY column_name',
    ['public', 'experiments']
  );
  assert.deepEqual(schemaResult.rows, [
    { column_name: 'created_at', data_type: 'timestamp with time zone', is_nullable: 'NO' },
    { column_name: 'id', data_type: 'uuid', is_nullable: 'NO' },
    { column_name: 'result_number', data_type: 'integer', is_nullable: 'NO' },
    { column_name: 'selected_bet', data_type: 'text', is_nullable: 'NO' },
    { column_name: 'stake_credits', data_type: 'integer', is_nullable: 'NO' }
  ]);
});

test('inserts and reads both bets with boundary stakes and result numbers', async function(t) {
  var client = await beginTestTransaction(t);
  var validExperiments = [
    { selectedBet: 'red', stakeCredits: 1, resultNumber: 0 },
    { selectedBet: 'black', stakeCredits: 1000, resultNumber: 36 }
  ];

  for (var experiment of validExperiments) {
    var experimentId = randomUUID();
    var insertResult = await client.query(insertExperimentSql, [
      experimentId, experiment.selectedBet, experiment.stakeCredits, experiment.resultNumber
    ]);
    var savedExperiment = insertResult.rows[0];
    assert.equal(insertResult.rowCount, 1);
    assert.equal(savedExperiment.id, experimentId);
    assert.equal(savedExperiment.selected_bet, experiment.selectedBet);
    assert.equal(savedExperiment.stake_credits, experiment.stakeCredits);
    assert.equal(savedExperiment.result_number, experiment.resultNumber);
    assert.ok(savedExperiment.created_at instanceof Date);
    assert.ok(Number.isFinite(savedExperiment.created_at.getTime()));

    var readResult = await client.query(
      'SELECT id, selected_bet, stake_credits, result_number, created_at ' +
      'FROM public.experiments WHERE id = $1',
      [experimentId]
    );
    assert.deepEqual(readResult.rows, [savedExperiment]);
  }
});

// SQLSTATE: 23514 = check violation, 23502 = not-null violation, 22P02 = invalid input.
var invalidExperiments = [
  {
    name: 'green bets', values: [randomUUID(), 'green', 1, 0], errorCode: '23514'
  },
  {
    name: 'uppercase bets', values: [randomUUID(), 'Red', 1, 0], errorCode: '23514'
  },
  {
    name: 'zero stakes', values: [randomUUID(), 'red', 0, 1], errorCode: '23514'
  },
  {
    name: 'negative stakes', values: [randomUUID(), 'red', -1, 1], errorCode: '23514'
  },
  {
    name: 'stakes above 1000', values: [randomUUID(), 'black', 1001, 1], errorCode: '23514'
  },
  {
    name: 'fractional stakes', values: [randomUUID(), 'red', 1.5, 1], errorCode: '22P02'
  },
  {
    name: 'negative result numbers', values: [randomUUID(), 'red', 1, -1], errorCode: '23514'
  },
  {
    name: 'result numbers above 36', values: [randomUUID(), 'black', 1, 37], errorCode: '23514'
  },
  {
    name: 'fractional result numbers', values: [randomUUID(), 'red', 1, 1.5], errorCode: '22P02'
  },
  {
    name: 'null IDs', values: [null, 'red', 1, 0], errorCode: '23502'
  },
  {
    name: 'null bets', values: [randomUUID(), null, 1, 0], errorCode: '23502'
  },
  {
    name: 'null stakes', values: [randomUUID(), 'red', null, 0], errorCode: '23502'
  },
  {
    name: 'null result numbers', values: [randomUUID(), 'red', 1, null], errorCode: '23502'
  },
  {
    name: 'malformed UUIDs', values: ['invalid-uuid', 'red', 1, 0], errorCode: '22P02'
  }
];

invalidExperiments.forEach(function(experiment) {
  test('rejects ' + experiment.name, async function(t) {
    var client = await beginTestTransaction(t);
    await assert.rejects(client.query(insertExperimentSql, experiment.values), {
      code: experiment.errorCode
    });
  });
});

test('rejects duplicate experiment IDs', async function(t) {
  var client = await beginTestTransaction(t);
  var values = [randomUUID(), 'red', 37, 1];
  await client.query(insertExperimentSql, values);
  await assert.rejects(client.query(insertExperimentSql, values), { code: '23505' });
});

test('transaction rollback leaves no saved test record', async function() {
  var experimentId = randomUUID();
  var client = await pool.connect();
  try {
    await client.query('BEGIN');
    var insertResult = await client.query(insertExperimentSql, [experimentId, 'black', 37, 0]);
    assert.equal(insertResult.rowCount, 1);
  } finally {
    try {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  var readResult = await pool.query('SELECT id FROM public.experiments WHERE id = $1', [experimentId]);
  assert.equal(readResult.rowCount, 0);
});
