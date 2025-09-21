// AETHERIC System (screen-space interference + polychora shadows)
// Drop-in module for vib34d-ultimate-viewer
// Exports a factory with { id, name, init(gl), draw(gl, state, dt), resize(gl), dispose(gl) }

import { compileProgram } from '../_shared/glutils.js';

const vertUrl = new URL('../../shaders/aetheric.vert.glsl', import.meta.url);
const fragUrl = new URL('../../shaders/aetheric.frag.glsl', import.meta.url);

let shaderSourcePromise = null;

async function loadShaderSources() {
  if (!shaderSourcePromise) {
    shaderSourcePromise = Promise.all([
      fetch(vertUrl).then((res) => res.text()),
      fetch(fragUrl).then((res) => res.text())
    ]);
  }

  return shaderSourcePromise;
}

export default function createAethericSystem() {
  let program;
  let vao;
  let uniforms = {};
  let quad;

  const id = 'AETHERIC';
  const name = 'Aetheric (Holo-Caustics)';

  async function init(gl) {
    const [vertSrc, fragSrc] = await loadShaderSources();
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
  }

  function resize(gl, w, h) {
    gl.viewport(0, 0, w, h);
  }

  // state.params must expose the 11-parameter grammar used across engines
  // Expected fields (names can be mapped in your controller):
  //   rotXW, rotYW, rotZW, gridDensity, morphFactor, chaos, speed,
  //   hue, intensity, saturation, scale
  function draw(gl, state, dt) {
    const width = gl.drawingBufferWidth || gl.canvas.width;
    const height = gl.drawingBufferHeight || gl.canvas.height;
    const p = state.params || {};

    gl.useProgram(program);
    gl.bindVertexArray(vao);

    gl.uniform1f(uniforms.u_time, state.time || 0);
    gl.uniform2f(uniforms.u_res, width, height);

    gl.uniform1f(uniforms.u_rotXW, p.rotXW || 0.0);
    gl.uniform1f(uniforms.u_rotYW, p.rotYW || 0.0);
    gl.uniform1f(uniforms.u_rotZW, p.rotZW || 0.0);

    gl.uniform1f(uniforms.u_grid, p.gridDensity ?? 15.0);
    gl.uniform1f(uniforms.u_morph, p.morphFactor ?? 1.0);
    gl.uniform1f(uniforms.u_chaos, p.chaos ?? 0.2);
    gl.uniform1f(uniforms.u_speed, p.speed ?? 1.0);

    gl.uniform1f(uniforms.u_hue, p.hue ?? 200.0);
    gl.uniform1f(uniforms.u_intensity, p.intensity ?? 0.9);
    gl.uniform1f(uniforms.u_sat, p.saturation ?? 0.5);

    gl.uniform1f(uniforms.u_scale, p.scale ?? 1.0);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function dispose(gl) {
    if (vao) gl.deleteVertexArray(vao);
    if (quad?.vbo) gl.deleteBuffer(quad.vbo);
    if (program) gl.deleteProgram(program);
  }

  return { id, name, init, draw, resize, dispose };
}
