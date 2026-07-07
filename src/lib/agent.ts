import Anthropic from "@anthropic-ai/sdk";
import {
  addLeadNote,
  addMessage,
  addModelRequest,
  getMessages,
  getOrCreateLead,
  getSetting,
  searchCars,
  updateLead,
} from "./db";
import { buildSystemBlocks } from "./persona";
import type { AgentOutcome, Lead, LeadStage } from "./types";

const MODEL = "claude-opus-4-8";

export function isLiveMode(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

const TOOLS: Anthropic.Messages.ToolUnion[] = [
  {
    name: "check_inventory",
    description:
      "Search the current car inventory. Call this before answering any question about a specific car, price, or availability that you have not already confirmed from the CURRENT INVENTORY section.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Free-text search, e.g. 'civic', 'toyota', 'under 10k sedan'",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "capture_lead_intel",
    description:
      "Record what this customer wants so the seller sees it on his dashboard. Call this on EVERY customer message, even casual ones. Record every car model they mention wanting, every question they ask, and your read on how close they are to buying.",
    input_schema: {
      type: "object",
      properties: {
        models_of_interest: {
          type: "array",
          description:
            "Car models the customer asked about or expressed interest in, e.g. [{make: 'Toyota', model: 'Corolla'}]. Empty array if none.",
          items: {
            type: "object",
            properties: {
              make: { type: ["string", "null"], description: "Manufacturer, null if unknown" },
              model: { type: "string" },
            },
            required: ["make", "model"],
            additionalProperties: false,
          },
        },
        questions: {
          type: "array",
          description:
            "Questions or requests the customer raised, each as a short third-person bullet, e.g. 'Asked whether financing is available'. Empty array if none.",
          items: { type: "string" },
        },
        intent: {
          type: "string",
          description:
            "One short sentence on where this customer stands, e.g. 'Comparing the Corolla and the Civic, price-sensitive'.",
        },
        stage: {
          type: "string",
          enum: ["new", "engaged", "hot", "closed"],
          description:
            "Your read: new = first contact, engaged = actively asking, hot = talking money/visit, closed = bought or walked away.",
        },
      },
      required: ["models_of_interest", "questions", "intent", "stage"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "flag_for_review",
    description:
      "Escalate to the seller. Call this when the customer negotiates price, offers a trade-in, wants to arrange payment or paperwork, is upset, or asks something you cannot answer from inventory or business facts. Your reply will be held as a draft for the seller to approve instead of being sent automatically.",
    input_schema: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Short reason the seller sees, e.g. 'Offering $7,800 on the Altima (asking $8,500)'.",
        },
      },
      required: ["reason"],
      additionalProperties: false,
    },
    strict: true,
  },
];

interface IntelInput {
  models_of_interest: { make: string | null; model: string }[];
  questions: string[];
  intent: string;
  stage: LeadStage;
}

function applyIntel(lead: Lead, intel: IntelInput) {
  for (const m of intel.models_of_interest) {
    addModelRequest(lead.id, m.make, m.model);
    addLeadNote(lead.id, "model_interest", `Asked about ${[m.make, m.model].filter(Boolean).join(" ")}`);
  }
  for (const q of intel.questions) {
    addLeadNote(lead.id, "question", q);
  }
  if (intel.intent) addLeadNote(lead.id, "intent", intel.intent);
  if (intel.stage && intel.stage !== lead.stage && lead.stage !== "closed") {
    updateLead(lead.id, { stage: intel.stage });
  }
}

function executeTool(
  lead: Lead,
  name: string,
  input: unknown
): { result: string; flagged?: string } {
  if (name === "check_inventory") {
    const { query } = input as { query: string };
    const cars = searchCars(query);
    if (cars.length === 0) return { result: "No cars in inventory match that search." };
    return {
      result: cars
        .map(
          (c) =>
            `${[c.year, c.make, c.model].filter(Boolean).join(" ")} — ${
              c.price != null ? `$${c.price.toLocaleString()}` : "price TBD"
            }${c.mileage != null ? `, ${c.mileage.toLocaleString()} mi` : ""} [${c.status}]${
              c.notes ? ` — ${c.notes}` : ""
            }`
        )
        .join("\n"),
    };
  }
  if (name === "capture_lead_intel") {
    applyIntel(lead, input as IntelInput);
    return { result: "Recorded on the dashboard." };
  }
  if (name === "flag_for_review") {
    const { reason } = input as { reason: string };
    return { result: "Flagged. Your reply will be held for the seller's approval.", flagged: reason };
  }
  return { result: `Unknown tool: ${name}` };
}

async function runLiveAgent(lead: Lead, client: Anthropic): Promise<AgentOutcome> {
  const history = getMessages(lead.id).filter((m) => m.status === "sent");
  const messages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.direction === "in" ? "user" : "assistant",
    content: m.text,
  }));

  let flaggedReason: string | null = null;

  for (let turn = 0; turn < 6; turn++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048, // DM replies are deliberately short
      thinking: { type: "adaptive" },
      system: buildSystemBlocks(lead),
      tools: TOOLS,
      messages,
    });

    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return {
        replyText: text || "give me a sec, checking on that for you 👍",
        disposition: flaggedReason ? "draft" : "sent",
        draftReason: flaggedReason,
        live: true,
      };
    }

    messages.push({ role: "assistant", content: response.content });
    const toolResults: Anthropic.ToolResultBlockParam[] = toolUses.map((tu) => {
      const { result, flagged } = executeTool(lead, tu.name, tu.input);
      if (flagged) flaggedReason = flagged;
      return { type: "tool_result", tool_use_id: tu.id, content: result };
    });
    messages.push({ role: "user", content: toolResults });
  }

  return {
    replyText: "give me a sec, checking on that for you 👍",
    disposition: "draft",
    draftReason: flaggedReason ?? "Agent hit its tool-call limit without finishing a reply",
    live: true,
  };
}

/**
 * Stub mode — no ANTHROPIC_API_KEY set. Keeps the whole demo loop working:
 * naive keyword matching against inventory + heuristic escalation, so the
 * dashboard, queue, and intel capture can be exercised without live AI.
 */
function runStubAgent(lead: Lead, inbound: string, contextText = ""): AgentOutcome {
  const text = inbound.toLowerCase();
  // a bare "how much?" comment gets its car from the post/reel it's under
  const matchCorpus = `${text} ${contextText.toLowerCase()}`;
  const words = matchCorpus.split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const seen = new Map<string, ReturnType<typeof searchCars>[number]>();
  for (const raw of words) {
    // try the word and its singular form ("corollas" → "corolla")
    const candidates = raw.endsWith("s") && raw.length > 3 ? [raw, raw.slice(0, -1)] : [raw];
    for (const w of candidates) {
      for (const car of searchCars(w)) {
        if (
          car.model.toLowerCase().includes(w) ||
          car.make.toLowerCase().includes(w)
        ) {
          seen.set(`${car.make} ${car.model}`, car);
        }
      }
    }
  }
  const matches = [...seen.values()];

  for (const car of matches) {
    addModelRequest(lead.id, car.make, car.model);
    addLeadNote(lead.id, "model_interest", `Asked about ${car.make} ${car.model}`);
  }
  if (text.includes("?") || /how much|price|cuanto|available|still got/.test(text)) {
    addLeadNote(lead.id, "question", `Asked: "${inbound.slice(0, 120)}"`);
  }

  const negotiating =
    /\$|\d{3,}|\d+\s?k\b|take|offer|trade|cash|lower|deal|finance|payment|zelle/.test(text);
  if (negotiating && lead.stage !== "closed") {
    updateLead(lead.id, { stage: "hot" });
  } else if (lead.stage === "new") {
    updateLead(lead.id, { stage: "engaged" });
  }

  let reply: string;
  if (matches.length > 0) {
    const lines = matches
      .filter((c) => c.status !== "sold")
      .map(
        (c) =>
          `${c.year ?? ""} ${c.make} ${c.model}${c.price != null ? ` at $${c.price.toLocaleString()}` : ""}`.trim()
      );
    reply =
      lines.length > 0
        ? `got you — ${lines.join(", ")}. trip ticket included. when you tryna come see it?`
        : `that one's gone my friend, but lmk what else you're looking for 👍`;
  } else {
    reply = `what you looking for exactly? got a few clean ones rn, all come with trip ticket`;
  }

  if (negotiating) {
    return {
      replyText: `let me check with the boss and get back to you real quick 👍`,
      disposition: "draft",
      draftReason: `Possible negotiation/payment talk: "${inbound.slice(0, 120)}" (stub mode heuristic)`,
      live: false,
    };
  }
  return { replyText: reply, disposition: "sent", draftReason: null, live: false };
}

export interface InboundOptions {
  /** Set when the inbound text is a comment on one of his posts/reels. */
  comment?: { mediaLabel: string };
}

/**
 * Full inbound pipeline: record the message, run the agent (live or stub),
 * store the reply as sent or as a draft awaiting approval.
 * Comments run the same pipeline — the reply is what goes out as the
 * private-reply DM, plus a short public comment reply pointing to DMs.
 * Returns the outcome plus the stored reply's message id.
 */
export async function handleInboundMessage(
  igUsername: string,
  text: string,
  displayName?: string,
  options?: InboundOptions
): Promise<AgentOutcome & { leadId: number; replyMessageId: number; publicReply: string | null }> {
  const lead = getOrCreateLead(igUsername, displayName);
  const storedText = options?.comment
    ? `💬 commented on ${options.comment.mediaLabel}: "${text}"`
    : text;
  addMessage(lead.id, "in", storedText, "sent");
  if (options?.comment) {
    addLeadNote(lead.id, "note", `Came in from a comment on ${options.comment.mediaLabel}`);
  }

  let outcome: AgentOutcome;
  if (isLiveMode()) {
    try {
      outcome = await runLiveAgent(lead, new Anthropic());
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError || err instanceof Anthropic.APIConnectionError) {
        outcome = {
          replyText: "one sec, i'll get back to you in a bit 👍",
          disposition: "draft",
          draftReason: "AI temporarily unavailable (rate limit / network) — review and send manually",
          live: true,
        };
      } else if (err instanceof Anthropic.APIError) {
        outcome = {
          replyText: "one sec, i'll get back to you in a bit 👍",
          disposition: "draft",
          draftReason: `AI error (${err.status ?? "unknown"}): ${err.message.slice(0, 200)}`,
          live: true,
        };
      } else {
        throw err;
      }
    }
  } else {
    outcome = runStubAgent(lead, text, options?.comment?.mediaLabel ?? "");
  }

  const replyMessageId = addMessage(
    lead.id,
    "out",
    outcome.replyText,
    outcome.disposition === "sent" ? "sent" : "draft",
    outcome.draftReason
  );

  if (outcome.disposition === "draft") {
    updateLead(lead.id, {
      needs_attention: 1,
      attention_reason: outcome.draftReason,
    });
  }

  // Public comment reply never carries deal details — it points to the DMs,
  // where the real answer (or the held draft) lives.
  const publicReply = options?.comment
    ? (getSetting("comment_public_reply") ?? "answered you in the DMs 🤝")
    : null;

  return { ...outcome, leadId: lead.id, replyMessageId, publicReply };
}
