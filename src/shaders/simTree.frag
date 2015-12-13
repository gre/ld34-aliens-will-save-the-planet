precision highp float;

#pragma glslify: random = require(glsl-random)

varying vec2 uv;
uniform sampler2D previous;
uniform sampler2D co2map;
uniform sampler2D mapMask;

void main() {
  vec4 p = texture2D(previous, uv);
  vec4 co2 = texture2D(co2map, uv);
  float seeds = p.r;
  float trees = p.g;
  float humans = p.b;
  float bomb = p.a;
  vec4 mask = texture2D(mapMask, uv);
  float fertility = mask.g;
  trees = min(mask.r, trees + seeds * fertility * 0.01);
  seeds -= mix(0.01, 0.001, mask.r);
  trees *= 0.995;

  humans += 0.01 * (random(uv) - 0.6);

  humans *=
  1.0
    + 0.01 * smoothstep(0.4, 1.0, co2.a)
    - 0.05 * smoothstep(0.4, 1.0, co2.r);

  gl_FragColor = vec4(
    step(bomb, 0.01) * seeds,
    step(bomb, 0.01) * trees,
    step(bomb, 0.01) * humans,
    bomb * 1.01);
}
