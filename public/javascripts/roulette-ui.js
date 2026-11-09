(function() {
  'use strict';

  var europeanWheelOrder = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
    5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
  ];
  var pocketColors = { green: '#17694b', red: '#b52d37', black: '#202525' };
  var pockets = europeanWheelOrder.map(function(number, index) {
    // Nonzero pockets alternate red and black in this physical wheel order.
    return { number: number, color: index === 0 ? 'green' : index % 2 === 1 ? 'red' : 'black' };
  });

  var container = document.getElementById('roulette-wheel');
  var statusOutput = document.getElementById('spin-status');
  var spinButton = document.getElementById('spin-button');
  var resultDetails = document.getElementById('result-details');
  var resultEmpty = document.getElementById('result-empty');
  var historyStatus = document.getElementById('history-status');
  var historyScroll = document.getElementById('history-scroll');
  var historyBody = document.getElementById('history-body');
  var historyRefresh = document.getElementById('history-refresh');
  var motionNote = document.getElementById('motion-note');
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var wheel = null;
  var spinInProgress = false;
  var animationInProgress = false;
  var savedExperiment = null;
  var animationTimeout = null;
  var historyRequestId = 0;

  function setStatus(message, isError) {
    statusOutput.textContent = message;
    statusOutput.dataset.state = isError ? 'error' : 'ready';
  }

  function updateControls() {
    var input = updateBetSelection();
    betOptions.forEach(function(option) {
      option.disabled = spinInProgress;
    });
    stakeInput.disabled = spinInProgress;
    spinButton.disabled = spinInProgress || input === null;
    spinButton.textContent = spinInProgress ? (animationInProgress ? 'Spinning...' : 'Saving...') : 'Spin';
    bettingForm.setAttribute('aria-busy', String(spinInProgress));
  }

  function positionAtTarget(index) {
    wheel.stop();
    wheel.rotation = (360 - (index + 0.5) * (360 / pockets.length)) % 360;
  }

  function finishSpin(reason) {
    if (!animationInProgress || savedExperiment === null) return;
    window.clearTimeout(animationTimeout);
    animationTimeout = null;
    animationInProgress = false;
    var targetIndex = europeanWheelOrder.indexOf(savedExperiment.resultNumber);
    var animationWarning = reason !== 'completed' && reason !== 'reduced-motion';

    try {
      if (wheel === null) throw new Error('Wheel unavailable.');
      if (reason !== 'completed' || wheel.getCurrentIndex() !== targetIndex) {
        if (reason === 'completed') animationWarning = true;
        positionAtTarget(targetIndex);
      } else {
        wheel.stop();
      }
      if (wheel.getCurrentIndex() !== targetIndex) throw new Error('Wheel alignment failed.');
    } catch (error) {
      if (wheel !== null) {
        try { wheel.stop(); } catch (stopError) {}
      }
      wheel = null;
      animationWarning = true;
    }

    showExperiment(savedExperiment);
    spinInProgress = false;
    updateControls();
    setStatus(animationWarning
      ? 'Experiment saved. Animation could not finish normally; the saved server result is shown.'
      : 'Experiment saved.' + (reason === 'reduced-motion' ? ' Reduced motion: no animation.' : ''), animationWarning);
    loadHistory();
  }

  async function submitSpin(event) {
    event.preventDefault();
    if (spinInProgress) return;
    var input = updateBetSelection();
    if (input === null) {
      setStatus('Choose Red or Black and a whole stake from 1 to 1000.', true);
      bettingForm.reportValidity();
      return;
    }

    spinInProgress = true;
    savedExperiment = null;
    resultDetails.hidden = true;
    resultEmpty.hidden = false;
    resultEmpty.textContent = 'Waiting for the server result.';
    updateControls();
    setStatus('Submitting one spin to the server...', false);

    try {
      var response = await requestExperiments({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      });
      if (response.status !== 201 || !isExperimentRecord(response.body)) {
        throw new Error('No valid saved experiment returned.');
      }
      savedExperiment = response.body;
      animationInProgress = true;
      updateControls();
      resultEmpty.textContent = 'Experiment saved. Animating the server result.';
      setStatus('Experiment saved. Animating the server result...', false);
      if (wheel === null || reducedMotion.matches || document.hidden) {
        finishSpin(wheel === null ? 'unavailable' : reducedMotion.matches ? 'reduced-motion' : 'hidden');
        return;
      }
      animationTimeout = window.setTimeout(function() {
        finishSpin('timeout');
      }, 6000);
      wheel.spinToItem(europeanWheelOrder.indexOf(savedExperiment.resultNumber), 3500, true, 3, 1);
    } catch (error) {
      if (savedExperiment !== null) {
        finishSpin('error');
        return;
      }
      spinInProgress = false;
      updateControls();
      resultEmpty.textContent = 'No confirmed saved result for this request. Check history.';
      var httpStatus = response && response.status !== 201 ? ' (HTTP ' + response.status + ')' : '';
      setStatus('Spin could not be confirmed' + httpStatus +
        '. Check history before another spin. No automatic retry was sent.', true);
    }
  }

  function updateMotionNote() {
    motionNote.textContent = reducedMotion.matches
      ? 'Reduced motion is enabled. Saved results are positioned without animation.'
      : 'Spins animate for about 3.5 seconds.';
  }

  function isExperimentRecord(record) {
    return record !== null && typeof record === 'object' &&
      typeof record.id === 'string' && record.id.length > 0 &&
      (record.selectedBet === 'red' || record.selectedBet === 'black') &&
      Number.isInteger(record.stakeCredits) && record.stakeCredits >= 1 && record.stakeCredits <= 1000 &&
      Number.isInteger(record.resultNumber) && record.resultNumber >= 0 && record.resultNumber <= 36 &&
      pockets[europeanWheelOrder.indexOf(record.resultNumber)].color === record.resultColor &&
      typeof record.won === 'boolean' && Number.isFinite(record.netPayoutCredits) &&
      Number.isFinite(record.expectedNetReturnCredits) &&
      Number.isFinite(record.winProbability) && record.winProbability >= 0 && record.winProbability <= 1 &&
      Number.isFinite(record.lossProbability) && record.lossProbability >= 0 && record.lossProbability <= 1 &&
      typeof record.createdAt === 'string' && Number.isFinite(Date.parse(record.createdAt));
  }

  function formatCredits(value) {
    return (value > 0 ? '+' : '') + value.toFixed(2);
  }

  function showExperiment(experiment) {
    document.getElementById('result-number').textContent = experiment.resultNumber + ' / ' + experiment.resultColor;
    document.getElementById('result-outcome').textContent = experiment.won ? 'Win' : 'Loss';
    document.getElementById('result-bet').textContent = experiment.selectedBet + ' / ' + experiment.stakeCredits + ' virtual credits';
    document.getElementById('result-net').textContent = formatCredits(experiment.netPayoutCredits) + ' virtual credits';
    document.getElementById('result-expected').textContent = formatCredits(experiment.expectedNetReturnCredits) + ' virtual credits';
    document.getElementById('result-probabilities').textContent =
      (experiment.winProbability * 100).toFixed(2) + '% win / ' + (experiment.lossProbability * 100).toFixed(2) + '% loss';
    document.getElementById('result-id').textContent = experiment.id;
    document.getElementById('result-time').textContent = experiment.createdAt;
    resultEmpty.hidden = true;
    resultDetails.hidden = false;
  }

  async function requestExperiments(options) {
    var controller = new AbortController();
    var timeout = window.setTimeout(function() { controller.abort(); }, 10000);
    try {
      var response = await fetch('/api/experiments', Object.assign({
        method: 'GET', cache: 'no-store', signal: controller.signal
      }, options));
      return { status: response.status, body: await response.json() };
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function loadHistory() {
    var requestId = ++historyRequestId;
    historyRefresh.disabled = true;
    historyScroll.hidden = true;
    historyStatus.textContent = 'Loading saved history...';
    historyStatus.dataset.state = 'loading';
    try {
      var response = await requestExperiments();
      if (requestId !== historyRequestId) return;
      if (response.status !== 200 || !response.body || !Array.isArray(response.body.experiments) ||
          !response.body.experiments.every(isExperimentRecord)) {
        throw new Error('Invalid history response.');
      }
      historyBody.replaceChildren();
      response.body.experiments.forEach(function(experiment) {
        var row = document.createElement('tr');
        var values = [experiment.id, experiment.createdAt, experiment.selectedBet, experiment.stakeCredits,
          experiment.resultNumber + ' / ' + experiment.resultColor, experiment.won ? 'Win' : 'Loss',
          formatCredits(experiment.netPayoutCredits)];
        values.forEach(function(value) {
          var cell = document.createElement('td');
          cell.textContent = String(value);
          row.appendChild(cell);
        });
        historyBody.appendChild(row);
      });
      historyScroll.hidden = response.body.experiments.length === 0;
      historyStatus.textContent = response.body.experiments.length === 0
        ? 'No saved experiments yet.'
        : 'Showing ' + response.body.experiments.length + ' saved experiments, newest first.';
      historyStatus.dataset.state = 'ready';
    } catch (error) {
      if (requestId !== historyRequestId) return;
      historyStatus.textContent = 'History could not be loaded. Use Refresh history to try again.';
      historyStatus.dataset.state = 'error';
    } finally {
      if (requestId === historyRequestId) historyRefresh.disabled = false;
    }
  }

  var bettingForm = document.getElementById('betting-form');
  var betOptions = Array.from(document.querySelectorAll('input[name="selectedBet"]'));
  var stakeInput = document.getElementById('stake-credits');
  var stakeError = document.getElementById('stake-error');
  var betSummary = document.getElementById('bet-summary');

  function updateBetSelection() {
    var selectedBet = betOptions.find(function(option) {
      return option.checked;
    });
    var betName = selectedBet ? (selectedBet.value === 'red' ? 'Red' : 'Black') : 'None';
    var stakeCredits = stakeInput.valueAsNumber;
    var validStake = Number.isInteger(stakeCredits) && stakeCredits >= 1 && stakeCredits <= 1000;
    var errorMessage = validStake ? '' : 'Enter a whole number from 1 to 1000 virtual credits.';

    stakeInput.setCustomValidity(errorMessage);
    stakeInput.setAttribute('aria-invalid', String(!validStake));
    stakeError.textContent = errorMessage;
    betSummary.textContent = 'Selected bet: ' + betName + '. Stake: ' + (validStake
      ? stakeCredits + (stakeCredits === 1 ? ' virtual credit.' : ' virtual credits.')
      : 'enter a valid amount.');
    if (!validStake || !selectedBet || (selectedBet.value !== 'red' && selectedBet.value !== 'black')) return null;
    return { selectedBet: selectedBet.value, stakeCredits: stakeCredits };
  }

  document.querySelectorAll('[data-table-number]').forEach(function(cell) {
    var number = Number(cell.dataset.tableNumber);
    var pocket = pockets.find(function(item) {
      return item.number === number;
    });
    cell.dataset.color = pocket.color;
    cell.setAttribute('aria-label', number + ' ' + pocket.color + ', display only');
  });
  betOptions.forEach(function(option) {
    option.addEventListener('change', updateControls);
  });
  stakeInput.addEventListener('input', updateControls);
  bettingForm.addEventListener('submit', submitSpin);
  historyRefresh.addEventListener('click', loadHistory);

  try {
    if (!window.spinWheel || typeof window.spinWheel.Wheel !== 'function') {
      throw new Error('The local spin-wheel bundle is unavailable.');
    }
    wheel = new window.spinWheel.Wheel(container, {
      items: pockets.map(function(pocket) {
        return { label: String(pocket.number), backgroundColor: pocketColors[pocket.color], weight: 1 };
      }),
      isInteractive: false,
      pointerAngle: 0,
      radius: 0.96,
      rotation: 360 - 180 / pockets.length,
      borderColor: '#e0c891',
      borderWidth: 2,
      lineColor: '#e5d6b3',
      lineWidth: 1.15,
      itemLabelColors: ['#fffdf5'],
      itemLabelFont: 'Arial, sans-serif',
      itemLabelFontSizeMax: 26,
      itemLabelRadius: 0.9,
      itemLabelRadiusMax: 0.72,
      itemLabelAlign: 'center',
      itemLabelRotation: 90,
      onRest: function() {
        finishSpin('completed');
      }
    });
    wheel.canvas.setAttribute('aria-label', 'European roulette wheel with 37 numbered pockets and a fixed pointer at the top.');
    reducedMotion.addEventListener('change', function() {
      updateMotionNote();
      if (reducedMotion.matches) finishSpin('reduced-motion');
    });
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) finishSpin('hidden');
    });
    setStatus('Ready. Choose a bet and stake, then Spin.', false);
  } catch (error) {
    wheel = null;
    setStatus('The wheel is unavailable. Saved spins will still show their server result without animation.', true);
  }
  updateMotionNote();
  updateControls();
  loadHistory();
})();
