import { Euler, Quaternion, Vector3 } from '../vendor/three.module.js';

const WORLD_UP = new Vector3(0, 1, 0);
const SCREEN_NORMAL = new Vector3(0, 0, 1);
const CAMERA_ALIGNMENT = new Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2);
const WATCHDOG_MS = 2500;
// Keep just enough filtering to calm sensor noise without the long visual lag
// that makes phone VR uncomfortable during head turns.
const SMOOTHING_RATE = 45;
const DEFAULT_DELTA_SECONDS = 1 / 60;
const MAX_DELTA_SECONDS = 0.1;

const MESSAGES = {
  off: 'Head tracking off — drag to look',
  permission: 'Allow motion and orientation access to enable head tracking',
  waiting: 'Waiting for motion sensor readings…',
  tracking: 'Head tracking active',
  denied: 'Motion permission was denied or blocked — allow motion and orientation access in browser settings, then tap Enable again, or drag to look',
  insecure: 'Motion sensors require a secure context — mobile LAN HTTP is not supported. Open a trusted HTTPS URL, or drag to look',
  unsupported: 'Device orientation is not supported by this browser — drag to look instead',
  noReadings: 'No sensor readings — drag to look or use a supported HTTPS browser',
  disposed: 'This head tracker has been disposed',
};

// Wrapping before conversion also keeps very large, finite arguments finite.
function radians(degrees) {
  return Number.isFinite(degrees) ? (degrees % 360) * Math.PI / 180 : 0;
}

/**
 * Canonical Three.js DeviceOrientationControls conversion. Device angles are
 * degrees; the camera looks down local -Z. The final local-Z rotation accounts
 * for portrait/landscape screen orientation (including legacy -90 degrees).
 *
 * This function never accesses browser globals or mutates its arguments.
 * Missing/non-finite angles become zero; the live tracker validates sensor
 * ranges separately, rather than turning invalid events into camera movement.
 */
export function orientationToQuaternion(alphaDegrees, betaDegrees, gammaDegrees, screenAngleDegrees = 0) {
  const euler = new Euler(radians(betaDegrees), radians(alphaDegrees), -radians(gammaDegrees), 'YXZ');
  const screenRotation = new Quaternion().setFromAxisAngle(SCREEN_NORMAL, -radians(screenAngleDegrees));
  return new Quaternion().setFromEuler(euler).multiply(CAMERA_ALIGNMENT).multiply(screenRotation).normalize();
}

function isUsableQuaternion(quaternion) {
  if (!quaternion || ![quaternion.x, quaternion.y, quaternion.z, quaternion.w].every(Number.isFinite)) return false;
  const lengthSquared = quaternion.x ** 2 + quaternion.y ** 2 + quaternion.z ** 2 + quaternion.w ** 2;
  return Number.isFinite(lengthSquared) && lengthSquared > 0;
}

function forwardHeading(quaternion) {
  if (!isUsableQuaternion(quaternion)) return null;
  const unit = new Quaternion(quaternion.x, quaternion.y, quaternion.z, quaternion.w).normalize();
  const forward = new Vector3(0, 0, -1).applyQuaternion(unit);
  // Heading is undefined when looking straight up/down. Do not derive yaw from
  // roll at this singularity: keep the tracker's previous yaw offset instead.
  if (forward.x ** 2 + forward.z ** 2 < 1e-8) return null;
  return Math.atan2(-forward.x, -forward.z);
}

/**
 * Return a world-Y-only correction that centers the camera's forward heading.
 * Left-multiply it onto the input quaternion; pitch and roll are preserved.
 * A vertical forward direction (or an invalid quaternion) returns identity.
 */
export function yawRecenterOffset(quaternion) {
  return new Quaternion().setFromAxisAngle(WORLD_UP, -(forwardHeading(quaternion) ?? 0));
}

function isInsecure(browser) {
  if (typeof browser.isSecureContext === 'boolean') return !browser.isSecureContext;
  // Older engines may omit isSecureContext. Still explain LAN HTTP rather than
  // misdiagnosing its hidden/restricted sensor API as missing hardware.
  const location = browser.location;
  if (location?.protocol !== 'http:') return false;
  const hostname = (location.hostname || '').toLowerCase();
  return !['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname) && !hostname.endsWith('.localhost');
}

function validAngle(value, minimum, maximum) {
  return Number.isFinite(value) && value >= minimum && value <= maximum;
}

/**
 * Owns only sensor listeners and one initial-reading watchdog, not input/UI.
 * `status` is the state code; `message` is its human-readable description.
 * `cameraQuaternion` is the most recent smoothed result of update().
 */
export class HeadTracker {
  constructor({ onStatus } = {}) {
    this.enabled = false;
    this.status = 'off';
    this.message = MESSAGES.off;
    this.hasReading = false;
    this.cameraQuaternion = new Quaternion();

    this._onStatus = typeof onStatus === 'function' ? onStatus : null;
    this._sensorQuaternion = new Quaternion();
    this._yawOffset = new Quaternion();
    this._targetQuaternion = new Quaternion();
    this._sample = null;
    this._lastAlpha = 0;
    this._needsRecenter = true;
    this._browser = null;
    this._screenOrientation = null;
    this._deviceListening = false;
    this._legacyScreenListening = false;
    this._screenListening = false;
    this._watchdog = null;
    this._generation = 0;
    this._pendingEnable = null;
    this._disposed = false;
    this._handleOrientation = (event) => this._receiveOrientation(event);
    this._handleScreenChange = () => {
      if (this.enabled && this.hasReading) this._refreshOrientation();
    };
  }

  /** Invoke directly from a user gesture, before awaiting unrelated work. */
  async enable() {
    if (this._disposed) return { ok: false, message: MESSAGES.disposed };
    if (this.enabled) return { ok: true, message: this.message };
    if (this._pendingEnable) return this._pendingEnable.promise;

    const browser = typeof window === 'undefined' ? null : window;
    if (browser && isInsecure(browser)) {
      this._setStatus('insecure', MESSAGES.insecure);
      return { ok: false, message: MESSAGES.insecure };
    }
    const OrientationEvent = browser?.DeviceOrientationEvent;
    if (!OrientationEvent || typeof browser.addEventListener !== 'function' || typeof browser.removeEventListener !== 'function') {
      this._setStatus('unsupported', MESSAGES.unsupported);
      return { ok: false, message: MESSAGES.unsupported };
    }

    // Install the pending record before invoking permission or status hooks so
    // repeated/reentrant calls share one request. disable() can settle it even
    // if a browser permission dialog has not answered yet.
    const attempt = { generation: ++this._generation, resolve: null, promise: null };
    attempt.promise = new Promise((resolve) => { attempt.resolve = resolve; });
    this._pendingEnable = attempt;
    void this._beginEnable(attempt, browser, OrientationEvent);
    return attempt.promise;
  }

  async _beginEnable(attempt, browser, OrientationEvent) {
    let result = { ok: false, message: MESSAGES.off };
    let requestingPermission = false;
    try {
      if (typeof OrientationEvent.requestPermission === 'function') {
        requestingPermission = true;
        // This invocation occurs synchronously in enable()'s user-gesture stack.
        const permission = OrientationEvent.requestPermission();
        this._setStatus('waiting', MESSAGES.permission);
        const answer = await permission;
        if (!this._isCurrentAttempt(attempt)) return;
        if (answer !== 'granted') {
          this._setStatus('denied', MESSAGES.denied);
          result = { ok: false, message: MESSAGES.denied };
          return;
        }
      }
      if (!this._isCurrentAttempt(attempt)) return;
      requestingPermission = false;
      this._attach(browser);
      if (!this.hasReading) this._setStatus('waiting', MESSAGES.waiting);
      if (this._isCurrentAttempt(attempt) && this.enabled) result = { ok: true, message: this.message };
    } catch {
      if (this._isCurrentAttempt(attempt)) {
        this.enabled = false;
        this.hasReading = false;
        this._detach();
        const state = requestingPermission ? 'denied' : 'unsupported';
        this._setStatus(state, MESSAGES[state]);
        result = { ok: false, message: MESSAGES[state] };
      }
    } finally {
      if (this._pendingEnable === attempt) this._pendingEnable = null;
      attempt.resolve(result);
    }
  }

  _isCurrentAttempt(attempt) {
    return !this._disposed && this._pendingEnable === attempt && this._generation === attempt.generation;
  }

  _attach(browser) {
    this._browser = browser;
    this._sample = null;
    this._lastAlpha = 0;
    this._needsRecenter = true;
    this.hasReading = false;
    this._sensorQuaternion.identity();
    this._yawOffset.identity();
    this._targetQuaternion.identity();
    this.enabled = true;

    this._deviceListening = true;
    browser.addEventListener('deviceorientation', this._handleOrientation, { passive: true });
    this._legacyScreenListening = true;
    browser.addEventListener('orientationchange', this._handleScreenChange);
    const screenOrientation = browser.screen?.orientation;
    if (typeof screenOrientation?.addEventListener === 'function' && typeof screenOrientation.removeEventListener === 'function') {
      this._screenOrientation = screenOrientation;
      this._screenListening = true;
      screenOrientation.addEventListener('change', this._handleScreenChange);
    }
    if (!this.hasReading) {
      const generation = this._generation;
      this._watchdog = browser.setTimeout(() => {
        if (this._generation !== generation || this._browser !== browser) return;
        this._watchdog = null;
        if (this.enabled && !this.hasReading) this._setStatus('waiting', MESSAGES.noReadings);
      }, WATCHDOG_MS);
    }
  }

  _screenAngle() {
    const modernAngle = this._browser?.screen?.orientation?.angle;
    if (Number.isFinite(modernAngle)) return modernAngle;
    const legacyAngle = this._browser?.orientation;
    return Number.isFinite(legacyAngle) ? legacyAngle : 0;
  }

  _receiveOrientation(event) {
    if (!this.enabled || !event) return;
    const { alpha, beta, gamma } = event;
    if (!validAngle(beta, -180, 180) || !validAngle(gamma, -90, 90)) return;
    if (alpha != null && !validAngle(alpha, 0, 360)) return;

    // Null alpha occurs on some devices. Keep the last known heading (zero
    // initially) while still accepting useful beta/gamma tilt measurements.
    this._lastAlpha = alpha ?? this._lastAlpha;
    this._sample = { alpha: this._lastAlpha, beta, gamma };
    this._refreshOrientation();
    this.hasReading = true;
    this._clearWatchdog();
    this._setStatus('tracking', MESSAGES.tracking);
  }

  _refreshOrientation() {
    if (!this._sample) return;
    const { alpha, beta, gamma } = this._sample;
    this._sensorQuaternion.copy(orientationToQuaternion(alpha, beta, gamma, this._screenAngle()));
    if (this._needsRecenter) this._recenterFromSensor();
    this._targetQuaternion.copy(this._yawOffset).multiply(this._sensorQuaternion).normalize();
  }

  _recenterFromSensor() {
    const heading = forwardHeading(this._sensorQuaternion);
    if (heading === null) return;
    this._yawOffset.setFromAxisAngle(WORLD_UP, -heading);
    this._needsRecenter = false;
  }

  /** Change only the world-Y origin; the next updates ease toward that origin. */
  recenter() {
    if (this._disposed) return;
    this._needsRecenter = true;
    if (this.enabled && this.hasReading) {
      this._recenterFromSensor();
      this._targetQuaternion.copy(this._yawOffset).multiply(this._sensorQuaternion).normalize();
    }
  }

  /**
   * Smooth into the caller's THREE.Quaternion with frame-rate-independent
   * exponential slerp. Return false without touching it until data is available.
   * A long paused frame is capped at 100 ms to avoid an abrupt resume jump.
   */
  update(cameraQuaternion = this.cameraQuaternion, deltaSeconds = DEFAULT_DELTA_SECONDS) {
    if (!this.enabled || !this.hasReading) return false;
    const delta = Number.isFinite(deltaSeconds)
      ? Math.max(0, Math.min(deltaSeconds, MAX_DELTA_SECONDS))
      : DEFAULT_DELTA_SECONDS;
    if (!isUsableQuaternion(cameraQuaternion)) {
      cameraQuaternion.copy(this._targetQuaternion);
    } else {
      cameraQuaternion.normalize().slerp(this._targetQuaternion, 1 - Math.exp(-SMOOTHING_RATE * delta)).normalize();
    }
    this.cameraQuaternion.copy(cameraQuaternion);
    return true;
  }

  disable() {
    ++this._generation;
    this.enabled = false;
    this.hasReading = false;
    if (this._pendingEnable) {
      const attempt = this._pendingEnable;
      this._pendingEnable = null;
      attempt.resolve({ ok: false, message: MESSAGES.off });
    }
    this._detach();
    this._sample = null;
    this._lastAlpha = 0;
    this._needsRecenter = true;
    // Keep the last public camera quaternion for a seamless handoff to dragging.
    this._setStatus('off', MESSAGES.off);
  }

  _clearWatchdog() {
    if (this._watchdog !== null) {
      this._browser.clearTimeout(this._watchdog);
      this._watchdog = null;
    }
  }

  _detach() {
    this._clearWatchdog();
    if (this._deviceListening) this._browser.removeEventListener('deviceorientation', this._handleOrientation);
    if (this._legacyScreenListening) this._browser.removeEventListener('orientationchange', this._handleScreenChange);
    if (this._screenListening) this._screenOrientation.removeEventListener('change', this._handleScreenChange);
    this._deviceListening = false;
    this._legacyScreenListening = false;
    this._screenListening = false;
    this._screenOrientation = null;
    this._browser = null;
  }

  _setStatus(state, message) {
    if (this.status === state && this.message === message) return;
    this.status = state;
    this.message = message;
    // UI observers are advisory and must not interrupt sensor cleanup/lifecycle.
    try { this._onStatus?.({ state, message }); } catch { /* Ignore observer errors. */ }
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this.disable();
    this._onStatus = null;
  }
}
