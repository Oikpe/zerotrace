var Pool = require('pg').Pool;

var pool = new Pool({
  max: 5,
  connectionTimeoutMillis: 3000,
  query_timeout: 5000,
  statement_timeout: 3000
});

pool.on('error', function(error) {
  console.error('Unexpected PostgreSQL pool error:', error.code || 'UNKNOWN');
});

module.exports = pool;
