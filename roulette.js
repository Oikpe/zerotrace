var crypto = require('node:crypto');

var redNumbers = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18,
  19, 21, 23, 25, 27, 30, 32, 34, 36
]);

function validateBetInputs(selectedBet, stakeCredits) {
  if (typeof selectedBet !== 'string') {
    throw new TypeError('Selected bet must be a string.');
  }
  if (selectedBet !== 'red' && selectedBet !== 'black') {
    throw new RangeError('Selected bet must be red or black.');
  }
  if (typeof stakeCredits !== 'number') {
    throw new TypeError('Stake must be a number.');
  }
  if (!Number.isInteger(stakeCredits) || stakeCredits < 1 || stakeCredits > 1000) {
    throw new RangeError('Stake must be an integer from 1 to 1000 credits.');
  }
}

function getNumberColor(resultNumber) {
  if (typeof resultNumber !== 'number') {
    throw new TypeError('Result number must be a number.');
  }
  if (!Number.isInteger(resultNumber) || resultNumber < 0 || resultNumber > 36) {
    throw new RangeError('Result number must be an integer from 0 to 36.');
  }
  if (resultNumber === 0) {
    return 'green';
  }
  return redNumbers.has(resultNumber) ? 'red' : 'black';
}

function evaluateBet(selectedBet, stakeCredits, resultNumber) {
  validateBetInputs(selectedBet, stakeCredits);
  var resultColor = getNumberColor(resultNumber);
  var won = selectedBet === resultColor;

  return {
    selectedBet: selectedBet,
    stakeCredits: stakeCredits,
    resultNumber: resultNumber,
    resultColor: resultColor,
    won: won,
    netPayoutCredits: won ? stakeCredits : -stakeCredits,
    winProbability: 18 / 37,
    lossProbability: 19 / 37,
    expectedNetReturnCredits: -stakeCredits / 37
  };
}

function spinRoulette(selectedBet, stakeCredits) {
  validateBetInputs(selectedBet, stakeCredits);
  var resultNumber = crypto.randomInt(0, 37);
  return evaluateBet(selectedBet, stakeCredits, resultNumber);
}

module.exports = {
  getNumberColor: getNumberColor,
  evaluateBet: evaluateBet,
  spinRoulette: spinRoulette
};
