/**
 * Pluggable Database Service for the Snooker Scoring App.
 * Uses IndexedDB to store matches and history locally in the browser.
 * This class exposes a clean, Promise-based API that can be easily
 * swapped for an HTTP REST client or another database driver later.
 */
export class DatabaseService {
  constructor() {
    this.dbName = 'SnookerScorerDB';
    this.dbVersion = 1;
    this.storeName = 'matches';
    this.db = null;
  }

  /**
   * Initializes the IndexedDB database.
   * @returns {Promise<void>}
   */
  init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve();
      };

      request.onerror = (event) => {
        reject(new Error(`Database error: ${event.target.error?.message || 'Unknown error'}`));
      };
    });
  }

  /**
   * Ensures the database is initialized.
   * @private
   */
  _ensureDb() {
    if (!this.db) {
      throw new Error('Database is not initialized. Call init() first.');
    }
  }

  /**
   * Creates a new match and saves it to the database.
   * @param {string} player1Name
   * @param {string} player2Name
   * @param {number} bestOf
   * @returns {Promise<Object>} The newly created Match object
   */
  async createMatch(player1Name, player2Name, bestOf) {
    this._ensureDb();
    const match = {
      id: `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      player1: player1Name.trim() || 'Player 1',
      player2: player2Name.trim() || 'Player 2',
      bestOf: Number(bestOf) || 5, // Best of 1, 3, 5, 7, etc.
      status: 'ongoing', // 'ongoing' | 'finished'
      winner: null, // 'player1' | 'player2'
      p1FrameWins: 0,
      p2FrameWins: 0,
      frames: [this._createNewFrame(1)],
      currentFrameIndex: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await this.saveMatch(match);
    return match;
  }

  /**
   * Helper to initialize a new frame object.
   * @param {number} frameNumber
   * @returns {Object}
   * @private
   */
  _createNewFrame(frameNumber) {
    return {
      frameNumber,
      p1Score: 0,
      p2Score: 0,
      winner: null, // 'player1' | 'player2' | null
      status: 'ongoing', // 'ongoing' | 'finished'
      history: [], // List of actions in the frame
      redsRemaining: 15,
      phase: 'normal', // 'normal' | 'clearance'
      onBall: 'red', // 'red' | 'color' | 'yellow' | 'green' | 'brown' | 'blue' | 'pink' | 'black'
      activePlayer: 'player1' // 'player1' | 'player2'
    };
  }

  /**
   * Retrieves a match by ID.
   * @param {string} matchId
   * @returns {Promise<Object>}
   */
  getMatch(matchId) {
    this._ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(matchId);

      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result);
        } else {
          reject(new Error(`Match with ID "${matchId}" not found.`));
        }
      };

      request.onerror = (event) => {
        reject(new Error(`Failed to fetch match: ${event.target.error?.message}`));
      };
    });
  }

  /**
   * Saves or updates a match in the database.
   * @param {Object} match
   * @returns {Promise<void>}
   */
  saveMatch(match) {
    this._ensureDb();
    return new Promise((resolve, reject) => {
      match.updatedAt = Date.now();
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(match);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = (event) => {
        reject(new Error(`Failed to save match: ${event.target.error?.message}`));
      };
    });
  }

  /**
   * Retrieves all matches sorted by creation time (newest first).
   * @returns {Promise<Array<Object>>}
   */
  listMatches() {
    this._ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const matches = request.result || [];
        // Sort newest first
        matches.sort((a, b) => b.createdAt - a.createdAt);
        resolve(matches);
      };

      request.onerror = (event) => {
        reject(new Error(`Failed to list matches: ${event.target.error?.message}`));
      };
    });
  }

  /**
   * Deletes a match from the database.
   * @param {string} matchId
   * @returns {Promise<void>}
   */
  deleteMatch(matchId) {
    this._ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(matchId);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = (event) => {
        reject(new Error(`Failed to delete match: ${event.target.error?.message}`));
      };
    });
  }

  /**
   * Creates and appends a new frame to an ongoing match.
   * @param {Object} match
   * @returns {Object} Updated match object
   */
  addNewFrame(match) {
    if (match.status !== 'ongoing') {
      throw new Error('Cannot add a frame to a completed match.');
    }
    const nextFrameNum = match.frames.length + 1;
    const newFrame = this._createNewFrame(nextFrameNum);
    match.frames.push(newFrame);
    match.currentFrameIndex = match.frames.length - 1;
    return match;
  }
}
