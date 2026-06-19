import { DatabaseService } from './db.js';
import { UIManager } from './ui.js';
import { applyAction, undoAction, rebuildFrameState } from './snooker.js';

// Instantiate core modules
const db = new DatabaseService();
const ui = new UIManager();

let currentMatch = null;

// ==========================================================================
// Initialization & Core Loading
// ==========================================================================

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await db.init();
    await loadHistory();
    bindEvents();
  } catch (error) {
    console.error('Initialization error:', error);
    alert('Failed to initialize database. Make sure IndexedDB is supported.');
  }
});

/**
 * Loads and renders the list of matches in the history panel.
 */
async function loadHistory() {
  try {
    const matches = await db.listMatches();
    ui.renderHistory(matches, handleSelectMatch, handleDeleteMatch);
  } catch (error) {
    console.error('Failed to load history:', error);
  }
}

// ==========================================================================
// Event Binding
// ==========================================================================

function bindEvents() {
  // Setup Form
  ui.setupForm.addEventListener('submit', handleStartMatch);

  // Ball Clicks
  ui.ballButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const ball = btn.dataset.ball;
      handleBallPot(ball);
    });
  });

  // Action Buttons
  ui.btnSafety.addEventListener('click', handleSafety);
  ui.btnFoul.addEventListener('click', () => ui.showFoulModal(true));
  ui.btnUndo.addEventListener('click', handleUndo);
  
  // More options Modal Toggle
  ui.btnMore.addEventListener('click', () => ui.showOptionsModal(true));
  ui.closeOptionsModal.addEventListener('click', () => ui.showOptionsModal(false));
  
  // Concede/Restart actions inside More Options
  ui.optConcede.addEventListener('click', handleConcede);
  ui.optRestart.addEventListener('click', handleRestartFrame);
  ui.optEndMatch.addEventListener('click', handleExitMatch);

  // Close Foul Modal
  ui.closeFoulModal.addEventListener('click', () => ui.showFoulModal(false));

  // Foul Point selections
  ui.foulPointButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const points = parseInt(btn.dataset.points, 10);
      handleFoul(points);
    });
  });

  // Frame Win Modal buttons
  ui.btnNextFrame.addEventListener('click', handleNextFrame);
  ui.btnViewMatchResults.addEventListener('click', () => {
    ui.showFrameWinModal(false);
    ui.showView('setup');
    loadHistory();
  });

  // Event delegation for the exit button in the header
  document.addEventListener('click', (e) => {
    if (e.target.closest('#btn-header-exit')) {
      handleExitMatch();
    }
  });
}

// ==========================================================================
// Event Handlers
// ==========================================================================

/**
 * Handles starting a new match from the setup form.
 */
async function handleStartMatch(event) {
  event.preventDefault();
  
  const p1Name = ui.p1NameInput.value.trim() || 'Player 1';
  const p2Name = ui.p2NameInput.value.trim() || 'Player 2';
  
  // Get selected Best of radio
  const selectedBestOf = document.querySelector('input[name="best-of"]:checked');
  const bestOf = selectedBestOf ? parseInt(selectedBestOf.value, 10) : 5;

  try {
    currentMatch = await db.createMatch(p1Name, p2Name, bestOf);
    const activeFrame = currentMatch.frames[currentMatch.currentFrameIndex];
    
    ui.showView('game');
    ui.updateScoreboard(currentMatch, activeFrame);
  } catch (error) {
    console.error('Error starting match:', error);
    alert('Could not start match. Please try again.');
  }
}

/**
 * Handles selecting a match from the history list to resume or view.
 */
async function handleSelectMatch(matchId) {
  try {
    currentMatch = await db.getMatch(matchId);
    
    // Get the current ongoing frame, or default to the last frame if completed
    let activeFrame = currentMatch.frames[currentMatch.currentFrameIndex];
    
    ui.showView('game');
    ui.updateScoreboard(currentMatch, activeFrame);

    // If the match is already finished, disable all interaction
    toggleInteractiveControls(currentMatch.status !== 'finished');
  } catch (error) {
    console.error('Error loading match:', error);
    alert('Failed to load match.');
  }
}

/**
 * Disables or enables table scoring buttons (e.g. for completed matches).
 */
function toggleInteractiveControls(enable) {
  ui.btnSafety.disabled = !enable;
  ui.btnFoul.disabled = !enable;
  ui.btnUndo.disabled = !enable;
  ui.btnMore.disabled = !enable;
  
  ui.ballButtons.forEach(btn => {
    if (!enable) btn.disabled = true;
  });
}

/**
 * Handles deleting a match from the database.
 */
async function handleDeleteMatch(matchId) {
  try {
    await db.deleteMatch(matchId);
    await loadHistory();
    // If the deleted match is the current match, reset it
    if (currentMatch && currentMatch.id === matchId) {
      currentMatch = null;
      ui.showView('setup');
    }
  } catch (error) {
    console.error('Failed to delete match:', error);
  }
}

/**
 * Handles potting a ball.
 */
async function handleBallPot(ballColor) {
  if (!currentMatch || currentMatch.status === 'finished') return;

  const frame = currentMatch.frames[currentMatch.currentFrameIndex];
  try {
    applyAction(frame, { type: 'pot', ball: ballColor });
    await db.saveMatch(currentMatch);
    ui.updateScoreboard(currentMatch, frame);
    checkFrameEnd();
  } catch (error) {
    console.error('Error applying pot action:', error);
  }
}

/**
 * Handles recording a safety play / miss (ends active break, switches player).
 */
async function handleSafety() {
  if (!currentMatch || currentMatch.status === 'finished') return;

  const frame = currentMatch.frames[currentMatch.currentFrameIndex];
  try {
    applyAction(frame, { type: 'safety' });
    await db.saveMatch(currentMatch);
    ui.updateScoreboard(currentMatch, frame);
  } catch (error) {
    console.error('Error applying safety action:', error);
  }
}

/**
 * Handles recording a foul.
 */
async function handleFoul(points) {
  if (!currentMatch || currentMatch.status === 'finished') return;

  const frame = currentMatch.frames[currentMatch.currentFrameIndex];
  try {
    applyAction(frame, { type: 'foul', points });
    await db.saveMatch(currentMatch);
    ui.showFoulModal(false);
    ui.updateScoreboard(currentMatch, frame);
    checkFrameEnd();
  } catch (error) {
    console.error('Error applying foul action:', error);
  }
}

/**
 * Handles undoing the last stroke.
 */
async function handleUndo() {
  if (!currentMatch) return;

  const frame = currentMatch.frames[currentMatch.currentFrameIndex];
  if (frame.history.length === 0) return;

  try {
    undoAction(frame);

    // Dynamic frame wins recount (in case we undo a frame-ending shot)
    let p1Wins = 0;
    let p2Wins = 0;
    currentMatch.frames.forEach(f => {
      if (f.status === 'finished') {
        if (f.winner === 'player1') p1Wins++;
        else if (f.winner === 'player2') p2Wins++;
      }
    });
    currentMatch.p1FrameWins = p1Wins;
    currentMatch.p2FrameWins = p2Wins;

    // Restore match status to ongoing if it was marked finished
    if (currentMatch.status === 'finished') {
      currentMatch.status = 'ongoing';
      currentMatch.winner = null;
      toggleInteractiveControls(true);
    }

    await db.saveMatch(currentMatch);
    ui.updateScoreboard(currentMatch, frame);
    ui.showFrameWinModal(false); // Hide in case it was showing
  } catch (error) {
    console.error('Error applying undo:', error);
  }
}

/**
 * Handles conceding the current frame.
 */
async function handleConcede() {
  if (!currentMatch || currentMatch.status === 'finished') return;

  const frame = currentMatch.frames[currentMatch.currentFrameIndex];
  try {
    applyAction(frame, { type: 'concede' });
    await db.saveMatch(currentMatch);
    ui.showOptionsModal(false);
    ui.updateScoreboard(currentMatch, frame);
    checkFrameEnd();
  } catch (error) {
    console.error('Error conceding frame:', error);
  }
}

/**
 * Restarts the current frame (clears history).
 */
async function handleRestartFrame() {
  if (!currentMatch || currentMatch.status === 'finished') return;

  if (confirm('Are you sure you want to restart this frame? All points in this frame will be lost.')) {
    const frame = currentMatch.frames[currentMatch.currentFrameIndex];
    frame.history = [];
    rebuildFrameState(frame);
    
    try {
      await db.saveMatch(currentMatch);
      ui.showOptionsModal(false);
      ui.updateScoreboard(currentMatch, frame);
    } catch (error) {
      console.error('Error restarting frame:', error);
    }
  }
}

/**
 * Exits the game screen and returns to the match setup screen.
 */
function handleExitMatch() {
  const isFinished = !currentMatch || currentMatch.status === 'finished';
  if (isFinished || confirm('Exit match scoring? Your progress is saved and can be resumed later.')) {
    ui.showOptionsModal(false);
    ui.showView('setup');
    loadHistory();
    currentMatch = null;
  }
}

/**
 * Adds a new frame to the match and transitions to it.
 */
async function handleNextFrame() {
  if (!currentMatch) return;

  try {
    currentMatch = db.addNewFrame(currentMatch);
    await db.saveMatch(currentMatch);
    
    ui.showFrameWinModal(false);
    const activeFrame = currentMatch.frames[currentMatch.currentFrameIndex];
    ui.updateScoreboard(currentMatch, activeFrame);
  } catch (error) {
    console.error('Error adding next frame:', error);
  }
}

/**
 * Checks if the current frame has ended and manages frame/match transitions.
 */
function checkFrameEnd() {
  const frame = currentMatch.frames[currentMatch.currentFrameIndex];
  
  if (frame.status === 'finished') {
    // Determine winner if not already set (e.g. from concession)
    if (!frame.winner) {
      if (frame.p1Score > frame.p2Score) {
        frame.winner = 'player1';
      } else if (frame.p2Score > frame.p1Score) {
        frame.winner = 'player2';
      } else {
        frame.winner = 'tie';
      }
    }

    // Recount frame wins
    let p1Wins = 0;
    let p2Wins = 0;
    currentMatch.frames.forEach(f => {
      if (f.status === 'finished') {
        if (f.winner === 'player1') p1Wins++;
        else if (f.winner === 'player2') p2Wins++;
      }
    });
    currentMatch.p1FrameWins = p1Wins;
    currentMatch.p2FrameWins = p2Wins;

    // Check if match is won
    const winsNeeded = Math.ceil(currentMatch.bestOf / 2);
    let isMatchFinished = false;
    
    if (currentMatch.p1FrameWins >= winsNeeded) {
      currentMatch.status = 'finished';
      currentMatch.winner = 'player1';
      isMatchFinished = true;
    } else if (currentMatch.p2FrameWins >= winsNeeded) {
      currentMatch.status = 'finished';
      currentMatch.winner = 'player2';
      isMatchFinished = true;
    }

    const winnerName = frame.winner === 'player1' 
      ? currentMatch.player1 
      : (frame.winner === 'player2' ? currentMatch.player2 : 'Tie');

    db.saveMatch(currentMatch).then(() => {
      ui.showFrameWinModal(true, winnerName, frame.p1Score, frame.p2Score, isMatchFinished);
      if (isMatchFinished) {
        toggleInteractiveControls(false);
      }
    });
  }
}
