import fs from 'node:fs';
import path from 'node:path';

// Synchronous atomic replace keeps each mutation crash-safe for this small, single-process exercise.
export class JsonStore {
  constructor(file) {
    this.file = file;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (!fs.existsSync(file)) this.#write({ items: {} });
  }
  read() { return JSON.parse(fs.readFileSync(this.file, 'utf8')); }
  update(fn) {
    const db = this.read();
    const result = fn(db);
    this.#write(db);
    return result;
  }
  #write(db) {
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, this.file);
  }
}
