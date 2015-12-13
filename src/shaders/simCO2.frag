precision highp float;

#pragma glslify: random = require(glsl-random)
#pragma glslify: PI = require(glsl-pi)

varying vec2 uv;
uniform sampler2D previous;
uniform sampler2D treemap;
uniform float ratio;
uniform float t;

const float TWOPI = 2.0 * PI;
const float windPower = 0.01;

float deltaAng (float x, float y) {
  float a = mod(x - y, TWOPI);
  float b = mod(y - x, TWOPI);
  return mix(-a, b, step(b, a));
}

void main() {
  vec4 p = texture2D(previous, uv);
  vec4 tree = texture2D(treemap, uv);
  float co2 = p.r;
  float o2 = p.a;
  float windAngle = p.g * TWOPI - PI;
  float windForce = p.b;
  vec2 wind = windPower * windForce * vec2(
    cos(windAngle) / ratio,
    sin(windAngle)
  ) + vec2(0.004, 0.0);
  vec4 tail = texture2D(previous, mod(uv - wind, 1.0));
  vec4 head = texture2D(previous, mod(uv + wind, 1.0));

  co2 =
  (co2 + head.r + tail.r) / 3.0
  - 0.01 * tree.g
  + 0.006 * co2
  - 0.008 * o2;

  o2 = (o2 + head.a + tail.a) / 3.0
  + 0.01 * tree.g;


  windAngle += 0.01 * deltaAng(windAngle, tail.g * TWOPI);
  windAngle += 0.02 * (random(uv + t) - 0.5);
  //o2 += 0.01 * smoothstep(0.0, 1.0, o2);

  gl_FragColor = vec4(
    co2,
    mod(windAngle / TWOPI, 1.0),
    windForce,
    o2);
}
