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
  var targetButtons = Array.from(document.querySelectorAll('[data-result-number]'));
  var repeatButton = document.getElementById('repeat-target');
  var targetOutput = document.getElementById('target-number');
  var indexOutput = document.getElementById('target-index');
  var resultOutput = document.getElementById('preview-result');
  var statusOutput = document.getElementById('preview-status');
  var motionNote = document.getElementById('motion-note');
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var wheel = null;
  var animationInProgress = false;
  var requestedNumber = null;
  var lastPreviewNumber = null;
  var animationTimeout = null;

  function describePocket(index) {
    var pocket = pockets[index];
    return pocket.number + ' / ' + pocket.color;
  }

  function setStatus(message, isError) {
    statusOutput.textContent = message;
    statusOutput.dataset.state = isError ? 'error' : 'ready';
  }

  function updateControls() {
    targetButtons.forEach(function(button) {
      button.disabled = wheel === null || animationInProgress;
    });
    repeatButton.disabled = wheel === null || animationInProgress || lastPreviewNumber === null;
    repeatButton.textContent = lastPreviewNumber === null ? 'Repeat last target' : 'Repeat ' + lastPreviewNumber;
  }

  function positionAtTarget(index) {
    wheel.stop();
    wheel.rotation = (360 - (index + 0.5) * (360 / pockets.length)) % 360;
  }

  function finishPreview(reason) {
    if (!animationInProgress) return;
    window.clearTimeout(animationTimeout);
    animationTimeout = null;
    animationInProgress = false;

    try {
      var targetIndex = europeanWheelOrder.indexOf(requestedNumber);
      if (reason === 'completed') {
        wheel.stop();
      } else {
        positionAtTarget(targetIndex);
      }
      var actualIndex = wheel.getCurrentIndex();
      resultOutput.textContent = pockets[actualIndex] ? describePocket(actualIndex) : 'Unavailable';
      if (actualIndex !== targetIndex) {
        setStatus('The reported pocket differs from the target. Inspect the wheel before continuing.', true);
      } else {
        lastPreviewNumber = requestedNumber;
        if (reason === 'completed') {
          setStatus('Preview ' + requestedNumber + ' finished. Check that pocket under the pointer.', false);
        } else if (reason === 'reduced-motion') {
          setStatus('Reduced motion: positioned at ' + requestedNumber + ' without animation. Check the pointer.', false);
        } else {
          setStatus('Animation interrupted; positioned at ' + requestedNumber + '. Check the pointer before continuing.', true);
        }
      }
    } catch (error) {
      wheel.stop();
      wheel = null;
      resultOutput.textContent = 'Unavailable';
      setStatus('The preview could not finish. Reload the page to initialize the wheel again.', true);
    }
    updateControls();
  }

  function previewTarget(resultNumber) {
    if (wheel === null || animationInProgress) return;
    var targetIndex = europeanWheelOrder.indexOf(resultNumber);
    if (!Number.isInteger(resultNumber) || targetIndex < 0) {
      setStatus('Choose a valid European wheel target.', true);
      return;
    }

    requestedNumber = resultNumber;
    animationInProgress = true;
    targetOutput.textContent = describePocket(targetIndex);
    indexOutput.textContent = String(targetIndex);
    resultOutput.textContent = 'Animating';
    setStatus('Previewing ' + resultNumber + '. No experiment is being saved.', false);
    updateControls();

    if (reducedMotion.matches) {
      finishPreview('reduced-motion');
      return;
    }
    try {
      animationTimeout = window.setTimeout(function() {
        finishPreview('timeout');
      }, 6000);
      wheel.spinToItem(targetIndex, 3500, true, 3, 1);
    } catch (error) {
      finishPreview('error');
    }
  }

  function updateMotionNote() {
    motionNote.textContent = reducedMotion.matches
      ? 'Reduced motion is enabled. Previews change position immediately.'
      : 'Previews animate for about 3.5 seconds.';
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
    option.addEventListener('change', updateBetSelection);
  });
  stakeInput.addEventListener('input', updateBetSelection);
  bettingForm.addEventListener('submit', function(event) {
    event.preventDefault();
    updateBetSelection();
  });
  updateBetSelection();

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
        finishPreview('completed');
      }
    });
    wheel.canvas.setAttribute('aria-label', 'European roulette wheel with 37 numbered pockets and a fixed pointer at the top.');
    targetButtons.forEach(function(button) {
      button.addEventListener('click', function() {
        previewTarget(Number(button.dataset.resultNumber));
      });
    });
    repeatButton.addEventListener('click', function() {
      if (lastPreviewNumber !== null) previewTarget(lastPreviewNumber);
    });
    reducedMotion.addEventListener('change', function() {
      updateMotionNote();
      if (reducedMotion.matches) finishPreview('reduced-motion');
    });
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) finishPreview('hidden');
    });
    updateMotionNote();
    updateControls();
    setStatus('Ready. Choose a development target to preview.', false);
  } catch (error) {
    if (wheel !== null) wheel.stop();
    wheel = null;
    updateControls();
    setStatus('The local wheel could not be initialized. Check the browser console and local asset loading.', true);
    console.error('Wheel prototype initialization failed:', error);
  }
})();
