import { randomUUID } from 'node:crypto';

export const db = {
  workouts: [], workout_sets: [], personal_records: [],
  latencyMs: 0,
  calls: [],           // every table op, in completion order
  failNext: null,      // set to an error object to make the next op fail
};
export function resetDb() {
  db.workouts = []; db.workout_sets = []; db.personal_records = [];
  db.latencyMs = 0; db.calls = []; db.failNext = null;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

class Query {
  constructor(table) { this.t = table; this.op = null; this.payload = null; this.f = []; }
  insert(p) { this.op = 'insert'; this.payload = p; return this; }
  upsert(p) { this.op = 'upsert'; this.payload = p; return this; }
  update(p) { this.op = 'update'; this.payload = p; return this; }
  delete() { this.op = 'delete'; return this; }
  select() { return this; }
  eq(c, v) { this.f.push([c, v]); return this; }
  neq() { return this; } order() { return this; } limit() { return this; } is() { return this; }
  single() { return this._run(); }
  maybeSingle() { return this._run(); }
  then(res, rej) { return this._run().then(res, rej); }

  async _run() {
    if (db.latencyMs) await sleep(db.latencyMs);
    db.calls.push(`${this.t}.${this.op ?? 'select'}`);
    if (db.failNext) { const e = db.failNext; db.failNext = null; return { data: null, error: e }; }

    if (this.t === 'workouts' && this.op === 'insert') {
      const row = { id: randomUUID(), ...this.payload };
      db.workouts.push(row);
      return { data: row, error: null };
    }
    if (this.t === 'workouts' && this.op === 'update') return { data: null, error: null };

    if (this.t === 'workout_sets' && this.op === 'insert') {
      const id = this.payload.id ?? randomUUID();
      if (db.workout_sets.some(r => r.id === id)) {
        return { data: null, error: { code: '23505', message: 'duplicate key' } };
      }
      const row = { ...this.payload, id };
      db.workout_sets.push(row);
      return { data: row, error: null };
    }

    if (this.t === 'personal_records') {
      const match = r => this.f.every(([c, v]) => r[c] === v);
      if (this.op === 'upsert') {
        const i = db.personal_records.findIndex(
          r => r.user_id === this.payload.user_id && r.exercise_id === this.payload.exercise_id);
        if (i >= 0) db.personal_records[i] = { ...this.payload }; else db.personal_records.push({ ...this.payload });
        return { data: this.payload, error: null };
      }
      if (this.op === 'delete') {
        db.personal_records = db.personal_records.filter(r => !match(r));
        return { data: null, error: null };
      }
      return { data: db.personal_records.find(match) ?? null, error: null };
    }
    return { data: null, error: null };
  }
}

export const supabase = {
  from: t => new Query(t),
  auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
};
