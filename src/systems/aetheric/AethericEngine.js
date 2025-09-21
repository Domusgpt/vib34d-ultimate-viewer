import createAethericSystem from './aetheric.js';

const CANVAS_ID = 'aetheric-background-canvas';

export default class AethericEngine {
  constructor() {
    this.canvas = null;
    this.gl = null;
    this.system = createAethericSystem();
    this.parameters = {
      rot4dXW: 0,
      rot4dYW: 0,
      rot4dZW: 0,
      gridDensity: 15,
      morphFactor: 1,
      chaos: 0.2,
      speed: 1,
      hue: 200,
      intensity: 0.8,
      saturation: 0.7,
      scale: 1
    };
    this.isActive = false;
    this.animationId = null;
    this.startTime = performance.now();

    this.handleResize = this.handleResize.bind(this);
  }

  async initialize() {
    this.canvas = document.getElementById(CANVAS_ID);
    if (!this.canvas) {
      throw new Error(`Aetheric canvas '${CANVAS_ID}' not found`);
    }

    this.gl = this.canvas.getContext('webgl2', { preserveDrawingBuffer: false }) ||
               this.canvas.getContext('webgl', { preserveDrawingBuffer: false });

    if (!this.gl) {
      throw new Error('Unable to acquire WebGL context for Aetheric system');
    }

    await this.system.init(this.gl);
    this.handleResize();
    window.addEventListener('resize', this.handleResize);

    return true;
  }

  handleResize() {
    if (!this.gl || !this.canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth * dpr;
    const height = window.innerHeight * dpr;

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    if (this.system.resize) {
      this.system.resize(this.gl, this.canvas.width, this.canvas.height);
    }
  }

  setActive(active) {
    this.isActive = active;
    if (active) {
      this.startRenderLoop();
    } else {
      this.stopRenderLoop();
    }
  }

  startRenderLoop() {
    if (this.animationId) return;

    const render = (time) => {
      if (!this.isActive || !this.gl) {
        this.animationId = null;
        return;
      }

      this.system.draw(this.gl, {
        time: (time - this.startTime) * 0.001,
        params: {
          rotXW: this.parameters.rot4dXW ?? this.parameters.rotXW ?? 0,
          rotYW: this.parameters.rot4dYW ?? this.parameters.rotYW ?? 0,
          rotZW: this.parameters.rot4dZW ?? this.parameters.rotZW ?? 0,
          gridDensity: this.parameters.gridDensity,
          morphFactor: this.parameters.morphFactor,
          chaos: this.parameters.chaos,
          speed: this.parameters.speed,
          hue: this.parameters.hue,
          intensity: this.parameters.intensity,
          saturation: this.parameters.saturation,
          scale: this.parameters.scale
        }
      }, 0);

      this.animationId = requestAnimationFrame(render);
    };

    this.animationId = requestAnimationFrame(render);
  }

  stopRenderLoop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  updateParameter(name, value) {
    const numericValue = typeof value === 'number' ? value : parseFloat(value);
    if (!Number.isNaN(numericValue)) {
      this.parameters[name] = numericValue;
    }
  }

  destroy() {
    this.stopRenderLoop();
    window.removeEventListener('resize', this.handleResize);

    if (this.system && this.gl) {
      this.system.dispose(this.gl);
    }

    if (this.gl) {
      const loseContext = this.gl.getExtension('WEBGL_lose_context');
      if (loseContext) {
        loseContext.loseContext();
      }
    }

    this.gl = null;
    this.canvas = null;
  }
}
