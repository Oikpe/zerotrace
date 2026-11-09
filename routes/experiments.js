var express = require('express');
var crypto = require('node:crypto');
var pool = require('../db');
var roulette = require('../roulette');
var router = express.Router();

function toExperimentResponse(record) {
  return Object.assign(
    { id: record.id },
    roulette.evaluateBet(record.selected_bet, record.stake_credits, record.result_number),
    { createdAt: record.created_at.toISOString() }
  );
}

router.get('/', async function(req, res, next) {
  try {
    var result = await pool.query(
      'SELECT id, selected_bet, stake_credits, result_number, created_at ' +
      'FROM public.experiments ORDER BY created_at DESC, id DESC LIMIT 20'
    );
    res.json({ experiments: result.rows.map(toExperimentResponse) });
  } catch (error) {
    next(error);
  }
});

router.post('/', async function(req, res, next) {
  if (!req.is('application/json')) {
    return res.status(415).json({ error: 'Content-Type must be application/json.' });
  }
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Body must be a JSON object.' });
  }

  var fields = Object.keys(req.body);
  if (fields.length !== 2 || !fields.includes('selectedBet') || !fields.includes('stakeCredits')) {
    return res.status(400).json({ error: 'Body must contain only selectedBet and stakeCredits.' });
  }

  var selectedBet = req.body.selectedBet;
  var stakeCredits = req.body.stakeCredits;
  if (selectedBet !== 'red' && selectedBet !== 'black') {
    return res.status(400).json({ error: 'Selected bet must be red or black.' });
  }
  if (!Number.isInteger(stakeCredits) || stakeCredits < 1 || stakeCredits > 1000) {
    return res.status(400).json({ error: 'Stake must be an integer from 1 to 1000 credits.' });
  }

  try {
    var experiment = roulette.spinRoulette(selectedBet, stakeCredits);
    var experimentId = crypto.randomUUID();
    var result = await pool.query(
      'INSERT INTO public.experiments (id, selected_bet, stake_credits, result_number) ' +
      'VALUES ($1, $2, $3, $4) ' +
      'RETURNING id, selected_bet, stake_credits, result_number, created_at',
      [experimentId, experiment.selectedBet, experiment.stakeCredits, experiment.resultNumber]
    );
    res.status(201).json(toExperimentResponse(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
