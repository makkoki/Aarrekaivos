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

export class GameScene extends Phaser.Scene {
  private level!: LevelState;
  private score = 0;
  private collectedCrystals = 0;
  private lastMoveAt = 0;
  private lastGravityAt = 0;
  private lastEnemyMoveAt = 0;
  private gameWon = false;
  private gameOver = false;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private boardLayer!: Phaser.GameObjects.Container;
  private hudText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,R,SPACE') as Record<string, Phaser.Input.Keyboard.Key>;
    this.createTextures();
    this.boardLayer = this.add.container(0, HUD_HEIGHT);
    this.hudText = this.add.text(18, 14, '', {
      color: '#fff7ed',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '22px',
      fontStyle: '700',
    });
    this.statusText = this.add.text(18, 52, '', {
      color: '#d7c6f2',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '15px',
    });

    this.input.keyboard!.on('keydown-R', () => this.resetLevel('Kenttä aloitettiin uudelleen.'));
    this.input.keyboard!.on('keydown-SPACE', () => {
      if (this.gameWon || this.gameOver) {
        this.resetLevel('Uusi yritys alkaa!');
      }
    });

    this.resetLevel('Kerää 6 kristallia, avaa portti ja palaa aarteiden kanssa ulos!');
  }

  update(time: number): void {
    if (this.gameWon || this.gameOver) {
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

  private resetLevel(message: string): void {
    const levelConfig = LEVELS[0];
    this.level = parseLevel([...levelConfig.rows], levelConfig.requiredCrystals);
    this.score = 0;
    this.collectedCrystals = 0;
    this.gameWon = false;
    this.gameOver = false;
    this.lastMoveAt = 0;
    this.lastGravityAt = 0;
    this.lastEnemyMoveAt = 0;
    this.statusText.setText(message);
    this.redraw();
  }

  private readMovementDirection(): Direction | null {
    if (this.cursors.left.isDown || this.keys.A.isDown) {
      return { x: -1, y: 0 };
    }
    if (this.cursors.right.isDown || this.keys.D.isDown) {
      return { x: 1, y: 0 };
    }
    if (this.cursors.up.isDown || this.keys.W.isDown) {
      return { x: 0, y: -1 };
    }
    if (this.cursors.down.isDown || this.keys.S.isDown) {
      return { x: 0, y: 1 };
    }

    return null;
  }

  private movePlayer(direction: Direction): void {
    const target = {
      x: this.level.player.x + direction.x,
      y: this.level.player.y + direction.y,
    };
    const targetTile = getTile(this.level.grid, target);

    if (this.level.enemies.some((enemy) => samePosition(enemy, target))) {
      this.loseLevel('Kaivosmörrikkä nappasi pelaajan. Paina välilyöntiä tai R yrittääksesi uudelleen.');
      return;
    }

    if (targetTile === Tile.Wall || targetTile === Tile.Rock) {
      return;
    }

    if (targetTile === Tile.Exit && !this.level.exitOpen) {
      this.statusText.setText('Portti on vielä kiinni. Kerää ensin tarpeeksi kristalleja!');
      return;
    }

    if (targetTile === Tile.Crystal) {
      this.collectedCrystals += 1;
      this.score += SCORE_PER_CRYSTAL;
      this.statusText.setText(`Hienoa! Kristalli ${this.collectedCrystals}/${this.level.requiredCrystals} kerätty.`);
      setTile(this.level.grid, target, Tile.Empty);

      if (this.collectedCrystals >= this.level.requiredCrystals && !this.level.exitOpen) {
        this.level.exitOpen = true;
        this.statusText.setText('Portti aukesi! Etsi vihreänä hohtava uloskäynti.');
      }
    }

    if (targetTile === Tile.Dirt) {
      setTile(this.level.grid, target, Tile.Empty);
    }

    this.level.player = target;

    if (targetTile === Tile.Exit && this.level.exitOpen) {
      this.winLevel();
      return;
    }

    this.redraw();
  }

  private updateGravity(): void {
    const result = applyRockGravity(this.level.grid, this.level.player, this.level.enemies);

    if (result.defeatedEnemyIndexes.length > 0) {
      this.level.enemies = this.level.enemies.filter((_, index) => !result.defeatedEnemyIndexes.includes(index));
      this.score += 250;
      this.statusText.setText('Kivi pysäytti mörrikän! Saat 250 lisäpistettä.');
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
    this.gameOver = true;
    this.statusText.setText(message);
    this.redraw();
  }

  private winLevel(): void {
    this.gameWon = true;
    this.score += 500;
    this.statusText.setText('Voitto! Löysit uloskäynnin ja toit aarteet turvaan. Paina välilyöntiä pelataksesi uudelleen.');
    this.redraw();
  }

  private redraw(): void {
    this.boardLayer.removeAll(true);
    this.drawBoard();
    this.drawActors();
    this.drawHud();
  }

  private drawHud(): void {
    const exitStatus = this.level.exitOpen ? 'Auki' : 'Kiinni';
    this.hudText.setText(
      `Pisteet: ${this.score}   Kristallit: ${this.collectedCrystals}/${this.level.requiredCrystals}   Portti: ${exitStatus}   R = uusi yritys`,
    );
  }

  private drawBoard(): void {
    const background = this.add.rectangle(
      0,
      0,
      this.level.width * TILE_SIZE,
      this.level.height * TILE_SIZE,
      0x1b102d,
    );
    background.setOrigin(0);
    this.boardLayer.add(background);

    for (let y = 0; y < this.level.height; y += 1) {
      for (let x = 0; x < this.level.width; x += 1) {
        const tile = this.level.grid[y][x];
        const image = this.add.image(x * TILE_SIZE, y * TILE_SIZE, this.textureForTile(tile));
        image.setOrigin(0);
        if (tile === Tile.Exit && this.level.exitOpen) {
          image.setTint(0x6ee7b7);
        }
        this.boardLayer.add(image);
      }
    }
  }

  private drawActors(): void {
    this.addActor(this.level.player, 'player');
    this.level.enemies.forEach((enemy) => this.addActor(enemy, 'enemy'));

    if (this.gameWon || this.gameOver) {
      const message = this.gameWon ? 'KENTTÄ LÄPÄISTY!' : 'Yritä uudelleen!';
      const color = this.gameWon ? '#bbf7d0' : '#fecaca';
      const panel = this.add.rectangle(400, 224, 500, 116, 0x160d28, 0.92).setStrokeStyle(3, 0xfacc15);
      const title = this.add.text(400, 198, message, {
        color,
        fontFamily: 'system-ui, sans-serif',
        fontSize: '32px',
        fontStyle: '900',
      });
      title.setOrigin(0.5);
      const hint = this.add.text(400, 240, 'Paina välilyöntiä tai R aloittaaksesi alusta.', {
        color: '#fff7ed',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
      });
      hint.setOrigin(0.5);
      this.boardLayer.add([panel, title, hint]);
    }
  }

  private addActor(position: GridPosition, texture: string): void {
    const actor = this.add.image(position.x * TILE_SIZE + TILE_SIZE / 2, position.y * TILE_SIZE + TILE_SIZE / 2, texture);
    this.boardLayer.add(actor);
  }

  private textureForTile(tile: Tile): string {
    switch (tile) {
      case Tile.Wall:
        return 'wall';
      case Tile.Dirt:
        return 'dirt';
      case Tile.Crystal:
        return 'crystal';
      case Tile.Rock:
        return 'rock';
      case Tile.Exit:
        return 'exit';
      case Tile.Empty:
      default:
        return 'empty';
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
    graphics.fillStyle(0x24123c, 1);
    graphics.fillRoundedRect(1, 1, TILE_SIZE - 2, TILE_SIZE - 2, 5);
    graphics.fillStyle(0x67e8f9, 1);
    graphics.beginPath();
    graphics.moveTo(16, 4);
    graphics.lineTo(27, 15);
    graphics.lineTo(16, 29);
    graphics.lineTo(5, 15);
    graphics.closePath();
    graphics.fillPath();
    graphics.lineStyle(2, 0xf0fdfa, 0.9);
    graphics.strokePath();
    graphics.generateTexture('crystal', TILE_SIZE, TILE_SIZE);
    graphics.destroy();
  }

  private makeRockTexture(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0x24123c, 1);
    graphics.fillRoundedRect(1, 1, TILE_SIZE - 2, TILE_SIZE - 2, 5);
    graphics.fillStyle(0x78716c, 1);
    graphics.fillCircle(16, 17, 12);
    graphics.lineStyle(2, 0xd6d3d1, 0.7);
    graphics.strokeCircle(16, 17, 12);
    graphics.generateTexture('rock', TILE_SIZE, TILE_SIZE);
    graphics.destroy();
  }

  private makeExitTexture(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0x24123c, 1);
    graphics.fillRoundedRect(1, 1, TILE_SIZE - 2, TILE_SIZE - 2, 5);
    graphics.lineStyle(3, 0xfacc15, 1);
    graphics.strokeRoundedRect(7, 5, 18, 24, 6);
    graphics.fillStyle(0xfacc15, 1);
    graphics.fillCircle(23, 17, 2);
    graphics.generateTexture('exit', TILE_SIZE, TILE_SIZE);
    graphics.destroy();
  }

  private makePlayerTexture(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0x38bdf8, 1);
    graphics.fillCircle(16, 16, 12);
    graphics.fillStyle(0xfef3c7, 1);
    graphics.fillCircle(12, 14, 3);
    graphics.fillCircle(20, 14, 3);
    graphics.lineStyle(2, 0x0f172a, 1);
    graphics.beginPath();
    graphics.arc(16, 18, 6, 0.2, Math.PI - 0.2, false);
    graphics.strokePath();
    graphics.generateTexture('player', TILE_SIZE, TILE_SIZE);
    graphics.destroy();
  }

  private makeEnemyTexture(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0xc084fc, 1);
    graphics.fillCircle(16, 17, 12);
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(12, 14, 3);
    graphics.fillCircle(20, 14, 3);
    graphics.fillStyle(0x1f1235, 1);
    graphics.fillCircle(12, 14, 1);
    graphics.fillCircle(20, 14, 1);
    graphics.lineStyle(2, 0x581c87, 1);
    graphics.strokeCircle(16, 17, 12);
    graphics.generateTexture('enemy', TILE_SIZE, TILE_SIZE);
    graphics.destroy();
  }
}
