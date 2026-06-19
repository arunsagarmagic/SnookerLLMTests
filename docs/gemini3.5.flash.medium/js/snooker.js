/**
 * Snooker game rules engine and state machine.
 * This module is completely decoupled from the UI and IndexedDB,
 * allowing it to be easily unit tested or run on a backend server.
 */

export const BALL_VALUES = {
  red: 1,
  yellow: 2,
  green: 3,
  brown: 4,
  blue: 5,
  pink: 6,
  black: 7
};

export const CLEARANCE_SEQUENCE = ['yellow', 'green', 'brown', 'blue', 'pink', 'black'];

/**
 * Calculates the maximum points remaining on the table.
 * @param {number} redsRemaining
 * @param {string} phase - 'normal' | 'clearance'
 * @param {string} onBall - current target ball
 * @returns {number}
 */
export function calculatePointsRemaining(redsRemaining, phase, onBall) {
  if (phase === 'normal') {
    if (redsRemaining > 0) {
      // Each red is worth 1 point and can be followed by a black (7 points)
      // Plus the colors clearance value (27 points)
      return (redsRemaining * 8) + 27;
    } else if (onBall === 'color') {
      // No reds left, but the color shot after the last red is still pending.
      // Maximum score is potting a black (7) plus clearance (27) = 34 points.
      return 7 + 27;
    }
  } else if (phase === 'clearance') {
    const startIndex = CLEARANCE_SEQUENCE.indexOf(onBall);
    if (startIndex === -1) return 0;
    
    let sum = 0;
    for (let i = startIndex; i < CLEARANCE_SEQUENCE.length; i++) {
      sum += BALL_VALUES[CLEARANCE_SEQUENCE[i]];
    }
    return sum;
  }
  return 0;
}

/**
 * Rebuilds the frame state from the actions in the history array.
 * Rebuilding state from history ensures data consistency and makes undo/redo simple.
 * @param {Object} frame - The frame object containing history
 * @returns {Object} Updated frame state
 */
export function rebuildFrameState(frame) {
  // Reset frame state to initial
  frame.p1Score = 0;
  frame.p2Score = 0;
  frame.redsRemaining = 15;
  frame.phase = 'normal';
  frame.onBall = 'red';
  frame.activePlayer = frame.activePlayer || 'player1'; // Maintain starting player if defined
  frame.status = 'ongoing';
  frame.winner = null;

  let currentBreak = 0;
  let lastPottedBall = null;

  // Process history sequence
  for (const action of frame.history) {
    if (action.type === 'pot') {
      const ballValue = BALL_VALUES[action.ball];
      const player = action.player;

      // Add score
      if (player === 'player1') {
        frame.p1Score += ballValue;
      } else {
        frame.p2Score += ballValue;
      }

      currentBreak += ballValue;
      lastPottedBall = action.ball;

      // Update state machine
      if (action.ball === 'red') {
        frame.redsRemaining = Math.max(0, frame.redsRemaining - 1);
        frame.onBall = 'color';
      } else {
        // Potted a color
        if (frame.phase === 'normal') {
          if (frame.redsRemaining > 0) {
            frame.onBall = 'red';
          } else {
            // Potted color after the last red, now move to clearance
            frame.phase = 'clearance';
            frame.onBall = 'yellow';
          }
        } else if (frame.phase === 'clearance') {
          const currentIndex = CLEARANCE_SEQUENCE.indexOf(action.ball);
          if (currentIndex !== -1 && currentIndex < CLEARANCE_SEQUENCE.length - 1) {
            frame.onBall = CLEARANCE_SEQUENCE[currentIndex + 1];
          } else if (action.ball === 'black') {
            // Black potted, frame finishes
            frame.onBall = 'none';
            frame.status = 'finished';
          }
        }
      }
    } else if (action.type === 'miss' || action.type === 'safety') {
      // Turn change
      currentBreak = 0;
      frame.activePlayer = action.player === 'player1' ? 'player2' : 'player1';
      
      // If we just potted a red but missed the color, or if it was a safety,
      // what is the ball on?
      if (frame.redsRemaining > 0) {
        frame.onBall = 'red';
      } else {
        if (frame.phase === 'normal' && frame.onBall === 'color') {
          // Missed the color after the last red. Move to yellow clearance.
          frame.phase = 'clearance';
          frame.onBall = 'yellow';
        }
        // If already in clearance, target stays on current clearance ball.
      }
    } else if (action.type === 'foul') {
      const points = action.points || 4;
      const offender = action.player;
      const receiver = offender === 'player1' ? 'player2' : 'player1';

      // Add points to receiver
      if (receiver === 'player1') {
        frame.p1Score += points;
      } else {
        frame.p2Score += points;
      }

      currentBreak = 0;
      frame.activePlayer = receiver; // Turn changes to the other player

      // Reset ball on target
      if (frame.redsRemaining > 0) {
        frame.onBall = 'red';
      } else {
        if (frame.phase === 'normal' && frame.onBall === 'color') {
          // Fouled on the color after the last red. Move to yellow clearance.
          frame.phase = 'clearance';
          frame.onBall = 'yellow';
        }
        // If already in clearance, target stays on current clearance ball.
      }
    } else if (action.type === 'concede') {
      frame.status = 'finished';
      const concedingPlayer = action.player;
      frame.winner = concedingPlayer === 'player1' ? 'player2' : 'player1';
    }
  }

  // Determine frame winner if finished
  if (frame.status === 'finished' && !frame.winner) {
    if (frame.p1Score > frame.p2Score) {
      frame.winner = 'player1';
    } else if (frame.p2Score > frame.p1Score) {
      frame.winner = 'player2';
    } else {
      // In the rare event of a tie when black is potted:
      // In professional snooker, a respotted black is played.
      // Here we will just flag it as tie or default winner to player 1 for simplicity, 
      // but let's default to a tie (or let's just make it player1 and let user handle it).
      frame.winner = 'tie';
    }
  }

  // Attach runtime property for UI (not saved to history list)
  frame.currentBreak = currentBreak;
  frame.pointsRemaining = calculatePointsRemaining(frame.redsRemaining, frame.phase, frame.onBall);

  return frame;
}

/**
 * Applies a play action to the frame history and rebuilds state.
 * @param {Object} frame - The frame object
 * @param {Object} action - Action details e.g. { type: 'pot', ball: 'red', player: 'player1' }
 * @returns {Object} Updated frame state
 */
export function applyAction(frame, action) {
  if (frame.status === 'finished') {
    throw new Error('Frame is already completed.');
  }

  // Ensure action contains the correct player context
  action.player = action.player || frame.activePlayer;
  action.timestamp = Date.now();

  frame.history.push(action);
  return rebuildFrameState(frame);
}

/**
 * Removes the last action from the frame history and rebuilds state.
 * @param {Object} frame
 * @returns {Object} Updated frame state
 */
export function undoAction(frame) {
  if (frame.history.length === 0) {
    return frame; // Nothing to undo
  }

  frame.history.pop();
  return rebuildFrameState(frame);
}

/**
 * Calculates statistics for the frame based on its history.
 * @param {Object} frame
 * @returns {Object} Frame statistics object
 */
export function calculateFrameStats(frame) {
  const stats = {
    player1: {
      highestBreak: 0,
      redsPotted: 0,
      colorsPotted: 0,
      foulsCommitted: 0,
      pointsConceded: 0
    },
    player2: {
      highestBreak: 0,
      redsPotted: 0,
      colorsPotted: 0,
      foulsCommitted: 0,
      pointsConceded: 0
    }
  };

  let currentBreak = 0;
  let currentBreakPlayer = null;

  for (const action of frame.history) {
    if (action.type === 'pot') {
      const p = action.player;
      if (p !== currentBreakPlayer) {
        currentBreak = 0;
        currentBreakPlayer = p;
      }
      currentBreak += BALL_VALUES[action.ball];
      stats[p].highestBreak = Math.max(stats[p].highestBreak, currentBreak);

      if (action.ball === 'red') {
        stats[p].redsPotted++;
      } else {
        stats[p].colorsPotted++;
      }
    } else if (action.type === 'miss' || action.type === 'safety' || action.type === 'foul') {
      currentBreak = 0;
      currentBreakPlayer = null;
      if (action.type === 'foul') {
        const offender = action.player;
        stats[offender].foulsCommitted++;
        stats[offender].pointsConceded += action.points || 4;
      }
    }
  }

  return stats;
}

