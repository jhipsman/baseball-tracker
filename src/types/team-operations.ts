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
export type TeamOperationsTables = {
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
