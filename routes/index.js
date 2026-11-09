var express = require('express');
var pool = require('../db');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.get('/health', async function(req, res) {
  try {
    await pool.query(
      'SELECT id, selected_bet, stake_credits, result_number, created_at ' +
      'FROM public.experiments LIMIT 0'
    );
    res.json({ status: 'ok' });
  } catch (error) {
    res.status(503).json({ error: 'Database unavailable.' });
  }
});

module.exports = router;
