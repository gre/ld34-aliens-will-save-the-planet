import createShader from "gl-shader";
import createTexture from "gl-texture2d";
import createFBO from "gl-fbo";
import numeral from "numeral";
import loader from "./loader";
const glslify = require("glslify");

const staticVert = glslify("./shaders/static.vert");

// SETUP

const canvas = document.getElementById("game");
const width = canvas.width, height = canvas.height;
const gl = canvas.getContext("webgl") || canvas.getContext("experiemntal-webgl");

gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

var buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
  -1.0, -1.0,
  1.0, -1.0,
  -1.0,  1.0,
  -1.0,  1.0,
  1.0, -1.0,
  1.0,  1.0
]), gl.STATIC_DRAW);

const shaders = {
  main: createShader(gl, staticVert, glslify("./shaders/main.frag")),
  emitCO2: createShader(gl, staticVert, glslify("./shaders/emitCO2.frag")),
  initCO2: createShader(gl, staticVert, glslify("./shaders/initCO2.frag")),
  initTree: createShader(gl, staticVert, glslify("./shaders/initTree.frag")),
  simCO2: createShader(gl, staticVert, glslify("./shaders/simCO2.frag")),
  simTree: createShader(gl, staticVert, glslify("./shaders/simTree.frag")),
  drawRadial: createShader(gl, staticVert, glslify("./shaders/drawRadial.frag"))
};

shaders.main.attributes.p.pointer();
shaders.emitCO2.attributes.p.pointer();
shaders.initCO2.attributes.p.pointer();
shaders.initTree.attributes.p.pointer();
shaders.simCO2.attributes.p.pointer();
shaders.simTree.attributes.p.pointer();
shaders.drawRadial.attributes.p.pointer();

// GAME CONSTANTS

/*
const CursorMode = {
  NONE: 0,
  PLANT_TREE: 1,
  KILL: 2
};
*/

const pixel = (x, y) => [ x/1000, 1-y/500 ];

const locations = {
  Paris: pixel(504, 118),
  Beijing: pixel(828, 160),
  Sydney: pixel(920, 340),
  Johannesburg: pixel(580, 330),
  Anchorage: pixel(88, 80),
  Vancouver: pixel(150, 125),
  "Mexico City": pixel(216, 188),
  Lima: pixel(290, 280),
  "Buenos Aires": pixel(338, 350),
  Brasilia: pixel(360, 294),
  Dakar: pixel(456, 200),
  Madrid: pixel(486, 138),
  Budapest: pixel(540, 112),
  Baghdad: pixel(620, 150),
  Nairobi: pixel(600, 240),
  Novosibirsk: pixel(700, 100),
  "New Delhi": pixel(706, 178),
  Jakarta: pixel(790, 270),
  Godthab: pixel(360, 70),
  "sunken city of Hawaii": pixel(66, 196)
};

const KEY_CODE = {
  V: 86,
  C: 67,
  B: 66
};

// GAME HELPER FUNCTIONS

function domHelper (id) {
  const $ = document.getElementById(id);
  let _txt;
  return {
    setText: function (txt) {
      if (txt !== _txt) {
        $.textContent = txt;
        _txt = txt;
      }
    }
  };
}

const data = new Uint8Array(1000 * 500 * 4);
function getPixelAverage (fbo) {
  fbo.bind();
  gl.readPixels(0, 0, 1000, 500, gl.RGBA, gl.UNSIGNED_BYTE, data);
  let res = [0,0,0,0];
  for (let y = 0; y < 500; y++) {
    let row = [0,0,0,0];
    for (let x = 0; x < 1000; x++) {
      row[0] += data[(y * 1000 + x) * 4 + 0];
      row[1] += data[(y * 1000 + x) * 4 + 1];
      row[2] += data[(y * 1000 + x) * 4 + 2];
      row[3] += data[(y * 1000 + x) * 4 + 3];
    }
    res[0] += row[0] / 1000;
    res[1] += row[1] / 1000;
    res[2] += row[2] / 1000;
    res[3] += row[3] / 1000;
  }
  return [
    res[0] / 500,
    res[1] / 500,
    res[2] / 500,
    res[3] / 500
  ];
}

const evtCanvasNormPosition = e => {
  const rect = canvas.getBoundingClientRect();
  return [
    (e.clientX - rect.left) / width,
    1 - (e.clientY - rect.top) / height
  ];
}

const projectToMap = ([x, y], [ cx, cy ], zoom) => ([
  (x + (zoom * 2 - 1) / 2) / (zoom * 2) + cx - 0.5,
  (y + (zoom - 1) / 2) / zoom + cy - 0.5
]);

// WAIT RESOURCES AND START THE GAME

loader.images(
  "images/mapColor.png",
  "images/mapMask.png"
).then(([
  mapColor,
  mapMask
]) => {
  // mapColor: the color texture
  // mapMask: static data about the map: RED: ground, GREEN: fertility

  const mapColorTexture = createTexture(gl, mapColor);
  mapColorTexture.minFilter = mapColorTexture.magFilter = gl.LINEAR;

  const mapMaskTexture = createTexture(gl, mapMask);
  mapMaskTexture.minFilter = mapMaskTexture.magFilter = gl.LINEAR;

  function fbo (size) {
    const fbo = createFBO(gl, size);
    fbo.color[0].minFilter =
    fbo.color[0].magFilter =
    gl.LINEAR;
    return fbo;
  }

  function distance (a, b) {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    return Math.sqrt(dx * dx + dy * dy);
  }

  let co2maps = [0,1].map(() => fbo([ 1000, 500 ]));
  let treemaps = [0,1].map(() => fbo([ 1000, 500 ]));

  const swap = ([ a, b ]) => ([ b, a ]);

  // game states
  let vacuum, addSeed, bomb;
  let lastBombDropped = 0;
  let center, zoom;
  let factories =
  Object.keys(locations)
  .sort(() => Math.random()-0.5)
  .slice(0, 5)
  .map(name => {
    return {
      name,
      center: locations[name],
      value: [1, 0, 0, 0],
      mixForce: [0.1, 0, 0, 0],
      size: 0.03 + 0.04 * Math.random()
    };
  });
  let humans = 0;
  let co2 = 0, o2 = 0, n2;

  let ePos = [ 0, 0 ];
  const keys = {};


  const $humans = domHelper("humans");
  const $co2 = domHelper("co2");
  const $o2 = domHelper("o2");
  const $n2 = domHelper("n2");
  const $year = domHelper("year");
  const $factories = domHelper("factories");
  const $help = domHelper("help");
  function updateDOM (t) {
    $humans.setText(numeral(humans).format("0,0"));
    $co2.setText((co2*100).toFixed(0)+"%");
    $o2.setText((o2*100).toFixed(0)+"%");
    $n2.setText((n2*100).toFixed(0)+"%");
    $year.setText(""+Math.floor(2100 + t / 6000));
    $factories.setText(""+factories.length);
    if (t > 5000)
      $help.setText("Detected a human factory in "+factories[0].name);
  }

  function syncCO2stats () {
    const treesPixel = getPixelAverage(treemaps[0]);
    const co2Pixel = getPixelAverage(co2maps[0]);
    co2 = co2Pixel[0] / 256;
    o2 = co2Pixel[3] / 256;
    n2 = 1;
    const sum = co2 + o2 + n2;
    co2 /= sum;
    o2 /= sum;
    n2 /= sum;
    humans = 1000000000 * treesPixel[2];
  }

  // init CO2
  co2maps[0].bind();
  shaders.initCO2.bind();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  Object.assign(shaders.initCO2.uniforms);
  co2maps = swap(co2maps);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  // init treemap
  treemaps[0].bind();
  shaders.initTree.bind();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  Object.assign(shaders.initTree.uniforms, {
    mapMask: mapMaskTexture.bind(0)
  });
  treemaps = swap(treemaps);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  function update (t, dt) {
    center = [
      (0.3 + t / 34000) % 1,
      0.55 + 0.2 * Math.sin(t / 2500)
    ];
    zoom = 2;

    if (keys[KEY_CODE.V]) {
      vacuum = {
        center: projectToMap(ePos, center, zoom),
        size: 0.1
      };
    }
    else if (keys[KEY_CODE.C]) {
      addSeed = {
        center: projectToMap(ePos, center, zoom),
        size: 0.05
      };
    }
    else if (keys[KEY_CODE.B]) {
      if (t-lastBombDropped > 600) {
        lastBombDropped = t;
        const bombCenter = projectToMap(ePos, center, zoom);
        const bombSize = 0.01 + 0.01 * Math.random();
        bomb = {
          center: bombCenter,
          size: 0.02 + 0.02 * Math.random()
        };
        factories = factories.filter(({ center }) => distance(bombCenter, center) > bombSize + 0.01);
      }
    }

    if (vacuum) {
      co2maps[0].bind();
      shaders.drawRadial.bind();
      Object.assign(shaders.drawRadial.uniforms, {
        previous: co2maps[1].color[0].bind(0),
        ratio: 2,
        dt,
        value: [0, 0, 0, 1],
        mixForce: [0.005, 0, 0, 0.001],
        ...vacuum
      });
      co2maps = swap(co2maps);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      vacuum = null;
    }
    if (addSeed) {
      treemaps[0].bind();
      shaders.drawRadial.bind();
      Object.assign(shaders.drawRadial.uniforms, {
        previous: treemaps[1].color[0].bind(0),
        dt,
        value: [1, 0, 0, 0],
        mixForce: [0.004, 0, 0, 0],
        ...addSeed
      });
      treemaps = swap(treemaps);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      addSeed = null;
    }
    if (bomb) {
      treemaps[0].bind();
      shaders.drawRadial.bind();
      Object.assign(shaders.drawRadial.uniforms, {
        previous: treemaps[1].color[0].bind(0),
        dt,
        value: [0, 0, 0, 1],
        mixForce: [0, 0, 0, 0.01],
        ...bomb
      });
      treemaps = swap(treemaps);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      addSeed = null;
    }

    // update co2map
    co2maps[0].bind();
    shaders.simCO2.bind();
    Object.assign(shaders.simCO2.uniforms, {
      previous: co2maps[1].color[0].bind(0),
      treemap: treemaps[0].color[0].bind(1),
      ratio: 2,
      t: t / 1000
    });
    co2maps = swap(co2maps);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    factories.forEach(f => {
      co2maps[0].bind();
      shaders.drawRadial.bind();
      Object.assign(shaders.drawRadial.uniforms, {
        previous: co2maps[1].color[0].bind(0),
        ratio: 2,
        dt,
        ...f
      });
      co2maps = swap(co2maps);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    });

    // update treemap
    treemaps[0].bind();
    shaders.simTree.bind();
    Object.assign(shaders.simTree.uniforms, {
      previous: treemaps[1].color[0].bind(0),
      co2map: co2maps[0].color[0].bind(1),
      mapMask: mapMaskTexture.bind(2)
    });
    treemaps = swap(treemaps);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function render (t, dt) {
    // render the game
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    shaders.main.bind();
    Object.assign(shaders.main.uniforms, {
      mapColor: mapColorTexture.bind(0),
      mapMask: mapMaskTexture.bind(1),
      co2map: co2maps[0].color[0].bind(2),
      treemap: treemaps[0].color[0].bind(3),
      center,
      zoom
    });
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  ///// Events /////

  document.addEventListener("keydown", e => {
    keys[e.keyCode] = 1;
  });
  document.addEventListener("keyup", e => {
    keys[e.keyCode] = 0;
  });
  canvas.addEventListener("mousemove", e => {
    ePos = evtCanvasNormPosition(e);
  });

  setTimeout(() => {
    document.body.className = "start";

    setInterval(syncCO2stats, 500);
    ///// Render Loop ////
    let _start, _t, _dt;
    requestAnimationFrame(function loop (rt) {
      requestAnimationFrame(loop);
      if (!_start) _start = _t = rt;
      _dt = Math.min(100, rt - _t);
      _t = rt;
      update(_t-_start, _dt);
      render(_t-_start, _dt);
      updateDOM(_t-_start);
    });
  }, 3000 * 0);

});
