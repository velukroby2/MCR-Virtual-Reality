import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {Viewer, viewerCamera} from '../src/viewer.js';
import {createModel} from '../src/model.js';

// CPU geometry tests only: Three.js performs the transforms and ray intersections,
// but neither Canvas drawing nor WebGL rendering is performed by this harness.
const SCREEN_IDS = ['tv', 'left', 'right'];
const CONTROL_IDS = ['inputA', 'inputB', 'takeLive', 'adBreak', 'returnLive', 'off'];
const GRID_COLUMNS = 25;
const GRID_ROWS = 17;
// Stay just inside triangle edges to avoid floating-point edge ambiguity. This is
// 0.01% of the surface, not a crop that could hide an obstructed footer or bezel.
const EDGE_INSET = 0.0001;
const noop = () => {};

function imageData(width, height) {
  if (typeof width === 'object') ({width, height} = width);
  width = Math.max(1, Math.trunc(width || 1));
  height = Math.max(1, Math.trunc(height || 1));
  return {width, height, colorSpace: 'srgb', data: new Uint8ClampedArray(width * height * 4)};
}

function fakeCanvas(width = 1024, height = 576) {
  let context;
  const canvas = {
    width, height, style: {}, tagName: 'CANVAS', nodeName: 'CANVAS',
    addEventListener: noop, removeEventListener: noop,
    getBoundingClientRect() {
      return {x: 0, y: 0, left: 0, top: 0, right: this.width, bottom: this.height,
        width: this.width, height: this.height};
    },
    getContext(kind) {
      assert.equal(kind, '2d', 'The CPU harness must never request a WebGL context');
      if (context) return context;
      const gradient = () => ({addColorStop: noop});
      const values = {
        canvas, font: '10px sans-serif', globalAlpha: 1,
        createLinearGradient: gradient, createRadialGradient: gradient,
        createConicGradient: gradient, createPattern: () => ({setTransform: noop}),
        createImageData: imageData,
        getImageData: (_x, _y, w, h) => imageData(w, h),
        getLineDash: () => [],
        getTransform: () => ({a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, is2D: true}),
        getContextAttributes: () => ({alpha: true, colorSpace: 'srgb'}),
        isPointInPath: () => false, isPointInStroke: () => false,
        measureText(value) {
          const size = Number.parseFloat(/([\d.]+)px/.exec(values.font)?.[1] || '10');
          const width = String(value).length * size * 0.6;
          return {width, actualBoundingBoxLeft: 0, actualBoundingBoxRight: width,
            actualBoundingBoxAscent: size * 0.8, actualBoundingBoxDescent: size * 0.2,
            fontBoundingBoxAscent: size * 0.8, fontBoundingBoxDescent: size * 0.2};
        },
      };
      // Procedural textures can use additional ordinary drawing calls and style
      // setters without coupling these geometry tests to their drawing details.
      context = new Proxy(values, {
        get(target, key) {
          if (key in target) return target[key];
          if (typeof key === 'symbol') return undefined;
          return (target[key] = noop);
        },
        set(target, key, value) { target[key] = value; return true; },
      });
      return context;
    },
  };
  return canvas;
}

function fakeRenderer(element) {
  return {
    domElement: element, ratio: 1, target: null,
    shadowMap: {enabled: false, type: T.PCFShadowMap, autoUpdate: true, needsUpdate: false},
    capabilities: {isWebGL2: true, maxTextures: 16, maxTextureSize: 8192, maxSamples: 4,
      getMaxAnisotropy: () => 16, getMaxPrecision: () => 'highp'},
    extensions: {has: () => false, get: () => null},
    xr: {enabled: false, isPresenting: false, setReferenceSpaceType: noop},
    setPixelRatio(value) { this.ratio = value; },
    getPixelRatio() { return this.ratio; },
    setSize(width, height) { this.size = new T.Vector2(width, height); },
    getSize(target) { return target.copy(this.size); },
    getDrawingBufferSize(target) { return target.copy(this.size).multiplyScalar(this.ratio).floor(); },
    setRenderTarget(target) { this.target = target; },
    getRenderTarget() { return this.target; },
    setViewport: noop, setScissor: noop, setScissorTest: noop,
    setClearColor: noop, setClearAlpha: noop, clear: noop, clearDepth: noop,
    render: noop, compile: noop, dispose: noop,
  };
}

function withViewer(run, width = 1600, height = 900) {
  const createElement = tag => {
    assert.equal(tag.toLowerCase(), 'canvas', 'Viewer should only need fake Canvas elements');
    return fakeCanvas();
  };
  const globals = {
    document: {createElement, createElementNS: (_namespace, tag) => createElement(tag)},
    devicePixelRatio: 1, innerWidth: width, innerHeight: height,
  };
  const previous = new Map();
  for (const [key, value] of Object.entries(globals)) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {value, writable: true, configurable: true});
  }
  let viewer;
  try {
    const element = fakeCanvas(width, height);
    const screens = Object.fromEntries(SCREEN_IDS.map(id => [id, fakeCanvas()]));
    viewer = new Viewer(element, screens, createModel().state, fakeRenderer(element));
    viewer.resize(width, height);
    viewer.scene.updateMatrixWorld(true);
    return run(viewer);
  } finally {
    // No GPU resources exist, but release Three.js objects using their real APIs.
    const resources = new Set();
    for (const scene of [viewer?.scene, viewer?.composite]) {
      scene?.traverse(object => {
        if (object.geometry) resources.add(object.geometry);
        for (const material of [object.material].flat().filter(Boolean)) {
          resources.add(material);
          for (const value of Object.values(material)) if (value?.isTexture) resources.add(value);
        }
      });
    }
    for (const target of viewer?.targets || []) resources.add(target);
    for (const resource of resources) resource.dispose();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
}

function screenSurfaces(viewer) {
  const screens = new Map();
  const found = [];
  viewer.room.traverse(object => {
    if (!object.userData.screen) return;
    found.push(object.userData.screen);
    screens.set(object.userData.screen, object);
    assert.ok(object.isMesh, `${object.userData.screen} must be a real screen mesh`);
  });
  assert.deepEqual(found.sort(), [...SCREEN_IDS].sort(), 'Exactly three uniquely tagged screen surfaces');
  return screens;
}

// Find the actual triangle at a UV coordinate, rather than assuming hard-coded
// monitor dimensions, translations, yaw, or a particular parent hierarchy.
function surfacePoint(surface, u, v) {
  const {geometry} = surface;
  const positions = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  assert.ok(positions && uv, 'Screen/button surfaces need position and UV attributes');
  const index = geometry.getIndex();
  const count = index ? index.count : positions.count;
  for (let triangle = 0; triangle < count; triangle += 3) {
    const [a, b, c] = [0, 1, 2].map(i => index ? index.getX(triangle + i) : triangle + i);
    const au = uv.getX(a), av = uv.getY(a);
    const bu = uv.getX(b), bv = uv.getY(b);
    const cu = uv.getX(c), cv = uv.getY(c);
    const denominator = (bv - cv) * (au - cu) + (cu - bu) * (av - cv);
    if (Math.abs(denominator) < 1e-12) continue;
    const wa = ((bv - cv) * (u - cu) + (cu - bu) * (v - cv)) / denominator;
    const wb = ((cv - av) * (u - cu) + (au - cu) * (v - cv)) / denominator;
    const wc = 1 - wa - wb;
    if (Math.min(wa, wb, wc) < -1e-8) continue;
    return new T.Vector3().fromBufferAttribute(positions, a).multiplyScalar(wa)
      .addScaledVector(new T.Vector3().fromBufferAttribute(positions, b), wb)
      .addScaledVector(new T.Vector3().fromBufferAttribute(positions, c), wc)
      .applyMatrix4(surface.matrixWorld);
  }
  assert.fail(`${surface.userData.screen || surface.userData.action}: no surface at UV (${u}, ${v})`);
}

function operatorEyes(viewer) {
  viewer.scene.updateMatrixWorld(true);
  // The real production operator pose is retained; no camera.lookAt() is used.
  const operator = viewerCamera();
  assert.ok(viewer.camera.position.distanceTo(operator.position) < 1e-10,
    'Desktop resize must retain the operator position');
  assert.ok(viewer.camera.quaternion.angleTo(operator.quaternion) < 1e-7,
    'Desktop resize must retain the default operator orientation');
  viewer.stereo.update(viewer.camera);
  const eyes = [
    {name: 'center eye', camera: viewer.camera},
    {name: 'left stereo eye', camera: viewer.stereo.cameraL},
    {name: 'right stereo eye', camera: viewer.stereo.cameraR},
  ].map(({name, camera}) => ({name, layers: camera.layers.mask,
    origin: new T.Vector3().setFromMatrixPosition(camera.matrixWorld)}));
  // StereoCamera writes matrixWorld directly. Calling getWorldPosition() on its
  // parentless eye cameras would recompute and overwrite those eye transforms.
  assert.ok(viewer.stereo.eyeSep > 0 && Number.isFinite(viewer.stereo.eyeSep));
  assert.ok(Math.abs(eyes[1].origin.distanceTo(eyes[2].origin) - viewer.stereo.eyeSep) < 1e-9);
  assert.ok(eyes[1].origin.clone().add(eyes[2].origin).multiplyScalar(0.5)
    .distanceTo(eyes[0].origin) < 1e-9);
  return eyes;
}

function isVisibleHit(hit) {
  for (let object = hit.object; object; object = object.parent) if (!object.visible) return false;
  const material = Array.isArray(hit.object.material)
    ? hit.object.material[hit.face?.materialIndex || 0] : hit.object.material;
  return material?.visible !== false && !(material?.transparent && material.opacity <= 0);
}

function castToSurface(viewer, eye, surface, worldPoint) {
  const direction = worldPoint.clone().sub(eye.origin);
  const ray = new T.Raycaster(eye.origin, direction.clone().normalize(), 0, direction.length() + 1e-5);
  ray.layers.mask = eye.layers;
  const hits = ray.intersectObject(viewer.room, true).filter(isVisibleHit);
  const target = hits.find(hit => hit.object === surface);
  // A target hit is mandatory. A ray missing every mesh must never count as a
  // clear view, and another visible mesh in front must never be ignored.
  return {clear: Boolean(target && hits[0]?.object === surface), first: hits[0], target};
}

function describeObject(object) {
  if (!object) return 'no intersection';
  const identity = object.userData.screen ? `screen:${object.userData.screen}`
    : object.userData.action ? `button:${object.userData.action}`
    : object.name || object.geometry?.type || object.type;
  const parameters = object.geometry?.parameters || {};
  const size = ['width', 'height', 'depth'].filter(key => key in parameters)
    .map(key => `${key}=${Number(parameters[key]).toFixed(3)}`).join(',');
  const position = new T.Vector3().setFromMatrixPosition(object.matrixWorld).toArray()
    .map(n => n.toFixed(3)).join(',');
  return `${identity}${size ? ` [${size}]` : ''} at (${position})`;
}

const gridCoordinate = (index, count) => EDGE_INSET + index / (count - 1) * (1 - 2 * EDGE_INSET);
const percent = value => `${(value * 100).toFixed(2)}%`;

function gridOcclusions(viewer, eye, surface) {
  const blocked = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let column = 0; column < GRID_COLUMNS; column++) {
      const u = gridCoordinate(column, GRID_COLUMNS), v = gridCoordinate(row, GRID_ROWS);
      const result = castToSurface(viewer, eye, surface, surfacePoint(surface, u, v));
      if (!result.clear) blocked.push({row, column, u, v, ...result});
    }
  }
  return blocked;
}

function occlusionDiagnostic(screenId, eye, blocked) {
  const lines = [`${screenId} / ${eye.name}: ${blocked.length}/${GRID_COLUMNS * GRID_ROWS} blocked samples`,
    '  UV: u increases left to right; v increases bottom to top. These are occlusion rays, not viewport tests.'];
  for (let row = 0; row < GRID_ROWS; row++) {
    const samples = blocked.filter(sample => sample.row === row);
    if (!samples.length) continue;
    const runs = [];
    for (const sample of samples) {
      const last = runs.at(-1);
      if (last && sample.column === last.at(-1).column + 1) last.push(sample);
      else runs.push([sample]);
    }
    lines.push(`  row ${row}, v=${percent(samples[0].v)}: blocked u ${runs.map(run =>
      run.length === 1 ? percent(run[0].u) : `${percent(run[0].u)}..${percent(run.at(-1).u)}`).join(', ')}`);
  }
  const blockers = new Map();
  for (const sample of blocked) {
    const description = describeObject(sample.first?.object);
    blockers.set(description, (blockers.get(description) || 0) + 1);
  }
  for (const [description, count] of blockers) lines.push(`  ${count} nearest hits: ${description}`);
  const missing = blocked.filter(sample => !sample.target).length;
  if (missing) lines.push(`  ${missing} rays did not intersect the tagged target surface at all`);
  return lines.join('\n');
}

test('world-point occlusion probe detects blockers and cannot pass a missing target', () => {
  const room = new T.Group();
  const surface = new T.Mesh(new T.PlaneGeometry(2, 1), new T.MeshBasicMaterial());
  surface.position.set(8, 0, -4); // Intentionally off-axis: this is not a frustum test.
  const blockerParent = new T.Group();
  const blocker = new T.Mesh(new T.BoxGeometry(0.4, 0.4, 0.1), new T.MeshBasicMaterial());
  blocker.position.set(4, 0, -2);
  blockerParent.add(blocker);
  room.add(surface, blockerParent);
  const eye = {origin: new T.Vector3(), layers: 1};
  const point = surface.position.clone();
  try {
    room.updateMatrixWorld(true);
    assert.equal(castToSurface({room}, eye, surface, point).first?.object, blocker);
    assert.equal(castToSurface({room}, eye, surface, point).clear, false);
    blockerParent.visible = false;
    assert.equal(castToSurface({room}, eye, surface, point).clear, true,
      'An invisible ancestor must hide a would-be blocker');
    surface.visible = false;
    assert.equal(castToSurface({room}, eye, surface, point).clear, false,
      'A hidden target is not a clear view');
    room.remove(surface);
    assert.equal(castToSurface({room}, eye, surface, point).clear, false,
      'No intersections must not count as success');
  } finally {
    for (const mesh of [surface, blocker]) { mesh.geometry.dispose(); mesh.material.dispose(); }
  }
});

for (const id of SCREEN_IDS) {
  test(`${id}: full surface grid is unoccluded from center and both stereo eyes (not framing)`, t => {
    withViewer(viewer => {
      const surface = screenSurfaces(viewer).get(id);
      const diagnostics = [];
      for (const eye of operatorEyes(viewer)) {
        const blocked = gridOcclusions(viewer, eye, surface);
        if (blocked.length) diagnostics.push(occlusionDiagnostic(id, eye, blocked));
      }
      assert.equal(diagnostics.length, 0, diagnostics.join('\n\n'));
      t.diagnostic(`${GRID_COLUMNS}x${GRID_ROWS} UV samples x 3 operator eyes = ${GRID_COLUMNS * GRID_ROWS * 3} clear world-point rays`);
    });
  });
}

test('all six physical button centers are unoccluded for three eyes and pickable without re-aiming', () => {
  withViewer(viewer => {
    // Utility actions may grow independently; only these six records are the
    // physical playout keys whose unobstructed centers are part of this contract.
    const physical = viewer.buttons.filter(button => CONTROL_IDS.includes(button.id));
    assert.deepEqual(physical.map(button => button.id).sort(), [...CONTROL_IDS].sort());
    const diagnostics = [];
    const eyes = operatorEyes(viewer);
    for (const button of physical) {
      assert.equal(button.face.userData.action, button.id);
      const center = surfacePoint(button.face, 0.5, 0.5);
      for (const eye of eyes) {
        const result = castToSurface(viewer, eye, button.face, center);
        if (!result.clear) diagnostics.push(`${button.id} / ${eye.name}: center blocked by ${describeObject(result.first?.object)}`);
      }
      const ndc = center.clone().project(viewer.camera);
      if (!ndc.toArray().every(Number.isFinite) || Math.max(Math.abs(ndc.x), Math.abs(ndc.y), Math.abs(ndc.z)) > 1 + 1e-7) {
        diagnostics.push(`${button.id}: default-desktop center is outside the viewport, NDC ${ndc.toArray().join(', ')}`);
      }
      // Projection into the unchanged production camera exercises real picking;
      // aiming the camera at each button would conceal a framing regression.
      const picked = viewer.pick(ndc.x, ndc.y);
      if (picked?.action !== button.id || picked?.key !== button.id) {
        diagnostics.push(`${button.id}: Viewer.pick returned ${JSON.stringify(picked)} instead of the physical button`);
      }
    }
    assert.equal(diagnostics.length, 0, diagnostics.join('\n'));
  });
});

for (const {label, width, height} of [
  {label: '4:3', width: 1200, height: 900},
  {label: '16:10', width: 1440, height: 900},
  {label: '16:9', width: 1600, height: 900},
  {label: '21:9', width: 2100, height: 900},
]) {
  test(`default desktop ${label}: every screen corner is framed without moving the camera`, () => {
    withViewer(viewer => {
      operatorEyes(viewer);
      const diagnostics = [];
      for (const [id, surface] of screenSurfaces(viewer)) {
        for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
          const worldPoint = surfacePoint(surface, u, v);
          const ndc = worldPoint.clone().project(viewer.camera);
          const depth = worldPoint.clone().applyMatrix4(viewer.camera.matrixWorldInverse).z;
          if (!ndc.toArray().every(Number.isFinite) || depth >= 0 ||
              Math.max(Math.abs(ndc.x), Math.abs(ndc.y), Math.abs(ndc.z)) > 1 + 1e-7) {
            diagnostics.push(`${id} corner UV (${u},${v}) outside default ${label} viewport: ` +
              `NDC (${ndc.toArray().map(n => n.toFixed(5)).join(',')}), camera-space z=${depth.toFixed(5)}, fov=${viewer.camera.fov}`);
          }
        }
      }
      assert.equal(diagnostics.length, 0, diagnostics.join('\n'));
    }, width, height);
  });
}
