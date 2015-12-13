precision highp float;

#pragma glslify: random = require(glsl-random)

varying vec2 uv;

void main() {
  gl_FragColor = vec4(
    // co2
    0.9 + 0.1 * random(uv),
    // wind angle
    random(uv),
    // wind force
    1.0,
    // oxygen
    0.2);
}
