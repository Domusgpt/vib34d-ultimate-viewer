/**
 * VIB34D Integrated Holographic Visualizer
 * WebGL-based renderer for individual holographic layers
 */

import { GeometryLibrary } from '../geometry/GeometryLibrary.js';
import { TopologyLibrary } from './TopologyLibrary.js';

export class IntegratedHolographicVisualizer {
    constructor(canvasId, role, reactivity, variant) {
        this.canvas = document.getElementById(canvasId);
        this.role = role;
        this.reactivity = reactivity;
        this.variant = variant;
        
        if (!this.canvas) {
            console.error(`Canvas ${canvasId} not found`);
            return;
        }
        let rect = this.canvas.getBoundingClientRect();
        const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2x for performance
        
        // Store context options for later use
        this.contextOptions = {
            alpha: true,
            depth: true,
            stencil: false,
            antialias: false,
            premultipliedAlpha: true,
            preserveDrawingBuffer: false,
            powerPreference: 'high-performance',
            failIfMajorPerformanceCaveat: false
        };
        
        // CRITICAL FIX: Ensure canvas is properly sized BEFORE creating WebGL context
        this.ensureCanvasSizedThenInitWebGL(rect, devicePixelRatio);
        
        this.mouseX = 0.5;
        this.mouseY = 0.5;
        this.mouseIntensity = 0.0;
        this.clickIntensity = 0.0;
        this.startTime = Date.now();
        
        // Default parameters
        const defaultGeometry = 0;
        const defaultTopologyFamily = TopologyLibrary.resolveFamily(null, defaultGeometry);
        const defaultTopologyVariant = TopologyLibrary.getDefaultVariantId(defaultTopologyFamily);
        const defaultTopology = TopologyLibrary.getDefaults(defaultTopologyFamily, defaultTopologyVariant);

        this.params = {
            geometry: defaultGeometry,
            gridDensity: 15,
            morphFactor: 1.0,
            chaos: 0.2,
            speed: 1.0,
            hue: 200,
            intensity: 0.5,
            saturation: 0.8,
            dimension: 3.5,
            rot4dXW: 0.0,
            rot4dYW: 0.0,
            rot4dZW: 0.0,
            topologyFamily: defaultTopologyFamily,
            topologyVariant: defaultTopologyVariant,
            topologyShellWidth: defaultTopology.shellWidth,
            topologyPlaneThickness: defaultTopology.planeThickness
        };

        this.applyTopologyDefaults(defaultTopologyFamily, defaultTopologyVariant);
        
        // Initialization now happens in ensureCanvasSizedThenInitWebGL after sizing
        // this.init(); // MOVED
    }
    
    /**
     * CRITICAL FIX: Ensure canvas is properly sized before creating WebGL context
     */
    async ensureCanvasSizedThenInitWebGL(rect, devicePixelRatio) {
        // If canvas has no dimensions, wait for layout or use viewport
        if (rect.width === 0 || rect.height === 0) {
            // Wait for layout with promise
            await new Promise(resolve => {
                setTimeout(() => {
                    rect = this.canvas.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0) {
                        // Use viewport dimensions as fallback
                        const viewWidth = window.innerWidth;
                        const viewHeight = window.innerHeight;
                        this.canvas.width = viewWidth * devicePixelRatio;
                        this.canvas.height = viewHeight * devicePixelRatio;
                        
                        if (window.mobileDebug) {
                            window.mobileDebug.log(`📐 Canvas ${this.canvas.id}: Using viewport fallback ${this.canvas.width}x${this.canvas.height}`);
                        }
                    } else {
                        this.canvas.width = rect.width * devicePixelRatio;
                        this.canvas.height = rect.height * devicePixelRatio;
                        
                        if (window.mobileDebug) {
                            window.mobileDebug.log(`📐 Canvas ${this.canvas.id}: Layout ready ${this.canvas.width}x${this.canvas.height}`);
                        }
                    }
                    resolve();
                }, 100);
            });
        } else {
            this.canvas.width = rect.width * devicePixelRatio;
            this.canvas.height = rect.height * devicePixelRatio;
            
            if (window.mobileDebug) {
                window.mobileDebug.log(`📐 Canvas ${this.canvas.id}: ${this.canvas.width}x${this.canvas.height} (DPR: ${devicePixelRatio})`);
            }
        }
        
        // NOW create WebGL context with properly sized canvas
        this.createWebGLContext();
        
        // Initialize rendering pipeline
        if (this.gl) {
            this.init();
        }
    }
    
    /**
     * Create WebGL context after canvas is properly sized
     */
    createWebGLContext() {
        // CRITICAL FIX: Check if context already exists from CanvasManager
        let existingContext = this.canvas.getContext('webgl2') || 
                             this.canvas.getContext('webgl') || 
                             this.canvas.getContext('experimental-webgl');
        
        if (existingContext && !existingContext.isContextLost()) {
            console.log(`🔄 Reusing existing WebGL context for ${this.canvas.id}`);
            this.gl = existingContext;
            return;
        }
        
        // Try WebGL2 first (better mobile support), then WebGL1
        this.gl = this.canvas.getContext('webgl2', this.contextOptions) || 
                  this.canvas.getContext('webgl', this.contextOptions) ||
                  this.canvas.getContext('experimental-webgl', this.contextOptions);
        
        if (!this.gl) {
            console.error(`WebGL not supported for ${this.canvas.id}`);
            if (window.mobileDebug) {
                window.mobileDebug.log(`❌ WebGL context failed for ${this.canvas.id} (size: ${this.canvas.width}x${this.canvas.height})`);
            }
            // Show user-friendly error instead of white screen
            this.showWebGLError();
            return;
        } else {
            if (window.mobileDebug) {
                const version = this.gl.getParameter(this.gl.VERSION);
                window.mobileDebug.log(`✅ WebGL context created for ${this.canvas.id}: ${version} (size: ${this.canvas.width}x${this.canvas.height})`);
            }
        }
    }

    /**
     * Initialize WebGL rendering pipeline
     */
    init() {
        this.initShaders();
        this.initBuffers();
        this.resize();
    }
    
    /**
     * Initialize shaders with 4D mathematics
     */
    initShaders() {
        const vertexShaderSource = `attribute vec2 a_position;
void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
}`;
        
        const fragmentShaderSource = `precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;
uniform float u_geometry;
uniform float u_gridDensity;
uniform float u_morphFactor;
uniform float u_chaos;
uniform float u_speed;
uniform float u_hue;
uniform float u_intensity;
uniform float u_saturation;
uniform float u_topologyFamily;
uniform float u_topologyVariant;
uniform float u_topologyShellWidth;
uniform float u_topologyPlaneThickness;
uniform float u_dimension;
uniform float u_rot4dXW;
uniform float u_rot4dYW;
uniform float u_rot4dZW;
uniform float u_mouseIntensity;
uniform float u_clickIntensity;
uniform float u_roleIntensity;

// 4D rotation matrices
mat4 rotateXW(float theta) {
    float c = cos(theta);
    float s = sin(theta);
    return mat4(c, 0.0, 0.0, -s, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, s, 0.0, 0.0, c);
}

mat4 rotateYW(float theta) {
    float c = cos(theta);
    float s = sin(theta);
    return mat4(1.0, 0.0, 0.0, 0.0, 0.0, c, 0.0, -s, 0.0, 0.0, 1.0, 0.0, 0.0, s, 0.0, c);
}

mat4 rotateZW(float theta) {
    float c = cos(theta);
    float s = sin(theta);
    return mat4(1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, c, -s, 0.0, 0.0, s, c);
}

vec3 project4Dto3D(vec4 p) {
    float w = 2.5 / (2.5 + p.w);
    return vec3(p.x * w, p.y * w, p.z * w);
}

float hypercubeClassicTopology(vec4 p) {
    vec4 cell = fract(p * u_gridDensity * 0.08 + 0.5) - 0.5;
    vec4 dist = abs(cell);
    float thickness = max(0.003, u_topologyPlaneThickness * 0.75);
    float minDist = min(min(dist.x, dist.y), min(dist.z, dist.w));
    float lattice = 1.0 - smoothstep(0.0, thickness, minDist);
    return (lattice - 0.5) * (0.9 + u_morphFactor * 0.2);
}

float hypercubePhasedTopology(vec4 p) {
    float timeFactor = u_time * 0.0002 * u_speed;
    vec4 cell = fract(p * u_gridDensity * 0.08 + vec4(timeFactor)) - 0.5;
    vec4 dist = abs(cell);
    float thickness = max(0.0025, u_topologyShellWidth * 0.5 + 0.005);
    float minDist = min(min(dist.x, dist.y), min(dist.z, dist.w));
    float lattice = 1.0 - smoothstep(0.0, thickness, minDist);
    float phase = sin((p.x + p.y + p.z + p.w) * 1.7 + timeFactor * 4.0) * 0.25;
    return (lattice + phase) * (0.85 + u_morphFactor * 0.3) - 0.45;
}

float hypercubeCrystalTopology(vec4 p) {
    vec4 cell = fract(p * u_gridDensity * 0.1) - 0.5;
    float edge = max(max(abs(cell.x), abs(cell.y)), max(abs(cell.z), abs(cell.w)));
    float shell = smoothstep(0.2, 0.5, 0.5 - edge);
    float pulse = sin(length(p.xyz) * 2.5 + u_time * 0.0003 * u_speed) * 0.2;
    return (shell + pulse) * (0.8 + u_intensity * 0.4) - 0.5;
}

float hypersphereClassicTopology(vec4 p) {
    float r = length(p);
    float density = u_gridDensity * 0.06;
    float shells = abs(fract(r * density) - 0.5) * 2.0;
    float shellWidth = max(0.01, u_topologyShellWidth + 0.01);
    float smoothShell = smoothstep(0.0, shellWidth, 1.0 - shells);
    float theta = atan(p.y, p.x);
    float harmonics = sin(theta * 3.0) * 0.2;
    float lattice = smoothShell + harmonics * 0.3;
    return (lattice - 0.5) * (0.9 + u_morphFactor * 0.2);
}

float hypersphereQuantumShellTopology(vec4 p) {
    vec3 pos3 = project4Dto3D(p);
    float radius3D = length(pos3);
    float densityFactor = max(0.05, u_gridDensity * 0.03);
    float dynamicShellWidth = max(0.003, u_topologyShellWidth);
    float timeFactor = u_time * 0.0002 * u_speed;

    float phase = radius3D * densityFactor * 6.28318 - timeFactor;
    float shells3D = 0.5 + 0.5 * sin(phase);
    shells3D = smoothstep(1.0 - dynamicShellWidth, 1.0, shells3D);

    float finalLattice = shells3D;
    float dimFactor = smoothstep(3.0, 4.5, u_dimension);

    if (dimFactor > 0.01) {
        float harmonic = dot(pos3, vec3(1.0, 1.3, -0.7));
        float wCoord = cos(radius3D * 2.5 - timeFactor * 0.8)
                     * sin(harmonic + timeFactor * 0.3)
                     * dimFactor * (0.6 + u_morphFactor * 0.4);

        vec4 p4d = vec4(pos3, wCoord);
        float baseSpeed = 0.8 + u_speed * 0.4;
        float rot1 = timeFactor * 1.1 * baseSpeed;
        float rot2 = timeFactor * 0.9 * baseSpeed + u_morphFactor * 0.6;
        float rot3 = -timeFactor * 0.7 * baseSpeed + u_chaos * 2.0;
        p4d = rotateXW(rot1) * rotateYW(rot2) * rotateZW(rot3) * p4d;

        vec3 projected = project4Dto3D(p4d);
        float radius4D = length(projected);
        float phase4D = radius4D * densityFactor * 6.28318 - timeFactor * 1.2;
        float shells4D = 0.5 + 0.5 * sin(phase4D);
        shells4D = smoothstep(1.0 - dynamicShellWidth, 1.0, shells4D);
        finalLattice = mix(shells3D, shells4D, clamp(u_morphFactor, 0.0, 1.0));
    }

    return (finalLattice - 0.5) * (0.8 + u_intensity * 0.4);
}

float hypersphereTetrahedralTopology(vec4 p) {
    vec3 pos3 = project4Dto3D(p);
    float density = max(0.1, u_gridDensity * 0.03);
    float thickness = max(0.002, u_topologyPlaneThickness);
    vec3 c1 = normalize(vec3(1.0, 1.0, 1.0));
    vec3 c2 = normalize(vec3(-1.0, -1.0, 1.0));
    vec3 c3 = normalize(vec3(-1.0, 1.0, -1.0));
    vec3 c4 = normalize(vec3(1.0, -1.0, -1.0));

    vec3 mod3D = fract(pos3 * density * 0.5 + 0.5) - 0.5;
    float minDist3D = min(min(abs(dot(mod3D, c1)), abs(dot(mod3D, c2))),
                          min(abs(dot(mod3D, c3)), abs(dot(mod3D, c4))));
    float lattice3D = 1.0 - smoothstep(0.0, thickness, minDist3D);

    float finalLattice = lattice3D;
    float dimFactor = smoothstep(3.0, 4.5, u_dimension);

    if (dimFactor > 0.01) {
        float timeFactor = u_time * 0.0002 * u_speed;
        float wCoord = cos(dot(pos3, vec3(1.8, -1.5, 1.2)) + timeFactor * 0.6)
                     * sin(length(pos3) * 1.4 + timeFactor * 0.4)
                     * dimFactor * (0.5 + u_morphFactor * 0.5);

        vec4 p4d = vec4(pos3, wCoord);
        float baseSpeed = 1.0 + u_speed * 0.5;
        float rot1 = timeFactor * 0.8 * baseSpeed + u_chaos * 1.5;
        float rot2 = timeFactor * 0.9 * baseSpeed - u_morphFactor * 0.5;
        float rot3 = timeFactor * 0.7 * baseSpeed + u_intensity * 1.2;
        p4d = rotateXW(rot1) * rotateYW(rot2) * rotateZW(rot3) * p4d;

        vec3 projected = project4Dto3D(p4d);
        vec3 mod4D = fract(projected * density * 0.5 + 0.5) - 0.5;
        float minDist4D = min(min(abs(dot(mod4D, c1)), abs(dot(mod4D, c2))),
                              min(abs(dot(mod4D, c3)), abs(dot(mod4D, c4))));
        float lattice4D = 1.0 - smoothstep(0.0, thickness, minDist4D);
        finalLattice = mix(lattice3D, lattice4D, clamp(u_morphFactor, 0.0, 1.0));
    }

    return (finalLattice - 0.5) * (0.9 + u_morphFactor * 0.3);
}

float hypertetraClassicTopology(vec4 p) {
    vec4 cell = fract(p * u_gridDensity * 0.08 + 0.5) - 0.5;
    vec4 dist = abs(cell);
    float thickness = max(0.003, u_topologyPlaneThickness);
    float minDist = min(min(dist.x, dist.y), min(dist.z, dist.w));
    float lattice = 1.0 - smoothstep(0.0, thickness, minDist);
    return (lattice - 0.5) * (0.9 + u_morphFactor * 0.2);
}

float hypertetraTwistedTopology(vec4 p) {
    float timeFactor = u_time * 0.00025 * u_speed;
    vec4 rotated = rotateXW(timeFactor * 1.3) * rotateYW(timeFactor * 0.9) * p;
    vec4 cell = fract(rotated * u_gridDensity * 0.08 + 0.5) - 0.5;
    vec4 dist = abs(cell);
    float thickness = max(0.0025, u_topologyShellWidth * 0.6 + 0.005);
    float minDist = min(min(dist.x, dist.y), min(dist.z, dist.w));
    float lattice = 1.0 - smoothstep(0.0, thickness, minDist);
    float ribbon = sin((rotated.x + rotated.y + rotated.z) * 2.2 + timeFactor * 3.0) * 0.25;
    return (lattice + ribbon) * (0.85 + u_morphFactor * 0.25) - 0.45;
}

float hypertetraPrismaticTopology(vec4 p) {
    vec4 wave = sin(p * u_gridDensity * 0.05 + u_time * 0.0003 * u_speed);
    float prism = abs(wave.x) + abs(wave.y) + abs(wave.z) + abs(wave.w);
    float shell = smoothstep(0.0, 4.0 * max(0.002, u_topologyShellWidth + 0.01), prism);
    return (1.0 - shell) * (0.8 + u_intensity * 0.3) - 0.5;
}

float evaluateHypercubeTopology(vec4 p, int variant) {
    if (variant == 1) {
        return hypercubePhasedTopology(p);
    }
    if (variant == 2) {
        return hypercubeCrystalTopology(p);
    }
    return hypercubeClassicTopology(p);
}

float evaluateHypersphereTopology(vec4 p, int variant) {
    if (variant == 1) {
        return hypersphereQuantumShellTopology(p);
    }
    if (variant == 2) {
        return hypersphereTetrahedralTopology(p);
    }
    return hypersphereClassicTopology(p);
}

float evaluateHypertetraTopology(vec4 p, int variant) {
    if (variant == 1) {
        return hypertetraTwistedTopology(p);
    }
    if (variant == 2) {
        return hypertetraPrismaticTopology(p);
    }
    return hypertetraClassicTopology(p);
}

float evaluateTopology(vec4 p, int geometryType) {
    int family = int(floor(u_topologyFamily + 0.5));
    int variant = int(floor(u_topologyVariant + 0.5));

    if (geometryType == 0) {
        return evaluateHypertetraTopology(p, family == 2 ? variant : 0);
    }
    if (geometryType == 1) {
        return evaluateHypercubeTopology(p, family == 0 ? variant : 0);
    }
    if (geometryType == 2) {
        return evaluateHypersphereTopology(p, family == 1 ? variant : 0);
    }

    // Fallback: honour selected family even if geometry differs
    if (family == 0) {
        return evaluateHypercubeTopology(p, variant);
    }
    if (family == 1) {
        return evaluateHypersphereTopology(p, variant);
    }
    return evaluateHypertetraTopology(p, variant);
}

// Simplified geometry functions for WebGL 1.0 compatibility (ORIGINAL FACETED)
float geometryFunction(vec4 p) {
    int geomType = int(u_geometry);

    if (geomType == 0 || geomType == 1 || geomType == 2) {
        return evaluateTopology(p, geomType);
    }
    else if (geomType == 3) {
        // Torus lattice - UNIFORM GRID DENSITY
        float r1 = length(p.xy) - 2.0;
        float torus = length(vec2(r1, p.z)) - 0.8;
        float lattice = sin(p.x * u_gridDensity * 0.08) * sin(p.y * u_gridDensity * 0.08);
        return (torus + lattice * 0.3) * u_morphFactor;
    }
    else if (geomType == 4) {
        // Klein bottle lattice - UNIFORM GRID DENSITY
        float u = atan(p.y, p.x);
        float v = atan(p.w, p.z);
        float dist = length(p) - 2.0;
        float lattice = sin(u * u_gridDensity * 0.08) * sin(v * u_gridDensity * 0.08);
        return (dist + lattice * 0.4) * u_morphFactor;
    }
    else if (geomType == 5) {
        // Fractal lattice - NOW WITH UNIFORM GRID DENSITY
        vec4 pos = fract(p * u_gridDensity * 0.08);
        pos = abs(pos * 2.0 - 1.0);
        float dist = length(max(abs(pos) - 1.0, 0.0));
        return dist * u_morphFactor;
    }
    else if (geomType == 6) {
        // Wave lattice - UNIFORM GRID DENSITY
        float freq = u_gridDensity * 0.08;
        float time = u_time * 0.001 * u_speed;
        float wave1 = sin(p.x * freq + time);
        float wave2 = sin(p.y * freq + time * 1.3);
        float wave3 = sin(p.z * freq * 0.8 + time * 0.7); // Add Z-dimension waves
        float interference = wave1 * wave2 * wave3;
        return interference * u_morphFactor;
    }
    else if (geomType == 7) {
        // Crystal lattice - UNIFORM GRID DENSITY
        vec4 pos = fract(p * u_gridDensity * 0.08) - 0.5;
        float cube = max(max(abs(pos.x), abs(pos.y)), max(abs(pos.z), abs(pos.w)));
        return cube * u_morphFactor;
    }
    else {
        // Default hypercube - UNIFORM GRID DENSITY
        vec4 pos = fract(p * u_gridDensity * 0.08);
        vec4 dist = min(pos, 1.0 - pos);
        return min(min(dist.x, dist.y), min(dist.z, dist.w)) * u_morphFactor;
    }
}

void main() {
    vec2 uv = (gl_FragCoord.xy - u_resolution.xy * 0.5) / min(u_resolution.x, u_resolution.y);
    
    // 4D position with mouse interaction - NOW USING SPEED PARAMETER
    float timeSpeed = u_time * 0.0001 * u_speed;
    vec4 pos = vec4(uv * 3.0, sin(timeSpeed * 3.0), cos(timeSpeed * 2.0));
    pos.xy += (u_mouse - 0.5) * u_mouseIntensity * 2.0;
    
    // Apply 4D rotations
    pos = rotateXW(u_rot4dXW) * pos;
    pos = rotateYW(u_rot4dYW) * pos;
    pos = rotateZW(u_rot4dZW) * pos;
    
    // Calculate geometry value
    float value = geometryFunction(pos);
    
    // Apply chaos
    float noise = sin(pos.x * 7.0) * cos(pos.y * 11.0) * sin(pos.z * 13.0);
    value += noise * u_chaos;
    
    // Color based on geometry value and hue with user-controlled intensity/saturation
    float geometryIntensity = 1.0 - clamp(abs(value), 0.0, 1.0);
    geometryIntensity += u_clickIntensity * 0.3;
    
    // Apply user intensity control
    float finalIntensity = geometryIntensity * u_intensity;
    
    float hue = u_hue / 360.0 + value * 0.1;
    
    // Create color with saturation control
    vec3 baseColor = vec3(
        sin(hue * 6.28318 + 0.0) * 0.5 + 0.5,
        sin(hue * 6.28318 + 2.0943) * 0.5 + 0.5,
        sin(hue * 6.28318 + 4.1887) * 0.5 + 0.5
    );
    
    // Apply saturation (mix with grayscale)
    float gray = (baseColor.r + baseColor.g + baseColor.b) / 3.0;
    vec3 color = mix(vec3(gray), baseColor, u_saturation) * finalIntensity;
    
    gl_FragColor = vec4(color, finalIntensity * u_roleIntensity);
}`;
        
        this.program = this.createProgram(vertexShaderSource, fragmentShaderSource);
        this.uniforms = {
            resolution: this.gl.getUniformLocation(this.program, 'u_resolution'),
            time: this.gl.getUniformLocation(this.program, 'u_time'),
            mouse: this.gl.getUniformLocation(this.program, 'u_mouse'),
            geometry: this.gl.getUniformLocation(this.program, 'u_geometry'),
            gridDensity: this.gl.getUniformLocation(this.program, 'u_gridDensity'),
            morphFactor: this.gl.getUniformLocation(this.program, 'u_morphFactor'),
            chaos: this.gl.getUniformLocation(this.program, 'u_chaos'),
            speed: this.gl.getUniformLocation(this.program, 'u_speed'),
            hue: this.gl.getUniformLocation(this.program, 'u_hue'),
            intensity: this.gl.getUniformLocation(this.program, 'u_intensity'),
            saturation: this.gl.getUniformLocation(this.program, 'u_saturation'),
            topologyFamily: this.gl.getUniformLocation(this.program, 'u_topologyFamily'),
            topologyVariant: this.gl.getUniformLocation(this.program, 'u_topologyVariant'),
            topologyShellWidth: this.gl.getUniformLocation(this.program, 'u_topologyShellWidth'),
            topologyPlaneThickness: this.gl.getUniformLocation(this.program, 'u_topologyPlaneThickness'),
            dimension: this.gl.getUniformLocation(this.program, 'u_dimension'),
            rot4dXW: this.gl.getUniformLocation(this.program, 'u_rot4dXW'),
            rot4dYW: this.gl.getUniformLocation(this.program, 'u_rot4dYW'),
            rot4dZW: this.gl.getUniformLocation(this.program, 'u_rot4dZW'),
            mouseIntensity: this.gl.getUniformLocation(this.program, 'u_mouseIntensity'),
            clickIntensity: this.gl.getUniformLocation(this.program, 'u_clickIntensity'),
            roleIntensity: this.gl.getUniformLocation(this.program, 'u_roleIntensity')
        };
    }
    
    /**
     * Create WebGL program from shaders
     */
    createProgram(vertexSource, fragmentSource) {
        const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentSource);
        
        if (!vertexShader || !fragmentShader) {
            return null;
        }
        
        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);
        
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.error('Program linking failed:', this.gl.getProgramInfoLog(program));
            return null;
        }
        
        return program;
    }
    
    /**
     * Create individual shader
     */
    createShader(type, source) {
        // CRITICAL FIX: Check WebGL context state before shader operations
        if (!this.gl) {
            console.error('❌ Cannot create shader: WebGL context is null');
            return null;
        }
        
        if (this.gl.isContextLost()) {
            console.error('❌ Cannot create shader: WebGL context is lost');
            return null;
        }
        
        try {
            const shader = this.gl.createShader(type);
            
            if (!shader) {
                console.error('❌ Failed to create shader object - WebGL context may be invalid');
                return null;
            }
            
            this.gl.shaderSource(shader, source);
            this.gl.compileShader(shader);
            
            if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
                const error = this.gl.getShaderInfoLog(shader);
                const shaderType = type === this.gl.VERTEX_SHADER ? 'vertex' : 'fragment';
                
                // CRITICAL FIX: Show actual error instead of null
                if (error) {
                    console.error(`❌ ${shaderType} shader compilation failed:`, error);
                } else {
                    console.error(`❌ ${shaderType} shader compilation failed: WebGL returned no error info (context may be invalid)`);
                }
                
                console.error('Shader source:', source);
                this.gl.deleteShader(shader);
                return null;
            }
            
            return shader;
        } catch (error) {
            console.error('❌ Exception during shader creation:', error);
            return null;
        }
    }
    
    /**
     * Initialize vertex buffers
     */
    initBuffers() {
        const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
        
        this.buffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);
        
        const positionLocation = this.gl.getAttribLocation(this.program, 'a_position');
        this.gl.enableVertexAttribArray(positionLocation);
        this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);
    }
    
    /**
     * Resize canvas and viewport
     */
    resize() {
        // Mobile-optimized canvas sizing
        const dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2x for mobile performance
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;
        
        // Only resize if dimensions actually changed (mobile optimization)
        if (this.canvas.width !== width * dpr || this.canvas.height !== height * dpr) {
            this.canvas.width = width * dpr;
            this.canvas.height = height * dpr;
            this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        }
    }
    
    /**
     * Show user-friendly WebGL error message
     */
    showWebGLError() {
        if (!this.canvas) return;
        
        // Try 2D canvas fallback
        const ctx = this.canvas.getContext('2d');
        if (ctx) {
            this.canvas.width = this.canvas.clientWidth;
            this.canvas.height = this.canvas.clientHeight;
            
            ctx.fillStyle = '#1a0033';
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Mobile-friendly error display
            ctx.fillStyle = '#ff6b6b';
            ctx.font = `${Math.min(20, this.canvas.width / 15)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText('⚠️ WebGL Error', this.canvas.width / 2, this.canvas.height / 2 - 30);
            
            ctx.fillStyle = '#ffd93d';
            ctx.font = `${Math.min(14, this.canvas.width / 20)}px sans-serif`;
            
            const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            if (isMobile) {
                ctx.fillText('Mobile device detected', this.canvas.width / 2, this.canvas.height / 2);
                ctx.fillText('Enable hardware acceleration', this.canvas.width / 2, this.canvas.height / 2 + 20);
                ctx.fillText('or try Chrome/Firefox', this.canvas.width / 2, this.canvas.height / 2 + 40);
            } else {
                ctx.fillText('Please enable WebGL', this.canvas.width / 2, this.canvas.height / 2);
                ctx.fillText('in your browser settings', this.canvas.width / 2, this.canvas.height / 2 + 20);
            }
            
            // Log to mobile debug
            if (window.mobileDebug) {
                window.mobileDebug.log(`📱 WebGL error fallback shown for canvas ${this.canvas.id}`);
            }
        } else {
            // Even 2D canvas failed - create HTML fallback
            const errorDiv = document.createElement('div');
            errorDiv.innerHTML = `
                <div style="
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: #1a0033;
                    color: #ff6b6b;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    font-family: sans-serif;
                    text-align: center;
                    padding: 20px;
                ">
                    <div style="font-size: 24px; margin-bottom: 10px;">⚠️</div>
                    <div style="font-size: 18px; margin-bottom: 10px;">Graphics Error</div>
                    <div style="font-size: 14px; color: #ffd93d;">
                        Your device doesn't support<br>
                        the required graphics features
                    </div>
                </div>
            `;
            this.canvas.parentNode.insertBefore(errorDiv, this.canvas.nextSibling);
        }
    }
    
    /**
     * Update visualization parameters
     */
    updateParameters(params) {
        if (!params) {
            return;
        }

        const nextParams = { ...params };

        if (Object.prototype.hasOwnProperty.call(nextParams, 'topologyFamily')) {
            this.setTopologyFamily(nextParams.topologyFamily);
            delete nextParams.topologyFamily;
        }

        if (Object.prototype.hasOwnProperty.call(nextParams, 'topologyVariant')) {
            this.setTopologyVariant(nextParams.topologyVariant);
            delete nextParams.topologyVariant;
        }

        this.params = { ...this.params, ...nextParams };

        if (Object.prototype.hasOwnProperty.call(params, 'geometry')) {
            this.ensureTopologyMatchesGeometry();
        }
    }

    getTopologyFamilies() {
        return TopologyLibrary.getFamilyEntries();
    }

    getTopologyVariants(familyId = this.params.topologyFamily) {
        return TopologyLibrary.getVariantEntries(familyId);
    }

    setTopologyFamily(familyId) {
        const resolvedFamily = TopologyLibrary.resolveFamily(familyId, this.params.geometry);
        const resolvedVariant = TopologyLibrary.getDefaultVariantId(resolvedFamily);
        this.params.topologyFamily = resolvedFamily;
        this.params.topologyVariant = resolvedVariant;
        this.applyTopologyDefaults(resolvedFamily, resolvedVariant);
    }

    setTopologyVariant(variantId) {
        const resolvedVariant = TopologyLibrary.resolveVariant(this.params.topologyFamily, variantId);
        this.params.topologyVariant = resolvedVariant;
        this.applyTopologyDefaults(this.params.topologyFamily, resolvedVariant);
    }

    applyTopologyDefaults(familyId, variantId) {
        const defaults = TopologyLibrary.getDefaults(familyId, variantId);
        this.params.topologyShellWidth = defaults.shellWidth;
        this.params.topologyPlaneThickness = defaults.planeThickness;
    }

    ensureTopologyMatchesGeometry() {
        const matchingFamily = TopologyLibrary.getFamilyForGeometry(Math.round(this.params.geometry));
        if (matchingFamily !== null && matchingFamily !== this.params.topologyFamily) {
            this.setTopologyFamily(matchingFamily);
        }
    }
    
    /**
     * Update mouse interaction state
     */
    updateInteraction(x, y, intensity) {
        // Check if interactions are enabled globally
        if (window.interactivityEnabled === false) {
            // Reset to default when disabled
            this.mouseX = 0.5;
            this.mouseY = 0.5;
            this.mouseIntensity = 0.0;
            return;
        }
        
        this.mouseX = x;
        this.mouseY = y;
        this.mouseIntensity = intensity;
    }
    
    /**
     * Render frame
     */
    render() {
        if (!this.program) {
            if (window.mobileDebug) {
                window.mobileDebug.log(`❌ ${this.canvas?.id}: No WebGL program compiled`);
            }
            return;
        }
        
        if (!this.gl) {
            if (window.mobileDebug) {
                window.mobileDebug.log(`❌ ${this.canvas?.id}: No WebGL context`);
            }
            return;
        }
        
        try {
            this.resize();
            this.gl.useProgram(this.program);
            
            // CRITICAL FIX: Clear framebuffer before rendering
            this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
            this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        } catch (error) {
            if (window.mobileDebug) {
                window.mobileDebug.log(`❌ ${this.canvas?.id}: WebGL render error: ${error.message}`);
            }
            return;
        }
        
        // Role-specific intensity (ORIGINAL FACETED VALUES)
        const roleIntensities = {
            'background': 0.3,
            'shadow': 0.5,
            'content': 0.8,
            'highlight': 1.0,
            'accent': 1.2
        };
        
        const time = Date.now() - this.startTime;
        
        // Set uniforms
        this.gl.uniform2f(this.uniforms.resolution, this.canvas.width, this.canvas.height);
        this.gl.uniform1f(this.uniforms.time, time);
        this.gl.uniform2f(this.uniforms.mouse, this.mouseX, this.mouseY);
        this.gl.uniform1f(this.uniforms.geometry, this.params.geometry);
        // 🎵 DIRECT AUDIO REACTIVITY - Simple and works
        let gridDensity = this.params.gridDensity;
        let hue = this.params.hue;
        let intensity = this.params.intensity;
        
        if (window.audioEnabled && window.audioReactive) {
            // Faceted audio mapping: Bass affects grid density, Mid affects hue, High affects intensity
            gridDensity += window.audioReactive.bass * 30;  // Bass makes patterns denser
            hue += window.audioReactive.mid * 60;           // Mid frequencies shift colors
            intensity += window.audioReactive.high * 0.4;   // High frequencies brighten
        }
        
        this.gl.uniform1f(this.uniforms.gridDensity, Math.min(100, gridDensity));
        this.gl.uniform1f(this.uniforms.morphFactor, this.params.morphFactor);
        this.gl.uniform1f(this.uniforms.chaos, this.params.chaos);
        this.gl.uniform1f(this.uniforms.speed, this.params.speed);
        this.gl.uniform1f(this.uniforms.hue, hue % 360);
        this.gl.uniform1f(this.uniforms.intensity, Math.min(1, intensity));
        this.gl.uniform1f(this.uniforms.saturation, this.params.saturation);
        this.gl.uniform1f(this.uniforms.topologyFamily, this.params.topologyFamily);
        this.gl.uniform1f(this.uniforms.topologyVariant, this.params.topologyVariant);
        this.gl.uniform1f(this.uniforms.topologyShellWidth, this.params.topologyShellWidth);
        this.gl.uniform1f(this.uniforms.topologyPlaneThickness, this.params.topologyPlaneThickness);
        this.gl.uniform1f(this.uniforms.dimension, this.params.dimension);
        this.gl.uniform1f(this.uniforms.rot4dXW, this.params.rot4dXW);
        this.gl.uniform1f(this.uniforms.rot4dYW, this.params.rot4dYW);
        this.gl.uniform1f(this.uniforms.rot4dZW, this.params.rot4dZW);
        this.gl.uniform1f(this.uniforms.mouseIntensity, this.mouseIntensity);
        this.gl.uniform1f(this.uniforms.clickIntensity, this.clickIntensity);
        this.gl.uniform1f(this.uniforms.roleIntensity, roleIntensities[this.role] || 1.0);
        
        try {
            this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
            
            // Mobile success logging (only once per canvas)
            if (window.mobileDebug && !this._renderSuccessLogged) {
                window.mobileDebug.log(`✅ ${this.canvas?.id}: WebGL render successful`);
                this._renderSuccessLogged = true;
            }
        } catch (error) {
            if (window.mobileDebug) {
                window.mobileDebug.log(`❌ ${this.canvas?.id}: WebGL draw error: ${error.message}`);
            }
        }
    }
    
    /**
     * CRITICAL FIX: Reinitialize WebGL program after context recreation
     */
    reinitializeContext() {
        console.log(`🔄 Reinitializing WebGL context for ${this.canvas?.id}`);
        
        // Clear ALL old WebGL references
        this.program = null;
        this.buffer = null;
        this.uniforms = null;
        this.gl = null;
        
        // CRITICAL FIX: Don't create new context - CanvasManager already did this
        // Just get the existing context that CanvasManager created
        this.gl = this.canvas.getContext('webgl2') || 
                  this.canvas.getContext('webgl') ||
                  this.canvas.getContext('experimental-webgl');
        
        if (!this.gl) {
            console.error(`❌ No WebGL context available for ${this.canvas?.id} - CanvasManager should have created one`);
            return false;
        }
        
        if (this.gl.isContextLost()) {
            console.error(`❌ WebGL context is lost for ${this.canvas?.id}`);
            return false;
        }
        
        // Reinitialize shaders and buffers if context is valid
        try {
            this.init();
            console.log(`✅ ${this.canvas?.id}: Context reinitialized successfully`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to reinitialize WebGL resources for ${this.canvas?.id}:`, error);
            return false;
        }
    }

    // Audio reactivity now handled directly in render() loop - no complex methods needed
    
    /**
     * Clean up WebGL resources
     */
    destroy() {
        if (this.gl && this.program) {
            this.gl.deleteProgram(this.program);
        }
        if (this.gl && this.buffer) {
            this.gl.deleteBuffer(this.buffer);
        }
    }
}