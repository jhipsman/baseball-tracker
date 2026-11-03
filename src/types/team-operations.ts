import type { Json } from "./database";
type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };
export type PaymentPlanRow = {
  id: string;
  org_id: string;
  payer_id: string | null;
  player_id: string | null;
  title: string;
  season: string;
  installment_cents: number;
  installments: number;
  first_due: string;
  currency: string;
  status: string;
  autopay_status: string;
  stripe_subscription_id: string | null;
  stripe_checkout_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
export type InvoiceRow = {
  id: string;
  org_id: string;
  plan_id: string;
  payer_id: string | null;
  installment_number: number;
  due_date: string;
  amount_cents: number;
  paid_cents: number;
  refunded_cents: number;
  status: string;
  stripe_checkout_id: string | null;
  created_at: string;
  updated_at: string;
};
export type StaffPayRateRow = {
  org_id: string;
  profile_id: string;
  pay_type: "hourly" | "per_session" | "stipend" | "volunteer";
  rate_cents: number;
  stipend_cents: number;
  stipend_payments: number;
  title: string | null;
  updated_at: string;
  updated_by: string | null;
};
export type StaffTimeEntryRow = {
  id: string;
  org_id: string;
  profile_id: string;
  work_date: string;
  kind: "shift" | "session";
  started_at: string | null;
  ended_at: string | null;
  minutes: number | null;
  activity: string | null;
  practice_id: string | null;
  game_id: string | null;
  note: string | null;
  status: "open" | "submitted" | "approved" | "rejected" | "paid";
  amount_cents: number | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  period_id: string | null;
  created_at: string;
  created_by: string | null;
};
export type StaffPayPeriodRow = {
  id: string;
  org_id: string;
  starts_on: string;
  ends_on: string;
  status: "open" | "paid";
  paid_at: string | null;
  created_at: string;
  created_by: string | null;
};
export type StaffPaymentRow = {
  id: string;
  org_id: string;
  period_id: string;
  profile_id: string;
  amount_cents: number;
  method: "payroll" | "check" | "cash" | "app" | "bank" | "other";
  reference: string | null;
  paid_at: string;
  created_by: string | null;
};
export type PublicTeamRow = {
  id: string;
  slug: string;
  name: string;
  level: "youth" | "middle_school" | "high_school" | "travel" | "college" | "adult";
  age_group: string | null;
  city: string | null;
  state: string | null;
  org_id: string | null;
  group_id: string | null;
  owner_id: string | null;
  verified: boolean;
  logo_path: string | null;
  created_at: string;
  updated_at: string;
};
export type PublicGameRow = {
  id: string;
  team_id: string;
  date: string;
  start_time: string | null;
  opponent: string;
  home_away: "home" | "away" | "neutral";
  location: string | null;
  status: "scheduled" | "final" | "postponed" | "canceled";
  team_score: number | null;
  opponent_score: number | null;
  /** The opponent's team page, when the game is shared with it. */
  opponent_team_id: string | null;
  reported_by: string | null;
  dispute: { team_id: string; team_score: number; opponent_score: number } | null;
  confirmed: boolean;
  created_at: string;
};
/** A game as public pages see it (9D games may also be "live"). */
export type PublicTeamGame = {
  id: string;
  team_id: string;
  date: string;
  start_time: string | null;
  opponent: string;
  home_away: string;
  location: string | null;
  status: string;
  team_score: number | null;
  opponent_score: number | null;
  inning: number | null;
  /** The other team's page when the game is shared. */
  opponent_team_id: string | null;
  /** Added by the opponent (shown flipped to this team's side). */
  mirror: boolean;
  /** When "disputed": the other team's reported score, from this team's side. */
  alt_team_score: number | null;
  alt_opponent_score: number | null;
  /** Whether the alt score is this team's report (so the main score is the other team's). */
  alt_is_ours: boolean | null;
};

export type LeagueRow = {
  id: string;
  slug: string;
  name: string;
  season: string | null;
  level: PublicTeamRow["level"];
  city: string | null;
  state: string | null;
  owner_id: string | null;
  created_at: string;
};
export type LeagueDivisionRow = {
  id: string;
  league_id: string;
  name: string;
  sort: number;
  created_at: string;
};
export type LeagueTeamRow = {
  league_id: string;
  team_id: string;
  division_id: string | null;
  created_at: string;
};
export type LeagueGameRow = {
  id: string;
  league_id: string;
  date: string;
  start_time: string | null;
  home_team_id: string;
  away_team_id: string;
  location: string | null;
  status: "scheduled" | "final" | "postponed" | "canceled";
  home_score: number | null;
  away_score: number | null;
  created_at: string;
};

export type TeamOperationsTables = {
  leagues: Table<LeagueRow>;
  league_divisions: Table<LeagueDivisionRow>;
  league_teams: Table<LeagueTeamRow>;
  league_games: Table<LeagueGameRow>;
  public_teams: Table<PublicTeamRow>;
  public_games: Table<PublicGameRow>;
  staff_pay_rates: Table<StaffPayRateRow>;
  staff_time_entries: Table<StaffTimeEntryRow>;
  staff_pay_periods: Table<StaffPayPeriodRow>;
  staff_payments: Table<StaffPaymentRow>;
  message_templates: Table<{
    id: string;
    org_id: string;
    title: string;
    body: string;
    created_by: string | null;
    created_at: string;
  }>;
  team_events: Table<{
    id: string;
    org_id: string;
    group_id: string | null;
    title: string;
    event_type: string;
    date: string;
    start_time: string | null;
    duration_minutes: number;
    location: string | null;
    notes: string | null;
    published: boolean;
    canceled: boolean;
    series_id: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  }>;
  activity_attendance: Table<{
    org_id: string;
    kind: string;
    activity_id: string;
    player_id: string;
    response: string;
    checked_in: boolean;
    updated_by: string | null;
    updated_at: string;
  }>;
  schedule_changes: Table<{
    id: string;
    org_id: string;
    actor_id: string | null;
    action: string;
    before_data: Json;
    after_data: Json | null;
    notified: boolean;
    created_at: string;
  }>;
  org_payment_accounts: Table<{
    org_id: string;
    stripe_account_id: string;
    charges_enabled: boolean;
    payouts_enabled: boolean;
    created_at: string;
  }>;
  team_payment_plans: Table<PaymentPlanRow>;
  team_invoices: Table<InvoiceRow>;
  team_payment_transactions: Table<{
    id: string;
    org_id: string;
    invoice_id: string;
    kind: string;
    amount_cents: number;
    method: string;
    reference: string | null;
    note: string | null;
    request_key: string;
    provider_payment_id: string | null;
    processor_fee_cents: number | null;
    created_by: string | null;
    created_at: string;
  }>;
  team_payment_webhooks: Table<{ event_id: string; org_id: string; created_at: string }>;
  team_payment_plan_requests: Table<{ org_id: string; request_key: string; plan_id: string }>;
  registration_forms: Table<RegistrationFormRow>;
  team_registrations: Table<RegistrationRow>;
  team_documents: Table<TeamDocumentRow>;
  document_responses: Table<DocumentResponseRow>;
  staff_credentials: Table<StaffCredentialRow>;
  billing_events: Table<{ event_id: string; created_at: string }>;
};
export type TeamDocumentRow = {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  kind: "read" | "acknowledge" | "sign" | "upload";
  audience: "families" | "staff";
  group_id: string | null;
  file_path: string | null;
  file_sha256: string | null;
  due_date: string | null;
  archived: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
export type DocumentResponseRow = {
  id: string;
  org_id: string;
  document_id: string;
  subject_id: string;
  completed_by: string | null;
  kind: "acknowledged" | "signed" | "uploaded";
  signed_name: string | null;
  file_path: string | null;
  doc_sha256: string | null;
  consent_at: string | null;
  signer_ip: string | null;
  signer_agent: string | null;
  created_at: string;
};
export type StaffCredentialRow = {
  id: string;
  org_id: string;
  profile_id: string;
  kind: "background_check" | "safesport" | "concussion" | "first_aid" | "other";
  label: string | null;
  file_path: string;
  issued_on: string | null;
  expires_on: string | null;
  created_at: string;
};
export type RegistrationFormRow = {
  id: string;
  org_id: string;
  token: string;
  title: string;
  season: string;
  fee_cents: number;
  installments_max: number;
  first_due: string | null;
  waiver_text: string;
  capacity: number | null;
  open: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
export type RegistrationRow = {
  id: string;
  org_id: string;
  form_id: string;
  submitted_by: string | null;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  player_name: string;
  player_birth_date: string;
  player_email: string | null;
  player_position: string | null;
  emergency_name: string;
  emergency_phone: string;
  emergency_relation: string | null;
  medical_notes: string | null;
  waiver_text: string;
  waiver_signed_name: string;
  waiver_signed_at: string;
  installments: number;
  plan_id: string | null;
  player_invite_id: string | null;
  player_id: string | null;
  status: string;
  created_at: string;
};
export type TeamOperationsViews = {
  schedule_activities: {
    Row: {
      id: string;
      org_id: string;
      kind: string;
      group_id: string | null;
      title: string;
      date: string;
      start_time: string | null;
      duration_minutes: number;
      location: string | null;
      published: boolean;
      state: string;
      updated_at: string;
      series_id: string | null;
    };
    Relationships: [];
  };
};
export type TeamOperationsFunctions = {
  public_teams_games: {
    Args: { p_teams: string[]; p_from: string; p_to: string };
    Returns: PublicTeamGame[];
  };
  report_public_game: {
    Args: { p_game: string; p_status: string; p_us?: number | null; p_them?: number | null };
    Returns: string;
  };
  public_team_games: {
    Args: { p_team?: string | null; p_from?: string | null; p_to?: string | null };
    Returns: PublicTeamGame[];
  };
  review_staff_time: {
    Args: { p_ids: string[]; p_approve: boolean; p_note?: string | null };
    Returns: number;
  };
  pay_staff_period: { Args: { p_period: string; p_payments: Json }; Returns: number };
  edit_team_event: {
    Args: {
      p_org: string;
      p_id: string;
      p_updated: string;
      p_event: Json;
      p_following?: boolean;
      p_notify?: boolean;
    };
    Returns: number;
  };
  cancel_team_payment_plan: { Args: { p_org: string; p_plan: string }; Returns: number };
  announcement_recipients: {
    Args: { p_org: string; p_group?: string | null; p_parents?: boolean; p_scope?: string };
    Returns: { profile_id: string; display_name: string }[];
  };
  link_imported_player: {
    Args: { p_org: string; p_row: string; p_player: string };
    Returns: undefined;
  };
  create_team_events: {
    Args: { p_org: string; p_event: Json; p_count?: number; p_notify?: boolean };
    Returns: string;
  };
  update_schedule_activities: {
    Args: {
      p_org: string;
      p_items: Json;
      p_action: string;
      p_days?: number;
      p_time?: string | null;
      p_location?: string | null;
      p_notify?: boolean;
    };
    Returns: number;
  };
  respond_activity: {
    Args: {
      p_org: string;
      p_kind: string;
      p_activity: string;
      p_player: string;
      p_response?: string | null;
      p_check_in?: boolean | null;
    };
    Returns: undefined;
  };
  create_team_payment_plan: {
    Args: {
      p_org: string;
      p_payer: string;
      p_player: string | null;
      p_title: string;
      p_season: string;
      p_cents: number;
      p_count: number;
      p_first: string;
      p_request: string;
    };
    Returns: string;
  };
  record_team_payment: {
    Args: {
      p_org: string;
      p_invoice: string;
      p_kind: string;
      p_cents: number;
      p_method: string;
      p_reference: string;
      p_note: string;
      p_request: string;
    };
    Returns: undefined;
  };
  remind_team_invoice: { Args: { p_org: string; p_invoice: string }; Returns: undefined };
  get_registration_form: {
    Args: { p_token: string };
    Returns: {
      form_id: string;
      team_name: string;
      title: string;
      season: string;
      fee_cents: number;
      installments_max: number;
      first_due: string | null;
      waiver_text: string;
      open: boolean;
      spots_left: number | null;
    }[];
  };
  submit_registration: {
    Args: { p_token: string; p_data: Json; p_installments: number };
    Returns: string;
  };
  link_registration_player: {
    Args: { p_org: string; p_reg: string; p_player: string };
    Returns: undefined;
  };
  send_payment_reminders: { Args: Record<string, never>; Returns: number };
  notify_document: { Args: { p_doc: string; p_missing_only: boolean }; Returns: number };
  send_trial_reminders: { Args: Record<string, never>; Returns: number };
  add_roster_players: {
    Args: { p_org: string; p_people: Json };
    Returns: Json;
  };
  create_claim_invite: {
    Args: { p_org: string; p_player: string; p_email: string };
    Returns: string;
  };
  import_roster: {
    Args: { p_org: string; p_source: string; p_label: string; p_people: Json; p_invite: boolean };
    Returns: Json;
  };
  import_schedule: {
    Args: { p_org: string; p_source: string; p_label: string; p_events: Json };
    Returns: Json;
  };
  import_stats: {
    Args: { p_org: string; p_source: string; p_season: string; p_label: string; p_rows: Json };
    Returns: Json;
  };
  undo_import: { Args: { p_batch: string }; Returns: Json };
  medical_cards: {
    Args: { p_org: string };
    Returns: {
      player_id: string;
      full_name: string;
      jersey_number: number | null;
      birth_date: string | null;
      allergies: string | null;
      medications: string | null;
      conditions: string | null;
      registration_notes: string | null;
      contacts: Json;
      updated_at: string | null;
    }[];
  };
  submit_health_clearance: {
    Args: { p_org: string; p_player: string; p_path: string };
    Returns: undefined;
  };
  apply_team_stripe_payment: {
    Args: {
      p_event: string;
      p_org: string;
      p_invoice: string | null;
      p_plan: string | null;
      p_cents: number;
      p_provider: string;
      p_kind?: string;
      p_fee?: number | null;
    };
    Returns: string | null;
  };
};
