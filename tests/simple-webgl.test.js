import { test, expect } from '@playwright/test';

test('Simple WebGL Context Test', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.moduleReady === true, { timeout: 10000 });
  
  // Test basic WebGL context creation and shader compilation
  const webglTest = await page.evaluate(() => {
    const canvas = document.getElementById('background-canvas');
    if (!canvas) return { error: 'Canvas not found' };
    
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return { error: 'WebGL context not available' };
    
    // Test simple shader compilation
    const vertexSource = `
      attribute vec2 a_position;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;
    
    const fragmentSource = `
      precision mediump float;
      void main() {
        gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
      }
    `;
    
    // Create vertex shader
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexSource);
    gl.compileShader(vertexShader);
    
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      return { 
        error: 'Vertex shader compilation failed', 
        log: gl.getShaderInfoLog(vertexShader),
        contextInfo: {
          version: gl.getParameter(gl.VERSION),
          vendor: gl.getParameter(gl.VENDOR),
          renderer: gl.getParameter(gl.RENDERER)
        }
      };
    }
    
    // Create fragment shader
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentSource);
    gl.compileShader(fragmentShader);
    
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      return { 
        error: 'Fragment shader compilation failed', 
        log: gl.getShaderInfoLog(fragmentShader),
        contextInfo: {
          version: gl.getParameter(gl.VERSION),
          vendor: gl.getParameter(gl.VENDOR),
          renderer: gl.getParameter(gl.RENDERER)
        }
      };
    }
    
    // Create program
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      return { 
        error: 'Program linking failed', 
        log: gl.getProgramInfoLog(program) 
      };
    }
    
    return { 
      success: true,
      contextInfo: {
        version: gl.getParameter(gl.VERSION),
        vendor: gl.getParameter(gl.VENDOR),
        renderer: gl.getParameter(gl.RENDERER)
      }
    };
  });
  
  console.log('WebGL Test Result:', JSON.stringify(webglTest, null, 2));
  
  if (webglTest.error) {
    console.error('WebGL Error:', webglTest.error, webglTest.log);
  }
  
  expect(webglTest.success).toBe(true);
});