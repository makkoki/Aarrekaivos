const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const hud = {
  lap: document.getElementById('lapDisplay'),
  currentLap: document.getElementById('currentLapTime'),
  lastLap: document.getElementById('lastLapTime'),
  bestLap: document.getElementById('bestLapTime'),
  total: document.getElementById('totalTime'),
  status: document.getElementById('statusMessage'),
};

const resultsOverlay = document.getElementById('resultsOverlay');
const resultsList = document.getElementById('resultsList');
const restartButton = document.getElementById('restartButton');
const hudRestartButton = document.getElementById('hudRestartButton');

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const TOTAL_LAPS = 3;
const track = {
  centerX: WIDTH / 2,
  centerY: HEIGHT / 2 + 20,
  outerRadiusX: 390,
  outerRadiusY: 215,
  innerRadiusX: 220,
  innerRadiusY: 92,
};

const startLine = { x1: track.centerX, y1: track.centerY + track.innerRadiusY, x2: track.centerX, y2: track.centerY + track.outerRadiusY };
const checkpointLine = { x1: track.centerX, y1: track.centerY - track.outerRadiusY, x2: track.centerX, y2: track.centerY - track.innerRadiusY };
const keys = new Set();

let car;
let timing;
let raceStarted = false;
let raceFinished = false;
let lastFrameTime = 0;

function createInitialState(startRace = false) {
  const now = performance.now();
  const startTime = startRace ? now : null;

  car = {
    x: track.centerX - 25,
    y: track.centerY + 152,
    angle: -Math.PI / 2,
    speed: 0,
    width: 22,
    height: 38,
    maxForwardSpeed: 370,
    maxReverseSpeed: -155,
    previousX: track.centerX - 25,
    previousY: track.centerY + 152,
    passedCheckpoint: false,
    wasOnFinishLine: false,
    wasOnCheckpoint: false,
  };

  timing = {
    raceStart: startTime,
    lapStart: startTime,
    lap: 1,
    lapTimes: [],
    lastLapTime: null,
    bestLapTime: null,
    totalTime: 0,
  };

  raceStarted = startRace;
  raceFinished = false;
  lastFrameTime = now;
  keys.clear();
  resultsOverlay.classList.add('hidden');
  hud.status.textContent = startRace
    ? 'Aja vastapuolen checkpointin kautta ja ylitä maaliviiva oikeasta suunnasta.'
    : 'Paina Restart aloittaaksesi ajanoton.';
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isKeyDown(...codes) {
  return codes.some((code) => keys.has(code));
}

function isPointOnTrack(x, y) {
  const dx = x - track.centerX;
  const dy = y - track.centerY;
  const outer = (dx * dx) / (track.outerRadiusX * track.outerRadiusX) + (dy * dy) / (track.outerRadiusY * track.outerRadiusY);
  const inner = (dx * dx) / (track.innerRadiusX * track.innerRadiusX) + (dy * dy) / (track.innerRadiusY * track.innerRadiusY);
  return outer <= 1 && inner >= 1;
}

function isCarOnTrack() {
  const cos = Math.cos(car.angle);
  const sin = Math.sin(car.angle);
  const samplePoints = [
    [0, 0],
    [0, -car.height / 2],
    [0, car.height / 2],
    [-car.width / 2, 0],
    [car.width / 2, 0],
  ];

  return samplePoints.some(([localX, localY]) => {
    const worldX = car.x + localX * cos - localY * sin;
    const worldY = car.y + localX * sin + localY * cos;
    return isPointOnTrack(worldX, worldY);
  });
}

function isInsideLineZone(line, width = 18) {
  const minX = Math.min(line.x1, line.x2) - width;
  const maxX = Math.max(line.x1, line.x2) + width;
  const minY = Math.min(line.y1, line.y2) - width;
  const maxY = Math.max(line.y1, line.y2) + width;
  return car.x >= minX && car.x <= maxX && car.y >= minY && car.y <= maxY;
}

function crossedVerticalSegment(line, direction, padding = 22) {
  const lineX = line.x1;
  const previousX = car.previousX;
  const currentX = car.x;

  const crossedCorrectDirection = direction === 'left-to-right'
    ? previousX < lineX && currentX >= lineX
    : previousX > lineX && currentX <= lineX;

  if (!crossedCorrectDirection || previousX === currentX) {
    return false;
  }

  // Laske kohta, jossa auton edellisen ja nykyisen sijainnin välinen liike leikkaa viivan.
  // Tämä tekee checkpointista ja maaliviivasta luotettavia myös kovassa vauhdissa.
  const travelProgress = (lineX - previousX) / (currentX - previousX);
  const yAtCrossing = car.previousY + (car.y - car.previousY) * travelProgress;
  const minY = Math.min(line.y1, line.y2) - padding;
  const maxY = Math.max(line.y1, line.y2) + padding;
  return yAtCrossing >= minY && yAtCrossing <= maxY;
}

function formatTime(milliseconds) {
  if (milliseconds === null || Number.isNaN(milliseconds)) {
    return '--:--.---';
  }

  const totalMilliseconds = Math.max(0, Math.floor(milliseconds));
  const minutes = Math.floor(totalMilliseconds / 60000);
  const seconds = Math.floor((totalMilliseconds % 60000) / 1000);
  const ms = totalMilliseconds % 1000;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

// Auton fysiikka: kiihtyvyys, jarrutus/peruutus, nopeuteen suhteutettu kääntyminen ja kitka.
function updateCar(deltaSeconds) {
  const accelerating = isKeyDown('ArrowUp', 'KeyW');
  const braking = isKeyDown('ArrowDown', 'KeyS');
  const turningLeft = isKeyDown('ArrowLeft', 'KeyA');
  const turningRight = isKeyDown('ArrowRight', 'KeyD');
  const onTrack = isCarOnTrack();
  const acceleration = onTrack ? 250 : 105;
  const brakeForce = onTrack ? 330 : 145;
  const friction = onTrack ? 0.985 : 0.935;
  const offTrackDrag = onTrack ? 1 : 0.985;

  car.previousX = car.x;
  car.previousY = car.y;

  if (accelerating) {
    car.speed += acceleration * deltaSeconds;
  }

  if (braking) {
    car.speed -= brakeForce * deltaSeconds;
  }

  if (!accelerating && !braking) {
    car.speed *= Math.pow(friction, deltaSeconds * 60);
  }

  car.speed *= Math.pow(offTrackDrag, deltaSeconds * 60);
  car.speed = clamp(car.speed, car.maxReverseSpeed, onTrack ? car.maxForwardSpeed : 190);

  const steeringInput = (turningRight ? 1 : 0) - (turningLeft ? 1 : 0);
  const speedFactor = clamp(Math.abs(car.speed) / 190, 0, 1);
  const reverseDirection = car.speed >= 0 ? 1 : -1;
  car.angle += steeringInput * reverseDirection * (1.65 + speedFactor * 1.45) * deltaSeconds;

  car.x += Math.sin(car.angle) * car.speed * deltaSeconds;
  car.y -= Math.cos(car.angle) * car.speed * deltaSeconds;

  car.x = clamp(car.x, 20, WIDTH - 20);
  car.y = clamp(car.y, 20, HEIGHT - 20);
}

// Kierrosten tunnistus: checkpoint pitää kerätä ennen maaliviivaa, ja maaliviiva lasketaan vain oikeaan suuntaan.
function updateRaceProgress(now) {
  const onCheckpoint = isInsideLineZone(checkpointLine, 16);
  const onFinish = isInsideLineZone(startLine, 16);
  const crossedCheckpoint = crossedVerticalSegment(checkpointLine, 'left-to-right');
  const crossedFinish = crossedVerticalSegment(startLine, 'right-to-left');

  if (crossedCheckpoint) {
    car.passedCheckpoint = true;
    hud.status.textContent = 'Checkpoint hyväksytty! Palaa maaliviivalle viimeistelemään kierros.';
  }

  if (crossedFinish && car.passedCheckpoint) {
    completeLap(now);
  } else if (crossedFinish) {
    hud.status.textContent = 'Kierros ei kelpaa vielä: aja ensin vastapuolen checkpointin kautta.';
  }

  car.wasOnCheckpoint = onCheckpoint;
  car.wasOnFinishLine = onFinish;
}

// Ajanotto: tallennetaan kierrosaika, paras kierros ja kokonaisaika maalissa.
function completeLap(now) {
  const lapTime = now - timing.lapStart;
  timing.lapTimes.push(lapTime);
  timing.lastLapTime = lapTime;
  timing.bestLapTime = timing.bestLapTime === null ? lapTime : Math.min(timing.bestLapTime, lapTime);
  car.passedCheckpoint = false;

  if (timing.lapTimes.length >= TOTAL_LAPS) {
    timing.totalTime = now - timing.raceStart;
    finishRace();
    return;
  }

  timing.lap += 1;
  timing.lapStart = now;
  hud.status.textContent = `Kierros ${timing.lap - 1} valmis. Hae seuraava checkpoint!`;
}

function finishRace() {
  raceFinished = true;
  hud.status.textContent = 'Maali! Katso tulokset ja aloita halutessasi uudelleen.';

  resultsList.innerHTML = '';
  timing.lapTimes.forEach((lapTime, index) => addResultRow(`Kierros ${index + 1}`, formatTime(lapTime)));
  addResultRow('Paras kierros', formatTime(timing.bestLapTime));
  addResultRow('Loppuaika', formatTime(timing.totalTime));
  resultsOverlay.classList.remove('hidden');
  restartButton.focus();
}

function addResultRow(label, value) {
  const term = document.createElement('dt');
  term.textContent = label;
  const description = document.createElement('dd');
  description.textContent = value;
  resultsList.append(term, description);
}

function updateHud(now) {
  const currentLapTime = !raceStarted ? 0 : (raceFinished ? timing.lastLapTime : now - timing.lapStart);
  const totalTime = !raceStarted ? 0 : (raceFinished ? timing.totalTime : now - timing.raceStart);
  hud.lap.textContent = `${Math.min(timing.lap, TOTAL_LAPS)}/${TOTAL_LAPS}`;
  hud.currentLap.textContent = formatTime(currentLapTime);
  hud.lastLap.textContent = formatTime(timing.lastLapTime);
  hud.bestLap.textContent = formatTime(timing.bestLapTime);
  hud.total.textContent = formatTime(totalTime);
}

function drawTrack() {
  ctx.fillStyle = '#2f7d3d';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 1;
  for (let x = 0; x < WIDTH; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x - 140, HEIGHT);
    ctx.stroke();
  }
  ctx.restore();

  ctx.beginPath();
  ctx.ellipse(track.centerX, track.centerY, track.outerRadiusX, track.outerRadiusY, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#3d4248';
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(track.centerX, track.centerY, track.outerRadiusX - 17, track.outerRadiusY - 17, 0, 0, Math.PI * 2);
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(track.centerX, track.centerY, track.innerRadiusX, track.innerRadiusY, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#2f7d3d';
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(track.centerX, track.centerY, track.innerRadiusX + 15, track.innerRadiusY + 15, 0, 0, Math.PI * 2);
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.setLineDash([24, 16]);
  ctx.beginPath();
  ctx.ellipse(track.centerX, track.centerY, 305, 153, 0, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.38)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.setLineDash([]);

  drawLine(startLine, '#f8fafc', 8);
  drawLine(checkpointLine, '#facc15', 8);

  drawDirectionArrow(track.centerX - 100, track.centerY + 155, Math.PI, 'AJOSUUNTA');
  drawDirectionArrow(track.centerX - 300, track.centerY + 6, -Math.PI / 2, '');
  drawDirectionArrow(track.centerX + 82, track.centerY - 153, 0, '');

  ctx.fillStyle = '#0f172a';
  ctx.font = '700 15px system-ui, sans-serif';
  ctx.fillText('MAALI', startLine.x1 + 14, startLine.y1 + 55);
  ctx.fillText('CHECKPOINT', checkpointLine.x1 + 14, checkpointLine.y2 - 24);
}

function drawDirectionArrow(x, y, angle, label) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(103, 232, 249, 0.95)';
  ctx.beginPath();
  ctx.moveTo(22, 0);
  ctx.lineTo(-14, -14);
  ctx.lineTo(-7, 0);
  ctx.lineTo(-14, 14);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  if (label) {
    ctx.fillStyle = '#cffafe';
    ctx.font = '800 14px system-ui, sans-serif';
    ctx.fillText(label, x - 46, y + 34);
  }
}

function drawLine(line, color, width) {
  ctx.beginPath();
  ctx.moveTo(line.x1, line.y1);
  ctx.lineTo(line.x2, line.y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function drawCar() {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);

  ctx.fillStyle = '#ef4444';
  roundRect(-car.width / 2, -car.height / 2, car.width, car.height, 5);
  ctx.fill();

  ctx.fillStyle = '#bae6fd';
  roundRect(-car.width / 2 + 4, -car.height / 2 + 5, car.width - 8, 9, 3);
  ctx.fill();

  ctx.fillStyle = '#111827';
  ctx.fillRect(-car.width / 2 - 3, -car.height / 2 + 6, 4, 9);
  ctx.fillRect(car.width / 2 - 1, -car.height / 2 + 6, 4, 9);
  ctx.fillRect(-car.width / 2 - 3, car.height / 2 - 15, 4, 9);
  ctx.fillRect(car.width / 2 - 1, car.height / 2 - 15, 4, 9);

  ctx.fillStyle = '#fde68a';
  ctx.fillRect(-7, -car.height / 2 - 1, 5, 3);
  ctx.fillRect(2, -car.height / 2 - 1, 5, 3);
  ctx.restore();
}

function roundRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
}

// Pelilooppi: lasketaan delta-aika, päivitetään fysiikka ja pelitila, piirretään uusi ruutu.
function gameLoop(now) {
  const deltaSeconds = Math.min((now - lastFrameTime) / 1000, 0.033);
  lastFrameTime = now;

  if (raceStarted && !raceFinished) {
    updateCar(deltaSeconds);
    updateRaceProgress(now);
  }

  drawTrack();
  drawCar();
  updateHud(now);
  requestAnimationFrame(gameLoop);
}

window.addEventListener('keydown', (event) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) {
    event.preventDefault();
    keys.add(event.code);
  }
});

window.addEventListener('keyup', (event) => {
  keys.delete(event.code);
});

function restartGame() {
  createInitialState(true);
}

restartButton.addEventListener('click', restartGame);
hudRestartButton.addEventListener('click', restartGame);

createInitialState();
requestAnimationFrame(gameLoop);
