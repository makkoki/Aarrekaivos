import Phaser from 'phaser';
import { chooseEnemyMove } from '../core/EnemySystem';
import { getTile, samePosition, setTile } from '../core/Grid';
import { applyRockGravity } from '../core/PhysicsSystem';
import { LevelState, parseLevel } from '../core/Level';
import { Direction, GridPosition, Tile, TILE_SIZE } from '../core/TileTypes';
import { LEVELS } from '../data/levels';

const HUD_HEIGHT = 92;
const MOVE_DELAY = 120;
const GRAVITY_DELAY = 230;
const ENEMY_DELAY = 520;
const SCORE_PER_CRYSTAL = 100;
const HIGH_SCORE_KEY = 'aarrekaivos-high-score';
const SOUND_ENABLED_KEY = 'aarrekaivos-sound-enabled';

type GameMode = 'menu' | 'playing' | 'levelComplete' | 'gameOver';
type SoundName = 'collect' | 'rock' | 'lose' | 'complete';

export class GameScene extends Phaser.Scene {
  private level!: LevelState;
  private levelIndex = 0;
  private score = 0;
  private highScore = 0;
  private collectedCrystals = 0;
  private lastMoveAt = 0;
  private lastGravityAt = 0;
  private lastEnemyMoveAt = 0;
  private mode: GameMode = 'menu';
  private soundEnabled = true;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private boardLayer!: Phaser.GameObjects.Container;
  private hudText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private overlayLayer!: Phaser.GameObjects.Container;
  private touchDirection: Direction | null = null;
  private statusMessage = '';

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,R,SPACE,M') as Record<string, Phaser.Input.Keyboard.Key>;
    this.highScore = this.loadHighScore();
    this.soundEnabled = this.loadSoundEnabled();
    this.createTextures();
    this.boardLayer = this.add.container(0, HUD_HEIGHT);
    this.overlayLayer = this.add.container(0, 0);
    this.hudText = this.add.text(18, 14, '', {
      color: '#fff7ed',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '21px',
      fontStyle: '700',
    });
    this.statusText = this.add.text(18, 52, '', {
      color: '#d7c6f2',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '15px',
    });

    this.input.keyboard!.on('keydown-R', () => this.resetLevel('Kenttä aloitettiin uudelleen.'));
    this.input.keyboard!.on('keydown-M', () => this.toggleSound());
    this.input.keyboard!.on('keydown-SPACE', () => this.handlePrimaryAction());
    this.createTouchControls();
    this.startMusicLoop();
    this.showStartMenu();
  }

  update(time: number): void {
    if (this.mode !== 'playing') {
      return;
    }

    const direction = this.readMovementDirection();
    if (direction && time - this.lastMoveAt >= MOVE_DELAY) {
      this.lastMoveAt = time;
      this.movePlayer(direction);
    }

    if (time - this.lastGravityAt >= GRAVITY_DELAY) {
      this.lastGravityAt = time;
      this.updateGravity();
    }

    if (time - this.lastEnemyMoveAt >= ENEMY_DELAY) {
      this.lastEnemyMoveAt = time;
      this.updateEnemies();
    }
  }

  private showStartMenu(): void {
    this.mode = 'menu';
    this.levelIndex = 0;
    this.score = 0;
    this.prepareLevel('Valitse aloita, kerää kristallit ja vältä mörriköitä.', 'menu');
    this.drawMenu('Aarrekaivos', 'Aloita seikkailu', 'Paina välilyöntiä tai kosketa tästä aloittaaksesi.');
  }

  private handlePrimaryAction(): void {
    if (this.mode === 'menu') {
      this.startRun();
      return;
    }
    if (this.mode === 'levelComplete') {
      this.advanceLevel();
      return;
    }
    if (this.mode === 'gameOver') {
      this.startRun();
    }
  }

  private startRun(): void {
    this.levelIndex = 0;
    this.score = 0;
    this.prepareLevel('Kerää kristallit, avaa portti ja palaa aarteiden kanssa ulos!', 'playing');
  }

  private advanceLevel(): void {
    if (this.levelIndex >= LEVELS.length - 1) {
      this.showStartMenu();
      return;
    }

    this.levelIndex += 1;
    this.prepareLevel('Uusi syvempi kenttä alkaa. Vaikeus kasvaa!', 'playing');
  }

  private prepareLevel(message: string, mode: GameMode = 'playing'): void {
    const levelConfig = LEVELS[this.levelIndex];
    this.level = parseLevel([...levelConfig.rows], levelConfig.requiredCrystals);
    this.collectedCrystals = 0;
    this.mode = mode;
    this.lastMoveAt = 0;
    this.lastGravityAt = 0;
    this.lastEnemyMoveAt = 0;
    this.statusMessage = message;
    this.overlayLayer.removeAll(true);
    this.redraw();
  }

  private resetLevel(message: string): void {
    if (this.mode === 'menu') {
      return;
    }
    this.prepareLevel(message);
  }

  private readMovementDirection(): Direction | null {
    if (this.touchDirection) {
      const direction = this.touchDirection;
      this.touchDirection = null;
      return direction;
    }
    if (this.cursors.left.isDown || this.keys.A.isDown) return { x: -1, y: 0 };
    if (this.cursors.right.isDown || this.keys.D.isDown) return { x: 1, y: 0 };
    if (this.cursors.up.isDown || this.keys.W.isDown) return { x: 0, y: -1 };
    if (this.cursors.down.isDown || this.keys.S.isDown) return { x: 0, y: 1 };
    return null;
  }

  private movePlayer(direction: Direction): void {
    const target = { x: this.level.player.x + direction.x, y: this.level.player.y + direction.y };
    const targetTile = getTile(this.level.grid, target);

    if (this.level.enemies.some((enemy) => samePosition(enemy, target))) {
      this.loseLevel('Kaivosmörrikkä nappasi pelaajan. Paina välilyöntiä tai R yrittääksesi uudelleen.');
      return;
    }
    if (targetTile === Tile.Wall || targetTile === Tile.Rock) return;
    if (targetTile === Tile.Exit && !this.level.exitOpen) {
      this.statusMessage = 'Portti on vielä kiinni. Kerää ensin tarpeeksi kristalleja!';
      return;
    }

    if (targetTile === Tile.Crystal) {
      this.collectedCrystals += 1;
      this.score += SCORE_PER_CRYSTAL;
      this.playSound('collect');
      this.statusMessage = `Hienoa! Kristalli ${this.collectedCrystals}/${this.level.requiredCrystals} kerätty.`;
      setTile(this.level.grid, target, Tile.Empty);
      if (this.collectedCrystals >= this.level.requiredCrystals && !this.level.exitOpen) {
        this.level.exitOpen = true;
        this.statusMessage = 'Portti aukesi! Etsi vihreänä hohtava uloskäynti.';
      }
    }
    if (targetTile === Tile.Dirt) setTile(this.level.grid, target, Tile.Empty);
    this.level.player = target;

    if (targetTile === Tile.Exit && this.level.exitOpen) {
      this.winLevel();
      return;
    }
    this.redraw();
  }

  private updateGravity(): void {
    const before = this.level.grid.map((row) => row.join('')).join('\n');
    const result = applyRockGravity(this.level.grid, this.level.player, this.level.enemies);
    const rocksMoved = before !== this.level.grid.map((row) => row.join('')).join('\n');
    if (rocksMoved) this.playSound('rock');

    if (result.defeatedEnemyIndexes.length > 0) {
      this.level.enemies = this.level.enemies.filter((_, index) => !result.defeatedEnemyIndexes.includes(index));
      this.score += 250;
      this.statusMessage = 'Kivi pysäytti mörrikän! Saat 250 lisäpistettä.';
    }
    if (result.crushedPlayer) {
      this.loseLevel('Putoava kivi osui pelaajaan. Paina välilyöntiä tai R yrittääksesi uudelleen.');
      return;
    }
    this.redraw();
  }

  private updateEnemies(): void {
    this.level.enemies = this.level.enemies.map((enemy) => {
      const next = chooseEnemyMove(enemy, this.level.player, this.level.grid, this.level.enemies);
      if (samePosition(next, this.level.player)) {
        this.loseLevel('Kaivosmörrikkä löysi pelaajan. Paina välilyöntiä tai R yrittääksesi uudelleen.');
      }
      return next;
    });
    this.redraw();
  }

  private loseLevel(message: string): void {
    this.mode = 'gameOver';
    this.playSound('lose');
    this.statusMessage = message;
    this.saveHighScore();
    this.redraw();
    this.drawMenu('Peli päättyi', 'Yritä uudelleen', 'Paina välilyöntiä tai kosketa tästä aloittaaksesi alusta.');
  }

  private winLevel(): void {
    this.mode = 'levelComplete';
    this.score += 500 + this.levelIndex * 150;
    this.playSound('complete');
    this.saveHighScore();
    const isLastLevel = this.levelIndex === LEVELS.length - 1;
    this.statusMessage = isLastLevel ? 'Kaikki kentät läpäisty!' : 'Kenttä läpäisty! Seuraava kenttä odottaa.';
    this.redraw();
    this.drawMenu(
      isLastLevel ? 'Kaivos valloitettu!' : 'Kenttä läpäisty!',
      isLastLevel ? 'Takaisin alkuvalikkoon' : 'Seuraava kenttä',
      'Paina välilyöntiä tai kosketa jatkaaksesi.',
    );
  }

  private redraw(): void {
    this.boardLayer.removeAll(true);
    this.drawBoard();
    this.drawActors();
    this.drawHud();
  }

  private drawHud(): void {
    const exitStatus = this.level.exitOpen ? 'Auki' : 'Kiinni';
    const levelName = LEVELS[this.levelIndex].name;
    this.hudText.setText(
      `${levelName}  Pisteet: ${this.score}  High score: ${this.highScore}  Äänet: ${this.soundEnabled ? 'On' : 'Off'}`,
    );
    this.statusText.setText(
      `${this.statusMessage}  Kristallit: ${this.collectedCrystals}/${this.level.requiredCrystals}  Portti: ${exitStatus}  R = uusi yritys  M = äänet`,
    );
  }

  private drawBoard(): void {
    const background = this.add.rectangle(0, 0, this.level.width * TILE_SIZE, this.level.height * TILE_SIZE, 0x1b102d);
    background.setOrigin(0);
    this.boardLayer.add(background);
    for (let y = 0; y < this.level.height; y += 1) {
      for (let x = 0; x < this.level.width; x += 1) {
        const tile = this.level.grid[y][x];
        const image = this.add.image(x * TILE_SIZE, y * TILE_SIZE, this.textureForTile(tile));
        image.setOrigin(0);
        if (tile === Tile.Exit && this.level.exitOpen) image.setTint(0x6ee7b7);
        if (tile === Tile.Crystal) this.tweens.add({ targets: image, alpha: 0.72, yoyo: true, repeat: -1, duration: 720 });
        this.boardLayer.add(image);
      }
    }
  }

  private drawActors(): void {
    this.addActor(this.level.player, 'player', true);
    this.level.enemies.forEach((enemy) => this.addActor(enemy, 'enemy', false));
  }

  private addActor(position: GridPosition, texture: string, isPlayer: boolean): void {
    const actor = this.add.image(position.x * TILE_SIZE + TILE_SIZE / 2, position.y * TILE_SIZE + TILE_SIZE / 2, texture);
    this.boardLayer.add(actor);
    this.tweens.add({
      targets: actor,
      scale: isPlayer ? 1.08 : 0.94,
      angle: isPlayer ? 4 : -5,
      yoyo: true,
      repeat: -1,
      duration: isPlayer ? 300 : 520,
    });
  }

  private drawMenu(titleText: string, buttonText: string, hintText: string): void {
    this.overlayLayer.removeAll(true);
    const shade = this.add.rectangle(400, 270, 800, 540, 0x080412, 0.72).setInteractive();
    const panel = this.add.rectangle(400, 270, 560, 265, 0x1e1230, 0.96).setStrokeStyle(3, 0xfacc15);
    const title = this.add.text(400, 182, titleText, {
      color: '#fff7ed', fontFamily: 'system-ui, sans-serif', fontSize: '36px', fontStyle: '900', align: 'center',
    }).setOrigin(0.5);
    const details = this.add.text(400, 232, `Kenttiä: ${LEVELS.length}  •  High score: ${this.highScore}`, {
      color: '#d7c6f2', fontFamily: 'system-ui, sans-serif', fontSize: '17px', align: 'center',
    }).setOrigin(0.5);
    const button = this.add.rectangle(400, 298, 300, 54, 0xfacc15, 1).setInteractive({ useHandCursor: true });
    const buttonLabel = this.add.text(400, 298, buttonText, {
      color: '#1e1230', fontFamily: 'system-ui, sans-serif', fontSize: '20px', fontStyle: '900',
    }).setOrigin(0.5);
    const hint = this.add.text(400, 364, hintText, {
      color: '#fff7ed', fontFamily: 'system-ui, sans-serif', fontSize: '15px', align: 'center',
    }).setOrigin(0.5);
    button.on('pointerdown', () => this.handlePrimaryAction());
    this.overlayLayer.add([shade, panel, title, details, button, buttonLabel, hint]);
  }

  private createTouchControls(): void {
    const buttons: Array<[string, number, number, Direction]> = [
      ['▲', 705, 386, { x: 0, y: -1 }], ['◀', 655, 436, { x: -1, y: 0 }],
      ['▶', 755, 436, { x: 1, y: 0 }], ['▼', 705, 486, { x: 0, y: 1 }],
    ];
    buttons.forEach(([label, x, y, direction]) => {
      const circle = this.add.circle(x, y, 24, 0xfacc15, 0.72).setInteractive({ useHandCursor: true }).setScrollFactor(0);
      const text = this.add.text(x, y - 2, label, { color: '#1e1230', fontSize: '22px', fontStyle: '900' }).setOrigin(0.5).setScrollFactor(0);
      circle.on('pointerdown', () => { this.touchDirection = direction; });
      this.add.existing(text);
    });
  }

  private toggleSound(): void {
    this.soundEnabled = !this.soundEnabled;
    localStorage.setItem(SOUND_ENABLED_KEY, String(this.soundEnabled));
    if (this.soundEnabled) this.playSound('complete');
    this.redraw();
  }

  private playSound(name: SoundName): void {
    if (!this.soundEnabled) return;
    const assetKey = `${name}-sound`;
    if (this.sound.get(assetKey)) {
      this.sound.play(assetKey);
      return;
    }
    const tones: Record<SoundName, [number, number]> = {
      collect: [880, 0.08], rock: [130, 0.1], lose: [92, 0.28], complete: [660, 0.18],
    };
    this.playTone(...tones[name]);
  }

  private startMusicLoop(): void {
    this.time.addEvent({
      delay: 1600,
      loop: true,
      callback: () => {
        if (this.soundEnabled && this.mode !== 'menu') this.playTone(220 + (this.levelIndex * 20), 0.12, 0.025);
      },
    });
  }

  private playTone(frequency: number, duration: number, volume = 0.07): void {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    gain.gain.value = volume;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
    oscillator.onended = () => context.close();
  }

  private loadHighScore(): number {
    return Number(localStorage.getItem(HIGH_SCORE_KEY) ?? 0);
  }

  private saveHighScore(): void {
    if (this.score <= this.highScore) return;
    this.highScore = this.score;
    localStorage.setItem(HIGH_SCORE_KEY, String(this.highScore));
  }

  private loadSoundEnabled(): boolean {
    return localStorage.getItem(SOUND_ENABLED_KEY) !== 'false';
  }

  private textureForTile(tile: Tile): string {
    switch (tile) {
      case Tile.Wall: return 'wall';
      case Tile.Dirt: return 'dirt';
      case Tile.Crystal: return 'crystal';
      case Tile.Rock: return 'rock';
      case Tile.Exit: return 'exit';
      case Tile.Empty:
      default: return 'empty';
    }
  }

  private createTextures(): void {
    this.makeTileTexture('empty', 0x24123c, 0x2f1b4d);
    this.makeTileTexture('dirt', 0x8b5a2b, 0xa16207);
    this.makeTileTexture('wall', 0x43304f, 0x21102f);
    this.makeCrystalTexture();
    this.makeRockTexture();
    this.makeExitTexture();
    this.makePlayerTexture();
    this.makeEnemyTexture();
  }

  private makeTileTexture(key: string, fill: number, stroke: number): void {
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(fill, 1);
    graphics.fillRoundedRect(1, 1, TILE_SIZE - 2, TILE_SIZE - 2, 5);
    graphics.lineStyle(2, stroke, 0.8);
    graphics.strokeRoundedRect(1, 1, TILE_SIZE - 2, TILE_SIZE - 2, 5);
    graphics.generateTexture(key, TILE_SIZE, TILE_SIZE);
    graphics.destroy();
  }

  private makeCrystalTexture(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0x24123c, 1); graphics.fillRoundedRect(1, 1, TILE_SIZE - 2, TILE_SIZE - 2, 5);
    graphics.fillStyle(0x67e8f9, 1); graphics.beginPath(); graphics.moveTo(16, 4); graphics.lineTo(27, 15); graphics.lineTo(16, 29); graphics.lineTo(5, 15); graphics.closePath(); graphics.fillPath();
    graphics.lineStyle(2, 0xf0fdfa, 0.9); graphics.strokePath(); graphics.generateTexture('crystal', TILE_SIZE, TILE_SIZE); graphics.destroy();
  }

  private makeRockTexture(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0x24123c, 1); graphics.fillRoundedRect(1, 1, TILE_SIZE - 2, TILE_SIZE - 2, 5);
    graphics.fillStyle(0x78716c, 1); graphics.fillCircle(16, 17, 12); graphics.lineStyle(2, 0xd6d3d1, 0.7); graphics.strokeCircle(16, 17, 12);
    graphics.generateTexture('rock', TILE_SIZE, TILE_SIZE); graphics.destroy();
  }

  private makeExitTexture(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0x24123c, 1); graphics.fillRoundedRect(1, 1, TILE_SIZE - 2, TILE_SIZE - 2, 5);
    graphics.lineStyle(3, 0xfacc15, 1); graphics.strokeRoundedRect(7, 5, 18, 24, 6); graphics.fillStyle(0xfacc15, 1); graphics.fillCircle(23, 17, 2);
    graphics.generateTexture('exit', TILE_SIZE, TILE_SIZE); graphics.destroy();
  }

  private makePlayerTexture(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0x38bdf8, 1); graphics.fillCircle(16, 16, 12); graphics.fillStyle(0xfef3c7, 1); graphics.fillCircle(12, 14, 3); graphics.fillCircle(20, 14, 3);
    graphics.lineStyle(2, 0x0f172a, 1); graphics.beginPath(); graphics.arc(16, 18, 6, 0.2, Math.PI - 0.2, false); graphics.strokePath();
    graphics.generateTexture('player', TILE_SIZE, TILE_SIZE); graphics.destroy();
  }

  private makeEnemyTexture(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0xc084fc, 1); graphics.fillCircle(16, 17, 12); graphics.fillStyle(0xffffff, 1); graphics.fillCircle(12, 14, 3); graphics.fillCircle(20, 14, 3);
    graphics.fillStyle(0x1f1235, 1); graphics.fillCircle(12, 14, 1); graphics.fillCircle(20, 14, 1); graphics.lineStyle(2, 0x581c87, 1); graphics.strokeCircle(16, 17, 12);
    graphics.generateTexture('enemy', TILE_SIZE, TILE_SIZE); graphics.destroy();
  }
}
