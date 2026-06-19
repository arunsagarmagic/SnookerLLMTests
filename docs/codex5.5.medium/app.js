const BALLS = {
  red: { label: "Red", value: 1 },
  yellow: { label: "Yellow", value: 2 },
  green: { label: "Green", value: 3 },
  brown: { label: "Brown", value: 4 },
  blue: { label: "Blue", value: 5 },
  pink: { label: "Pink", value: 6 },
  black: { label: "Black", value: 7 },
};

const COLOUR_CLEARANCE = ["yellow", "green", "brown", "blue", "pink", "black"];

class FrameRepository {
  async getCurrentFrame() { throw new Error("Not implemented"); }
  async saveCurrentFrame(frame) { throw new Error("Not implemented"); }
  async clearCurrentFrame() { throw new Error("Not implemented"); }
  async listCompletedFrames() { throw new Error("Not implemented"); }
  async addCompletedFrame(frame) { throw new Error("Not implemented"); }
  async clearCompletedFrames() { throw new Error("Not implemented"); }
}

class IndexedDbFrameRepository extends FrameRepository {
  constructor(name = "snooker-scorer", version = 1) {
    super();
    this.name = name;
    this.version = version;
    this.dbPromise = null;
  }

  open() {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.name, this.version);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
        if (!db.objectStoreNames.contains("frames")) {
          db.createObjectStore("frames", { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.dbPromise;
  }

  async get(storeName, key) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const request = tx.objectStore(storeName).get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async put(storeName, value, key) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const request = key === undefined ? store.put(value) : store.put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName, key) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const request = tx.objectStore(storeName).delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(storeName) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const request = tx.objectStore(storeName).clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  getCurrentFrame() {
    return this.get("meta", "currentFrame");
  }

  saveCurrentFrame(frame) {
    return this.put("meta", frame, "currentFrame");
  }

  clearCurrentFrame() {
    return this.delete("meta", "currentFrame");
  }

  async listCompletedFrames() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("frames", "readonly");
      const request = tx.objectStore("frames").getAll();
      request.onsuccess = () => resolve(request.result.sort((a, b) => b.completedAt.localeCompare(a.completedAt)));
      request.onerror = () => reject(request.error);
    });
  }

  addCompletedFrame(frame) {
    return this.put("frames", frame);
  }

  clearCompletedFrames() {
    return this.clear("frames");
  }
}

const repository = new IndexedDbFrameRepository();
let frame = null;
let completedFrames = [];

const elements = {
  setupPanel: document.querySelector("#setupPanel"),
  setupForm: document.querySelector("#setupForm"),
  playerOneInput: document.querySelector("#playerOneInput"),
  playerTwoInput: document.querySelector("#playerTwoInput"),
  scoreboard: document.querySelector("#scoreboard"),
  tablePanel: document.querySelector("#tablePanel"),
  historyPanel: document.querySelector("#historyPanel"),
  playerOneName: document.querySelector("#playerOneName"),
  playerTwoName: document.querySelector("#playerTwoName"),
  playerOneScore: document.querySelector("#playerOneScore"),
  playerTwoScore: document.querySelector("#playerTwoScore"),
  turnLabel: document.querySelector("#turnLabel"),
  phaseLabel: document.querySelector("#phaseLabel"),
  remainingLabel: document.querySelector("#remainingLabel"),
  redCounter: document.querySelector("#redCounter"),
  ballButtons: [...document.querySelectorAll("[data-ball]")],
  turnButtons: [...document.querySelectorAll("[data-turn]")],
  turnPlayerOne: document.querySelector("#turnPlayerOne"),
  turnPlayerTwo: document.querySelector("#turnPlayerTwo"),
  missButton: document.querySelector("#missButton"),
  undoButton: document.querySelector("#undoButton"),
  newFrameButton: document.querySelector("#newFrameButton"),
  foulForm: document.querySelector("#foulForm"),
  foulValue: document.querySelector("#foulValue"),
  historyList: document.querySelector("#historyList"),
  archiveList: document.querySelector("#archiveList"),
  clearHistoryButton: document.querySelector("#clearHistoryButton"),
};

function createFrame(playerNames) {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    completedAt: null,
    players: playerNames.map((name) => ({ name, score: 0 })),
    currentPlayer: 0,
    redsRemaining: 15,
    next: "red",
    clearanceIndex: 0,
    events: [],
  };
}

function cloneFrame(value) {
  return structuredClone(value);
}

function legalBalls() {
  if (!frame) return [];
  if (frame.next === "red") return frame.redsRemaining > 0 ? ["red"] : [COLOUR_CLEARANCE[frame.clearanceIndex]];
  if (frame.next === "colour") return COLOUR_CLEARANCE;
  return [COLOUR_CLEARANCE[frame.clearanceIndex]];
}

function scoreBall(ball) {
  const legal = legalBalls();
  if (!legal.includes(ball)) return;
  const before = cloneFrame(frame);
  frame.players[frame.currentPlayer].score += BALLS[ball].value;
  if (ball === "red") {
    frame.redsRemaining -= 1;
    frame.next = frame.redsRemaining > 0 ? "colour" : "clearance";
  } else if (frame.next === "colour") {
    frame.next = frame.redsRemaining > 0 ? "red" : "clearance";
  } else if (frame.next === "clearance") {
    frame.clearanceIndex += 1;
    if (frame.clearanceIndex >= COLOUR_CLEARANCE.length) frame.completedAt = new Date().toISOString();
  }
  recordEvent(before, `${frame.players[frame.currentPlayer].name} potted ${BALLS[ball].label} (+${BALLS[ball].value})`);
}

function switchPlayer(playerIndex = frame.currentPlayer === 0 ? 1 : 0) {
  const before = cloneFrame(frame);
  frame.currentPlayer = Number(playerIndex);
  recordEvent(before, `${frame.players[frame.currentPlayer].name} to play`);
}

function recordMiss() {
  const before = cloneFrame(frame);
  const playerName = frame.players[frame.currentPlayer].name;
  frame.currentPlayer = frame.currentPlayer === 0 ? 1 : 0;
  recordEvent(before, `${playerName} ended visit`);
}

function recordFoul(points) {
  const before = cloneFrame(frame);
  const offender = frame.currentPlayer;
  const opponent = offender === 0 ? 1 : 0;
  frame.players[opponent].score += points;
  frame.currentPlayer = opponent;
  recordEvent(before, `${frame.players[offender].name} foul, ${frame.players[opponent].name} +${points}`);
}

function recordEvent(before, label) {
  frame.events.push({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    label,
    before,
  });
  persistAndRender();
}

async function undoLast() {
  if (!frame || frame.events.length === 0) return;
  const last = frame.events.at(-1);
  frame = last.before;
  await persistAndRender();
}

function phaseText() {
  if (!frame) return "";
  if (frame.completedAt) return "Frame complete";
  if (frame.next === "red") return "Red is on";
  if (frame.next === "colour") return "Colour is on";
  return `${BALLS[COLOUR_CLEARANCE[frame.clearanceIndex]].label} is on`;
}

function render() {
  const hasFrame = Boolean(frame);
  elements.setupPanel.classList.toggle("hidden", hasFrame);
  elements.scoreboard.classList.toggle("hidden", !hasFrame);
  elements.tablePanel.classList.toggle("hidden", !hasFrame);
  elements.historyPanel.classList.toggle("hidden", !hasFrame && completedFrames.length === 0);
  renderArchive();
  if (!hasFrame) {
    elements.historyList.innerHTML = "";
    return;
  }

  elements.playerOneName.textContent = frame.players[0].name;
  elements.playerTwoName.textContent = frame.players[1].name;
  elements.playerOneScore.textContent = frame.players[0].score;
  elements.playerTwoScore.textContent = frame.players[1].score;
  elements.turnPlayerOne.textContent = frame.players[0].name;
  elements.turnPlayerTwo.textContent = frame.players[1].name;
  elements.turnLabel.textContent = `${frame.players[frame.currentPlayer].name} at table`;
  elements.phaseLabel.textContent = phaseText();
  elements.remainingLabel.textContent = `${frame.redsRemaining} red${frame.redsRemaining === 1 ? "" : "s"} left`;
  elements.redCounter.textContent = frame.redsRemaining;

  document.querySelectorAll("[data-player-card]").forEach((card) => {
    card.classList.toggle("active", Number(card.dataset.playerCard) === frame.currentPlayer);
  });
  elements.turnButtons.forEach((button) => {
    button.classList.toggle("selected", Number(button.dataset.turn) === frame.currentPlayer);
  });

  const legal = legalBalls();
  elements.ballButtons.forEach((button) => {
    const disabled = frame.completedAt || !legal.includes(button.dataset.ball) || (button.dataset.ball === "red" && frame.redsRemaining === 0);
    button.disabled = disabled;
    button.classList.toggle("disabled", disabled);
  });
  elements.undoButton.disabled = frame.events.length === 0;
  renderHistory();
}

function renderHistory() {
  elements.historyList.innerHTML = "";
  if (frame.events.length === 0) {
    const item = document.createElement("li");
    item.textContent = "No scoring events yet";
    elements.historyList.append(item);
    return;
  }
  [...frame.events].reverse().forEach((event) => {
    const item = document.createElement("li");
    const time = new Date(event.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    item.textContent = `${time} - ${event.label}`;
    elements.historyList.append(item);
  });
}

function renderArchive() {
  elements.archiveList.innerHTML = "";
  if (completedFrames.length === 0) {
    const item = document.createElement("li");
    item.textContent = "No saved frames";
    elements.archiveList.append(item);
    return;
  }
  completedFrames.forEach((savedFrame) => {
    const item = document.createElement("li");
    const completedAt = new Date(savedFrame.completedAt).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    item.textContent = `${completedAt} - ${savedFrame.players[0].name} ${savedFrame.players[0].score}, ${savedFrame.players[1].name} ${savedFrame.players[1].score}`;
    elements.archiveList.append(item);
  });
}

async function persistAndRender() {
  if (!frame) return;
  await repository.saveCurrentFrame(frame);
  if (frame.completedAt) {
    await repository.addCompletedFrame(frame);
    completedFrames = await repository.listCompletedFrames();
    await repository.clearCurrentFrame();
  }
  render();
}

async function startFrame(playerNames) {
  frame = createFrame(playerNames);
  await persistAndRender();
}

async function newFrame() {
  if (frame && frame.events.length > 0 && !frame.completedAt) {
    await repository.addCompletedFrame({ ...frame, completedAt: new Date().toISOString() });
    completedFrames = await repository.listCompletedFrames();
  }
  frame = null;
  await repository.clearCurrentFrame();
  render();
}

function bindEvents() {
  elements.setupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const names = [
      elements.playerOneInput.value.trim() || "Player 1",
      elements.playerTwoInput.value.trim() || "Player 2",
    ];
    await startFrame(names);
  });

  elements.ballButtons.forEach((button) => {
    button.addEventListener("click", () => scoreBall(button.dataset.ball));
  });

  elements.turnButtons.forEach((button) => {
    button.addEventListener("click", () => switchPlayer(button.dataset.turn));
  });

  elements.missButton.addEventListener("click", recordMiss);
  elements.undoButton.addEventListener("click", undoLast);
  elements.newFrameButton.addEventListener("click", newFrame);

  elements.foulForm.addEventListener("submit", (event) => {
    event.preventDefault();
    recordFoul(Number(elements.foulValue.value));
  });

  elements.clearHistoryButton.addEventListener("click", async () => {
    await repository.clearCompletedFrames();
    completedFrames = [];
    render();
  });
}

async function boot() {
  bindEvents();
  frame = await repository.getCurrentFrame();
  completedFrames = await repository.listCompletedFrames();
  if (frame) {
    elements.playerOneInput.value = frame.players[0].name;
    elements.playerTwoInput.value = frame.players[1].name;
  }
  render();
}

boot().catch((error) => {
  console.error(error);
  alert("Could not open the local scoring database.");
});
