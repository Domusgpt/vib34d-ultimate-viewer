#version 300 es
precision highp float;
out vec4 fragColor;

uniform vec2 u_res;
uniform float u_time;

// VIB34D grammar (mapped from shared UI/controller)
uniform float u_rotXW;
uniform float u_rotYW;
uniform float u_rotZW;
uniform float u_grid;      // “Grid Density”      [~1..64]
uniform float u_morph;     // “Morph Factor”      [0..1+]
uniform float u_chaos;     // “Chaos”             [0..1]
uniform float u_speed;     // “Speed”             [0.1..3]
uniform float u_hue;       // “Hue”               [0..360]
uniform float u_intensity; // “Intensity”         [0..1.5]
uniform float u_sat;       // “Saturation”        [0..1]
uniform float u_scale;     // “Scale”             [0.25..2]

// ===== Helpers =====
const float PI = 3.14159265359;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 234.12));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

mat3 hueRotate(float hDeg) {
  float h = radians(hDeg);
  float c = cos(h), s = sin(h);
  // YIQ-like rotation for saturated tint
  return mat3(
    0.299 + 0.701 * c + 0.168 * s, 0.587 - 0.587 * c + 0.330 * s, 0.114 - 0.114 * c - 0.497 * s,
    0.299 - 0.299 * c - 0.328 * s, 0.587 + 0.413 * c + 0.035 * s, 0.114 - 0.114 * c + 0.292 * s,
    0.299 - 0.300 * c + 1.250 * s, 0.587 - 0.588 * c - 1.050 * s, 0.114 + 0.886 * c - 0.203 * s
  );
}

vec3 hsl2rgb(float h, float s, float l) {
  float c = (1.0 - abs(2.0 * l - 1.0)) * s;
  float x = c * (1.0 - abs(mod(h / 60.0, 2.0) - 1.0));
  float m = l - 0.5 * c;
  vec3 rgb =
    (h < 60.0)  ? vec3(c, x, 0.0) :
    (h < 120.0) ? vec3(x, c, 0.0) :
    (h < 180.0) ? vec3(0.0, c, x) :
    (h < 240.0) ? vec3(0.0, x, c) :
    (h < 300.0) ? vec3(x, 0.0, c) :
                  vec3(c, 0.0, x);
  return rgb + m;
}

// 4D rotator: project X/Y/Z under XW,YW,ZW rotations into 3D intensity
mat3 basisFrom4DRot(float rxw, float ryw, float rzw) {
  float cx = cos(rxw), sx = sin(rxw);
  float cy = cos(ryw), sy = sin(ryw);
  float cz = cos(rzw), sz = sin(rzw);

  // we collapse W using three independent rotations into a 3x3 mixing basis
  return mat3(
    cx, -sx * cz, sx * sz,
    sy, cy * cz, -cy * sz,
    sz, cz, 1.0
  );
}

// Signed distance to simple polychora shadow lattice (screen-space param)
float sdfShadow(vec2 p, mat3 B) {
  // Tri-planar grid interference “shadow” of higher-D structure
  float g = u_grid;
  vec3 q = B * vec3(p * u_scale, 1.0);
  vec2 w1 = vec2(sin(q.x * g), cos(q.y * g));
  vec2 w2 = vec2(sin(q.y * g * 1.732), cos(q.z * g * 1.618));
  float field = dot(w1, w1) + dot(w2, w2);
  return field; // not a true SDF, but behaves like a soft density
}

// Multi-octave interference (caustic feel)
float aether(vec2 p, float t) {
  float f = 0.0;
  float a = 0.6 + 0.4 * u_morph;
  float freq = 1.0;
  for (int i = 0; i < 5; ++i) {
    vec2 q = p * freq;
    float phase = t * u_speed * (0.6 + 0.4 * float(i));
    float s = sin(q.x + phase) * cos(q.y - 0.5 * phase);
    float n = s * (0.8 + 0.2 * hash21(q));
    f += n * a;
    a *= 0.6;
    freq *= 1.9 + 0.3 * u_chaos;
  }
  return f;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res.xy;
  vec2 p = (uv - 0.5) * vec2(u_res.x / u_res.y, 1.0);

  mat3 B = basisFrom4DRot(u_rotXW, u_rotYW, u_rotZW);

  float shadow = sdfShadow(p, B);
  float wave = aether(p, u_time);

  // combine: bright seams where density + interference align
  float lum = pow(max(0.0, shadow * 0.35 + wave), 1.2) * u_intensity;

  // subtle chroma shift from 4D “parallax” derivative
  float par = length(B * vec3(p, 1.0));
  float hue = mod(u_hue + 90.0 * par + 30.0 * u_morph, 360.0);

  vec3 col = hsl2rgb(hue, clamp(u_sat, 0.0, 1.0), clamp(0.45 + 0.25 * lum, 0.0, 1.0));

  // card-glass pop (soft vignette + rim specular)
  float r = length(uv - 0.5);
  float vign = smoothstep(0.85, 0.35, r);
  float rim = smoothstep(0.48, 0.5, r) * 0.25;

  col *= vign;
  col += rim * vec3(1.0);

  fragColor = vec4(col, 1.0);
}
