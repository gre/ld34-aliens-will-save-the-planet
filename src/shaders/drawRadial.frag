precision highp float;

varying vec2 uv;
uniform sampler2D previous;
uniform float ratio;
uniform float dt;

uniform vec4 value;
uniform vec4 mixForce;
uniform vec2 center;
uniform float size;


void main() {
  vec2 d = abs(uv - center);
  gl_FragColor = mix(
    texture2D(previous, uv),
    value,
    mixForce * dt *
    smoothstep(size, 0.0, length(min(d, 1.0 - d) * vec2(ratio, 1.0))));
}
