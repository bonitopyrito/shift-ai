import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type {
  BusinessFact,
  Car,
  CarStatus,
  Lead,
  LeadNote,
  LeadStage,
  Message,
  MessageStatus,
  ModelRequest,
  NoteKind,
  VoiceNote,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = process.env.SHIFT_DB_PATH ?? path.join(DATA_DIR, "shift.db");

declare global {
  var __shiftDb: Database.Database | undefined;
}

function createDb(): Database.Database {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS cars (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      make TEXT NOT NULL,
      model TEXT NOT NULL,
      year INTEGER,
      price INTEGER,
      mileage INTEGER,
      status TEXT NOT NULL DEFAULT 'available',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ig_username TEXT NOT NULL UNIQUE,
      display_name TEXT,
      stage TEXT NOT NULL DEFAULT 'new',
      needs_attention INTEGER NOT NULL DEFAULT 0,
      attention_reason TEXT,
      first_seen TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL REFERENCES leads(id),
      direction TEXT NOT NULL,
      text TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'sent',
      draft_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS lead_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL REFERENCES leads(id),
      kind TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS model_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL REFERENCES leads(id),
      make TEXT,
      model TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS voice_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transcript TEXT NOT NULL,
      extracted_json TEXT,
      summary TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS business_facts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  seedIfEmpty(db);
  return db;
}

export function getDb(): Database.Database {
  if (!globalThis.__shiftDb) {
    globalThis.__shiftDb = createDb();
  }
  return globalThis.__shiftDb;
}

function seedIfEmpty(db: Database.Database) {
  const carCount = (db.prepare("SELECT COUNT(*) AS n FROM cars").get() as { n: number }).n;
  if (carCount > 0) return;

  const insertCar = db.prepare(
    "INSERT INTO cars (make, model, year, price, mileage, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  insertCar.run("Toyota", "Corolla", 2017, 9800, 84000, "available", "Clean title, gray, cold AC");
  insertCar.run("Honda", "Civic", 2016, 10500, 92000, "available", "Blue, new tires");
  insertCar.run("Nissan", "Altima", 2018, 8500, 101000, "available", "White, small scratch rear bumper");
  insertCar.run("Toyota", "Camry", 2015, 8900, 118000, "sold", "Sold last week");
  insertCar.run("Hyundai", "Elantra", 2019, 11200, 61000, "incoming", "Arriving Thursday");

  const insertFact = db.prepare("INSERT INTO business_facts (content) VALUES (?)");
  insertFact.run("Every car comes with a trip ticket (temporary transit permit) included in the price.");
  insertFact.run("Cash preferred; financing available through a partner with 30% down.");
  insertFact.run("Trade-ins considered case by case — the boss has to see the car first.");
  insertFact.run("Test drives by appointment, weekdays after 4pm and weekends.");

  const setSetting = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
  setSetting.run("seller_name", "Rey");
  setSetting.run(
    "business_desc",
    "Rey sells used cars through Instagram. He posts cars, people DM him, he closes deals fast. Every car comes with a trip ticket."
  );
  setSetting.run(
    "style_examples",
    [
      "Customer: how much for the corolla\nRey: corolla's at 9800 my friend, cold AC clean title. trip ticket included. when you tryna see it?",
      "Customer: you got any hondas?\nRey: got a 2016 civic rn, blue, new tires, 10500. moves quick tho, lmk",
      "Customer: is the price negotiable\nRey: price is close to firm but come see it first, we can talk in person 👍",
    ].join("\n---\n")
  );

  // A couple of demo leads so the dashboard shows life on first open
  const insertLead = db.prepare(
    "INSERT INTO leads (ig_username, display_name, stage, needs_attention, attention_reason) VALUES (?, ?, ?, ?, ?)"
  );
  const carlos = insertLead.run("carlos_m", "Carlos M.", "hot", 1, "Negotiating on the Altima — wants $7,800").lastInsertRowid as number;
  const dani = insertLead.run("dani.rides", "Dani", "engaged", 0, null).lastInsertRowid as number;

  const insertMsg = db.prepare(
    "INSERT INTO messages (lead_id, direction, text, status) VALUES (?, ?, ?, ?)"
  );
  insertMsg.run(carlos, "in", "how much for the altima", "sent");
  insertMsg.run(carlos, "out", "altima's at 8500, white, runs great. trip ticket included. wanna come see it?", "sent");
  insertMsg.run(carlos, "in", "would you take 7800 cash today", "sent");
  insertMsg.run(dani, "in", "you got any corollas or civics?", "sent");
  insertMsg.run(dani, "out", "got both rn — 2017 corolla at 9800 and a 2016 civic at 10500. both clean. which one you want first?", "sent");

  const insertNote = db.prepare(
    "INSERT INTO lead_notes (lead_id, kind, content) VALUES (?, ?, ?)"
  );
  insertNote.run(carlos, "model_interest", "Asked about the Nissan Altima");
  insertNote.run(carlos, "intent", "Offering $7,800 cash, ready to buy today");
  insertNote.run(carlos, "question", "Whether the price is negotiable");
  insertNote.run(dani, "model_interest", "Asked about Toyota Corolla");
  insertNote.run(dani, "model_interest", "Asked about Honda Civic");
  insertNote.run(dani, "question", "What compact cars are in stock");

  const insertReq = db.prepare(
    "INSERT INTO model_requests (lead_id, make, model) VALUES (?, ?, ?)"
  );
  insertReq.run(carlos, "Nissan", "Altima");
  insertReq.run(dani, "Toyota", "Corolla");
  insertReq.run(dani, "Honda", "Civic");
}

// ---------- settings ----------
export function getSetting(key: string): string | null {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

// ---------- cars ----------
export function listCars(): Car[] {
  return getDb().prepare("SELECT * FROM cars ORDER BY status = 'sold', updated_at DESC").all() as Car[];
}

export function searchCars(query: string): Car[] {
  const q = `%${query.trim()}%`;
  return getDb()
    .prepare(
      `SELECT * FROM cars
       WHERE make LIKE ? OR model LIKE ? OR (make || ' ' || model) LIKE ? OR notes LIKE ?
       ORDER BY status = 'sold'`
    )
    .all(q, q, q, q) as Car[];
}

export function addCar(car: {
  make: string;
  model: string;
  year: number | null;
  price: number | null;
  mileage: number | null;
  status: CarStatus;
  notes: string | null;
}): number {
  return getDb()
    .prepare(
      "INSERT INTO cars (make, model, year, price, mileage, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .run(car.make, car.model, car.year, car.price, car.mileage, car.status, car.notes)
    .lastInsertRowid as number;
}

/** Fuzzy-match a car by free-text description ("the gray corolla", "2018 altima"). */
export function findCarByDescription(description: string): Car | null {
  const cars = listCars();
  const desc = description.toLowerCase();
  const scored = cars
    .map((c) => {
      let score = 0;
      if (desc.includes(c.model.toLowerCase())) score += 3;
      if (desc.includes(c.make.toLowerCase())) score += 2;
      if (c.year && desc.includes(String(c.year))) score += 2;
      if (c.status !== "sold") score += 1;
      return { car: c, score };
    })
    .filter((s) => s.score >= 3)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.car ?? null;
}

export function updateCar(id: number, fields: Partial<Pick<Car, "price" | "status" | "notes">>) {
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(fields)) {
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  if (sets.length === 0) return;
  sets.push("updated_at = datetime('now')");
  getDb().prepare(`UPDATE cars SET ${sets.join(", ")} WHERE id = ?`).run(...vals, id);
}

// ---------- leads ----------
export function getOrCreateLead(igUsername: string, displayName?: string): Lead {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM leads WHERE ig_username = ?").get(igUsername) as
    | Lead
    | undefined;
  if (existing) {
    db.prepare("UPDATE leads SET last_seen = datetime('now') WHERE id = ?").run(existing.id);
    return existing;
  }
  const id = db
    .prepare("INSERT INTO leads (ig_username, display_name) VALUES (?, ?)")
    .run(igUsername, displayName ?? null).lastInsertRowid as number;
  return db.prepare("SELECT * FROM leads WHERE id = ?").get(id) as Lead;
}

export function getLead(id: number): Lead | null {
  return (getDb().prepare("SELECT * FROM leads WHERE id = ?").get(id) as Lead | undefined) ?? null;
}

export function listLeads(): Lead[] {
  return getDb()
    .prepare("SELECT * FROM leads ORDER BY needs_attention DESC, last_seen DESC")
    .all() as Lead[];
}

export function updateLead(
  id: number,
  fields: { stage?: LeadStage; needs_attention?: 0 | 1; attention_reason?: string | null }
) {
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(fields)) {
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  if (sets.length === 0) return;
  getDb().prepare(`UPDATE leads SET ${sets.join(", ")} WHERE id = ?`).run(...vals, id);
}

// ---------- messages ----------
export function addMessage(
  leadId: number,
  direction: "in" | "out",
  text: string,
  status: MessageStatus = "sent",
  draftReason: string | null = null
): number {
  return getDb()
    .prepare(
      "INSERT INTO messages (lead_id, direction, text, status, draft_reason) VALUES (?, ?, ?, ?, ?)"
    )
    .run(leadId, direction, text, status, draftReason).lastInsertRowid as number;
}

export function getMessages(leadId: number, limit = 30): Message[] {
  return (
    getDb()
      .prepare("SELECT * FROM messages WHERE lead_id = ? ORDER BY id DESC LIMIT ?")
      .all(leadId, limit) as Message[]
  ).reverse();
}

export function getMessage(id: number): Message | null {
  return (getDb().prepare("SELECT * FROM messages WHERE id = ?").get(id) as Message | undefined) ?? null;
}

export function updateMessageStatus(id: number, status: MessageStatus, text?: string) {
  if (text !== undefined) {
    getDb().prepare("UPDATE messages SET status = ?, text = ? WHERE id = ?").run(status, text, id);
  } else {
    getDb().prepare("UPDATE messages SET status = ? WHERE id = ?").run(status, id);
  }
}

export function listDrafts(): (Message & { ig_username: string; display_name: string | null })[] {
  return getDb()
    .prepare(
      `SELECT m.*, l.ig_username, l.display_name FROM messages m
       JOIN leads l ON l.id = m.lead_id
       WHERE m.status = 'draft' ORDER BY m.id DESC`
    )
    .all() as (Message & { ig_username: string; display_name: string | null })[];
}

// ---------- lead intel ----------
export function addLeadNote(leadId: number, kind: NoteKind, content: string) {
  // avoid duplicate bullets
  const dup = getDb()
    .prepare("SELECT id FROM lead_notes WHERE lead_id = ? AND kind = ? AND content = ?")
    .get(leadId, kind, content);
  if (dup) return;
  getDb()
    .prepare("INSERT INTO lead_notes (lead_id, kind, content) VALUES (?, ?, ?)")
    .run(leadId, kind, content);
}

export function getLeadNotes(leadId: number): LeadNote[] {
  return getDb()
    .prepare("SELECT * FROM lead_notes WHERE lead_id = ? ORDER BY id")
    .all(leadId) as LeadNote[];
}

export function addModelRequest(leadId: number, make: string | null, model: string) {
  const dup = getDb()
    .prepare("SELECT id FROM model_requests WHERE lead_id = ? AND model = ? COLLATE NOCASE")
    .get(leadId, model);
  if (dup) return;
  getDb()
    .prepare("INSERT INTO model_requests (lead_id, make, model) VALUES (?, ?, ?)")
    .run(leadId, make, model);
}

export function getDemandSignals(): { model: string; make: string | null; count: number }[] {
  return getDb()
    .prepare(
      `SELECT model, make, COUNT(DISTINCT lead_id) AS count
       FROM model_requests GROUP BY lower(model) ORDER BY count DESC, model LIMIT 8`
    )
    .all() as { model: string; make: string | null; count: number }[];
}

export function getModelRequests(leadId: number): ModelRequest[] {
  return getDb()
    .prepare("SELECT * FROM model_requests WHERE lead_id = ? ORDER BY id")
    .all(leadId) as ModelRequest[];
}

// ---------- voice notes / facts ----------
export function addVoiceNote(transcript: string): number {
  return getDb()
    .prepare("INSERT INTO voice_notes (transcript) VALUES (?)")
    .run(transcript).lastInsertRowid as number;
}

export function updateVoiceNote(
  id: number,
  fields: { extracted_json?: string; summary?: string; status?: "processed" | "pending" | "error" }
) {
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(fields)) {
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  if (sets.length === 0) return;
  getDb().prepare(`UPDATE voice_notes SET ${sets.join(", ")} WHERE id = ?`).run(...vals, id);
}

export function listVoiceNotes(): VoiceNote[] {
  return getDb().prepare("SELECT * FROM voice_notes ORDER BY id DESC LIMIT 50").all() as VoiceNote[];
}

export function addBusinessFact(content: string) {
  getDb().prepare("INSERT INTO business_facts (content) VALUES (?)").run(content);
}

export function listBusinessFacts(): BusinessFact[] {
  return getDb().prepare("SELECT * FROM business_facts ORDER BY id").all() as BusinessFact[];
}

// ---------- dashboard stats ----------
export function getStats() {
  const db = getDb();
  const leads = (db.prepare("SELECT COUNT(*) AS n FROM leads").get() as { n: number }).n;
  const hot = (db.prepare("SELECT COUNT(*) AS n FROM leads WHERE stage = 'hot'").get() as { n: number }).n;
  const attention = (
    db.prepare("SELECT COUNT(*) AS n FROM leads WHERE needs_attention = 1").get() as { n: number }
  ).n;
  const drafts = (
    db.prepare("SELECT COUNT(*) AS n FROM messages WHERE status = 'draft'").get() as { n: number }
  ).n;
  const inStock = (
    db.prepare("SELECT COUNT(*) AS n FROM cars WHERE status != 'sold'").get() as { n: number }
  ).n;
  return { leads, hot, attention, drafts, inStock };
}
