export type LeadStatus =
  | "new"
  | "interested"
  | "no_response"
  | "converted"
  | "lost"
  | "closed";

export type LeadSource = "call" | "whatsapp" | "email" | "walk-in" | "existing";

export interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: LeadStatus;
  tags: string[];
  created_at: string;
  updated_at: string;
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

export const SOURCES: { value: LeadSource; label: string }[] = [
  { value: "call", label: "Call" },
  { value: "whatsapp", label: "Whatsapp" },
  { value: "email", label: "Email" },
  { value: "walk-in", label: "Walk-in" },
  { value: "existing", label: "Existing" },
];

export const SOURCE_LABEL: Record<LeadSource, string> = {
  call: "Call",
  whatsapp: "Whatsapp",
  email: "Email",
  "walk-in": "Walk-in",
  existing: "Existing",
};
