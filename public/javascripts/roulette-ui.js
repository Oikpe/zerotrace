(function() {
  'use strict';

  var europeanWheelOrder = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
    5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
  ];
  var pocketColors = { green: '#287347', red: '#c33532', black: '#171a1c' };
  var pockets = europeanWheelOrder.map(function(number, index) {
    // Nonzero pockets alternate red and black in this physical wheel order.
    return { number: number, color: index === 0 ? 'green' : index % 2 === 1 ? 'red' : 'black' };
  });

  var container = document.getElementById('roulette-wheel');
  var ballOrbit = document.getElementById('ball-orbit');
  var ball = document.getElementById('roulette-ball');
  var spinDuration = 3500;
  var ballPocketTop = 11.5;
  var ballOuterTop = 2.5;
  var ballAngle = -45;
  var ballTop = ballOuterTop;
  var ballCruiseSpeed = -0.3; // Degrees per millisecond, counterclockwise.
  var ballRampDuration = 650;
  var wheelCruiseSpeed = 240; // Library speed is degrees per second, clockwise.
  var wheelIdleSpeed = 12;
  var restingPocketIndex = null;
  var entryAcknowledged = false;
  var entryDialog = document.getElementById('welcome-dialog');
  var enterButton = document.getElementById('enter-simulator');
  var simulator = document.getElementById('simulator');
  var motion = null;
  var motionFrame = null;
  var motionFailed = false;
  var landingAngle = null;
  var statusOutput = document.getElementById('spin-status');
  var spinButton = document.getElementById('spin-button');
  var resultDetails = document.getElementById('result-details');
  var resultRecord = document.getElementById('result-record');
  var resultEmpty = document.getElementById('result-empty');
  var historyStatus = document.getElementById('history-status');
  var historyScroll = document.getElementById('history-scroll');
  var historyBody = document.getElementById('history-body');
  var historyRefresh = document.getElementById('history-refresh');
  var historyToggle = document.getElementById('history-toggle');
  var historyExpanded = false;
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
    var controlsLocked = spinInProgress || !entryAcknowledged;
    betOptions.forEach(function(option) {
      option.disabled = controlsLocked;
    });
    stakeChips.forEach(function(chip) {
      chip.disabled = controlsLocked;
      chip.setAttribute('aria-pressed', String(input !== null && Number(chip.dataset.stakeCredits) === input.stakeCredits));
    });
    stakeInput.disabled = controlsLocked;
    spinButton.disabled = controlsLocked || input === null;
    spinButton.textContent = spinInProgress ? (animationInProgress ? 'Spinning...' : 'Saving...') : 'Spin';
    bettingForm.setAttribute('aria-busy', String(spinInProgress));
  }

  function normalizeAngle(angle) {
    return ((angle % 360) + 360) % 360;
  }

  function setBallPose(angle, top) {
    ballAngle = angle;
    ballTop = top;
    ballOrbit.style.transform = 'rotate(' + angle + 'deg)';
    ball.style.top = top + '%';
    ballOrbit.hidden = false;
  }

  function stopMotion() {
    if (motionFrame !== null) window.cancelAnimationFrame(motionFrame);
    motionFrame = null;
    if (wheel !== null) {
      try { wheel.stop(); } catch (error) { motionFailed = true; }
    }
  }

  function parkBall() {
    try { setBallPose(ballAngle, ballOuterTop); } catch (error) { motionFailed = true; }
  }

  function waitingPose(elapsed) {
    var progress = Math.min(1, Math.max(0, elapsed / ballRampDuration));
    // Integrating the speed ramp keeps release position and velocity continuous.
    var travel = elapsed < ballRampDuration
      ? ballRampDuration * (progress * progress - progress * progress * progress / 3)
      : elapsed - ballRampDuration / 3;
    var lift = progress * progress * (3 - 2 * progress);
    return {
      angle: motion.startAngle + motion.startBallSpeed * elapsed + (ballCruiseSpeed - motion.startBallSpeed) * travel,
      speed: motion.startBallSpeed + (ballCruiseSpeed - motion.startBallSpeed) * progress * (2 - progress),
      top: motion.startTop + (ballOuterTop - motion.startTop) * lift
    };
  }

  function beginLanding(now, pose) {
    motion.phase = 'settling';
    motion.landingStartedAt = now;
    motion.landingStartAngle = pose.angle;
    motion.landingStartSpeed = pose.speed;
    motion.landingStartTop = pose.top;
    // Finish at the wheel's idle speed so the ball can join its moving pocket.
    motion.endAngle = pose.angle + (pose.speed + wheelIdleSpeed / 1000) * spinDuration / 2;
    landingAngle = normalizeAngle(motion.endAngle);
    motion.wheelStart = wheel.rotation;
    motion.wheelTravel = null;
    var initialWheelSpeed = wheel.rotationSpeed;
    var wheelTravel = 1;
    var brakingStart = 0;
    var brakingDuration = 1;
    wheel.pointerAngle = landingAngle;
    wheel.spinToItem(europeanWheelOrder.indexOf(savedExperiment.resultNumber), spinDuration, true, 1, 1, function(progress) {
      var braking = Math.min(1, Math.max(0, (progress - brakingStart) / brakingDuration));
      // Integrate smooth braking, with an optional cruise before it or idle after it.
      var fastTravel = Math.min(progress, brakingStart) + brakingDuration *
        (braking - Math.pow(braking, 3) + Math.pow(braking, 4) / 2);
      return spinDuration * (wheelIdleSpeed * progress +
        (initialWheelSpeed - wheelIdleSpeed) * fastTravel) / (1000 * wheelTravel);
    });
    // onSpin supplies the exact clockwise travel for the backend-selected pocket.
    wheelTravel = motion.wheelTravel;
    var fastShare = (1000 * wheelTravel / spinDuration - wheelIdleSpeed) / (initialWheelSpeed - wheelIdleSpeed);
    if (!Number.isFinite(fastShare) || fastShare <= 0 || fastShare >= 1) {
      throw new Error('Wheel deceleration could not be planned.');
    }
    brakingStart = Math.max(0, 2 * fastShare - 1);
    brakingDuration = 2 * Math.min(fastShare, 1 - fastShare);
  }

  function updateMotion(now) {
    motionFrame = null;
    if (reducedMotion.matches || document.hidden || !entryAcknowledged) return;
    try {
      if (!spinInProgress) {
        if (restingPocketIndex !== null) {
          followRestingPocket();
          motionFrame = window.requestAnimationFrame(updateMotion);
        }
        return;
      }
      if (motion === null) return;
      if (motion.phase === 'waiting') {
        var elapsed = Math.max(0, now - motion.startedAt);
        var ramp = Math.min(1, elapsed / ballRampDuration);
        ramp = ramp * ramp * (3 - 2 * ramp);
        var speed = motion.startWheelSpeed + (wheelCruiseSpeed - motion.startWheelSpeed) * ramp;
        if (wheel.rotationSpeed !== speed) wheel.spin(speed);
        var pose = waitingPose(elapsed);
        setBallPose(pose.angle, pose.top);
        if (savedExperiment !== null && elapsed >= ballRampDuration) beginLanding(now, pose);
      } else {
        var progress = Math.min(1, Math.max(0, (now - motion.landingStartedAt) / spinDuration));
        var speedBlend = Math.pow(progress, 3) - Math.pow(progress, 4) / 2;
        var travel = spinDuration * (motion.landingStartSpeed * progress +
          (wheelIdleSpeed / 1000 - motion.landingStartSpeed) * speedBlend);
        var inward = Math.min(1, Math.max(0, (progress - 0.55) / 0.45));
        inward = inward * inward * (3 - 2 * inward);
        setBallPose(
          motion.landingStartAngle + travel,
          motion.landingStartTop + (ballPocketTop - motion.landingStartTop) * inward
        );
        if (progress === 1) return; // The library's onRest completes the spin.
      }
      motionFrame = window.requestAnimationFrame(updateMotion);
    } catch (error) {
      motionFailed = true;
      stopMotion();
      if (animationInProgress && savedExperiment !== null) finishSpin('error');
      else if (spinInProgress) parkBall();
    }
  }

  function startMotion() {
    var initialWheelSpeed = wheel === null ? 0 : wheel.rotationSpeed;
    var initialBallSpeed = restingPocketIndex === null ? 0 : initialWheelSpeed / 1000;
    stopMotion();
    restingPocketIndex = null;
    motionFailed = false;
    landingAngle = null;
    motion = {
      phase: 'waiting', startedAt: performance.now(), startAngle: ballAngle, startTop: ballTop,
      startWheelSpeed: initialWheelSpeed, startBallSpeed: initialBallSpeed
    };
    if (reducedMotion.matches || document.hidden) return;
    try {
      if (wheel === null) throw new Error('Wheel unavailable.');
      wheel.spin(initialWheelSpeed);
      motionFrame = window.requestAnimationFrame(updateMotion);
    } catch (error) {
      motionFailed = true;
      stopMotion();
      parkBall();
    }
  }

  function followRestingPocket() {
    var center = normalizeAngle(wheel.rotation + (restingPocketIndex + 0.5) * (360 / pockets.length));
    var offset = normalizeAngle(center - ballAngle + 180) - 180;
    setBallPose(ballAngle + offset, ballPocketTop);
  }

  function startIdleMotion() {
    if (spinInProgress || !entryAcknowledged || reducedMotion.matches || document.hidden || wheel === null) return;
    stopMotion();
    try {
      wheel.spin(wheelIdleSpeed);
      if (restingPocketIndex !== null) {
        followRestingPocket();
        // Queue after the library's renderer so the ball reads the drawn rotation.
        motionFrame = window.requestAnimationFrame(updateMotion);
      }
    } catch (error) {
      motionFailed = true;
      stopMotion();
    }
  }

  function positionAtTarget(index) {
    wheel.stop();
    wheel.pointerAngle = landingAngle;
    wheel.rotation = normalizeAngle(landingAngle - (index + 0.5) * (360 / pockets.length));
  }

  function isPocketAligned(index) {
    var center = normalizeAngle(wheel.rotation + (index + 0.5) * (360 / pockets.length));
    var error = Math.abs(normalizeAngle(center - landingAngle + 180) - 180);
    return error < 0.000001 && wheel.getCurrentIndex() === index;
  }

  function finishSpin(reason) {
    if (!animationInProgress || savedExperiment === null) return;
    window.clearTimeout(animationTimeout);
    animationTimeout = null;
    animationInProgress = false;
    stopMotion();
    var targetIndex = europeanWheelOrder.indexOf(savedExperiment.resultNumber);
    var animationWarning = motionFailed || (reason !== 'completed' && reason !== 'reduced-motion' && reason !== 'hidden');

    if (landingAngle === null) {
      var pose = waitingPose(Math.max(ballRampDuration, performance.now() - motion.startedAt));
      motion.endAngle = pose.angle + (pose.speed + wheelIdleSpeed / 1000) * spinDuration / 2;
      landingAngle = normalizeAngle(motion.endAngle);
    }
    try {
      if (wheel === null) throw new Error('Wheel unavailable.');
      if (reason !== 'completed' || !isPocketAligned(targetIndex)) {
        if (reason === 'completed') animationWarning = true;
        positionAtTarget(targetIndex);
      }
      if (!isPocketAligned(targetIndex)) throw new Error('Wheel alignment failed.');
      setBallPose(motion.endAngle, ballPocketTop);
      restingPocketIndex = targetIndex;
    } catch (error) {
      restingPocketIndex = null;
      wheel = null;
      animationWarning = true;
      parkBall();
    }

    motion = null;
    showExperiment(savedExperiment);
    spinInProgress = false;
    updateControls();
    setStatus(animationWarning
      ? 'Experiment saved. Animation could not finish normally; the saved server result is shown.'
      : 'Experiment saved.' + (reason === 'reduced-motion' ? ' Reduced motion: no animation.' : ''), animationWarning);
    loadHistory();
    startIdleMotion();
  }

  async function submitSpin(event) {
    event.preventDefault();
    if (spinInProgress || !entryAcknowledged) return;
    var input = updateBetSelection();
    if (input === null) {
      setStatus('Choose Red or Black and a whole stake from 1 to 1000.', true);
      bettingForm.reportValidity();
      return;
    }

    spinInProgress = true;
    savedExperiment = null;
    resultDetails.hidden = true;
    resultRecord.hidden = true;
    resultRecord.open = false;
    resultEmpty.hidden = false;
    resultEmpty.textContent = 'Waiting for the server result.';
    updateControls();
    setStatus('Submitting one spin to the server...', false);
    startMotion();

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
      if (wheel === null || reducedMotion.matches || document.hidden || motionFailed) {
        finishSpin(wheel === null ? 'unavailable' : reducedMotion.matches ? 'reduced-motion' : document.hidden ? 'hidden' : 'error');
        return;
      }
      animationTimeout = window.setTimeout(function() {
        finishSpin('timeout');
      }, 6000);
    } catch (error) {
      if (savedExperiment !== null) {
        finishSpin('error');
        return;
      }
      stopMotion();
      parkBall();
      motion = null;
      spinInProgress = false;
      updateControls();
      resultEmpty.textContent = 'No confirmed saved result for this request. Check history.';
      var httpStatus = response && response.status !== 201 ? ' (HTTP ' + response.status + ')' : '';
      setStatus('Spin could not be confirmed' + httpStatus +
        '. Check history before another spin. No automatic retry was sent.', true);
      startIdleMotion();
    }
  }

  function updateMotionNote() {
    motionNote.textContent = reducedMotion.matches
      ? 'Reduced motion is enabled. Saved results are positioned without animation.'
      : 'The wheel turns gently between spins. The ball follows the saved winning pocket.';
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
    var netPayout = document.getElementById('result-net');
    netPayout.textContent = (experiment.won ? 'Gain ' : 'Loss ') + formatCredits(experiment.netPayoutCredits) + ' virtual credits';
    netPayout.dataset.outcome = experiment.won ? 'positive' : 'negative';
    document.getElementById('result-expected').textContent = formatCredits(experiment.expectedNetReturnCredits) + ' virtual credits';
    document.getElementById('result-probabilities').textContent =
      (experiment.winProbability * 100).toFixed(2) + '% win / ' + (experiment.lossProbability * 100).toFixed(2) + '% loss';
    document.getElementById('result-id').textContent = experiment.id;
    document.getElementById('result-time').textContent = experiment.createdAt;
    resultEmpty.hidden = true;
    resultDetails.hidden = false;
    resultRecord.hidden = false;
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

  function updateHistoryVisibility() {
    var rows = Array.from(historyBody.children);
    if (rows.length <= 5) historyExpanded = false;
    rows.forEach(function(row, index) {
      row.hidden = !historyExpanded && index >= 5;
    });
    historyToggle.hidden = rows.length <= 5;
    historyToggle.disabled = false;
    historyToggle.textContent = historyExpanded ? 'Show latest 5' : 'Show ' + Math.max(0, rows.length - 5) + ' more';
    historyToggle.setAttribute('aria-expanded', String(historyExpanded));
    historyStatus.textContent = rows.length === 0
      ? 'No saved experiments yet.'
      : 'Showing ' + (historyExpanded ? rows.length : Math.min(5, rows.length)) + ' of ' + rows.length + ' recent saved experiments.';
    historyStatus.dataset.state = 'ready';
  }

  async function loadHistory() {
    var requestId = ++historyRequestId;
    historyRefresh.disabled = true;
    historyToggle.disabled = true;
    historyToggle.hidden = true;
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
        var values = [experiment.selectedBet, experiment.stakeCredits,
          experiment.resultNumber + ' / ' + experiment.resultColor, experiment.won ? 'Win' : 'Loss',
          (experiment.won ? 'Gain ' : 'Loss ') + formatCredits(experiment.netPayoutCredits)];
        values.forEach(function(value, index) {
          var cell = document.createElement('td');
          cell.textContent = String(value);
          if (index === 4) cell.dataset.outcome = experiment.won ? 'positive' : 'negative';
          row.appendChild(cell);
        });
        var recordCell = document.createElement('td');
        var details = document.createElement('details');
        details.className = 'record-details';
        var summary = document.createElement('summary');
        summary.textContent = 'Details';
        details.appendChild(summary);
        var metadata = document.createElement('dl');
        [['Experiment ID', experiment.id], ['Saved at (UTC)', experiment.createdAt]].forEach(function(field) {
          var group = document.createElement('div');
          var label = document.createElement('dt');
          label.textContent = field[0];
          var value = document.createElement('dd');
          value.textContent = field[1];
          group.appendChild(label);
          group.appendChild(value);
          metadata.appendChild(group);
        });
        details.appendChild(metadata);
        recordCell.appendChild(details);
        row.appendChild(recordCell);
        historyBody.appendChild(row);
      });
      historyScroll.hidden = response.body.experiments.length === 0;
      updateHistoryVisibility();
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
  var stakeChips = Array.from(document.querySelectorAll('[data-stake-credits]'));
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
  stakeChips.forEach(function(chip) {
    chip.addEventListener('click', function() {
      if (spinInProgress || !entryAcknowledged) return;
      stakeInput.valueAsNumber = Number(chip.dataset.stakeCredits);
      updateControls();
    });
  });
  stakeInput.addEventListener('input', updateControls);
  bettingForm.addEventListener('submit', submitSpin);
  historyRefresh.addEventListener('click', loadHistory);
  historyToggle.addEventListener('click', function() {
    if (historyToggle.disabled || historyToggle.hidden) return;
    historyExpanded = !historyExpanded;
    updateHistoryVisibility();
  });

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
      rotationResistance: 0,
      rotationSpeedMax: wheelCruiseSpeed,
      radius: 0.96,
      rotation: 360 - 180 / pockets.length,
      borderColor: '#c4a46a',
      borderWidth: 2,
      lineColor: '#c4a46a',
      lineWidth: 0.85,
      itemLabelColors: ['#f5f5f0'],
      itemLabelFont: 'Arial, sans-serif',
      itemLabelFontSizeMax: 26,
      itemLabelRadius: 0.9,
      itemLabelRadiusMax: 0.72,
      itemLabelAlign: 'center',
      itemLabelRotation: 90,
      onSpin: function(event) {
        if (motion !== null && motion.phase === 'settling' && event.method === 'spintoitem') {
          motion.wheelTravel = event.targetRotation - motion.wheelStart;
        }
      },
      onRest: function() {
        if (motion !== null && motion.phase === 'settling') finishSpin('completed');
      }
    });
    wheel.canvas.setAttribute('aria-label', 'European roulette wheel with 37 numbered pockets. The ball marks the saved result.');
    reducedMotion.addEventListener('change', function() {
      updateMotionNote();
      if (reducedMotion.matches) {
        if (animationInProgress) finishSpin('reduced-motion');
        else {
          stopMotion();
          if (spinInProgress) parkBall();
          else if (restingPocketIndex !== null) followRestingPocket();
        }
      } else if (spinInProgress && !animationInProgress && !document.hidden) {
        startMotion();
      } else {
        startIdleMotion();
      }
    });
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) {
        if (animationInProgress) finishSpin('hidden');
        else {
          stopMotion();
          if (spinInProgress) parkBall();
          else if (restingPocketIndex !== null) followRestingPocket();
        }
      } else if (spinInProgress && !animationInProgress && !reducedMotion.matches) {
        startMotion();
      } else {
        startIdleMotion();
      }
    });
    setStatus('Ready. Choose a bet and stake, then Spin.', false);
  } catch (error) {
    wheel = null;
    setStatus('The wheel is unavailable. Saved spins will still show their server result without animation.', true);
  }
  enterButton.addEventListener('click', function() {
    if (entryAcknowledged) return;
    entryAcknowledged = true;
    try { window.sessionStorage.setItem('zerotrace.disclaimerAcknowledged', 'yes'); } catch (error) {}
    entryDialog.close();
    simulator.inert = false;
    updateControls();
    document.getElementById('bet-red').focus();
    startIdleMotion();
  });
  entryDialog.addEventListener('cancel', function(event) {
    event.preventDefault();
  });
  try {
    entryAcknowledged = window.sessionStorage.getItem('zerotrace.disclaimerAcknowledged') === 'yes';
  } catch (error) {}
  simulator.inert = !entryAcknowledged;
  if (!entryAcknowledged) {
    entryDialog.showModal();
    enterButton.focus();
  }
  parkBall();
  updateMotionNote();
  updateControls();
  loadHistory();
  startIdleMotion();
})();
