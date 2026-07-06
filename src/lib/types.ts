export type CarStatus = "available" | "incoming" | "sold";

export interface Car {
  id: number;
  make: string;
  model: string;
  year: number | null;
  price: number | null;
  mileage: number | null;
  status: CarStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type LeadStage = "new" | "engaged" | "hot" | "closed";

export interface Lead {
  id: number;
  ig_username: string;
  display_name: string | null;
  stage: LeadStage;
  needs_attention: 0 | 1;
  attention_reason: string | null;
  first_seen: string;
  last_seen: string;
}

export type MessageDirection = "in" | "out";
export type MessageStatus = "sent" | "draft" | "rejected";

export interface Message {
  id: number;
  lead_id: number;
  direction: MessageDirection;
  text: string;
  status: MessageStatus;
  draft_reason: string | null;
  created_at: string;
}

export type NoteKind = "model_interest" | "question" | "intent" | "note";

export interface LeadNote {
  id: number;
  lead_id: number;
  kind: NoteKind;
  content: string;
  created_at: string;
}

export interface ModelRequest {
  id: number;
  lead_id: number;
  make: string | null;
  model: string;
  created_at: string;
}

export interface VoiceNote {
  id: number;
  transcript: string;
  extracted_json: string | null;
  summary: string | null;
  status: "processed" | "pending" | "error";
  created_at: string;
}

export interface BusinessFact {
  id: number;
  content: string;
  created_at: string;
}

/** Structured actions extracted from a voice-note transcript. */
export interface ExtractionResult {
  actions: ExtractedAction[];
  summary: string;
}

export type ExtractedAction =
  | {
      type: "add_car";
      make: string;
      model: string;
      year: number | null;
      price: number | null;
      mileage: number | null;
      status: "available" | "incoming";
      notes: string | null;
    }
  | { type: "mark_sold"; car_description: string }
  | { type: "update_price"; car_description: string; price: number }
  | { type: "business_note"; content: string };

/** Outcome of running the DM agent on an inbound message. */
export interface AgentOutcome {
  replyText: string;
  /** "sent" = auto-replied, "draft" = queued for the seller's approval */
  disposition: "sent" | "draft";
  draftReason: string | null;
  live: boolean; // false when running in stub mode (no API key)
}
