import { BALL_VALUES, calculateFrameStats } from './snooker.js';

export class UIManager {
  constructor() {
    this.cacheElements();
  }

  cacheElements() {
    // Views
    this.setupView = document.getElementById('setup-view');
    this.gameView = document.getElementById('game-view');
    this.headerActions = document.getElementById('header-actions');

    // Setup Form
    this.setupForm = document.getElementById('match-setup-form');
    this.p1NameInput = document.getElementById('p1-name');
    this.p2NameInput = document.getElementById('p2-name');
    this.historyList = document.getElementById('history-list');

    // Scoreboard
    this.matchFormatLabel = document.getElementById('match-format-label');
    this.frameNumberLabel = document.getElementById('frame-number-label');
    this.p1WinsDisplay = document.getElementById('p1-wins-display');
    this.p2WinsDisplay = document.getElementById('p2-wins-display');
    
    this.p1Card = document.getElementById('p1-card');
    this.p2Card = document.getElementById('p2-card');
    this.p1NameDisplay = document.getElementById('p1-name-display');
    this.p2NameDisplay = document.getElementById('p2-name-display');
    this.p1ScoreDisplay = document.getElementById('p1-score-display');
    this.p2ScoreDisplay = document.getElementById('p2-score-display');
    this.p1Substats = document.getElementById('p1-substats');
    this.p2Substats = document.getElementById('p2-substats');

    this.currentBreakDisplay = document.getElementById('current-break');
    this.pointsLeftDisplay = document.getElementById('points-left');
    this.redsLeftDisplay = document.getElementById('reds-left');
    this.ballOnLabel = document.getElementById('ball-on-label');

    // Balls
    this.ballTray = document.getElementById('ball-tray');
    this.ballButtons = this.ballTray.querySelectorAll('.ball-btn');

    // Console Actions
    this.btnSafety = document.getElementById('btn-safety');
    this.btnFoul = document.getElementById('btn-foul');
    this.btnUndo = document.getElementById('btn-undo');
    this.btnMore = document.getElementById('btn-more');

    // Panels
    this.strokeFeed = document.getElementById('stroke-feed');
    this.frameStatsDisplay = document.getElementById('frame-stats-display');

    // Modals
    this.foulModal = document.getElementById('foul-modal');
    this.closeFoulModal = document.getElementById('close-foul-modal');
    this.foulPointButtons = this.foulModal.querySelectorAll('.foul-pt-btn');

    this.optionsModal = document.getElementById('options-modal');
    this.closeOptionsModal = document.getElementById('close-options-modal');
    this.optConcede = document.getElementById('opt-concede');
    this.optRestart = document.getElementById('opt-restart');
    this.optEndMatch = document.getElementById('opt-end-match');

    this.frameWinModal = document.getElementById('frame-win-modal');
    this.frameWinnerTitle = document.getElementById('frame-winner-title');
    this.frameWinnerDesc = document.getElementById('frame-winner-desc');
    this.btnNextFrame = document.getElementById('btn-next-frame');
    this.btnViewMatchResults = document.getElementById('btn-view-match-results');
  }

  /**
   * Switches visibility between setup screen and scoring game screen.
   * @param {string} view - 'setup' | 'game'
   */
  showView(view) {
    if (view === 'setup') {
      this.setupView.classList.add('active');
      this.gameView.classList.remove('active');
      this.headerActions.innerHTML = ''; // Clear header action
    } else if (view === 'game') {
      this.setupView.classList.remove('active');
      this.gameView.classList.add('active');
      
      // Add a 'Home' / 'Exit' button to the header
      this.headerActions.innerHTML = `
        <button id="btn-header-exit" class="btn btn-secondary btn-glow" style="padding: 0.5rem 1rem; font-size: 0.9rem;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Exit Match
        </button>
      `;
    }
  }

  /**
   * Renders the match history list.
   * @param {Array<Object>} matches 
   * @param {Function} onSelectMatch 
   * @param {Function} onDeleteMatch 
   */
  renderHistory(matches, onSelectMatch, onDeleteMatch) {
    if (!matches || matches.length === 0) {
      this.historyList.innerHTML = `<div class="empty-state">No matches found. Start a new one above!</div>`;
      return;
    }

    this.historyList.innerHTML = '';
    matches.forEach(match => {
      const dateStr = new Date(match.createdAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const isFinished = match.status === 'finished';
      const statusClass = isFinished ? 'finished' : 'ongoing';
      const statusText = isFinished ? 'Finished' : 'Ongoing';
      
      // Winner string check
      let resultText = '';
      if (isFinished) {
        if (match.winner === 'player1') {
          resultText = `${match.player1} won`;
        } else if (match.winner === 'player2') {
          resultText = `${match.player2} won`;
        } else {
          resultText = 'Draw';
        }
      } else {
        resultText = `Frame ${match.frames.length}`;
      }

      const item = document.createElement('div');
      item.className = 'history-item';
      item.innerHTML = `
        <div class="history-players">
          <span class="history-names">${match.player1} <span style="color:var(--text-muted);">vs</span> ${match.player2}</span>
          <span class="history-date">${dateStr} • ${resultText}</span>
        </div>
        <div class="history-results">
          <span class="history-score">${match.p1FrameWins} - ${match.p2FrameWins}</span>
          <span class="status-badge ${statusClass}">${statusText}</span>
          <button class="btn btn-secondary btn-icon-only btn-delete-match" data-id="${match.id}" style="padding: 0.5rem; width:34px; height:34px; background:transparent; border-color:transparent;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-red)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              <line x1="10" y1="11" x2="10" y2="17"/>
              <line x1="14" y1="11" x2="14" y2="17"/>
            </svg>
          </button>
        </div>
      `;

      // Click to load/resume match
      item.addEventListener('click', (e) => {
        if (e.target.closest('.btn-delete-match')) {
          e.stopPropagation();
          const matchId = e.target.closest('.btn-delete-match').dataset.id;
          if (confirm('Are you sure you want to delete this match history?')) {
            onDeleteMatch(matchId);
          }
          return;
        }
        onSelectMatch(match.id);
      });

      this.historyList.appendChild(item);
    });
  }

  /**
   * Updates the scoring screen dashboard.
   * @param {Object} match 
   * @param {Object} frame 
   */
  updateScoreboard(match, frame) {
    // Header Info
    this.matchFormatLabel.textContent = `Best of ${match.bestOf} Frames`;
    this.frameNumberLabel.textContent = `Frame ${frame.frameNumber}`;
    this.p1WinsDisplay.textContent = match.p1FrameWins;
    this.p2WinsDisplay.textContent = match.p2FrameWins;

    // Names
    this.p1NameDisplay.textContent = match.player1;
    this.p2NameDisplay.textContent = match.player2;

    // Scores
    this.animateScoreChange(this.p1ScoreDisplay, frame.p1Score);
    this.animateScoreChange(this.p2ScoreDisplay, frame.p2Score);

    // Active Player Indicator & Card Styling
    if (frame.activePlayer === 'player1') {
      this.p1Card.classList.add('active');
      this.p2Card.classList.remove('active');
    } else {
      this.p2Card.classList.add('active');
      this.p1Card.classList.remove('active');
    }

    // Middle Stat Box
    this.currentBreakDisplay.textContent = frame.currentBreak;
    this.pointsLeftDisplay.textContent = frame.pointsRemaining;
    this.redsLeftDisplay.textContent = frame.redsRemaining;

    // Substats (Show active break under player name if they are in a break)
    if (frame.currentBreak > 0) {
      if (frame.activePlayer === 'player1') {
        this.p1Substats.innerHTML = `<span class="break-glow" style="font-weight:600;">Break: ${frame.currentBreak}</span>`;
        this.p2Substats.innerHTML = '';
      } else {
        this.p1Substats.innerHTML = '';
        this.p2Substats.innerHTML = `<span class="break-glow" style="font-weight:600;">Break: ${frame.currentBreak}</span>`;
      }
    } else {
      this.p1Substats.innerHTML = '';
      this.p2Substats.innerHTML = '';
    }

    // Ball on indicator badge styling
    this.updateBallOnBadge(frame.onBall);

    // Ball Buttons enabling/disabling
    this.updateBallTray(frame.onBall);

    // Render feed & stats
    this.updateStrokeFeed(frame.history, match.player1, match.player2);
    
    const stats = calculateFrameStats(frame);
    this.updateFrameStats(stats, match.player1, match.player2, frame.pointsRemaining);
  }

  /**
   * Helper to animate score updates.
   */
  animateScoreChange(element, newScore) {
    const currentScore = parseInt(element.textContent, 10) || 0;
    if (currentScore !== newScore) {
      element.textContent = newScore;
      element.style.transform = 'scale(1.2)';
      setTimeout(() => {
        element.style.transform = 'scale(1)';
      }, 150);
    }
  }

  /**
   * Updates the "Ball On" badge element.
   * @param {string} onBall 
   */
  updateBallOnBadge(onBall) {
    this.ballOnLabel.textContent = onBall;
    this.ballOnLabel.className = `badge ${onBall}`;
  }

  /**
   * Enables or disables buttons on the ball tray based on current rules state.
   * @param {string} onBall 
   */
  updateBallTray(onBall) {
    this.ballButtons.forEach(btn => {
      const ball = btn.dataset.ball;

      if (onBall === 'red') {
        // Only red allowed
        btn.disabled = (ball !== 'red');
      } else if (onBall === 'color') {
        // Any color allowed (everything but red)
        btn.disabled = (ball === 'red');
      } else {
        // Specific color clearance phase (only the specific color is allowed)
        btn.disabled = (ball !== onBall);
      }
    });
  }

  /**
   * Renders the list of actions in the bottom log feed.
   */
  updateStrokeFeed(history, p1Name, p2Name) {
    if (!history || history.length === 0) {
      this.strokeFeed.innerHTML = `<div class="feed-placeholder">Match started. Click balls to score.</div>`;
      return;
    }

    this.strokeFeed.innerHTML = '';
    // Show recent actions first (reverse chronological)
    const reversedHistory = [...history].reverse();
    
    reversedHistory.forEach(action => {
      const item = document.createElement('div');
      const playerClass = action.player === 'player1' ? 'p1' : 'p2';
      const name = action.player === 'player1' ? p1Name : p2Name;
      
      let actionHtml = '';
      if (action.type === 'pot') {
        const ballDisplay = action.ball.toUpperCase();
        actionHtml = `
          <span class="player">${name}</span>
          <span class="action">Potted <span class="badge ${action.ball}" style="padding:0.1rem 0.4rem; font-size:0.7rem; border-radius:4px;">${ballDisplay}</span></span>
          <span class="detail">+${BALL_VALUES[action.ball]} pts</span>
        `;
      } else if (action.type === 'miss' || action.type === 'safety') {
        actionHtml = `
          <span class="player">${name}</span>
          <span class="action" style="color: var(--text-secondary);">${action.type === 'miss' ? 'Missed shot' : 'Safety play'}</span>
          <span class="detail">Turn over</span>
        `;
      } else if (action.type === 'foul') {
        const receiverName = action.player === 'player1' ? p2Name : p1Name;
        actionHtml = `
          <span class="player" style="color: var(--accent-red);">${name}</span>
          <span class="action" style="color: var(--accent-red); font-weight: 600;">FOUL</span>
          <span class="detail">+${action.points} to ${receiverName}</span>
        `;
      } else if (action.type === 'concede') {
        actionHtml = `
          <span class="player">${name}</span>
          <span class="action" style="color: var(--accent-red);">Conceded frame</span>
          <span class="detail">Frame over</span>
        `;
      }

      item.className = `feed-item ${playerClass}`;
      item.innerHTML = actionHtml;
      this.strokeFeed.appendChild(item);
    });
  }

  /**
   * Renders the frame stats table in the bottom panel.
   */
  updateFrameStats(stats, p1Name, p2Name, pointsRemaining) {
    this.frameStatsDisplay.innerHTML = `
      <div class="stat-row">
        <span>STATISTIC</span>
        <span style="display:flex; justify-content:space-between; width: 60%;">
          <span style="flex:1; text-align:center;">${p1Name}</span>
          <span style="flex:1; text-align:center;">${p2Name}</span>
        </span>
      </div>
      <div class="stat-row">
        <span>Highest Break</span>
        <span style="display:flex; justify-content:space-between; width: 60%; font-weight:700;">
          <span style="flex:1; text-align:center;" class="${stats.player1.highestBreak > 0 ? 'break-glow' : ''}">${stats.player1.highestBreak}</span>
          <span style="flex:1; text-align:center;" class="${stats.player2.highestBreak > 0 ? 'break-glow' : ''}">${stats.player2.highestBreak}</span>
        </span>
      </div>
      <div class="stat-row">
        <span>Reds Potted</span>
        <span style="display:flex; justify-content:space-between; width: 60%;">
          <span style="flex:1; text-align:center;">${stats.player1.redsPotted}</span>
          <span style="flex:1; text-align:center;">${stats.player2.redsPotted}</span>
        </span>
      </div>
      <div class="stat-row">
        <span>Colors Potted</span>
        <span style="display:flex; justify-content:space-between; width: 60%;">
          <span style="flex:1; text-align:center;">${stats.player1.colorsPotted}</span>
          <span style="flex:1; text-align:center;">${stats.player2.colorsPotted}</span>
        </span>
      </div>
      <div class="stat-row">
        <span>Fouls Committed</span>
        <span style="display:flex; justify-content:space-between; width: 60%;">
          <span style="flex:1; text-align:center; color:${stats.player1.foulsCommitted > 0 ? 'var(--accent-red)' : ''}">${stats.player1.foulsCommitted}</span>
          <span style="flex:1; text-align:center; color:${stats.player2.foulsCommitted > 0 ? 'var(--accent-red)' : ''}">${stats.player2.foulsCommitted}</span>
        </span>
      </div>
      <div class="stat-row">
        <span>Penalty Pts Conceded</span>
        <span style="display:flex; justify-content:space-between; width: 60%;">
          <span style="flex:1; text-align:center; color:${stats.player1.pointsConceded > 0 ? 'var(--accent-red)' : ''}">${stats.player1.pointsConceded}</span>
          <span style="flex:1; text-align:center; color:${stats.player2.pointsConceded > 0 ? 'var(--accent-red)' : ''}">${stats.player2.pointsConceded}</span>
        </span>
      </div>
    `;
  }

  // Modals Toggling
  showFoulModal(show) {
    if (show) this.foulModal.classList.add('active');
    else this.foulModal.classList.remove('active');
  }

  showOptionsModal(show) {
    if (show) this.optionsModal.classList.add('active');
    else this.optionsModal.classList.remove('active');
  }

  showFrameWinModal(show, winnerName, p1Score, p2Score, isMatchFinished = false) {
    if (show) {
      this.frameWinnerTitle.textContent = isMatchFinished ? 'Match Completed!' : 'Frame Complete!';
      this.frameWinnerDesc.textContent = `${winnerName} wins (${p1Score} - ${p2Score})`;
      
      if (isMatchFinished) {
        this.btnNextFrame.classList.add('hide');
        this.btnViewMatchResults.classList.remove('hide');
        this.btnViewMatchResults.textContent = 'Back to Setup';
      } else {
        this.btnNextFrame.classList.remove('hide');
        this.btnViewMatchResults.classList.add('hide');
      }
      
      this.frameWinModal.classList.add('active');
    } else {
      this.frameWinModal.classList.remove('active');
    }
  }
}
