precision highp float;

#pragma glslify: random = require(glsl-random)

varying vec2 uv;
uniform sampler2D mapColor;
uniform sampler2D mapMask;
uniform sampler2D co2map;
uniform sampler2D treemap;

uniform float zoom;
uniform vec2 center;

void main() {
  vec2 zv = zoom * vec2(2.0, 1.0);
  vec2 mapuv = mod(
    (uv + (zv - 1.0) / 2.0) / zv + center - vec2(0.5),
    vec2(1.0));
  vec2 mapuvFloor = floor(mapuv * vec2(1000.0, 500.0)) / vec2(1000.0, 500.0);
  vec4 c = texture2D(mapColor, mapuv);
  vec4 co2 = texture2D(co2map, mapuv);
  vec4 tree = texture2D(treemap, mapuv);
  vec4 mask = texture2D(mapMask, mapuv);
  gl_FragColor = mix(
    mix(
      mix(
        mix(
          c,
          vec4(vec3(0.6, 0.5, 0.0) * mix(1.0, random(mapuvFloor), 0.5), 1.0),
          tree.r
        ),
        vec4(vec3(0.0, 0.3, 0.0) * mix(1.0, random(mapuvFloor), 0.5), 1.0),
        tree.g * 0.8
      ),
      vec4(0.0, 0.0, 0.0, 1.0),
      step(0.9, tree.a) * 0.8
    ),
    vec4(0.5, 0.5, 0.5, 1.0),
    co2.r * 0.96);
}
