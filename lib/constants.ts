// Inquiry types — must match the contact_type enum in the database.
export const INQUIRY_TYPES = [
  { value: "payroll_compliance_review", label: "Payroll Compliance Review" },
  { value: "payroll_remediation_review", label: "Payroll Remediation Review" },
  { value: "technology_procurement", label: "Technology Procurement" },
  { value: "payroll_system_review", label: "Payroll System Review" },
] as const;

export type InquiryType = (typeof INQUIRY_TYPES)[number]["value"];

export const INQUIRY_TYPE_VALUES = INQUIRY_TYPES.map((t) => t.value) as string[];

export function inquiryLabel(value: string): string {
  return INQUIRY_TYPES.find((t) => t.value === value)?.label ?? value;
}

// Urgency — captured on the enquiry form so the call doesn't start from zero
// and intake can triage. The human label is stored in attributes.urgency.
export const URGENCY_LEVELS = [
  { value: "urgent", label: "Urgent — need help now" },
  { value: "this_quarter", label: "Soon — within this quarter" },
  { value: "planning", label: "Planning ahead" },
  { value: "exploring", label: "Just exploring" },
] as const;

export const URGENCY_VALUES = URGENCY_LEVELS.map((u) => u.value) as string[];

export function urgencyLabel(value: string): string {
  return URGENCY_LEVELS.find((u) => u.value === value)?.label ?? value;
}

// Custom attribute: current_industry — pick from this fixed list.
export const INDUSTRIES = [
  "Retail",
  "Hospitality",
  "Mining",
  "Construction",
  "Rail",
  "Clerical",
  "Social and Community Services",
] as const;

// Contact pipeline stages — matches the contact_status enum.
// Labels use the Front Door journey language over the same underlying enum
// (decided: keep the DB enum, relabel in the UI). new_lead is the deck's
// "New Submission" entry stage.
export const STATUS_LABELS: Record<string, string> = {
  new_lead: "New submission",
  contacted: "Contacted",
  discovery_call: "Discovery call",
  proposal: "Proposal",
  won: "Won",
  lost: "Lost",
};

// Ordered list of pipeline stages for selects and progress display.
export const PIPELINE_STAGES = [
  "new_lead",
  "contacted",
  "discovery_call",
  "proposal",
  "won",
  "lost",
] as const;

export type ContactStatus = (typeof PIPELINE_STAGES)[number];

export function statusLabel(value: string): string {
  return STATUS_LABELS[value] ?? value;
}

// Order status — matches the order_status enum.
export const ORDER_STATUSES = [
  "pending",
  "paid",
  "refunded",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  paid: "Paid",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

export function orderStatusLabel(value: string): string {
  return ORDER_STATUS_LABELS[value] ?? value;
}

// Custom attribute display labels (people.attributes jsonb keys).
export const ATTR_LABELS: Record<string, string> = {
  number_of_employees: "Employees",
  current_industry: "Industry",
  ideal_project_start_date: "Ideal start",
  award: "Award / instrument",
  urgency: "Urgency",
};

// ============================================================
// The post-call required-fields checklist (Front Door).
// Captured after the call and stored on contacts.metadata.call. A complete
// checklist is what makes the quote accurate and kills wrong assumptions;
// the fields marked priceDriver are what the pricing calculator needs.
// ============================================================
export type CallField = {
  key: string;
  label: string;
  type: "text" | "textarea";
  placeholder?: string;
  priceDriver?: boolean;
  // Prefill from a people.attributes key when the enquiry already captured it.
  fromAttribute?: string;
};

export const CALL_FIELDS: CallField[] = [
  {
    key: "verified_scope",
    label: "Verified scope / services confirmed",
    type: "textarea",
    placeholder: "What they actually need, in your words after the call…",
    priceDriver: true,
  },
  {
    key: "headcount",
    label: "Headcount (verified)",
    type: "text",
    placeholder: "e.g. 250",
    priceDriver: true,
    fromAttribute: "number_of_employees",
  },
  {
    key: "awards",
    label: "Award(s) / industrial instrument(s)",
    type: "text",
    placeholder: "e.g. SCHADS, Retail Award",
    fromAttribute: "award",
  },
  {
    key: "payroll_systems",
    label: "Payroll system(s) in use",
    type: "text",
    placeholder: "e.g. Employment Hero, ADP",
    priceDriver: true,
  },
  {
    key: "pay_frequency",
    label: "Pay frequency & run complexity",
    type: "text",
    placeholder: "e.g. weekly + fortnightly, 3 entities",
    priceDriver: true,
  },
  {
    key: "complexity_flags",
    label: "Complexity flags",
    type: "text",
    placeholder: "Multi-state, multi-entity, EBA vs award, underpayment risk…",
    priceDriver: true,
  },
  {
    key: "effort_hours",
    label: "Effort driver (est. hours / scope size)",
    type: "text",
    placeholder: "e.g. ~40 hours",
    priceDriver: true,
  },
  {
    key: "deadline",
    label: "Deadline / ideal start",
    type: "text",
    placeholder: "e.g. before EOFY",
    fromAttribute: "ideal_project_start_date",
  },
  {
    key: "decision_maker",
    label: "Decision-maker & budget authority",
    type: "text",
    placeholder: "Who signs off, and is budget confirmed?",
  },
];

// The minimum a deal must have before it can move to Proposal: the scope, the
// size, and a price. These three make a proposal genuinely possible.
export const PROPOSAL_REQUIRED_CALL_KEYS = ["verified_scope", "headcount"] as const;

export type CallDetail = Record<string, unknown> & {
  estimated_value_cents?: number;
  notes?: string;
  logged_by?: string;
  logged_at?: string;
};

// Read the captured call detail off a contact's metadata jsonb.
export function getCallDetail(
  metadata: Record<string, unknown> | null | undefined
): CallDetail | null {
  const call = (metadata ?? {})["call"];
  if (call && typeof call === "object") return call as CallDetail;
  return null;
}

// Is this deal ready to become a proposal? Needs scope, headcount, and a value.
export function isProposalReady(call: CallDetail | null): boolean {
  if (!call) return false;
  for (const k of PROPOSAL_REQUIRED_CALL_KEYS) {
    const v = call[k];
    if (typeof v !== "string" || v.trim() === "") return false;
  }
  return typeof call.estimated_value_cents === "number" && call.estimated_value_cents > 0;
}
