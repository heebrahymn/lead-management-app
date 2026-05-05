export type LeadStatus =
  | "new"
  | "interested"
  | "no_response"
  | "converted"
  | "lost"
  | "closed";

export const SOURCES = ["call", "whatsapp", "email", "walk-in", "existing"] as const;
export type LeadSource = (typeof SOURCES)[number];

export const SOURCE_LABEL: Record<string, string> = {
  call: "Call",
  whatsapp: "WhatsApp",
  email: "Email",
  "walk-in": "Walk-in",
  existing: "Existing",
};

export const SERVICES = [
  "Wheel Balancing and Alignment",
  "Brake Service",
  "Tyre Installation",
  "Suspension and shock repair",
  "Car detailing",
  "Ceramic Coating",
  "AC Repair",
] as const;

export interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: LeadSource | null;
  status: LeadStatus;
  tags: string[];
  assigned_to: string | null;
  followup_at: string | null;
  deal_value: number | null;
  company: string | null;
  city: string | null;
  service: string | null;
  reg_number: string | null;
  vehicle_model: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type ManagedUser = {
  id: string;
  email: string;
  full_name?: string;
  roles: string[];
  created_at?: string;
  last_sign_in_at?: string | null;
};

export interface AdminFunctionResponse {
  users?: ManagedUser[];
  error?: string;
}

export interface LeadNote {
  id: string;
  lead_id: string;
  content: string;
  created_at: string;
}

export interface StatusHistoryEntry {
  id: string;
  lead_id: string;
  from_status: LeadStatus | null;
  to_status: LeadStatus;
  created_at: string;
}

export const STATUSES: { value: LeadStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "interested", label: "Interested" },
  { value: "no_response", label: "No Response" },
  { value: "converted", label: "Converted" },
  { value: "lost", label: "Lost" },
  { value: "closed", label: "Closed" },
];

export const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  interested: "Interested",
  no_response: "No Response",
  converted: "Converted",
  lost: "Lost",
  closed: "Closed",
};

export const STATUS_CLASSES: Record<LeadStatus, string> = {
  new: "bg-status-new-bg text-status-new-fg",
  interested: "bg-status-interested-bg text-status-interested-fg",
  no_response: "bg-status-no-response-bg text-status-no-response-fg",
  converted: "bg-status-converted-bg text-status-converted-fg",
  lost: "bg-status-lost-bg text-status-lost-fg",
  closed: "bg-status-closed-bg text-status-closed-fg",
};

export const STATUS_DOT: Record<LeadStatus, string> = {
  new: "bg-status-new-fg",
  interested: "bg-status-interested-fg",
  no_response: "bg-status-no-response-fg",
  converted: "bg-status-converted-fg",
  lost: "bg-status-lost-fg",
  closed: "bg-status-closed-fg",
};

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 250] as const;
export const DEFAULT_PAGE_SIZE = 10;
