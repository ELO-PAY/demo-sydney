// Seeds ~100 realistic sample records (people, inquiries, stage history,
// orders) spread across the last ~12 weeks, so the weekly dashboard has
// something meaningful to show. All sample people are tagged with
// source_site = 'sample_seed' so they can be removed cleanly:
//
//   node scripts/seed-samples.mjs          # clear old samples, insert fresh
//   node scripts/seed-samples.mjs --clear  # just remove the samples
//
// Sample data is fake and clearly tagged; deleting a sample person cascades
// to their contacts, activity_log rows, and orders.
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const TAG = "sample_seed";
const ACTOR = "emma-lee@austpayroll.com.au";
const DAY = 86400000;
const now = Date.now();

// ---- clear existing samples (cascade removes contacts/activity/orders) ----
async function clearSamples() {
  const { error } = await sb.from("people").delete().eq("source_site", TAG);
  if (error) throw error;
  console.log("Cleared existing sample people (cascade).");
}

if (process.argv.includes("--clear")) {
  await clearSamples();
  console.log("Done.");
  process.exit(0);
}

// ---- data pools ----
const FIRST = ["Sarah","James","Priya","Liam","Emma","Noah","Olivia","Wei","Aisha","Jack","Chloe","Mohammed","Grace","Ethan","Sophie","Daniel","Isla","Lucas","Amelia","Ryan","Zoe","Hannah","Marcus","Ava","Tom","Nina","Oscar","Ruby","Ben","Layla","Cooper","Mia","Harrison","Ella","Jai","Freya","Kai","Poppy","Leo","Willow"];
const LAST = ["Nguyen","Smith","Patel","Brown","Wilson","Chen","Taylor","Singh","Jones","Kaur","White","Martin","Anderson","Thompson","Lee","Walker","Harris","Clarke","Robinson","Wright","Kelly","Ryan","Murphy","Ward","Green","Baker","Adams","Hughes","Edwards","Turner","Cox","Bailey","Reed","Kumar","Ali","Bennett","Fraser","Dixon","Hunt","Shaw"];
const INDUSTRIES = ["Retail","Hospitality","Mining","Construction","Rail","Clerical","Social and Community Services"];
const ROLES = ["Payroll Manager","CFO","HR Director","Finance Manager","Head of People","Payroll Officer","Financial Controller","People & Culture Lead","Chief People Officer"];
const TYPES = ["payroll_compliance_review","payroll_remediation_review","technology_procurement","payroll_system_review"];
const PRODUCTS = ["Payroll Compliance Review","Payroll Remediation Program","Payroll System Selection","Award Interpretation Review","STP Phase 2 Readiness","Enterprise Agreement Audit"];
const CO_PREFIX = ["Coastline","Summit","Ironbark","Redgum","Harbourview","Wattle","Meridian","Southern Cross","Pinnacle","Blackwood","Sterling","Kingfisher","Anvil","Brightwater","Verity","Outback","Tallowood","Aurora","Keystone","Fairmont"];
const CO_SUFFIX = ["Group","Holdings","Industries","Services","Retail","Logistics","Resources","Hospitality Co","Rail","Care","Constructions","Partners"];
const MESSAGES = [
  "We've had a few underpayment issues flagged in an internal review and want an independent look.",
  "Our EBA interpretation in the payroll system doesn't match what finance expects. Need help.",
  "Looking to replace our current payroll platform and want guidance on selection.",
  "Preparing for STP Phase 2 and unsure our current setup is compliant.",
  "Rapid headcount growth has outpaced our payroll processes. Where do we start?",
  "Board has asked for assurance our award interpretation is correct across sites.",
  "",
];

const STAGES = ["new_lead","contacted","discovery_call","proposal","won","lost"];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rand = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const iso = (ms) => new Date(ms).toISOString();
// created dates biased toward recent so the trend grows over time
const createdOffsetDays = () => Math.floor(Math.pow(Math.random(), 1.6) * 84);

// Weighted final stage for an inquiry.
function finalStage() {
  const r = Math.random();
  if (r < 0.24) return "new_lead";
  if (r < 0.44) return "contacted";
  if (r < 0.60) return "discovery_call";
  if (r < 0.76) return "proposal";
  if (r < 0.90) return "won";
  return "lost";
}

const people = [];
const contacts = [];
const activity = [];
const orders = [];

for (let i = 0; i < 100; i++) {
  const first = pick(FIRST);
  const last = pick(LAST);
  const industry = pick(INDUSTRIES);
  const coName = `${pick(CO_PREFIX)} ${pick(CO_SUFFIX)}`;
  const domain = coName.toLowerCase().replace(/[^a-z]+/g, "") + ".com.au";
  const personId = randUUIDsafe();
  const createdMs = now - createdOffsetDays() * DAY - randInt(0, 10) * 3600000;
  const okToContact = Math.random() < 0.4;

  const attributes = {
    number_of_employees: pick(["38","72","120","240","450","900","1,200","2,600","85","310"]),
    current_industry: industry,
  };
  if (Math.random() < 0.5) {
    attributes.ideal_project_start_date = iso(now + randInt(14, 120) * DAY).slice(0, 10);
  }

  people.push({
    id: personId,
    email: `${first}.${last}${i}`.toLowerCase() + "@" + domain,
    name: `${first} ${last}`,
    phone: `+61 4${randInt(10, 99)} ${randInt(100, 999)} ${randInt(100, 999)}`,
    company: coName,
    role: pick(ROLES),
    source_site: TAG,
    ok_to_contact: okToContact,
    attributes,
    created_at: iso(createdMs),
    updated_at: iso(createdMs),
  });

  // 1 inquiry per person (occasionally 2).
  const inquiryCount = Math.random() < 0.15 ? 2 : 1;
  for (let j = 0; j < inquiryCount; j++) {
    const contactId = randUUIDsafe();
    const cCreated = createdMs + j * randInt(3, 20) * DAY;
    if (cCreated > now) continue;
    const target = finalStage();
    const targetIdx = STAGES.indexOf(target);

    contacts.push({
      id: contactId,
      person_id: personId,
      type: pick(TYPES),
      subject: `${pick(["Enquiry","Request","Question"])}: ${pick(PRODUCTS)}`,
      message: pick(MESSAGES) || null,
      source: TAG,
      status: target,
      metadata: {},
      created_at: iso(cCreated),
    });

    // Build the stage history from new_lead up to the final stage.
    // "lost" is treated as a terminal branch reachable from any middle stage.
    let cursorMs = cCreated;
    let fromStatus = "new_lead";
    const path =
      target === "new_lead"
        ? []
        : target === "lost"
        ? STAGES.slice(1, randInt(2, 4)).concat("lost") // some progress, then lost
        : STAGES.slice(1, targetIdx + 1);

    for (const to of path) {
      cursorMs += randInt(1, 8) * DAY + randInt(1, 8) * 3600000;
      if (cursorMs > now) cursorMs = now - randInt(0, 2) * DAY;
      activity.push({
        id: randUUIDsafe(),
        contact_id: contactId,
        person_id: personId,
        from_status: fromStatus,
        to_status: to,
        actor: ACTOR,
        note: Math.random() < 0.3 ? pick(["Left voicemail","Sent proposal","Good call, keen","Awaiting budget sign-off","Scoping call booked"]) : null,
        created_at: iso(cursorMs),
      });
      fromStatus = to;
    }

    // Orders: won inquiries convert; a few proposals have a pending order.
    if (target === "won") {
      const orderMs = cursorMs + randInt(1, 6) * DAY;
      orders.push({
        id: randUUIDsafe(),
        person_id: personId,
        product_name: pick(PRODUCTS),
        amount_cents: randInt(25, 120) * 10000, // $2,500–$12,000
        currency: "AUD",
        status: Math.random() < 0.8 ? "paid" : "pending",
        created_at: iso(Math.min(orderMs, now)),
      });
    } else if (target === "proposal" && Math.random() < 0.4) {
      orders.push({
        id: randUUIDsafe(),
        person_id: personId,
        product_name: pick(PRODUCTS),
        amount_cents: randInt(25, 120) * 10000,
        currency: "AUD",
        status: "pending",
        created_at: iso(Math.min(cursorMs + DAY, now)),
      });
    }
  }
}

function randUUIDsafe() {
  return randomUUID();
}

async function insertAll(table, rows) {
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { error } = await sb.from(table).insert(chunk);
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

await clearSamples();
console.log(`Inserting ${people.length} people, ${contacts.length} inquiries, ${activity.length} activity rows, ${orders.length} orders...`);
await insertAll("people", people);
await insertAll("contacts", contacts);
await insertAll("activity_log", activity);
await insertAll("orders", orders);
console.log("Sample data seeded. Tagged source_site = 'sample_seed' (remove with --clear).");
process.exit(0);
