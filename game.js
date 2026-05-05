// ═══════════════════════════════════════════════════════════
// SONGS REGISTRY
// To add a new level: push a new object to this array.
// Fields:
//   id     – unique string key
//   title  – display name shown on the card and config screen
//   artist – artist / source label shown on the card
//   bpm    – drives fall speed automatically via bpmToSpeed()
//   notes  – total notes spawned during the song
//   genre  – shown as a tag on the card
//   emoji  – icon shown in the song card
//   accent – CSS color used to theme the card (hex)
//
// Fall speed formula (see bpmToSpeed below):
//   speed = (bpm / BPM_BASE) * SPEED_BASE
//   BPM_BASE  = 120  (reference tempo → SPEED_BASE px/frame)
//   SPEED_BASE = 4   (pixels per frame at 120 BPM)
//   Example: 160 BPM → (160/120) * 4 = 5.33 px/frame
// ═══════════════════════════════════════════════════════════
const SONGS = [
  {
    id:     'Beauty_And_A_Beat',
    title:  'Beauty and A Beat',
    artist: 'Justin Bieber',
    bpm:    128,
    notes:  120,
    genre:  'Pop',
    emoji:  '⚡',
    accent: '#00e5ff',
    audioSrc: 'assets/audio/Beauty-And-A-Beat.mp3',
    offset: 0,
  },
  {
    id:     'void_pulse',
    title:  'VOID PULSE',
    artist: 'DARK MATTER',
    bpm:    160,
    notes:  30,
    genre:  'DRUM & BASS',
    emoji:  '🌀',
    accent: '#ff2d78',
    audioSrc: 'assets/audio/Telepathy-Love.mp3',
    offset: 0,
  },
  // ── Add more songs below ──────────────────────────────────
  // {
  //   id:     'solar_flare',
  //   title:  'SOLAR FLARE',
  //   artist: 'HYPERION',
  //   bpm:    174,
  //   notes:  36,
  //   genre:  'HARDSTYLE',
  //   emoji:  '☀️',
  //   accent: '#ffcc00',
  // },
];

// Converts a song's BPM to a fall speed (px/frame).
function bpmToSpeed(bpm) {
  const BPM_BASE   = 120;
  const SPEED_BASE = 4;
  return (bpm / BPM_BASE) * SPEED_BASE;
}

function buildBeatChart(song) {
  const beatLength = 60 / song.bpm;
  const chart = [];

  for (let i = 0; i < song.notes; i++) {
    chart.push({
      lane: Math.floor(Math.random() * 4),
      hitTime: song.offset + i * beatLength,
      holdDuration: 0
    });
  }

  return chart;
}


// ═══════════════════════════════════════════════════════════
// CLASS: Note
// Represents a single falling note on the track.
// ═══════════════════════════════════════════════════════════
class Note {
  #lane; #timeStamp; #isHit; #isMissed; #el; #y;
  #holdDuration; #isHolding; #holdProgress; #tailEl;
  static NOTE_HEIGHT = 64;

  constructor(lane, timeStamp, holdDuration = 0) {
    this.#lane = lane; this.#timeStamp = timeStamp;
    this.#isHit = false; this.#isMissed = false;
    this.#y = -Note.NOTE_HEIGHT; this.#el = null;
    this.#holdDuration = holdDuration;
    this.#isHolding = false;
    this.#holdProgress = 0;
    this.#tailEl = null;
  }

  get lane()         { return this.#lane; }
  get y()            { return this.#y; }
  get isHit()        { return this.#isHit; }
  get isMissed()     { return this.#isMissed; }
  get holdDuration() { return this.#holdDuration; }
  get isHolding()    { return this.#isHolding; }

  spawn(trackEl) {
    this.#el = document.createElement('div');
    this.#el.classList.add('note');
    this.#el.dataset.lane = this.#lane;
    trackEl.appendChild(this.#el);

    if (this.#holdDuration > 0) {
      this.#tailEl = document.createElement('div');
      this.#tailEl.classList.add('note-tail');
      this.#tailEl.dataset.lane = this.#lane;
      this.#tailEl.style.height = this.#holdDuration + 'px';
      trackEl.appendChild(this.#tailEl);
    }
  }

  move(fallSpeed) {
    this.#y += fallSpeed;
    if (!this.#isHolding) {
      this.#el.style.top = this.#y + 'px';
    }
    if (this.#tailEl) {
      // tail sits directly above the head
      this.#tailEl.style.top = (this.#y - this.#holdDuration) + 'px';
    }
  }

  checkHit(trackHeight, hitWindow) {
    const noteBottom = this.#y + Note.NOTE_HEIGHT;
    const hitLine = trackHeight + 60;
    return noteBottom >= (hitLine - hitWindow) && this.#y <= hitLine;
  }

  startHold() {
    this.#isHolding = true;
    if (this.#tailEl) this.#tailEl.classList.add('holding');
  }

  // Call each frame while held. Returns true when hold is complete.
  tickHold(fallSpeed) {
    this.#holdProgress += fallSpeed;
    // Shrink the visible tail from the bottom as the player holds
    if (this.#tailEl) {
      const remaining = Math.max(0, this.#holdDuration - this.#holdProgress);
      this.#tailEl.style.height = remaining + 'px';
    }
    return this.#holdProgress >= this.#holdDuration;
  }

  // Returns completion ratio 0–1
  endHold() {
    this.#isHolding = false;
    return Math.min(this.#holdProgress / this.#holdDuration, 1);
  }

  destroy() {
    this.#isHit = true;
    this.#el.classList.add('hit');
    this.#el.addEventListener('animationend', () => this.#el.remove(), { once: true });
    if (this.#tailEl) {
      this.#tailEl.classList.add('complete');
      this.#tailEl.addEventListener('animationend', () => this.#tailEl.remove(), { once: true });
    }
  }

  miss() {
    this.#isMissed = true;
    this.#el.remove();
    if (this.#tailEl) this.#tailEl.remove();
  }
}


// ═══════════════════════════════════════════════════════════
// CLASS: Lane
// ═══════════════════════════════════════════════════════════
class Lane {
  #laneId; #keyBinding; #notes; #btnEl; #activeHold;

  constructor(laneId, keyBinding) {
    this.#laneId = laneId;
    this.#keyBinding = keyBinding;
    this.#notes = [];
    this.#activeHold = null;
    this.#btnEl = document.querySelector(`.lane-btn[data-lane="${laneId}"]`);
  }

  get laneId()      { return this.#laneId; }
  get keyBinding()  { return this.#keyBinding; }
  get notes()       { return this.#notes; }
  get activeHold()  { return this.#activeHold; }

  addNote(note)     { this.#notes.push(note); }
  removeNote(note)  { const i = this.#notes.indexOf(note); if (i !== -1) this.#notes.splice(i, 1); }
  startHold(note)   { this.#activeHold = note; }
  endHold()         { this.#activeHold = null; }
  press()           { this.#btnEl.classList.add('pressed'); }
  release()         { this.#btnEl.classList.remove('pressed'); }
}

// ═══════════════════════════════════════════════════════════
// CLASS: ScoreManager
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
    this.#scoreEl = null;
    this.#multiplierEl = null;
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
    if (!this.#scoreEl)         this.#scoreEl         = document.getElementById('scoreDisplay');
    if (!this.#multiplierEl)    this.#multiplierEl    = document.getElementById('multiplierDisplay');
    if (!this.#multiplierBarEl) this.#multiplierBarEl = document.getElementById('multiplierBar');

    if (this.#scoreEl)       this.#scoreEl.textContent = this.#score.toLocaleString();

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
    const accuracy     = this.#totalNotes > 0 ? this.#hitNotes     / this.#totalNotes : 0;
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
// ═══════════════════════════════════════════════════════════
class NoteManager {
  #notes; #trackEl; #lanes; #isRunning; #spawnCount;
  #fallSpeed; #totalNotes; #chart; #audio; #songStartTime;

  static DEFAULT_FALL_SPEED  = 4;
  static DEFAULT_TOTAL_NOTES = 20;

  constructor(trackEl, lanes, fallSpeed, totalNotes, chart, audio) {
    this.#notes      = [];
    this.#trackEl    = trackEl;
    this.#lanes      = lanes;
    this.#isRunning  = false;
    this.#spawnCount = 0;
    this.#fallSpeed  = fallSpeed  ?? NoteManager.DEFAULT_FALL_SPEED;
    this.#totalNotes = totalNotes ?? NoteManager.DEFAULT_TOTAL_NOTES;
    this.#chart      = chart ?? [];
    this.#audio      = audio;
    this.#songStartTime = 0;
  }

  get notes()      { return this.#notes; }
  get spawnCount() { return this.#spawnCount; }

  start() {
    this.#isRunning = true;

    if (this.#audio) {
      this.#audio.currentTime = 0;
      this.#audio.play();
    }

    this.#songStartTime = performance.now();
    this.#loop();
  }

  stop() {
    this.#isRunning = false;

    if (this.#audio) {
      this.#audio.pause();
      this.#audio.currentTime = 0;
    }
  }

  spawnChartNotes(currentSongTime) {
    const trackHeight = this.#trackEl.clientHeight;
    const hitLine = trackHeight + 60;

    while (this.#spawnCount < this.#chart.length) {
      const chartNote = this.#chart[this.#spawnCount];

      const secondsUntilHit = chartNote.hitTime - currentSongTime;
      const pixelsToTravel = hitLine + Note.NOTE_HEIGHT;
      const secondsToFall = pixelsToTravel / (this.#fallSpeed * 60);

      if (secondsUntilHit <= secondsToFall) {
        Game.instance.scoreManager.addNote();

        const note = new Note(
          chartNote.lane,
          Date.now(),
          chartNote.holdDuration || 0
        );

        note.spawn(this.#trackEl);
        this.#lanes[chartNote.lane].addNote(note);
        this.#notes.push(note);
        this.#spawnCount++;
      } else {
        break;
      }
    }
  }

  updateNotes() {
    const trackHeight = this.#trackEl.clientHeight;

    for (let i = this.#notes.length - 1; i >= 0; i--) {
      const note = this.#notes[i];

      if (note.isHolding) {
        note.move(this.#fallSpeed);
        const done = note.tickHold(this.#fallSpeed);

        if (done) {
          Game.instance.onHoldComplete(note);
          this.#lanes[note.lane].endHold();
          this.#lanes[note.lane].removeNote(note);
          this.#notes.splice(i, 1);
        }

        continue;
      }

      note.move(this.#fallSpeed);

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
    const audioFinished = this.#audio ? this.#audio.ended : true;
    return this.#spawnCount >= this.#chart.length && this.#notes.length === 0 && audioFinished;
  }

  #loop() {
    if (!this.#isRunning) return;

    const currentSongTime = this.#audio
      ? this.#audio.currentTime
      : (performance.now() - this.#songStartTime) / 1000;

    this.spawnChartNotes(currentSongTime);
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
      if (laneId !== undefined) {
        this.#lanes[laneId].release();
        Game.instance.onKeyRelease(laneId);
      }
    });
    this.#lanes.forEach(lane => {
      const btn = document.querySelector(`.lane-btn[data-lane="${lane.laneId}"]`);
      btn.addEventListener('mousedown',  () => this.handleKeyPress(lane.keyBinding));
      btn.addEventListener('mouseup',    () => { lane.release(); Game.instance.onKeyRelease(lane.laneId); });
      btn.addEventListener('mouseleave', () => { lane.release(); Game.instance.onKeyRelease(lane.laneId); });
      btn.addEventListener('touchstart', (e) => { e.preventDefault(); this.handleKeyPress(lane.keyBinding); });
      btn.addEventListener('touchend',   (e) => { e.preventDefault(); lane.release(); Game.instance.onKeyRelease(lane.laneId); });
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
// ═══════════════════════════════════════════════════════════
class Game {
  #isRunning; #lanes; #noteManager; #inputHandler; #scoreManager;
  static HIT_WINDOW     = 80;
  static PERFECT_WINDOW = 40;
  static instance       = null;

  constructor(fallSpeed, totalNotes, chart, audio) {
    this.#isRunning = false;
    this.#lanes = [
      new Lane(0, 'd'),
      new Lane(1, 'f'),
      new Lane(2, 'j'),
      new Lane(3, 'k'),
    ];
    const trackEl = document.getElementById('track');
    this.#scoreManager = new ScoreManager();
    this.#noteManager  = new NoteManager(trackEl, this.#lanes, fallSpeed, totalNotes, chart, audio);
    this.#inputHandler = new InputHandler(this.#lanes);
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
    const trackHeight  = document.getElementById('track').clientHeight;
    const notesInLane  = this.#lanes[laneId].notes;
    let closest = null, closestDist = Infinity;

    for (const note of notesInLane) {
      if (note.checkHit(trackHeight, Game.HIT_WINDOW)) {
        const dist = Math.abs((note.y + Note.NOTE_HEIGHT) - trackHeight);
        if (dist < closestDist) { closestDist = dist; closest = note; }
      }
    }
    if (closest) {
      if (closest.holdDuration > 0) {
        // Hold note — activate it, don't destroy yet
        closest.startHold();
        this.#lanes[closest.lane].startHold(closest);
      } else {
        this.#onNoteHit(closest, trackHeight);
      }
    }
  }

  #onNoteHit(note, trackHeight) {
    const hitLine    = trackHeight + 60;
    const noteBottom = note.y + Note.NOTE_HEIGHT;
    const dist       = hitLine - noteBottom;
    const absDist    = Math.abs(dist);

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

  onKeyRelease(laneId) {
    const lane = this.#lanes[laneId];
    const note = lane.activeHold;
    if (!note) return;

    const ratio = note.endHold();
    lane.endHold();
    lane.removeNote(note);
    const i = this.#noteManager.notes.indexOf(note);
    if (i !== -1) this.#noteManager.notes.splice(i, 1);

    if (ratio >= 0.9) {
      this.#scoreManager.addHit(100, true);
      this.showFeedback('PERFECT', laneId);
    } else if (ratio >= 0.5) {
      this.#scoreManager.addHit(50, false);
      this.showFeedback('LATE', laneId);
    } else {
      this.#scoreManager.addMiss();
      this.showFeedback('MISS', laneId);
    }
    note.destroy();
  }

  onHoldComplete(note) {
    // Player held all the way through — full score
    this.#scoreManager.addHit(100, true);
    this.showFeedback('PERFECT', note.lane);
    note.destroy();
  }
  
  onNoteMiss(note) {
    this.#scoreManager.addMiss();
    this.showFeedback('MISS', note.lane);
  }

  showFeedback(judgement, laneId) {
    const track = document.getElementById('track');
    const el    = document.createElement('div');
    el.textContent = judgement;
    el.className   = `feedback-label feedback-${judgement.toLowerCase()}`;
    el.style.left  = `${laneId * 25 + 12.5}%`;
    track.appendChild(el);
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }

  endGame() {
    this.#isRunning = false;
    this.#noteManager.stop();
    setTimeout(() => this.#showGameOver(), 600);
  }

  #showGameOver() {
    const sm       = this.#scoreManager;
    const rank     = sm.getRank();
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
        <button class="btn" id="menuBtn" style="background:transparent; border:2px solid rgba(255,255,255,0.3); box-shadow:none; color:rgba(255,255,255,0.7);">MAIN MENU</button>
      </div>
    `;

    document.getElementById('screen').appendChild(overlay);

    document.getElementById('retryBtn').addEventListener('click', () => {
      overlay.remove();
      document.getElementById('track').innerHTML = '';
      // Re-use the same song/difficulty settings
      const { fallSpeed, totalNotes, chart, audio } = Navigator.getCurrentSettings();
      const newGame = new Game(fallSpeed, totalNotes, chart, audio);
      newGame.start();
    });

    document.getElementById('menuBtn').addEventListener('click', () => {
      overlay.remove();
      document.getElementById('track').innerHTML = '';
      document.getElementById('gameArea').classList.remove('active');
      Navigator.goToMain();
    });
  }
}


// ═══════════════════════════════════════════════════════════
// NAVIGATOR  –  screen transitions and state
// ═══════════════════════════════════════════════════════════
const Navigator = (() => {
  // Currently selected song id and difficulty
  let _songId     = null;
  let _difficulty = 'medium';
  let _noLives    = false;

  const $ = id => document.getElementById(id);

  // ── helpers ─────────────────────────────────────────────

  function transition(from, to, direction = 'forward') {
    const outClass = direction === 'forward' ? 'slide-out-left'  : 'slide-out-right';
    const inClass  = direction === 'forward' ? 'slide-in-right'  : 'slide-in-left';

    from.classList.add(outClass);
    from.addEventListener('animationend', () => {
      from.classList.add('hidden');
      from.classList.remove(outClass);

      to.classList.remove('hidden');
      to.classList.add(inClass);
      to.addEventListener('animationend', () => {
        to.classList.remove(inClass);
      }, { once: true });
    }, { once: true });
  }

  // ── screen builders ──────────────────────────────────────

  function buildSongList() {
    const list = $('songList');
    list.innerHTML = '';

    SONGS.forEach(song => {
      // derive a subtle tinted bg from the accent color
      const card = document.createElement('div');
      card.className = 'song-card';
      card.style.setProperty('--card-accent',        song.accent);
      card.style.setProperty('--card-accent-bg',     hexToRgba(song.accent, 0.1));
      card.style.setProperty('--card-accent-border', hexToRgba(song.accent, 0.25));
      card.style.setProperty('--card-accent-text',   song.accent);

      card.innerHTML = `
        <div class="song-icon">${song.emoji}</div>
        <div class="song-info">
          <div class="song-title">${song.title}</div>
          <div class="song-artist">${song.artist}</div>
          <div class="song-meta">
            <span class="song-tag bpm">${song.bpm} BPM</span>
            <span class="song-tag">${song.genre}</span>
          </div>
        </div>
        <div class="song-arrow">›</div>
      `;

      card.addEventListener('click', () => goToConfig(song.id));
      list.appendChild(card);
    });
  }

  function goToConfig(songId) {
    _songId = songId;
    const song = SONGS.find(s => s.id === songId);

    $('configSongName').textContent  = song.artist;
    $('configSongTitle').textContent = song.title;

    // reset difficulty UI to current selection
    document.querySelectorAll('#diffSelect .diff-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.diff === _difficulty);
    });

    // reset toggle
    const toggle = $('noLivesToggle');
    toggle.classList.toggle('on', _noLives);

    transition($('levelSelect'), $('songConfig'));
  }

  // ── public API ───────────────────────────────────────────

  function goToMain() {
    // Hide everything except main menu
    ['levelSelect', 'songConfig'].forEach(id => $( id).classList.add('hidden'));
    $('mainMenu').classList.remove('hidden');
  }

  function getCurrentSettings() {
    const song = SONGS.find(s => s.id === _songId) ?? SONGS[0];

    const chart = buildBeatChart(song);
    const audio = new Audio(song.audioSrc);

    return {
      fallSpeed:  bpmToSpeed(song.bpm),
      totalNotes: song.notes,
      noLives:    _noLives,
      chart:      chart,
      audio:      audio,
    };
  }

  function init() {
    buildSongList();

    // Main menu → level select
    $('selectSongBtn').addEventListener('click', () => {
      transition($('mainMenu'), $('levelSelect'));
    });

    // Level select → main menu (back)
    $('backToMainBtn').addEventListener('click', () => {
      transition($('levelSelect'), $('mainMenu'), 'back');
    });

    // Song config → level select (back)
    $('backToLevelSelectBtn').addEventListener('click', () => {
      transition($('songConfig'), $('levelSelect'), 'back');
    });

    // Difficulty buttons
    document.querySelectorAll('#diffSelect .diff-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#diffSelect .diff-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _difficulty = btn.dataset.diff;
      });
    });

    // No-lives toggle
    $('noLivesToggle').addEventListener('click', () => {
      _noLives = !_noLives;
      $('noLivesToggle').classList.toggle('on', _noLives);
    });

    // Play button
    $('playBtn').addEventListener('click', () => {
      $('songConfig').classList.add('hidden');
      $('gameArea').classList.add('active');

      const { fallSpeed, totalNotes, chart, audio } = getCurrentSettings();
      const game = new Game(fallSpeed, totalNotes, chart, audio);
      game.start();
    });
  }

  return { init, goToMain, getCurrentSettings };
})();


// ── tiny utility: hex color → rgba string ─────────────────
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}


// ═══════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════
Navigator.init();
