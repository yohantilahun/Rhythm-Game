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
// CLASS: NoteManager
// Spawns notes at a set interval and updates them each frame.
// UML: -notes | +spawnNotes, +updateNotes, +removeOldNotes
// ═══════════════════════════════════════════════════════════
class NoteManager {
  #notes; #trackEl; #lanes; #spawnTimer; #isRunning;
  static FALL_SPEED = 4;
  static SPAWN_INTERVAL = 1000;

  constructor(trackEl, lanes) {
    this.#notes = []; this.#trackEl = trackEl;
    this.#lanes = lanes; this.#spawnTimer = null; this.#isRunning = false;
  }

  get notes() { return this.#notes; }

  start() {
    this.#isRunning = true;
    this.#spawnTimer = setInterval(() => this.spawnNotes(), NoteManager.SPAWN_INTERVAL);
    this.#loop();
  }

  stop() { this.#isRunning = false; clearInterval(this.#spawnTimer); }

  spawnNotes() {
    const laneId = Math.floor(Math.random() * this.#lanes.length);
    const note = new Note(laneId, Date.now());
    note.spawn(this.#trackEl);
    this.#lanes[laneId].addNote(note);
    this.#notes.push(note);
  }

  updateNotes() {
    const trackHeight = this.#trackEl.clientHeight;
    for (let i = this.#notes.length - 1; i >= 0; i--) {
      const note = this.#notes[i];
      note.move(NoteManager.FALL_SPEED);
      if (note.y + Note.NOTE_HEIGHT> trackHeight + 60 +Game.HIT_WINDOW) {
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

  #loop() {
    if (!this.#isRunning) return;
    this.updateNotes();
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
  #score; #isRunning; #lanes; #noteManager; #inputHandler;
  static HIT_WINDOW = 80;
  static PERFECT_WINDOW = 40;
  static instance = null;

  constructor() {
    this.#score = 0;
    this.#isRunning = false;
    this.#lanes = [
      new Lane(0, 'd'),
      new Lane(1, 'f'),
      new Lane(2, 'j'),
      new Lane(3, 'k'),
    ];
    const trackEl = document.getElementById('track');
    this.#noteManager  = new NoteManager(trackEl, this.#lanes);
    this.#inputHandler = new InputHandler(this.#lanes);
    Game.instance = this;
  }

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
    const hitLine = trackHeight +60;
    const noteBottom = note.y + Note.NOTE_HEIGHT;
    const dist = hitLine - noteBottom;
    const absDist = Math.abs(dist);

    let judgement, points;
    if (absDist <= Game.PERFECT_WINDOW) {
      judgement = 'PERFECT'; points = 100;
    }else if (dist > 0) {
    judgement = 'EARLY';   points = 50;
  } else {
    judgement = 'LATE';    points = 50;
  }
  
    this.#score += points;
    this.showFeedback (judgement, note.lane);
    console.log(`HIT! Score: ${this.#score}`);
    note.destroy();
    this.#lanes[note.lane].removeNote(note);
    const i = this.#noteManager.notes.indexOf(note);
    if (i !== -1) this.#noteManager.notes.splice(i, 1);
  }

  onNoteMiss(note) {
    console.log(`MISS! Score: ${this.#score}`);
    this.showFeedback(`MISS`, note.lane);
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

  endGame() { this.#isRunning = false; this.#noteManager.stop(); }
  reset()   { this.#score = 0; }
}


// ═══════════════════════════════════════════════════════════
// BOOT — Start game when PLAY is clicked
// ═══════════════════════════════════════════════════════════
document.getElementById('playBtn').addEventListener('click', () => {
  document.getElementById('menu').style.display = 'none';
  document.getElementById('gameArea').classList.add('active');
  const game = new Game();
  game.start();
});
