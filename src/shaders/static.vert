
attribute vec2 p;
varying vec2 uv;

void main() {
  gl_Position = vec4(p, 0.0, 1.0);
  uv = (p + 1.0) / 2.0;
}
