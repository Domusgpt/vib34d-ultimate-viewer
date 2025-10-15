/**
 * Hypersphere topology rendering core
 * Provides modular geometry behaviors for hypersphere-derived topologies
 * and dynamic shader generation for the Polychora system.
 */

class BaseGeometry {
    getShaderCode() {
        throw new Error('getShaderCode() must be implemented');
    }
}

class HypercubeGeometry extends BaseGeometry {
    getShaderCode() {
        return `
            float calculateLattice(vec3 p) {
                float density = max(0.1, u_gridDensity * (1.0 + u_audioBass * 0.35));
                vec3 cell = fract(p * density + 0.5) - 0.5;
                float edgeThickness = max(0.01, u_lineThickness * 0.35);
                float minEdge = min(min(abs(cell.x), abs(cell.y)), abs(cell.z));
                float lattice = 1.0 - smoothstep(0.0, edgeThickness, minEdge);

                vec3 corners = abs(cell);
                float cornerIntensity = 1.0 - smoothstep(0.32, 0.5, max(max(corners.x, corners.y), corners.z));
                float blended = mix(lattice, cornerIntensity, 0.35 + u_morphFactor * 0.4);

                return pow(max(0.0, blended), max(0.1, u_universeModifier));
            }
        `;
    }
}

class HypersphereGeometry extends BaseGeometry {
    getShaderCode() {
        return `
            float calculateLattice(vec3 p) {
                float radius3D = length(p);
                float densityFactor = max(0.1, u_gridDensity * 0.7 * (1.0 + u_audioBass * 0.5));
                float dynamicShellWidth = max(0.005, u_shellWidth * (1.0 + u_audioMid * 1.5));
                float phase = radius3D * densityFactor * 6.28318 - u_time * u_rotationSpeed * 0.8 + u_audioHigh * 3.0;
                float shells3D = 0.5 + 0.5 * sin(phase);
                shells3D = smoothstep(1.0 - dynamicShellWidth, 1.0, shells3D);

                float finalLattice = shells3D;
                float dim_factor = smoothstep(3.0, 4.5, u_dimension);

                if (dim_factor > 0.01) {
                    float w_coord = cos(radius3D * 2.5 - u_time * 0.55)
                                  * sin(p.x*1.0 + p.y*1.3 - p.z*0.7 + u_time*0.2)
                                  * dim_factor * (0.5 + u_morphFactor * 0.5 + u_audioMid * 0.5);

                    vec4 p4d = vec4(p, w_coord);
                    float baseSpeed = u_rotationSpeed * 0.85;
                    float time_rot1 = u_time * 0.38 * baseSpeed + u_audioHigh * 0.2;
                    float time_rot2 = u_time * 0.31 * baseSpeed + u_morphFactor * 0.6;
                    float time_rot3 = u_time * -0.24 * baseSpeed + u_audioBass * 0.25;
                    p4d = rotXW(time_rot1 * 1.05) * rotYZ(time_rot2) * rotYW(time_rot3 * 0.95) * p4d;

                    vec3 projectedP = project4Dto3D(p4d);
                    float radius4D_proj = length(projectedP);
                    float phase4D = radius4D_proj * densityFactor * 6.28318 - u_time * u_rotationSpeed * 0.8 + u_audioHigh * 3.0;
                    float shells4D_proj = 0.5 + 0.5 * sin(phase4D);
                    shells4D_proj = smoothstep(1.0 - dynamicShellWidth, 1.0, shells4D_proj);
                    finalLattice = mix(shells3D, shells4D_proj, smoothstep(0.0, 1.0, u_morphFactor));
                }
                return pow(max(0.0, finalLattice), max(0.1, u_universeModifier));
            }
        `;
    }
}

class HypertetrahedronGeometry extends BaseGeometry {
    getShaderCode() {
        return `
            float calculateLattice(vec3 p) {
                float density = max(0.1, u_gridDensity * 0.65 * (1.0 + u_audioBass * 0.4));
                float dynamicThickness = max(0.003, u_tetraThickness * (1.0 - u_audioMid * 0.7));

                vec3 c1=normalize(vec3(1,1,1)), c2=normalize(vec3(-1,-1,1)), c3=normalize(vec3(-1,1,-1)), c4=normalize(vec3(1,-1,-1));
                vec3 p_mod3D = fract(p * density * 0.5 + 0.5 + u_time * 0.005) - 0.5;
                float d1=dot(p_mod3D, c1), d2=dot(p_mod3D, c2), d3=dot(p_mod3D, c3), d4=dot(p_mod3D, c4);
                float minDistToPlane3D = min(min(abs(d1), abs(d2)), min(abs(d3), abs(d4)));
                float lattice3D = 1.0 - smoothstep(0.0, dynamicThickness, minDistToPlane3D);

                float finalLattice = lattice3D;
                float dim_factor = smoothstep(3.0, 4.5, u_dimension);

                if (dim_factor > 0.01) {
                    float w_coord = cos(p.x*1.8 - p.y*1.5 + p.z*1.2 + u_time*0.24) * sin(length(p)*1.4 + u_time*0.18 - u_audioMid*2.0) * dim_factor * (0.45 + u_morphFactor*0.55 + u_audioHigh*0.4);
                    vec4 p4d = vec4(p, w_coord);
                    float baseSpeed = u_rotationSpeed * 1.15;
                    float time_rot1 = u_time*0.28*baseSpeed + u_audioHigh*0.25;
                    float time_rot2 = u_time*0.36*baseSpeed - u_audioBass*0.2 + u_morphFactor*0.4;
                    float time_rot3 = u_time*0.32*baseSpeed + u_audioMid*0.15;
                    p4d = rotXW(time_rot1*0.95) * rotYW(time_rot2*1.05) * rotZW(time_rot3) * p4d;
                    vec3 projectedP = project4Dto3D(p4d);

                    vec3 p_mod4D_proj = fract(projectedP * density * 0.5 + 0.5 + u_time * 0.008) - 0.5;
                    float dp1=dot(p_mod4D_proj,c1), dp2=dot(p_mod4D_proj,c2), dp3=dot(p_mod4D_proj,c3), dp4=dot(p_mod4D_proj,c4);
                    float minDistToPlane4D = min(min(abs(dp1), abs(dp2)), min(abs(dp3), abs(dp4)));
                    float lattice4D_proj = 1.0 - smoothstep(0.0, dynamicThickness, minDistToPlane4D);
                    finalLattice = mix(lattice3D, lattice4D_proj, smoothstep(0.0, 1.0, u_morphFactor));
                }
                return pow(max(0.0, finalLattice), max(0.1, u_universeModifier));
            }
        `;
    }
}

class BaseProjection {
    getShaderCode() {
        throw new Error('getShaderCode() must be implemented');
    }
}

class PerspectiveProjection extends BaseProjection {
    getShaderCode() {
        return `
            vec3 project4Dto3D(vec4 p) {
                float baseDistance = 2.50;
                float dynamicDistance = max(0.2, baseDistance * (1.0 + u_morphFactor * 0.4 - u_audioMid * 0.35));
                float denominator = dynamicDistance + p.w;
                float w_factor = dynamicDistance / max(0.1, denominator);
                return p.xyz * w_factor;
            }
        `;
    }
}

class OrthographicProjection extends BaseProjection {
    getShaderCode() {
        return `
            vec3 project4Dto3D(vec4 p) {
                vec3 orthoP = p.xyz;
                float basePerspectiveDistance = 2.5;
                float dynamicPerspectiveDistance = max(0.2, basePerspectiveDistance * (1.0 - u_audioMid * 0.4));
                float perspDenominator = dynamicPerspectiveDistance + p.w;
                float persp_w_factor = dynamicPerspectiveDistance / max(0.1, perspDenominator);
                vec3 perspP = p.xyz * persp_w_factor;
                float morphT = smoothstep(0.0, 1.0, u_morphFactor);
                return mix(orthoP, perspP, morphT);
            }
        `;
    }
}

class StereographicProjection extends BaseProjection {
    getShaderCode() {
        return `
            vec3 project4Dto3D(vec4 p) {
                float basePoleW = -1.50;
                float dynamicPoleW = sign(basePoleW) * max(0.1, abs(basePoleW + u_audioHigh * 0.4 * sign(basePoleW)));
                float denominator = p.w - dynamicPoleW;
                vec3 projectedP;
                float epsilon = 0.001;
                if (abs(denominator) < epsilon) {
                    projectedP = normalize(p.xyz + vec3(epsilon)) * 1000.0;
                } else {
                    float scale = (-dynamicPoleW) / denominator;
                    projectedP = p.xyz * scale;
                }
                float morphT = smoothstep(0.0, 1.0, u_morphFactor * 0.8);
                vec3 orthoP = p.xyz;
                return mix(projectedP, orthoP, morphT);
            }
        `;
    }
}

export class GeometryManager {
    constructor() {
        this.geometries = {
            hypercube: new HypercubeGeometry(),
            hypersphere: new HypersphereGeometry(),
            hypertetrahedron: new HypertetrahedronGeometry()
        };
    }

    getGeometry(name) {
        return this.geometries[name] || this.geometries.hypercube;
    }

    getGeometryNames() {
        return Object.keys(this.geometries);
    }
}

export class ProjectionManager {
    constructor() {
        this.projections = {
            perspective: new PerspectiveProjection(),
            orthographic: new OrthographicProjection(),
            stereographic: new StereographicProjection()
        };
    }

    getProjection(name) {
        return this.projections[name] || this.projections.perspective;
    }

    getProjectionNames() {
        return Object.keys(this.projections);
    }
}

export class ShaderManager {
    constructor(gl, geometryManager, projectionManager) {
        this.gl = gl;
        this.geometryManager = geometryManager;
        this.projectionManager = projectionManager;
        this.programs = new Map();
        this.currentProgramName = null;
        this.uniformLocations = new Map();
        this.attributeLocations = new Map();
    }

    createDynamicProgram(programName, geometryType, projectionMethod) {
        const vertexShaderSource = `
            attribute vec2 a_position;
            varying vec2 v_uv;
            void main() {
                v_uv = a_position * 0.5 + 0.5;
                gl_Position = vec4(a_position, 0.0, 1.0);
            }
        `;

        const geometry = this.geometryManager.getGeometry(geometryType);
        const projection = this.projectionManager.getProjection(projectionMethod);

        const fragmentShaderSource = `
            precision highp float;
            uniform vec2 u_resolution; uniform float u_time;
            uniform float u_dimension; uniform float u_morphFactor; uniform float u_rotationSpeed;
            uniform float u_universeModifier; uniform float u_patternIntensity; uniform float u_gridDensity;
            uniform float u_lineThickness; uniform float u_shellWidth; uniform float u_tetraThickness;
            uniform float u_audioBass; uniform float u_audioMid; uniform float u_audioHigh;
            uniform float u_glitchIntensity; uniform float u_colorShift;
            uniform vec3 u_primaryColor; uniform vec3 u_secondaryColor; uniform vec3 u_backgroundColor;
            varying vec2 v_uv;

            mat4 rotXW(float a){float c=cos(a),s=sin(a);return mat4(c,0,0,-s, 0,1,0,0, 0,0,1,0, s,0,0,c);} 
            mat4 rotYW(float a){float c=cos(a),s=sin(a);return mat4(1,0,0,0, 0,c,0,-s, 0,0,1,0, 0,s,0,c);} 
            mat4 rotZW(float a){float c=cos(a),s=sin(a);return mat4(1,0,0,0, 0,1,0,0, 0,0,c,-s, 0,0,s,c);} 
            mat4 rotXY(float a){float c=cos(a),s=sin(a);return mat4(c,-s,0,0, s,c,0,0, 0,0,1,0, 0,0,0,1);} 
            mat4 rotYZ(float a){float c=cos(a),s=sin(a);return mat4(1,0,0,0, 0,c,-s,0, 0,s,c,0, 0,0,0,1);} 
            mat4 rotXZ(float a){float c=cos(a),s=sin(a);return mat4(c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1);} 

            vec3 rgb2hsv(vec3 c){vec4 K=vec4(0.,-1./3.,2./3.,-1.);vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));float d=q.x-min(q.w,q.y);float e=1e-10;return vec3(abs(q.z+(q.w-q.y)/(6.*d+e)),d/(q.x+e),q.x);} 
            vec3 hsv2rgb(vec3 c){vec4 K=vec4(1.,2./3.,1./3.,3.);vec3 p=abs(fract(c.xxx+K.xyz)*6.-K.www);return c.z*mix(K.xxx,clamp(p-K.xxx,0.,1.),c.y);} 

            ${projection.getShaderCode()}
            ${geometry.getShaderCode()}

            void main() {
                vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
                vec2 uv = (v_uv * 2.0 - 1.0) * aspect;
                vec3 rayOrigin = vec3(0.0, 0.0, -2.5);
                vec3 rayDirection = normalize(vec3(uv, 1.0));
                float camRotY = u_time * 0.05 * u_rotationSpeed + u_audioMid * 0.1;
                float camRotX = sin(u_time * 0.03 * u_rotationSpeed) * 0.15 + u_audioHigh * 0.1;
                mat4 camMat = rotXY(camRotX) * rotYZ(camRotY);
                rayDirection = (camMat * vec4(rayDirection, 0.0)).xyz;
                vec3 p = rayDirection * 1.5;
                float latticeValue = calculateLattice(p);
                vec3 color = mix(u_backgroundColor, u_primaryColor, latticeValue);
                color = mix(color, u_secondaryColor, smoothstep(0.2, 0.7, u_audioMid) * latticeValue * 0.6);
                if (abs(u_colorShift) > 0.01) {
                    vec3 hsv = rgb2hsv(color);
                    hsv.x = fract(hsv.x + u_colorShift * 0.5 + u_audioHigh * 0.1);
                    color = hsv2rgb(hsv);
                }
                color *= (0.8 + u_patternIntensity * 0.7);
                if (u_glitchIntensity > 0.001) {
                    float glitch = u_glitchIntensity * (0.5 + 0.5 * sin(u_time * 8.0 + p.y * 10.0));
                    vec2 offsetR = vec2(cos(u_time*25.), sin(u_time*18.+p.x*5.)) * glitch * 0.2 * aspect;
                    vec2 offsetB = vec2(sin(u_time*19.+p.y*6.), cos(u_time*28.)) * glitch * 0.15 * aspect;
                    vec3 pR = normalize(vec3(uv + offsetR/aspect, 1.0));
                    pR = (camMat*vec4(pR,0.0)).xyz * 1.5;
                    vec3 pB = normalize(vec3(uv + offsetB/aspect, 1.0));
                    pB = (camMat*vec4(pB,0.0)).xyz * 1.5;
                    float latticeR = calculateLattice(pR);
                    float latticeB = calculateLattice(pB);
                    vec3 colorR = mix(u_backgroundColor, u_primaryColor, latticeR);
                    colorR = mix(colorR, u_secondaryColor, smoothstep(0.2, 0.7, u_audioMid) * latticeR * 0.6);
                    vec3 colorB = mix(u_backgroundColor, u_primaryColor, latticeB);
                    colorB = mix(colorB, u_secondaryColor, smoothstep(0.2, 0.7, u_audioMid) * latticeB * 0.6);
                    if (abs(u_colorShift) > 0.01) {
                        vec3 hsvR=rgb2hsv(colorR);
                        hsvR.x=fract(hsvR.x+u_colorShift*0.5+u_audioHigh*0.1);
                        colorR=hsv2rgb(hsvR);
                        vec3 hsvB=rgb2hsv(colorB);
                        hsvB.x=fract(hsvB.x+u_colorShift*0.5+u_audioHigh*0.1);
                        colorB=hsv2rgb(hsvB);
                    }
                    color = vec3(colorR.r, color.g, colorB.b);
                    color *= (0.8 + u_patternIntensity * 0.7);
                }
                color = pow(clamp(color, 0.0, 1.5), vec3(0.9));
                gl_FragColor = vec4(color, 1.0);
            }
        `;

        const vertexShader = this.compileShader(vertexShaderSource, this.gl.VERTEX_SHADER);
        const fragmentShader = this.compileShader(fragmentShaderSource, this.gl.FRAGMENT_SHADER);

        if (!vertexShader || !fragmentShader) {
            return null;
        }

        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);

        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.error('Program link error:', this.gl.getProgramInfoLog(program));
            return null;
        }

        this.programs.set(programName, program);
        this.uniformLocations.set(programName, new Map());
        this.attributeLocations.set(programName, new Map());

        return program;
    }

    compileShader(source, type) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    useProgram(programName) {
        const program = this.programs.get(programName);
        if (program) {
            this.gl.useProgram(program);
            this.currentProgramName = programName;
            return true;
        }
        return false;
    }

    getUniformLocation(name) {
        if (!this.currentProgramName) return null;

        const cache = this.uniformLocations.get(this.currentProgramName);
        if (cache.has(name)) {
            return cache.get(name);
        }

        const program = this.programs.get(this.currentProgramName);
        const location = this.gl.getUniformLocation(program, name);
        cache.set(name, location);
        return location;
    }

    getAttributeLocation(name) {
        if (!this.currentProgramName) return null;

        const cache = this.attributeLocations.get(this.currentProgramName);
        if (cache.has(name)) {
            return cache.get(name);
        }

        const program = this.programs.get(this.currentProgramName);
        const location = this.gl.getAttribLocation(program, name);
        cache.set(name, location);
        return location;
    }
}

export class HypercubeTopologyCore {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

        if (!this.gl) {
            throw new Error('WebGL not supported');
        }

        this.geometryManager = new GeometryManager();
        this.projectionManager = new ProjectionManager();
        this.shaderManager = new ShaderManager(this.gl, this.geometryManager, this.projectionManager);

        const defaults = {
            isRendering: false,
            startTime: 0,
            time: 0,
            geometryType: 'hypersphere',
            projectionMethod: 'perspective',
            shaderProgramName: null,
            dimension: 4.0,
            morphFactor: 0.5,
            rotationSpeed: 0.2,
            gridDensity: 8.0,
            lineThickness: 0.03,
            shellWidth: 0.025,
            tetraThickness: 0.035,
            patternIntensity: 1.0,
            glitchIntensity: 0.0,
            colorShift: 0.0,
            universeModifier: 1.0,
            audioBass: 0.0,
            audioMid: 0.0,
            audioHigh: 0.0,
            primaryColor: [1.0, 0.2, 0.8],
            secondaryColor: [0.2, 1.0, 1.0],
            backgroundColor: [0.05, 0.0, 0.2],
            dirtyUniforms: new Set()
        };

        this.state = { ...defaults, ...options };
        this.state.dirtyUniforms = new Set();

        this.setupWebGL();
        this.createBuffers();
        this.updateShader();

        this.frameCount = 0;
        this.lastFpsTime = (typeof performance !== 'undefined') ? performance.now() : 0;
        this.animationFrame = null;
    }

    setupWebGL() {
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    }

    createBuffers() {
        const vertices = new Float32Array([
            -1, -1,
             1, -1,
            -1,  1,
            -1,  1,
             1, -1,
             1,  1
        ]);

        this.vertexBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);
    }

    updateShader() {
        const programName = `${this.state.geometryType}_${this.state.projectionMethod}`;
        let program = this.shaderManager.programs.get(programName);

        if (!program) {
            program = this.shaderManager.createDynamicProgram(
                programName,
                this.state.geometryType,
                this.state.projectionMethod
            );
        }

        if (!program) {
            throw new Error('Failed to create shader program');
        }

        this.shaderManager.useProgram(programName);
        this.state.shaderProgramName = programName;
        this.markAllUniformsDirty();
    }

    markAllUniformsDirty() {
        const uniforms = [
            'u_resolution', 'u_time', 'u_dimension', 'u_morphFactor', 'u_rotationSpeed',
            'u_universeModifier', 'u_patternIntensity', 'u_gridDensity', 'u_lineThickness',
            'u_shellWidth', 'u_tetraThickness', 'u_audioBass', 'u_audioMid', 'u_audioHigh',
            'u_glitchIntensity', 'u_colorShift', 'u_primaryColor', 'u_secondaryColor',
            'u_backgroundColor'
        ];
        this.state.dirtyUniforms = new Set(uniforms);
    }

    setGeometry(geometryType) {
        if (geometryType === this.state.geometryType) return;
        this.state.geometryType = geometryType;
        this.updateShader();
    }

    setProjection(projectionMethod) {
        if (projectionMethod === this.state.projectionMethod) return;
        this.state.projectionMethod = projectionMethod;
        this.updateShader();
    }

    setParameter(name, value) {
        const normalizedValue = Array.isArray(value) ? value : parseFloat(value);
        this.state[name] = normalizedValue;
        const uniformName = this.mapParameterToUniform(name);
        if (uniformName) {
            this.state.dirtyUniforms.add(uniformName);
        }
    }

    mapParameterToUniform(name) {
        const mapping = {
            dimension: 'u_dimension',
            morphFactor: 'u_morphFactor',
            rotationSpeed: 'u_rotationSpeed',
            universeModifier: 'u_universeModifier',
            patternIntensity: 'u_patternIntensity',
            gridDensity: 'u_gridDensity',
            lineThickness: 'u_lineThickness',
            shellWidth: 'u_shellWidth',
            tetraThickness: 'u_tetraThickness',
            audioBass: 'u_audioBass',
            audioMid: 'u_audioMid',
            audioHigh: 'u_audioHigh',
            glitchIntensity: 'u_glitchIntensity',
            colorShift: 'u_colorShift',
            primaryColor: 'u_primaryColor',
            secondaryColor: 'u_secondaryColor',
            backgroundColor: 'u_backgroundColor'
        };
        return mapping[name] || null;
    }

    resize() {
        const width = this.canvas.clientWidth || this.canvas.width;
        const height = this.canvas.clientHeight || this.canvas.height;
        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
            this.gl.viewport(0, 0, width, height);
            this.state.dirtyUniforms.add('u_resolution');
        }
    }

    updateUniform(name, value) {
        const location = this.shaderManager.getUniformLocation(name);
        if (!location) return;

        if (Array.isArray(value)) {
            if (value.length === 2) {
                this.gl.uniform2fv(location, new Float32Array(value));
            } else if (value.length === 3) {
                this.gl.uniform3fv(location, new Float32Array(value));
            }
        } else {
            this.gl.uniform1f(location, value);
        }
    }

    updateUniforms() {
        if (!this.state.shaderProgramName) return;

        const uniformValues = {
            u_resolution: [this.canvas.width, this.canvas.height],
            u_time: this.state.time,
            u_dimension: this.state.dimension,
            u_morphFactor: this.state.morphFactor,
            u_rotationSpeed: this.state.rotationSpeed,
            u_universeModifier: this.state.universeModifier,
            u_patternIntensity: this.state.patternIntensity,
            u_gridDensity: this.state.gridDensity,
            u_lineThickness: this.state.lineThickness,
            u_shellWidth: this.state.shellWidth,
            u_tetraThickness: this.state.tetraThickness,
            u_audioBass: this.state.audioBass,
            u_audioMid: this.state.audioMid,
            u_audioHigh: this.state.audioHigh,
            u_glitchIntensity: this.state.glitchIntensity,
            u_colorShift: this.state.colorShift,
            u_primaryColor: this.state.primaryColor,
            u_secondaryColor: this.state.secondaryColor,
            u_backgroundColor: this.state.backgroundColor
        };

        this.state.dirtyUniforms.forEach(name => {
            if (uniformValues[name] !== undefined) {
                this.updateUniform(name, uniformValues[name]);
            }
        });

        this.state.dirtyUniforms.clear();
    }

    renderFrame(timestamp) {
        if (!this.state.isRendering) {
            return;
        }

        if (!this.state.startTime) {
            this.state.startTime = timestamp;
        }
        this.state.time = (timestamp - this.state.startTime) / 1000.0;

        this.resize();
        this.shaderManager.useProgram(this.state.shaderProgramName);

        const positionLocation = this.shaderManager.getAttributeLocation('a_position');
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
        this.gl.enableVertexAttribArray(positionLocation);
        this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);

        this.updateUniforms();

        this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);

        this.frameCount += 1;
        if (typeof performance !== 'undefined') {
            const now = performance.now();
            if (now - this.lastFpsTime >= 1000) {
                this.frameCount = 0;
                this.lastFpsTime = now;
            }
        }

        this.animationFrame = requestAnimationFrame(this.renderFrame.bind(this));
    }

    start() {
        if (this.state.isRendering) return;
        this.state.isRendering = true;
        this.animationFrame = requestAnimationFrame(this.renderFrame.bind(this));
    }

    stop() {
        this.state.isRendering = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }
}

export default HypercubeTopologyCore;
