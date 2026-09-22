import test from 'node:test';
import assert from 'node:assert/strict';
import { Euler, Quaternion, Vector3 } from '../vendor/three.module.js';
import { HeadTracker, orientationToQuaternion, yawRecenterOffset } from '../src/orientation.js';

const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
const forward = (quaternion) => new Vector3(0, 0, -1).applyQuaternion(quaternion);
const up = (quaternion) => new Vector3(0, 1, 0).applyQuaternion(quaternion);

function near(actual, expected, tolerance = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be near ${expected}`);
}

function vectorNear(actual, expected) {
  near(actual.x, expected[0]);
  near(actual.y, expected[1]);
  near(actual.z, expected[2]);
}

function assertUnit(quaternion) {
  assert.ok(quaternion instanceof Quaternion);
  assert.ok(quaternion.toArray().every(Number.isFinite));
  near(quaternion.length(), 1, 1e-12);
}

// THREE's slerp can stop once the dot product rounds to 1, leaving ~1e-8
// component error. This tolerance still resolves rotations far below a pixel.
function rotationNear(actual, expected, tolerance = 1e-7) {
  assertUnit(actual);
  const a = actual.toArray();
  const b = expected.clone().normalize().toArray();
  const same = Math.hypot(...a.map((value, index) => value - b[index]));
  const opposite = Math.hypot(...a.map((value, index) => value + b[index]));
  assert.ok(Math.min(same, opposite) <= tolerance, `${a} should represent the same rotation as ${b}`);
}

class FakeEventTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type, event = {}) {
    for (const listener of [...(this.listeners.get(type) || [])]) listener(event);
  }

  count(type) {
    return this.listeners.get(type)?.size || 0;
  }
}

function fakeBrowser({ secure = true, supported = true, permission, screenAngle = 0, legacyAngle = 0 } = {}) {
  const browser = new FakeEventTarget();
  const screenOrientation = new FakeEventTarget();
  screenOrientation.angle = screenAngle;
  browser.screen = { orientation: screenOrientation };
  browser.orientation = legacyAngle;
  browser.isSecureContext = secure;
  browser.location = { protocol: 'https:', hostname: 'example.test' };
  if (supported) {
    browser.DeviceOrientationEvent = class {};
    if (permission) browser.DeviceOrientationEvent.requestPermission = permission;
  }
  const timers = new Map();
  const scheduled = [];
  let timerId = 0;
  browser.setTimeout = (callback, delay) => {
    const id = ++timerId;
    timers.set(id, callback);
    scheduled.push({ id, callback, delay });
    return id;
  };
  browser.clearTimeout = (id) => timers.delete(id);
  return {
    browser,
    screenOrientation,
    timers,
    scheduled,
    emit: (event) => browser.emit('deviceorientation', event),
    fireWatchdog() {
      for (const [id, callback] of [...timers]) {
        timers.delete(id);
        callback();
      }
    },
  };
}

async function withWindow(browser, run) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: browser });
  try {
    return await run();
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else delete globalThis.window;
  }
}

async function withTracker(options, run) {
  const environment = fakeBrowser(options);
  return withWindow(environment.browser, async () => {
    const statuses = [];
    const tracker = new HeadTracker({ onStatus: (status) => statuses.push(status) });
    try {
      return await run({ ...environment, tracker, statuses });
    } finally {
      tracker.dispose();
    }
  });
}

function settle(tracker, quaternion = new Quaternion()) {
  for (let frame = 0; frame < 180; frame++) assert.equal(tracker.update(quaternion, 1 / 60), true);
  return quaternion;
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('module imports and tracker constructs/enables without browser globals', async () => {
  await withWindow(undefined, async () => {
    const tracker = new HeadTracker();
    assert.equal(tracker.enabled, false);
    assert.equal(tracker.hasReading, false);
    assert.equal(tracker.status, 'off');
    rotationNear(tracker.cameraQuaternion, new Quaternion());
    const camera = new Quaternion().setFromAxisAngle(Y, 0.4);
    const before = camera.clone();
    assert.equal(tracker.update(camera, 1 / 60), false);
    rotationNear(camera, before);
    assert.equal((await tracker.enable()).ok, false);
    assert.equal(tracker.status, 'unsupported');
    tracker.recenter();
    tracker.disable();
    tracker.dispose();
    tracker.dispose();
  });
});

test('canonical portrait poses: upright is identity and a flat phone looks down', () => {
  rotationNear(orientationToQuaternion(0, 90, 0), new Quaternion());
  vectorNear(forward(orientationToQuaternion(0, 0, 0)), [0, -1, 0]);
  vectorNear(up(orientationToQuaternion(0, 0, 0)), [0, 0, -1]);
  vectorNear(forward(orientationToQuaternion(90, 90, 0)), [-1, 0, 0]);
  vectorNear(up(orientationToQuaternion(90, 90, 0)), [0, 1, 0]);
});

test('beta 90 / gamma 0 / screen 90 applies the canonical landscape roll', () => {
  const landscape = orientationToQuaternion(0, 90, 0, 90);
  rotationNear(landscape, new Quaternion().setFromAxisAngle(Z, -Math.PI / 2));
  vectorNear(forward(landscape), [0, 0, -1]);
  vectorNear(up(landscape), [1, 0, 0]);
  vectorNear(up(orientationToQuaternion(0, 90, 0, -90)), [-1, 0, 0]);
  rotationNear(orientationToQuaternion(0, 90, 0, 270), orientationToQuaternion(0, 90, 0, -90));
});

test('physical landscape poses and wrapped angles produce the expected rotation', () => {
  rotationNear(orientationToQuaternion(90, 0, -90, 90), new Quaternion());
  rotationNear(orientationToQuaternion(270, 0, 90, -90), new Quaternion());
  rotationNear(orientationToQuaternion(450, 90, 0, 450), orientationToQuaternion(90, 90, 0, 90));
  rotationNear(orientationToQuaternion(null, 90, 0), orientationToQuaternion(0, 90, 0));
});

test('pure conversion stays finite and normalized across bounded and malformed inputs', () => {
  for (let alpha = 0; alpha <= 360; alpha += 45) {
    for (let beta = -180; beta <= 180; beta += 45) {
      for (let gamma = -90; gamma <= 90; gamma += 45) {
        for (const screen of [-90, 0, 90, 180, 270]) assertUnit(orientationToQuaternion(alpha, beta, gamma, screen));
      }
    }
  }
  for (const args of [
    [], [null, null, null, null], [NaN, Infinity, -Infinity, NaN],
    ['90', {}, undefined, []], [Number.MAX_VALUE, -Number.MAX_VALUE, Number.MAX_VALUE, -Number.MAX_VALUE],
  ]) assertUnit(orientationToQuaternion(...args));
});

test('yaw-only recenter preserves pitch/roll and does not mutate its input', () => {
  for (const yaw of [-3.13, -1.2, 0, 1.1, 3.13]) {
    const pose = new Quaternion().setFromEuler(new Euler(0.4, yaw, -0.35, 'YXZ'));
    const before = pose.clone();
    const offset = yawRecenterOffset(pose);
    const centered = offset.clone().multiply(pose);
    rotationNear(pose, before);
    rotationNear(centered, new Quaternion().setFromEuler(new Euler(0.4, 0, -0.35, 'YXZ')));
    near(offset.x, 0);
    near(offset.z, 0);
    near(forward(centered).x, 0);
    assert.ok(forward(centered).z < 0);
    near(forward(centered).y, forward(pose).y);
    near(up(centered).y, up(pose).y);
  }
});

test('recenter helper is finite at vertical directions and invalid quaternions', () => {
  for (const pitch of [-Math.PI / 2, Math.PI / 2]) {
    const vertical = new Quaternion().setFromEuler(new Euler(pitch, 1.2, 0.5, 'YXZ'));
    rotationNear(yawRecenterOffset(vertical), new Quaternion());
  }
  rotationNear(yawRecenterOffset(new Quaternion(NaN, 0, 0, 1)), new Quaternion());
  rotationNear(yawRecenterOffset(new Quaternion(0, 0, 0, 0)), new Quaternion());
});

test('insecure LAN HTTP is reported before permission or sensor support checks', async () => {
  for (const supported of [false, true]) {
    let requests = 0;
    await withTracker({ secure: false, supported, permission: () => { requests++; return 'granted'; } }, async ({ tracker, browser, scheduled, statuses }) => {
      const result = await tracker.enable();
      assert.equal(result.ok, false);
      assert.match(result.message, /HTTPS/);
      assert.match(result.message, /LAN HTTP/);
      assert.equal(tracker.status, 'insecure');
      assert.equal(tracker.enabled, false);
      assert.equal(browser.count('deviceorientation'), 0);
      assert.equal(scheduled.length, 0);
      assert.deepEqual(statuses, [{ state: 'insecure', message: result.message }]);
      assert.equal(requests, 0);
    });
  }
});

test('legacy secure-context detection rejects LAN HTTP but permits local development', async () => {
  await withTracker({}, async ({ tracker, browser }) => {
    delete browser.isSecureContext;
    browser.location = { protocol: 'http:', hostname: '192.168.1.20' };
    assert.equal((await tracker.enable()).ok, false);
    assert.equal(tracker.status, 'insecure');
    browser.location.hostname = 'localhost';
    assert.equal((await tracker.enable()).ok, true);
    assert.equal(tracker.status, 'waiting');
  });
});

test('a secure browser without DeviceOrientationEvent reports unsupported', async () => {
  await withTracker({ supported: false }, async ({ tracker, browser, scheduled }) => {
    assert.equal((await tracker.enable()).ok, false);
    assert.equal(tracker.status, 'unsupported');
    assert.equal(tracker.enabled, false);
    assert.equal(browser.count('deviceorientation'), 0);
    assert.equal(scheduled.length, 0);
  });
});

test('permission is requested in the gesture stack and concurrent enables share one request', async () => {
  const permission = deferred();
  let requests = 0;
  await withTracker({ permission: () => { requests++; return permission.promise; } }, async ({ tracker, browser, screenOrientation, scheduled }) => {
    const first = tracker.enable();
    assert.equal(requests, 1, 'requestPermission must run before enable yields');
    const second = tracker.enable();
    assert.equal(requests, 1);
    assert.equal(tracker.enabled, false);
    assert.equal(tracker.status, 'waiting');
    assert.equal(browser.count('deviceorientation'), 0);
    assert.equal(scheduled.length, 0);
    permission.resolve('granted');
    assert.equal((await first).ok, true);
    assert.equal((await second).ok, true);
    assert.equal((await tracker.enable()).ok, true);
    assert.equal(requests, 1);
    assert.equal(browser.count('deviceorientation'), 1);
    assert.equal(browser.count('orientationchange'), 1);
    assert.equal(screenOrientation.count('change'), 1);
    assert.equal(scheduled.length, 1);
    assert.equal(scheduled[0].delay, 2500);
  });
});

test('denied, rejected, and synchronously blocked permission requests fail cleanly', async () => {
  for (const permission of [
    () => Promise.resolve('denied'),
    () => Promise.reject(new Error('permission blocked')),
    () => { throw new Error('not a user gesture'); },
  ]) {
    await withTracker({ permission }, async ({ tracker, browser, screenOrientation, scheduled }) => {
      const result = await tracker.enable();
      assert.equal(result.ok, false);
      assert.match(result.message, /permission was denied or blocked/);
      assert.equal(tracker.status, 'denied');
      assert.equal(tracker.enabled, false);
      assert.equal(tracker.hasReading, false);
      assert.equal(browser.count('deviceorientation'), 0);
      assert.equal(screenOrientation.count('change'), 0);
      assert.equal(scheduled.length, 0);
    });
  }
});

test('one 2500 ms watchdog reports no data and still permits later valid readings', async () => {
  await withTracker({}, async ({ tracker, emit, timers, scheduled, statuses, fireWatchdog }) => {
    assert.equal((await tracker.enable()).ok, true);
    assert.equal(tracker.enabled, true);
    assert.equal(tracker.hasReading, false);
    assert.equal(tracker.status, 'waiting');
    assert.equal(tracker.update(new Quaternion(), 1 / 60), false);
    fireWatchdog();
    assert.equal(tracker.message, 'No sensor readings — drag to look or use a supported HTTPS browser');
    assert.equal(tracker.status, 'waiting');
    assert.equal(tracker.enabled, true);
    assert.equal(timers.size, 0);
    assert.equal(scheduled.length, 1);
    emit({ alpha: 137, beta: 90, gamma: 0 });
    assert.equal(tracker.hasReading, true);
    assert.equal(tracker.status, 'tracking');
    rotationNear(settle(tracker), new Quaternion());
    emit({ alpha: 138, beta: 90, gamma: 0 });
    assert.equal(statuses.filter(({ state }) => state === 'tracking').length, 1);
    assert.equal(scheduled.length, 1, 'readings must not start recurring timers');
  });
});

test('sensor samples reject nonnumeric, nonfinite, and out-of-range angles', async () => {
  await withTracker({}, async ({ tracker, emit, timers }) => {
    await tracker.enable();
    const valid = { alpha: 0, beta: 90, gamma: 0 };
    const invalidSamples = [
      { alpha: NaN }, { alpha: Infinity }, { alpha: -0.01 }, { alpha: 360.01 }, { alpha: '0' },
      { beta: null }, { beta: undefined }, { beta: '90' }, { beta: NaN }, { beta: -180.01 }, { beta: 180.01 },
      { gamma: null }, { gamma: NaN }, { gamma: Infinity }, { gamma: -90.01 }, { gamma: 90.01 }, { gamma: true },
    ];
    for (const invalid of invalidSamples) {
      emit({ ...valid, ...invalid });
      assert.equal(tracker.hasReading, false, JSON.stringify(invalid));
      assert.equal(tracker.update(new Quaternion(), 1 / 60), false);
    }
    assert.equal(timers.size, 1);
    emit(valid);
    assert.equal(tracker.hasReading, true);
    assert.equal(timers.size, 0);
    const before = settle(tracker);
    emit({ ...valid, alpha: 1e12 });
    rotationNear(settle(tracker), before, 1e-12);
    for (const sample of [
      { alpha: 360, beta: -180, gamma: -90 },
      { alpha: 0, beta: 180, gamma: 90 },
    ]) {
      emit(sample);
      assertUnit(settle(tracker));
    }
  });
});

test('null alpha falls back to zero initially and the last valid alpha subsequently', async () => {
  await withTracker({}, async ({ tracker, emit }) => {
    await tracker.enable();
    emit({ alpha: null, beta: 90, gamma: 0 });
    rotationNear(settle(tracker), new Quaternion());
    emit({ alpha: 30, beta: 90, gamma: 0 });
    rotationNear(settle(tracker), orientationToQuaternion(30, 90, 0));
    emit({ alpha: null, beta: 60, gamma: 12 });
    rotationNear(settle(tracker), orientationToQuaternion(30, 60, 12));
    emit({ beta: 60, gamma: 12 });
    rotationNear(settle(tracker), orientationToQuaternion(30, 60, 12));
    assert.equal(tracker.status, 'tracking');
  });
});

test('screen.orientation.angle takes priority and screen changes reuse the last sample', async () => {
  await withTracker({ screenAngle: 90, legacyAngle: -90 }, async ({ tracker, emit, browser, screenOrientation }) => {
    await tracker.enable();
    emit({ alpha: 0, beta: 90, gamma: 0 });
    rotationNear(settle(tracker), orientationToQuaternion(0, 90, 0, 90));
    screenOrientation.angle = 0;
    screenOrientation.emit('change');
    rotationNear(settle(tracker), new Quaternion());
    screenOrientation.angle = NaN;
    browser.emit('orientationchange');
    rotationNear(settle(tracker), orientationToQuaternion(0, 90, 0, -90));
    browser.orientation = undefined;
    browser.emit('orientationchange');
    rotationNear(settle(tracker), new Quaternion());
  });
});

test('legacy window.orientation works without the Screen Orientation API', async () => {
  await withTracker({ legacyAngle: -90 }, async ({ tracker, emit, browser, screenOrientation }) => {
    delete browser.screen;
    await tracker.enable();
    assert.equal(screenOrientation.count('change'), 0);
    emit({ alpha: 0, beta: 90, gamma: 0 });
    rotationNear(settle(tracker), orientationToQuaternion(0, 90, 0, -90));
    browser.orientation = 180;
    browser.emit('orientationchange');
    rotationNear(settle(tracker), orientationToQuaternion(0, 90, 0, 180));
  });
});

test('first reading auto-centers yaw; manual recenter preserves nonzero tilt/roll', async () => {
  await withTracker({}, async ({ tracker, emit }) => {
    await tracker.enable();
    const initial = orientationToQuaternion(27, 65, 15);
    const current = orientationToQuaternion(117, 65, 15);
    emit({ alpha: 27, beta: 65, gamma: 15 });
    rotationNear(settle(tracker), yawRecenterOffset(initial).multiply(initial));
    emit({ alpha: 117, beta: 65, gamma: 15 });
    const before = settle(tracker);
    rotationNear(before, yawRecenterOffset(initial).multiply(current));
    tracker.recenter();
    const after = settle(tracker, before.clone());
    rotationNear(after, yawRecenterOffset(current).multiply(current));
    near(forward(after).x, 0, 1e-7);
    assert.ok(forward(after).z < 0);
    near(forward(after).y, forward(before).y, 1e-7);
    near(up(after).y, up(before).y, 1e-7);
    assert.ok(Math.abs(forward(after).y) > 0.1, 'recenter must not erase pitch');
    assert.ok(Math.abs(after.z) > 0.01, 'recenter must not erase roll');
    rotationNear(tracker.cameraQuaternion, after);
  });
});

test('vertical recenter keeps the old offset until forward heading becomes defined', async () => {
  await withTracker({}, async ({ tracker, emit }) => {
    await tracker.enable();
    emit({ alpha: 30, beta: 90, gamma: 0 });
    emit({ alpha: 110, beta: 0, gamma: 0 });
    const vertical = settle(tracker);
    tracker.recenter();
    rotationNear(settle(tracker, vertical.clone()), vertical);
    emit({ alpha: 110, beta: 90, gamma: 0 });
    rotationNear(settle(tracker), new Quaternion());
    tracker.disable();
    await tracker.enable();
    emit({ alpha: 137, beta: 0, gamma: 0 });
    assertUnit(settle(tracker));
    emit({ alpha: 137, beta: 90, gamma: 0 });
    rotationNear(settle(tracker), new Quaternion());
  });
});

test('update uses smooth, frame-rate-independent slerp with finite delta safeguards', async () => {
  await withTracker({}, async ({ tracker, emit }) => {
    await tracker.enable();
    emit({ alpha: 0, beta: 90, gamma: 0 });
    emit({ alpha: 90, beta: 90, gamma: 0 });
    const once = new Quaternion();
    const twice = new Quaternion();
    tracker.update(once, 1 / 30);
    tracker.update(twice, 1 / 60);
    tracker.update(twice, 1 / 60);
    rotationNear(once, twice, 1e-12);
    assert.ok(once.angleTo(new Quaternion()) > 0);
    assert.ok(once.angleTo(orientationToQuaternion(90, 90, 0)) > 0.1);
    const unchanged = twice.clone();
    assert.equal(tracker.update(twice, 0), true);
    rotationNear(twice, unchanged, 1e-12);
    tracker.update(twice, -1);
    rotationNear(twice, unchanged, 1e-12);
    for (const delta of [undefined, NaN, Infinity, Number.MAX_VALUE]) {
      assert.equal(tracker.update(twice, delta), true);
      assertUnit(twice);
    }
    const invalidCamera = new Quaternion(NaN, Infinity, 0, 0);
    assert.equal(tracker.update(invalidCamera, 1 / 60), true);
    assertUnit(invalidCamera);
    rotationNear(tracker.cameraQuaternion, invalidCamera);
  });
});

test('disable/dispose remove every listener and timer, and repeated calls are safe', async () => {
  await withTracker({}, async ({ tracker, emit, browser, screenOrientation, timers, scheduled }) => {
    await tracker.enable();
    assert.equal(timers.size, 1);
    tracker.disable();
    tracker.disable();
    assert.equal(timers.size, 0);
    assert.equal(browser.count('deviceorientation'), 0);
    assert.equal(browser.count('orientationchange'), 0);
    assert.equal(screenOrientation.count('change'), 0);
    emit({ alpha: 50, beta: 90, gamma: 0 });
    assert.equal(tracker.hasReading, false);
    assert.equal((await tracker.enable()).ok, true);
    assert.equal(browser.count('deviceorientation'), 1);
    assert.equal(scheduled.length, 2);
    emit({ alpha: 50, beta: 90, gamma: 0 });
    const camera = settle(tracker);
    const before = camera.clone();
    tracker.disable();
    assert.equal(tracker.status, 'off');
    assert.equal(tracker.hasReading, false);
    assert.equal(tracker.update(camera, 1), false);
    rotationNear(camera, before);
    rotationNear(tracker.cameraQuaternion, before);
    tracker.dispose();
    tracker.dispose();
    assert.equal((await tracker.enable()).ok, false);
    assert.equal(browser.count('deviceorientation'), 0);
    assert.equal(screenOrientation.count('change'), 0);
    assert.equal(timers.size, 0);
  });
});

test('a stale watchdog cannot overwrite a new session or hide its timer from cleanup', async () => {
  await withTracker({}, async ({ tracker, scheduled, timers }) => {
    await tracker.enable();
    const stale = scheduled[0].callback;
    tracker.disable();
    await tracker.enable();
    const waitingMessage = tracker.message;
    stale();
    assert.equal(tracker.message, waitingMessage);
    assert.equal(timers.size, 1);
    tracker.disable();
    assert.equal(timers.size, 0);
  });
});

test('disable settles a pending permission attempt and stale permission cannot reattach', async () => {
  const oldPermission = deferred();
  const newPermission = deferred();
  let requests = 0;
  await withTracker({ permission: () => (++requests === 1 ? oldPermission.promise : newPermission.promise) }, async ({ tracker, browser, scheduled }) => {
    const oldEnable = tracker.enable();
    tracker.disable();
    assert.equal((await oldEnable).ok, false);
    assert.equal(tracker.status, 'off');
    const newEnable = tracker.enable();
    oldPermission.resolve('granted');
    await Promise.resolve();
    assert.equal(tracker.enabled, false);
    assert.equal(browser.count('deviceorientation'), 0);
    assert.equal(scheduled.length, 0);
    newPermission.resolve('granted');
    assert.equal((await newEnable).ok, true);
    assert.equal(browser.count('deviceorientation'), 1);
    assert.equal(scheduled.length, 1);
  });
});

test('dispose during a permission request prevents late listeners and status callbacks', async () => {
  const permission = deferred();
  await withTracker({ permission: () => permission.promise }, async ({ tracker, browser, scheduled, statuses }) => {
    const enabling = tracker.enable();
    tracker.dispose();
    assert.equal((await enabling).ok, false);
    const countAfterDisposal = statuses.length;
    permission.reject(new Error('dialog closed after disposal'));
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(tracker.enabled, false);
    assert.equal(tracker.status, 'off');
    assert.equal(browser.count('deviceorientation'), 0);
    assert.equal(scheduled.length, 0);
    assert.equal(statuses.length, countAfterDisposal);
    assert.equal((await tracker.enable()).ok, false);
  });
});

test('a partial listener-attachment failure is reported and cleaned up', async () => {
  await withTracker({}, async ({ tracker, browser, screenOrientation, timers }) => {
    const add = browser.addEventListener.bind(browser);
    browser.addEventListener = (type, listener) => {
      if (type === 'orientationchange') throw new Error('listener unavailable');
      add(type, listener);
    };
    assert.equal((await tracker.enable()).ok, false);
    assert.equal(tracker.status, 'unsupported');
    assert.equal(tracker.enabled, false);
    assert.equal(browser.count('deviceorientation'), 0);
    assert.equal(browser.count('orientationchange'), 0);
    assert.equal(screenOrientation.count('change'), 0);
    assert.equal(timers.size, 0);
  });
});

test('throwing status observers do not break tracking or disposal', async () => {
  const environment = fakeBrowser();
  await withWindow(environment.browser, async () => {
    const tracker = new HeadTracker({ onStatus: () => { throw new Error('UI observer failed'); } });
    try {
      assert.equal((await tracker.enable()).ok, true);
      environment.emit({ alpha: 0, beta: 90, gamma: 0 });
      assert.equal(tracker.status, 'tracking');
      assert.equal(tracker.update(), true);
      assertUnit(tracker.cameraQuaternion);
    } finally {
      assert.doesNotThrow(() => tracker.dispose());
    }
    assert.equal(environment.browser.count('deviceorientation'), 0);
    assert.equal(environment.timers.size, 0);
  });
});

test('status observers can dispose synchronously without leaving attached listeners', async () => {
  const environment = fakeBrowser();
  await withWindow(environment.browser, async () => {
    const tracker = new HeadTracker({ onStatus: ({ state }) => { if (state === 'waiting') tracker.dispose(); } });
    assert.equal((await tracker.enable()).ok, false);
    assert.equal(tracker.enabled, false);
    assert.equal(tracker.status, 'off');
    assert.equal(environment.browser.count('deviceorientation'), 0);
    assert.equal(environment.screenOrientation.count('change'), 0);
    assert.equal(environment.timers.size, 0);
    tracker.dispose();
  });
});
