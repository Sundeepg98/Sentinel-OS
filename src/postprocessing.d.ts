declare module 'postprocessing' {
  export class EffectComposer {
    constructor(renderer: unknown);
    addPass(pass: unknown): void;
    render(): void;
  }
  export class EffectPass {
    constructor(camera: unknown, ...effects: unknown[]);
  }
  export class RenderPass {
    constructor(scene: unknown, camera: unknown);
  }
  export class SMAAEffect {
    edgeDetectionMaterial: unknown;
  }
  export class BloomEffect {
    constructor(options?: unknown);
  }
  export class VignetteEffect {
    constructor(options?: unknown);
  }
  export const EdgeDetectionMode: Record<string, unknown>;
}
