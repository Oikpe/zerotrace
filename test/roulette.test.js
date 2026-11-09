var test = require('node:test');
var assert = require('node:assert/strict');
var crypto = require('node:crypto');
var roulette = require('../roulette');

var expectedColors = [
  'green',
  'red', 'black', 'red', 'black', 'red', 'black', 'red', 'black', 'red',
  'black', 'black', 'red', 'black', 'red', 'black', 'red', 'black', 'red',
  'red', 'black', 'red', 'black', 'red', 'black', 'red', 'black', 'red',
  'black', 'black', 'red', 'black', 'red', 'black', 'red', 'black', 'red'
];

var tolerance = 1e-12;

test('maps all 37 numbers to the correct European colors', function() {
  var counts = { red: 0, black: 0, green: 0 };
  expectedColors.forEach(function(expectedColor, resultNumber) {
    var resultColor = roulette.getNumberColor(resultNumber);
    assert.equal(resultColor, expectedColor, 'Color for number ' + resultNumber);
    counts[resultColor] += 1;
  });
  assert.deepEqual(counts, { red: 18, black: 18, green: 1 });
});

test('rejects nonnumeric result numbers without coercion', function() {
  [undefined, null, true, '0', '36', '00', {}, []].forEach(function(resultNumber) {
    assert.throws(function() {
      roulette.getNumberColor(resultNumber);
    }, TypeError);
    assert.throws(function() {
      roulette.evaluateBet('red', 10, resultNumber);
    }, TypeError);
  });
});

test('rejects result numbers outside the integer range 0 to 36', function() {
  [-1, 37, 1.5, NaN, Infinity, -Infinity].forEach(function(resultNumber) {
    assert.throws(function() {
      roulette.getNumberColor(resultNumber);
    }, RangeError);
    assert.throws(function() {
      roulette.evaluateBet('black', 10, resultNumber);
    }, RangeError);
  });
});

test('rejects nonstring bets', function() {
  [undefined, null, true, 1, {}, []].forEach(function(selectedBet) {
    assert.throws(function() {
      roulette.evaluateBet(selectedBet, 10, 1);
    }, TypeError);
  });
});

test('accepts only exact lowercase red and black bets', function() {
  ['green', 'Red', 'BLACK', '', ' red', 'black ', '00'].forEach(function(selectedBet) {
    assert.throws(function() {
      roulette.evaluateBet(selectedBet, 10, 1);
    }, RangeError);
  });
});

test('rejects nonnumeric stakes without coercion', function() {
  [undefined, null, true, '1', {}, []].forEach(function(stakeCredits) {
    assert.throws(function() {
      roulette.evaluateBet('red', stakeCredits, 1);
    }, TypeError);
  });
});

test('rejects stakes outside the integer range 1 to 1000', function() {
  [0, -1, 1.5, 1001, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER,
    Number.MAX_SAFE_INTEGER + 1].forEach(function(stakeCredits) {
    assert.throws(function() {
      roulette.evaluateBet('black', stakeCredits, 2);
    }, RangeError);
  });
});

test('settles both bets correctly for every result and the stake boundaries', function() {
  ['red', 'black'].forEach(function(selectedBet) {
    [1, 37, 1000].forEach(function(stakeCredits) {
      expectedColors.forEach(function(expectedColor, resultNumber) {
        var result = roulette.evaluateBet(selectedBet, stakeCredits, resultNumber);
        var expectedWin = selectedBet === expectedColor;
        assert.equal(result.selectedBet, selectedBet);
        assert.equal(result.stakeCredits, stakeCredits);
        assert.equal(result.resultNumber, resultNumber);
        assert.equal(result.resultColor, expectedColor);
        assert.equal(result.won, expectedWin);
        assert.equal(result.netPayoutCredits, expectedWin ? stakeCredits : -stakeCredits);
      });
    });
  });
});

test('zero loses the full stake for both bets', function() {
  ['red', 'black'].forEach(function(selectedBet) {
    var result = roulette.evaluateBet(selectedBet, 37, 0);
    assert.equal(result.resultColor, 'green');
    assert.equal(result.won, false);
    assert.equal(result.netPayoutCredits, -37);
  });
});

test('returns the theoretical probabilities and expected net return', function() {
  ['red', 'black'].forEach(function(selectedBet) {
    [1, 37, 100, 1000].forEach(function(stakeCredits) {
      [0, 1, 2].forEach(function(resultNumber) {
        var result = roulette.evaluateBet(selectedBet, stakeCredits, resultNumber);
        assert.ok(Math.abs(result.winProbability - 18 / 37) < tolerance);
        assert.ok(Math.abs(result.lossProbability - 19 / 37) < tolerance);
        assert.ok(Math.abs(result.winProbability + result.lossProbability - 1) < tolerance);
        assert.ok(Math.abs(result.expectedNetReturnCredits + stakeCredits / 37) < tolerance);
      });
    });
  });
});

test('the average net payout across all outcomes matches the expected return', function() {
  ['red', 'black'].forEach(function(selectedBet) {
    [1, 37, 1000].forEach(function(stakeCredits) {
      var wins = 0;
      var totalNetPayout = 0;
      expectedColors.forEach(function(expectedColor, resultNumber) {
        var result = roulette.evaluateBet(selectedBet, stakeCredits, resultNumber);
        if (result.won) {
          wins += 1;
        }
        totalNetPayout += result.netPayoutCredits;
      });
      assert.equal(wins, 18);
      assert.equal(expectedColors.length - wins, 19);
      assert.equal(totalNetPayout, -stakeCredits);
      assert.ok(Math.abs(totalNetPayout / 37 + stakeCredits / 37) < tolerance);
    });
  });
});

test('evaluating a known result does not draw randomness', function(t) {
  t.mock.method(crypto, 'randomInt', function() {
    throw new Error('Evaluation must not draw a random number.');
  });
  assert.equal(roulette.evaluateBet('red', 10, 1).netPayoutCredits, 10);
});

test('spins draw once with bounds 0 and 37 and allow consecutive repeats', function(t) {
  var resultNumbers = [0, 36, 36];
  var randomInt = t.mock.method(crypto, 'randomInt', function() {
    return resultNumbers.shift();
  });
  [0, 36, 36].forEach(function(resultNumber, index) {
    var stakeCredits = [1, 37, 1000][index];
    var result = roulette.spinRoulette('red', stakeCredits);
    assert.equal(result.resultNumber, resultNumber);
    assert.equal(result.resultColor, expectedColors[resultNumber]);
    assert.equal(result.stakeCredits, stakeCredits);
    assert.equal(result.won, resultNumber === 36);
    assert.equal(result.netPayoutCredits, resultNumber === 36 ? stakeCredits : -stakeCredits);
    assert.equal(randomInt.mock.callCount(), index + 1);
    assert.deepEqual(randomInt.mock.calls[index].arguments, [0, 37]);
  });
});

test('invalid spin inputs do not consume randomness', function(t) {
  var randomInt = t.mock.method(crypto, 'randomInt', function() {
    return 1;
  });
  [['green', 10], ['Red', 1], [null, 10], ['red', 0], ['black', 1001],
    ['red', '10'], ['black', 1.5], ['red', NaN]].forEach(function(input) {
    assert.throws(function() {
      roulette.spinRoulette(input[0], input[1]);
    });
  });
  assert.equal(randomInt.mock.callCount(), 0);
});

test('randomness failures propagate without a fallback or retry', function(t) {
  var randomError = new Error('Random number generation failed.');
  var randomInt = t.mock.method(crypto, 'randomInt', function() {
    throw randomError;
  });
  assert.throws(function() {
    roulette.spinRoulette('black', 10);
  }, function(error) {
    return error === randomError;
  });
  assert.equal(randomInt.mock.callCount(), 1);
});
