// ═══════════════════════════════════════════════════════════
// CLASS: Note
// Represents a single falling note on the track.
// UML: -lane, -timeStamp, -isHit, -isMissed | +spawn, +move, +checkHit
// ═══════════════════════════════════════════════════════════
class Note {
  #lane; #timeStamp; #isHit; #isMissed; #el; #y;
  static NOTE_HEIGHT = 64;

  constructor(lane, timeStamp) {
    this.#lane = lane; this.#timeStamp = timeStamp;
    this.#isHit = false; this.#isMissed = false;
    this.#y = -Note.NOTE_HEIGHT; this.#el = null;
  }

  get lane()     { return this.#lane; }
  get y()        { return this.#y; }
  get isHit()    { return this.#isHit; }
  get isMissed() { return this.#isMissed; }

  spawn(trackEl) {
    this.#el = document.createElement('div');
    this.#el.classList.add('note');
    this.#el.dataset.lane = this.#lane;
    trackEl.appendChild(this.#el);
  }

  move(fallSpeed) {
    this.#y += fallSpeed;
    this.#el.style.top = this.#y + 'px';
  }

  checkHit(trackHeight, hitWindow) {
    const noteBottom = this.#y + Note.NOTE_HEIGHT;
    const hitLine = trackHeight + 60;
    return noteBottom >= (hitLine - hitWindow) && this.#y <= hitLine;
  }

  destroy() {
    this.#isHit = true;
    this.#el.classList.add('hit');
    this.#el.addEventListener('animationend', () => this.#el.remove(), { once: true });
  }

  miss() {
    this.#isMissed = true;
    this.#el.remove();
  }
}


// ═══════════════════════════════════════════════════════════
// CLASS: Lane
// Represents one of the four button lanes.
// UML: -laneId, -keyBinding, -notes | +addNote, +removeNote
// ═══════════════════════════════════════════════════════════
class Lane {
  #laneId; #keyBinding; #notes; #btnEl;

  constructor(laneId, keyBinding) {
    this.#laneId = laneId;
    this.#keyBinding = keyBinding;
    this.#notes = [];
    this.#btnEl = document.querySelector(`.lane-btn[data-lane="${laneId}"]`);
  }

  get laneId()     { return this.#laneId; }
  get keyBinding() { return this.#keyBinding; }
  get notes()      { return this.#notes; }

  addNote(note)    { this.#notes.push(note); }
  removeNote(note) { const i = this.#notes.indexOf(note); if (i !== -1) this.#notes.splice(i, 1); }
  press()          { this.#btnEl.classList.add('pressed'); }
  release()        { this.#btnEl.classList.remove('pressed'); }
}


// ═══════════════════════════════════════════════════════════
// CLASS: ScoreManager
// Tracks score, multiplier, streaks, and note stats.
// ═══════════════════════════════════════════════════════════
class ScoreManager {
  #score; #multiplier; #perfectStreak; #totalNotes; #hitNotes; #perfectNotes;
  #scoreEl; #multiplierEl; #multiplierBarEl;

  static MAX_MULTIPLIER = 8;
  static STREAK_THRESHOLDS = [0, 0, 5, 10, 20, 30, 40, 50];

  constructor() {
    this.#score = 0;
    this.#multiplier = 1;
    this.#perfectStreak = 0;
    this.#totalNotes = 0;
    this.#hitNotes = 0;
    this.#perfectNotes = 0;

    // DOM elements looked up lazily in #refreshUI so they're always available
    this.#scoreEl         = null;
    this.#multiplierEl    = null;
    this.#multiplierBarEl = null;
  }

  get score()        { return this.#score; }
  get multiplier()   { return this.#multiplier; }
  get totalNotes()   { return this.#totalNotes; }
  get hitNotes()     { return this.#hitNotes; }
  get perfectNotes() { return this.#perfectNotes; }

  addNote() { this.#totalNotes++; }

  addHit(basePoints, isPerfect) {
    this.#hitNotes++;
    if (isPerfect) {
      this.#perfectNotes++;
      this.#perfectStreak++;
      this.#updateMultiplier();
    } else {
      this.#breakStreak();
    }
    this.#score += basePoints * this.#multiplier;
    this.#refreshUI();
  }

  addMiss() {
    this.#breakStreak();
    this.#refreshUI();
  }

  #breakStreak() {
    this.#perfectStreak = 0;
    this.#multiplier = 1;
  }

  #updateMultiplier() {
    for (let lvl = ScoreManager.MAX_MULTIPLIER; lvl >= 1; lvl--) {
      if (this.#perfectStreak >= ScoreManager.STREAK_THRESHOLDS[lvl - 1]) {
        this.#multiplier = lvl;
        break;
      }
    }
  }

  #refreshUI() {
    // Lazy-load DOM refs — gameArea is hidden (display:none) at construction time
    if (!this.#scoreEl)         this.#scoreEl         = document.getElementById('scoreDisplay');
    if (!this.#multiplierEl)    this.#multiplierEl    = document.getElementById('multiplierDisplay');
    if (!this.#multiplierBarEl) this.#multiplierBarEl = document.getElementById('multiplierBar');

    if (this.#scoreEl) {
      this.#scoreEl.textContent = this.#score.toLocaleString();
    }
    if (this.#multiplierEl) {
      const prev = this.#multiplierEl.textContent;
      this.#multiplierEl.textContent = `x${this.#multiplier}`;
      if (prev !== `x${this.#multiplier}`) {
        this.#multiplierEl.classList.remove('multiplier-pulse');
        void this.#multiplierEl.offsetWidth;
        this.#multiplierEl.classList.add('multiplier-pulse');
      }
    }
    if (this.#multiplierBarEl) {
      const lvl = this.#multiplier;
      if (lvl < ScoreManager.MAX_MULTIPLIER) {
        const cur  = ScoreManager.STREAK_THRESHOLDS[lvl - 1];
        const next = ScoreManager.STREAK_THRESHOLDS[lvl];
        const pct  = (this.#perfectStreak - cur) / (next - cur);
        this.#multiplierBarEl.style.width = `${Math.min(pct * 100, 100)}%`;
      } else {
        this.#multiplierBarEl.style.width = '100%';
      }
    }
  }

  getRank() {
    const accuracy    = this.#totalNotes > 0 ? this.#hitNotes    / this.#totalNotes : 0;
    const perfectRatio = this.#totalNotes > 0 ? this.#perfectNotes / this.#totalNotes : 0;

    if (accuracy >= 0.98 && perfectRatio >= 0.9) return 'S';
    if (accuracy >= 0.90 && perfectRatio >= 0.7) return 'A';
    if (accuracy >= 0.80)                         return 'B';
    if (accuracy >= 0.65)                         return 'C';
    if (accuracy >= 0.50)                         return 'D';
    return 'F';
  }
}


// ═══════════════════════════════════════════════════════════
// CLASS: NoteManager
// Spawns notes at a set interval and updates them each frame.
// UML: -notes | +spawnNotes, +updateNotes, +removeOldNotes
// ═══════════════════════════════════════════════════════════
class NoteManager {
  #notes; #trackEl; #lanes; #spawnTimer; #isRunning; #spawnCount;
  static FALL_SPEED = 4;
  static SPAWN_INTERVAL = 1000;
  static TOTAL_NOTES = 20;

  constructor(trackEl, lanes) {
    this.#notes = []; this.#trackEl = trackEl;
    this.#lanes = lanes; this.#spawnTimer = null;
    this.#isRunning = false; this.#spawnCount = 0;
  }

  get notes()      { return this.#notes; }
  get spawnCount() { return this.#spawnCount; }

  start() {
    this.#isRunning = true;
    this.#spawnTimer = setInterval(() => this.spawnNotes(), NoteManager.SPAWN_INTERVAL);
    this.#loop();
  }

  stop() { this.#isRunning = false; clearInterval(this.#spawnTimer); }

  spawnNotes() {
    if (this.#spawnCount >= NoteManager.TOTAL_NOTES) {
      clearInterval(this.#spawnTimer);
      return;
    }
    Game.instance.scoreManager.addNote();
    const laneId = Math.floor(Math.random() * this.#lanes.length);
    const note = new Note(laneId, Date.now());
    note.spawn(this.#trackEl);
    this.#lanes[laneId].addNote(note);
    this.#notes.push(note);
    this.#spawnCount++;
  }

  updateNotes() {
    const trackHeight = this.#trackEl.clientHeight;
    for (let i = this.#notes.length - 1; i >= 0; i--) {
      const note = this.#notes[i];
      note.move(NoteManager.FALL_SPEED);
      if (note.y + Note.NOTE_HEIGHT > trackHeight + 60 + Game.HIT_WINDOW) {
        this.removeOldNotes(note);
        Game.instance.onNoteMiss(note);
      }
    }
  }

  removeOldNotes(note) {
    note.miss();
    this.#lanes[note.lane].removeNote(note);
    const i = this.#notes.indexOf(note);
    if (i !== -1) this.#notes.splice(i, 1);
  }

  isDone() {
    return this.#spawnCount >= NoteManager.TOTAL_NOTES && this.#notes.length === 0;
  }

  #loop() {
    if (!this.#isRunning) return;
    this.updateNotes();
    if (this.isDone()) {
      Game.instance.endGame();
      return;
    }
    requestAnimationFrame(() => this.#loop());
  }
}


// ═══════════════════════════════════════════════════════════
// CLASS: InputHandler
// Listens for key/mouse input and routes it to the Game.
// UML: -keyMap | +listen, +handleKeyPress
// ═══════════════════════════════════════════════════════════
class InputHandler {
  #keyMap; #lanes;

  constructor(lanes) {
    this.#lanes = lanes;
    this.#keyMap = { d: 0, f: 1, j: 2, k: 3 };
  }

  listen() {
    document.addEventListener('keydown', e => this.handleKeyPress(e.key));
    document.addEventListener('keyup', e => {
      const laneId = this.#keyMap[e.key.toLowerCase()];
      if (laneId !== undefined) this.#lanes[laneId].release();
    });
    this.#lanes.forEach(lane => {
      const btn = document.querySelector(`.lane-btn[data-lane="${lane.laneId}"]`);
      btn.addEventListener('mousedown',  () => this.handleKeyPress(lane.keyBinding));
      btn.addEventListener('mouseup',    () => lane.release());
      btn.addEventListener('mouseleave', () => lane.release());
      btn.addEventListener('touchstart', (e) => { e.preventDefault(); this.handleKeyPress(lane.keyBinding); });
      btn.addEventListener('touchend',   (e) => { e.preventDefault(); lane.release(); });
    });
  }

  handleKeyPress(key) {
    const laneId = this.#keyMap[key.toLowerCase()];
    if (laneId === undefined) return;
    this.#lanes[laneId].press();
    Game.instance.onKeyPress(laneId);
  }
}


// ═══════════════════════════════════════════════════════════
// CLASS: Game
// Central game manager. Determines hit vs miss.
// UML: -score, -isRunning | +start, +update, +endGame, +reset
// ═══════════════════════════════════════════════════════════
class Game {
  #isRunning; #lanes; #noteManager; #inputHandler; #scoreManager;
  static HIT_WINDOW = 80;
  static PERFECT_WINDOW = 40;
  static instance = null;

  constructor() {
    this.#isRunning = false;
    this.#lanes = [
      new Lane(0, 'd'),
      new Lane(1, 'f'),
      new Lane(2, 'j'),
      new Lane(3, 'k'),
    ];
    const trackEl = document.getElementById('track');
    this.#scoreManager  = new ScoreManager();
    this.#noteManager   = new NoteManager(trackEl, this.#lanes);
    this.#inputHandler  = new InputHandler(this.#lanes);
    Game.instance = this;
  }

  get scoreManager() { return this.#scoreManager; }

  start() {
    this.#isRunning = true;
    this.#inputHandler.listen();
    this.#noteManager.start();
  }

  onKeyPress(laneId) {
    if (!this.#isRunning) return;
    const trackHeight = document.getElementById('track').clientHeight;
    const notesInLane = this.#lanes[laneId].notes;
    let closest = null, closestDist = Infinity;

    for (const note of notesInLane) {
      if (note.checkHit(trackHeight, Game.HIT_WINDOW)) {
        const dist = Math.abs((note.y + Note.NOTE_HEIGHT) - trackHeight);
        if (dist < closestDist) { closestDist = dist; closest = note; }
      }
    }
    if (closest) this.#onNoteHit(closest, trackHeight);
  }

  #onNoteHit(note, trackHeight) {
    const hitLine   = trackHeight + 60;
    const noteBottom = note.y + Note.NOTE_HEIGHT;
    const dist      = hitLine - noteBottom;
    const absDist   = Math.abs(dist);

    let judgement, basePoints, isPerfect;
    if (absDist <= Game.PERFECT_WINDOW) {
      judgement = 'PERFECT'; basePoints = 100; isPerfect = true;
    } else if (dist > 0) {
      judgement = 'EARLY';   basePoints = 50;  isPerfect = false;
    } else {
      judgement = 'LATE';    basePoints = 50;  isPerfect = false;
    }

    this.#scoreManager.addHit(basePoints, isPerfect);
    this.showFeedback(judgement, note.lane);

    note.destroy();
    this.#lanes[note.lane].removeNote(note);
    const i = this.#noteManager.notes.indexOf(note);
    if (i !== -1) this.#noteManager.notes.splice(i, 1);
  }

  onNoteMiss(note) {
    this.#scoreManager.addMiss();
    this.showFeedback('MISS', note.lane);
  }

  showFeedback(judgement, laneId) {
    const track = document.getElementById('track');
    const el = document.createElement('div');
    el.textContent = judgement;
    el.className = `feedback-label feedback-${judgement.toLowerCase()}`;
    el.style.left = `${laneId * 25 + 12.5}%`;
    track.appendChild(el);
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }

  endGame() {
    this.#isRunning = false;
    this.#noteManager.stop();
    setTimeout(() => this.#showGameOver(), 600);
  }

  #showGameOver() {
    const sm   = this.#scoreManager;
    const rank = sm.getRank();
    const accuracy = sm.totalNotes > 0
      ? Math.round((sm.hitNotes / sm.totalNotes) * 100)
      : 0;

    const rankColors = {
      S: { color: '#ffcc00', glow: 'rgba(255,204,0,0.7)'  },
      A: { color: '#00e5ff', glow: 'rgba(0,229,255,0.6)'  },
      B: { color: '#7c3aed', glow: 'rgba(124,58,237,0.6)' },
      C: { color: '#4ade80', glow: 'rgba(74,222,128,0.6)' },
      D: { color: '#fb923c', glow: 'rgba(251,146,60,0.6)' },
      F: { color: '#ff2d78', glow: 'rgba(255,45,120,0.6)' },
    };
    const rc  = rankColors[rank];
    const won = rank !== 'F';

    const overlay = document.createElement('div');
    overlay.id = 'gameOverScreen';
    overlay.innerHTML = `
      <div class="go-title">${won ? 'WELL PLAYED' : 'GAME OVER'}</div>
      <div class="go-rank" style="color:${rc.color}; text-shadow:0 0 40px ${rc.glow}, 0 0 80px ${rc.glow};">${rank}</div>
      <div class="go-stats">
        <div class="go-stat">
          <span class="go-stat-label">SCORE</span>
          <span class="go-stat-value">${sm.score.toLocaleString()}</span>
        </div>
        <div class="go-stat">
          <span class="go-stat-label">ACCURACY</span>
          <span class="go-stat-value">${accuracy}%</span>
        </div>
        <div class="go-stat">
          <span class="go-stat-label">HITS</span>
          <span class="go-stat-value">${sm.hitNotes} / ${sm.totalNotes}</span>
        </div>
        <div class="go-stat">
          <span class="go-stat-label">PERFECTS</span>
          <span class="go-stat-value">${sm.perfectNotes}</span>
        </div>
      </div>
      <div style="display:flex; gap:12px; flex-wrap:wrap; justify-content:center;">
        <button class="btn" id="retryBtn">RETRY</button>
        <button class="btn" id="menuBtn" style="background: transparent; border: 2px solid rgba(255,255,255,0.3); box-shadow: none; color: rgba(255,255,255,0.7);">MAIN MENU</button>
      </div>
    `;

    document.getElementById('screen').appendChild(overlay);

    document.getElementById('retryBtn').addEventListener('click', () => {
      overlay.remove();
      document.getElementById('track').innerHTML = '';
      const newGame = new Game();
      newGame.start();
    });
    document.getElementById('menuBtn').addEventListener('click', () => {
      overlay.remove();
      document.getElementById('track').innerHTML = '';
      document.getElementById('gameArea').classList.remove('active');
      document.getElementById('menu').style.display = '';
    });
  }
}


// ═══════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════
document.getElementById('playBtn').addEventListener('click', () => {
  document.getElementById('menu').style.display = 'none';
  document.getElementById('gameArea').classList.add('active');
  const game = new Game();
  game.start();
});