import Anthropic from "@anthropic-ai/sdk";
import {
  getLeadNotes,
  getSetting,
  listBusinessFacts,
  listCars,
} from "./db";
import type { Lead } from "./types";

/**
 * The system prompt is split into two blocks so prompt caching works:
 *  - block 1: the persona + rules (stable — cache_control breakpoint here)
 *  - block 2: live inventory, business facts, and lead context (changes often,
 *    so it sits after the cache breakpoint and never invalidates block 1)
 */
export function buildSystemBlocks(lead: Lead): Anthropic.TextBlockParam[] {
  const sellerName = getSetting("seller_name") ?? "the seller";
  const businessDesc = getSetting("business_desc") ?? "";
  const styleExamples = getSetting("style_examples") ?? "";

  const persona = `You are answering Instagram DMs on behalf of ${sellerName}, a used-car seller. Customers must feel like they are talking to ${sellerName} himself — never reveal you are an AI or an assistant.

${businessDesc}

How ${sellerName} texts — match this voice exactly (casual, lowercase, short, warm, always moving toward a visit or a deal):
${styleExamples}

Rules:
- Keep replies short, like real DMs. One to three sentences. No corporate tone, no bullet lists, no signatures.
- Only state facts about cars that appear in the CURRENT INVENTORY section or via the check_inventory tool. Never invent cars, prices, mileage, or availability. If you don't know, say you'll check and flag it for review.
- On EVERY customer message, call capture_lead_intel to record which models they asked about, their questions, and how close they are to buying. Do this even for casual messages.
- Call flag_for_review (and keep your reply as a holding message) whenever: the customer negotiates below asking price, offers a trade-in, asks something you can't answer from inventory or business facts, is upset, or wants to arrange payment/paperwork. Deals are ${sellerName}'s call, not yours.
- Answer availability, price, basic condition, and general process questions (test drives, trip tickets, financing terms from the business facts) directly and confidently.
- Write in the customer's language if they message in Spanish or another language.`;

  const cars = listCars();
  const inventory = cars
    .map((c) => {
      const bits = [
        `#${c.id}`,
        [c.year, c.make, c.model].filter(Boolean).join(" "),
        c.price != null ? `$${c.price.toLocaleString()}` : "price TBD",
        c.mileage != null ? `${c.mileage.toLocaleString()} mi` : null,
        c.status.toUpperCase(),
        c.notes,
      ].filter(Boolean);
      return `- ${bits.join(" | ")}`;
    })
    .join("\n");

  const facts = listBusinessFacts()
    .map((f) => `- ${f.content}`)
    .join("\n");

  const notes = getLeadNotes(lead.id);
  const leadContext =
    notes.length > 0
      ? notes.map((n) => `- [${n.kind}] ${n.content}`).join("\n")
      : "- (first contact — nothing recorded yet)";

  return [
    {
      type: "text",
      text: persona,
      cache_control: { type: "ephemeral" },
    },
    {
      type: "text",
      text: `CURRENT INVENTORY:
${inventory}

BUSINESS FACTS:
${facts}

WHAT WE KNOW ABOUT THIS CUSTOMER (@${lead.ig_username}${lead.display_name ? `, ${lead.display_name}` : ""}, stage: ${lead.stage}):
${leadContext}`,
    },
  ];
}
