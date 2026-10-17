// The tracker's data file. One JSON file on disk holds every saved key, so the Electron
// app and the Claude connector read and write the same place:
//   { "version": 1, "updatedAt": "...", "keys": { "dm-encounters-v1": [...], ... } }
// Every write replaces the file atomically (temp file + rename), and every change re-reads
// the file first, so an edit made by the connector while the app is open is never overwritten
// by a stale copy.
const fs = require("fs");
const path = require("path");

const FILE_NAME = "data.json";
const VERSION = 1;

function createStore(dir) {
  const file = path.join(dir, FILE_NAME);
  const listeners = new Set();
  /** Exact text of the last file this process wrote, so its own writes are not reported as outside edits. */
  let lastWritten = null;
  /** key -> serialized value, as of the last time this process looked at the file. */
  let snapshot = new Map();
  let watcher = null;
  let timer = null;

  function parse(text) {
    const parsed = JSON.parse(text);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !parsed.keys ||
      typeof parsed.keys !== "object" ||
      Array.isArray(parsed.keys)
    ) {
      throw new Error("Unrecognized data file");
    }
    return parsed.keys;
  }

  function readKeys() {
    let text;
    try {
      text = fs.readFileSync(file, "utf8");
    } catch (error) {
      if (error && error.code === "ENOENT") return {};
      throw error;
    }
    try {
      return parse(text);
    } catch {
      // Never overwrite a file we cannot read: move it aside so nothing is lost.
      fs.renameSync(file, path.join(dir, `data.corrupt-${Date.now()}.json`));
      return {};
    }
  }

  function writeKeys(keys) {
    fs.mkdirSync(dir, { recursive: true });
    const text = JSON.stringify(
      { version: VERSION, updatedAt: new Date().toISOString(), keys },
      null,
      2,
    );
    const tmp = path.join(dir, `.${FILE_NAME}.${process.pid}.tmp`);
    fs.writeFileSync(tmp, text);
    fs.renameSync(tmp, file);
    lastWritten = text;
    snapshot = serializeAll(keys);
  }

  function serializeAll(keys) {
    return new Map(Object.entries(keys).map(([k, v]) => [k, JSON.stringify(v)]));
  }

  function getAll() {
    const keys = readKeys();
    snapshot = serializeAll(keys);
    return keys;
  }

  function set(key, value) {
    const keys = readKeys();
    keys[key] = value;
    writeKeys(keys);
  }

  function remove(key) {
    const keys = readKeys();
    if (!(key in keys)) return;
    delete keys[key];
    writeKeys(keys);
  }

  /** Called with [{ key, value }] (value undefined when removed) when something else changed the file. */
  function onExternalChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function checkForOutsideEdit() {
    let text;
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      return;
    }
    if (text === lastWritten) return;
    let keys;
    try {
      keys = parse(text);
    } catch {
      return; // A half-written or invalid file: wait for the next change.
    }
    const next = serializeAll(keys);
    const changes = [];
    for (const [key, serialized] of next) {
      if (snapshot.get(key) !== serialized) changes.push({ key, value: keys[key] });
    }
    for (const key of snapshot.keys()) {
      if (!next.has(key)) changes.push({ key, value: undefined });
    }
    lastWritten = text;
    snapshot = next;
    if (changes.length) for (const listener of listeners) listener(changes);
  }

  function watch() {
    if (watcher) return;
    fs.mkdirSync(dir, { recursive: true });
    snapshot = serializeAll(readKeys());
    watcher = fs.watch(dir, (_event, name) => {
      if (name && name !== FILE_NAME) return;
      clearTimeout(timer);
      timer = setTimeout(checkForOutsideEdit, 100);
    });
  }

  function close() {
    clearTimeout(timer);
    if (watcher) watcher.close();
    watcher = null;
  }

  return { file, getAll, set, remove, onExternalChange, watch, close };
}

module.exports = { createStore, FILE_NAME };
