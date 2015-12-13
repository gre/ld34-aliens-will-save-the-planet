precision highp float;

#pragma glslify: random = require(glsl-random)

varying vec2 uv;
uniform sampler2D mapMask;

void main() {
  vec4 t = texture2D(mapMask, uv);
  gl_FragColor = vec4(
    // seeds
    0.0,
    // trees
    0.0,
    // human population
    t.b,
    // bombing result
    0.0);
}
