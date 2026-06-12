declare module '*.css';

declare module 'phaser' {
  namespace Phaser {
    const AUTO: number;

    class Game {
      constructor(config: Types.Core.GameConfig);
    }

    class Scene {
      input: Input.InputPlugin;
      add: GameObjects.GameObjectFactory;
      make: GameObjects.GameObjectCreator;
      constructor(config: string | object);
    }

    namespace Scale {
      const FIT: number;
      const CENTER_BOTH: number;
    }

    namespace Types {
      namespace Core {
        type GameConfig = {
          type: number;
          parent: string;
          width: number;
          height: number;
          backgroundColor: string;
          pixelArt: boolean;
          scene: Array<typeof Scene>;
          scale: {
            mode: number;
            autoCenter: number;
          };
        };
      }

      namespace Input {
        namespace Keyboard {
          type CursorKeys = {
            left: Phaser.Input.Keyboard.Key;
            right: Phaser.Input.Keyboard.Key;
            up: Phaser.Input.Keyboard.Key;
            down: Phaser.Input.Keyboard.Key;
          };
        }
      }
    }

    namespace Input {
      class InputPlugin {
        keyboard?: Keyboard.KeyboardPlugin;
      }

      namespace Keyboard {
        class Key {
          isDown: boolean;
        }

        class KeyboardPlugin {
          createCursorKeys(): Types.Input.Keyboard.CursorKeys;
          addKeys(keys: string): Record<string, Key>;
          on(event: string, callback: () => void): void;
        }
      }
    }

    namespace GameObjects {
      class GameObject {}

      class Container extends GameObject {
        add(child: GameObject | GameObject[]): this;
        removeAll(destroyChildren?: boolean): this;
      }

      class Image extends GameObject {
        setOrigin(x: number, y?: number): this;
        setTint(color: number): this;
      }

      class Rectangle extends GameObject {
        setOrigin(x: number, y?: number): this;
        setStrokeStyle(lineWidth: number, color: number): this;
      }

      class Text extends GameObject {
        setText(value: string): this;
        setOrigin(x: number, y?: number): this;
      }

      class Graphics extends GameObject {
        fillStyle(color: number, alpha?: number): this;
        fillRoundedRect(x: number, y: number, width: number, height: number, radius: number): this;
        lineStyle(width: number, color: number, alpha?: number): this;
        strokeRoundedRect(x: number, y: number, width: number, height: number, radius: number): this;
        beginPath(): this;
        moveTo(x: number, y: number): this;
        lineTo(x: number, y: number): this;
        closePath(): this;
        fillPath(): this;
        strokePath(): this;
        fillCircle(x: number, y: number, radius: number): this;
        strokeCircle(x: number, y: number, radius: number): this;
        arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, anticlockwise?: boolean): this;
        generateTexture(key: string, width: number, height: number): this;
        destroy(): void;
      }

      class GameObjectFactory {
        container(x: number, y: number): Container;
        text(x: number, y: number, text: string, style: Record<string, string>): Text;
        rectangle(x: number, y: number, width: number, height: number, fillColor: number, fillAlpha?: number): Rectangle;
        image(x: number, y: number, texture: string): Image;
      }

      class GameObjectCreator {
        graphics(config: { x: number; y: number }, addToScene?: boolean): Graphics;
      }
    }
  }

  export default Phaser;
}
