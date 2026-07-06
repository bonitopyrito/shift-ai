import Anthropic from "@anthropic-ai/sdk";
import {
  addBusinessFact,
  addCar,
  addVoiceNote,
  findCarByDescription,
  updateCar,
  updateVoiceNote,
} from "./db";
import { isLiveMode } from "./agent";
import type { ExtractedAction, ExtractionResult } from "./types";

const MODEL = "claude-opus-4-8";

/**
 * One flat action shape (discriminated by `type`, unused fields null) keeps the
 * schema inside structured-outputs constraints: additionalProperties false,
 * every property required.
 */
const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    actions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["add_car", "mark_sold", "update_price", "business_note"],
          },
          make: { type: ["string", "null"] },
          model: { type: ["string", "null"] },
          year: { type: ["integer", "null"] },
          price: { type: ["integer", "null"] },
          mileage: { type: ["integer", "null"] },
          status: { type: ["string", "null"], enum: ["available", "incoming", null] },
          notes: { type: ["string", "null"] },
          car_description: {
            type: ["string", "null"],
            description: "For mark_sold/update_price: how the seller referred to the car, e.g. 'the gray corolla'",
          },
          content: { type: ["string", "null"], description: "For business_note: the fact to remember" },
        },
        required: [
          "type",
          "make",
          "model",
          "year",
          "price",
          "mileage",
          "status",
          "notes",
          "car_description",
          "content",
        ],
        additionalProperties: false,
      },
    },
    summary: {
      type: "string",
      description: "One or two sentences summarizing what was understood, for the seller's dashboard",
    },
  },
  required: ["actions", "summary"],
  additionalProperties: false,
} as const;

interface RawAction {
  type: "add_car" | "mark_sold" | "update_price" | "business_note";
  make: string | null;
  model: string | null;
  year: number | null;
  price: number | null;
  mileage: number | null;
  status: "available" | "incoming" | null;
  notes: string | null;
  car_description: string | null;
  content: string | null;
}

function toExtractedActions(raw: RawAction[]): ExtractedAction[] {
  const actions: ExtractedAction[] = [];
  for (const a of raw) {
    if (a.type === "add_car" && a.model) {
      actions.push({
        type: "add_car",
        make: a.make ?? "Unknown",
        model: a.model,
        year: a.year,
        price: a.price,
        mileage: a.mileage,
        status: a.status ?? "available",
        notes: a.notes,
      });
    } else if (a.type === "mark_sold" && a.car_description) {
      actions.push({ type: "mark_sold", car_description: a.car_description });
    } else if (a.type === "update_price" && a.car_description && a.price != null) {
      actions.push({ type: "update_price", car_description: a.car_description, price: a.price });
    } else if (a.type === "business_note" && a.content) {
      actions.push({ type: "business_note", content: a.content });
    }
  }
  return actions;
}

async function extractWithClaude(transcript: string): Promise<ExtractionResult> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    system:
      "You turn a used-car seller's voice-note transcripts into structured inventory updates. " +
      "The seller talks casually ('the gray accord's gone', 'got a 2016 altima coming thursday, asking 8500'). " +
      "Extract only what he actually said — never invent prices, years, or mileage he didn't mention. " +
      "'Gone'/'sold'/'se fue' means mark_sold. A new car arriving means add_car with status 'incoming' " +
      "unless it's already on the lot. General knowledge (financing terms, hours, how deals work) is a business_note.",
    messages: [{ role: "user", content: `Transcript of the seller's voice note:\n\n"${transcript}"` }],
    output_config: {
      format: { type: "json_schema", schema: EXTRACTION_SCHEMA },
    },
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const parsed = JSON.parse(text) as { actions: RawAction[]; summary: string };
  return { actions: toExtractedActions(parsed.actions), summary: parsed.summary };
}

function applyActions(actions: ExtractedAction[]): string[] {
  const applied: string[] = [];
  for (const action of actions) {
    if (action.type === "add_car") {
      addCar({
        make: action.make,
        model: action.model,
        year: action.year,
        price: action.price,
        mileage: action.mileage,
        status: action.status,
        notes: action.notes,
      });
      applied.push(
        `Added ${[action.year, action.make, action.model].filter(Boolean).join(" ")}${
          action.price != null ? ` at $${action.price.toLocaleString()}` : ""
        } (${action.status})`
      );
    } else if (action.type === "mark_sold") {
      const car = findCarByDescription(action.car_description);
      if (car) {
        updateCar(car.id, { status: "sold" });
        applied.push(`Marked sold: ${[car.year, car.make, car.model].filter(Boolean).join(" ")}`);
      } else {
        applied.push(`Couldn't match "${action.car_description}" to a car in inventory — review manually`);
      }
    } else if (action.type === "update_price") {
      const car = findCarByDescription(action.car_description);
      if (car) {
        updateCar(car.id, { price: action.price });
        applied.push(
          `Updated price: ${[car.year, car.make, car.model].filter(Boolean).join(" ")} → $${action.price.toLocaleString()}`
        );
      } else {
        applied.push(`Couldn't match "${action.car_description}" to a car in inventory — review manually`);
      }
    } else {
      addBusinessFact(action.content);
      applied.push(`Noted: ${action.content}`);
    }
  }
  return applied;
}

/**
 * Full voice-note pipeline: store the transcript, extract structured actions
 * with Claude, apply them to inventory/facts, and record the result.
 * In stub mode (no API key) the transcript is stored unprocessed.
 */
export async function processVoiceNote(
  transcript: string
): Promise<{ id: number; summary: string; applied: string[]; live: boolean }> {
  const id = addVoiceNote(transcript);

  if (!isLiveMode()) {
    const summary = "Stored. Set ANTHROPIC_API_KEY to enable automatic extraction.";
    updateVoiceNote(id, { status: "pending", summary });
    return { id, summary, applied: [], live: false };
  }

  try {
    const result = await extractWithClaude(transcript);
    const applied = applyActions(result.actions);
    updateVoiceNote(id, {
      status: "processed",
      summary: result.summary,
      extracted_json: JSON.stringify({ actions: result.actions, applied }, null, 2),
    });
    return { id, summary: result.summary, applied, live: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    updateVoiceNote(id, { status: "error", summary: `Extraction failed: ${message.slice(0, 200)}` });
    return { id, summary: `Extraction failed: ${message.slice(0, 200)}`, applied: [], live: true };
  }
}
