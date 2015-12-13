precision highp float;

varying vec2 uv;
uniform sampler2D previous;
uniform sampler2D mask;
uniform float dt;

const float emissionSpeed = 0.0001;

void main() {
  gl_FragColor = texture2D(previous, uv) + vec4(
    dt * emissionSpeed * texture2D(mask, uv).r,
    0.0,
    0.0,
    0.0
  );
}
