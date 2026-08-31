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
export const STATUS_LABELS: Record<string, string> = {
  new_lead: "New lead",
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
};
