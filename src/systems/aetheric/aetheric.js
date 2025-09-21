// AETHERIC System (screen-space interference + polychora shadows)
// Drop-in module for vib34d-ultimate-viewer
// Exports a factory with { id, name, init(gl), draw(gl, state, dt), resize(gl), dispose(gl) }

import { compileProgram } from '../_shared/glutils.js';

const VERTEX_SHADER_URL = new URL('../../shaders/aetheric.vert.glsl', import.meta.url);
const FRAGMENT_SHADER_URL = new URL('../../shaders/aetheric.frag.glsl', import.meta.url);

const shaderCache = new Map();

async function loadShaderSource(url) {
  if (shaderCache.has(url.href)) {
    return shaderCache.get(url.href);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load shader: ${url.href}`);
  }

  const text = await response.text();
  shaderCache.set(url.href, text);
  return text;
}

export default function createAethericSystem() {
  let program;
  let vao;
  let uniforms = {};
  let quad;
  let isInitialized = false;
  let initPromise = null;

  const id = 'AETHERIC';
  const name = 'Aetheric (Holo-Caustics)';

  async function init(gl) {
    if (isInitialized) return;
    if (!initPromise) {
      initPromise = Promise.all([
        loadShaderSource(VERTEX_SHADER_URL),
        loadShaderSource(FRAGMENT_SHADER_URL)
      ]).then(([vertSrc, fragSrc]) => {
        program = compileProgram(gl, vertSrc, fragSrc);

        // Fullscreen triangle (fewer verts than quad; consistent with other systems’ full-screen pass)
        const vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array([-1, -1, 3, -1, -1, 3]),
          gl.STATIC_DRAW
        );

        vao = gl.createVertexArray();
        gl.bindVertexArray(vao);

        const posLoc = gl.getAttribLocation(program, 'a_pos');
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        // Uniform locations
        const uni = (n) => gl.getUniformLocation(program, n);
        uniforms = {
          u_time: uni('u_time'),
          u_res: uni('u_res'),
          u_rotXW: uni('u_rotXW'),
          u_rotYW: uni('u_rotYW'),
          u_rotZW: uni('u_rotZW'),
          u_grid: uni('u_grid'),
          u_morph: uni('u_morph'),
          u_chaos: uni('u_chaos'),
          u_speed: uni('u_speed'),
          u_hue: uni('u_hue'),
          u_intensity: uni('u_intensity'),
          u_sat: uni('u_sat'),
          u_scale: uni('u_scale')
        };

        quad = { vbo };
        isInitialized = true;
      });
    }

    return initPromise;
  }

  function resize(gl, w, h) {
    gl.viewport(0, 0, w, h);
  }

  function draw(gl, state, dt) {
    if (!isInitialized || !program) {
      return;
    }

    const { width, height } = gl.canvas;
    const params = state?.params || {};

    gl.useProgram(program);
    gl.bindVertexArray(vao);

    gl.uniform1f(uniforms.u_time, state?.time ?? 0);
    gl.uniform2f(uniforms.u_res, width, height);

    gl.uniform1f(uniforms.u_rotXW, params.rotXW || 0.0);
    gl.uniform1f(uniforms.u_rotYW, params.rotYW || 0.0);
    gl.uniform1f(uniforms.u_rotZW, params.rotZW || 0.0);

    gl.uniform1f(uniforms.u_grid, params.gridDensity ?? 15.0);
    gl.uniform1f(uniforms.u_morph, params.morphFactor ?? 1.0);
    gl.uniform1f(uniforms.u_chaos, params.chaos ?? 0.2);
    gl.uniform1f(uniforms.u_speed, params.speed ?? 1.0);

    gl.uniform1f(uniforms.u_hue, params.hue ?? 200.0);
    gl.uniform1f(uniforms.u_intensity, params.intensity ?? 0.9);
    gl.uniform1f(uniforms.u_sat, params.saturation ?? 0.5);

    gl.uniform1f(uniforms.u_scale, params.scale ?? 1.0);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function dispose(gl) {
    if (vao) gl.deleteVertexArray(vao);
    if (quad?.vbo) gl.deleteBuffer(quad.vbo);
    if (program) gl.deleteProgram(program);
    vao = null;
    quad = null;
    program = null;
    isInitialized = false;
    initPromise = null;
  }

  return { id, name, init, draw, resize, dispose };
}
