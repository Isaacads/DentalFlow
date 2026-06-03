export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type ProfileRole = "admin" | "dentist" | "receptionist" | "assistant"

export type PlanTier = "essential" | "clinic" | "management"

export type PaymentStatus = "active" | "past_due"

export type BookingMode = "request" | "auto"

export type AppointmentStatus = "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show"

export type AppointmentCreatedVia = "internal" | "online"

export type TransactionType = "income" | "expense"

export type TransactionStatus = "pending" | "paid" | "overdue" | "cancelled"

export type PaymentMethod = "cash" | "credit_card" | "debit_card" | "pix" | "insurance" | "installment"

export type PatientAddress = {
  street?: string
  number?: string
  neighborhood?: string
  city?: string
  state?: string
  zip?: string
}

export type WorkingHourRange = { start: string; end: string }
export type ClinicWorkingHours = Record<string, WorkingHourRange[]>

export type ToothStatus =
  | "saudavel"
  | "carie"
  | "restaurado"
  | "ausente"
  | "coroa"
  | "implante"
  | "fraturado"
  | "canal"

export type ToothMap = Record<string, { status: ToothStatus; treatment?: string }>

export type Clinic = {
  id: string
  name: string
  owner_id: string
  plan_tier: PlanTier
  billing_provider: string | null
  billing_subscription_id: string | null
  payment_status: PaymentStatus
  booking_enabled: boolean
  booking_slug: string
  booking_window_days: number
  booking_lead_time_hours: number
  booking_mode: BookingMode
  working_hours: ClinicWorkingHours
  cnpj: string | null
  address: PatientAddress | null
  logo_url: string | null
  slogan: string | null
  whatsapp_confirmation_template: string
  whatsapp_auto_booking_template: string
  whatsapp_enabled: boolean
  whatsapp_auto_confirm: boolean
  whatsapp_auto_cancel: boolean
  whatsapp_cancel_template: string
  whatsapp_return_template: string
  return_enabled: boolean
  return_default_days: number
  return_reminder_enabled: boolean
  return_reminder_days_before: number
  created_at: string
  updated_at: string
}

export type BookingRequestStatus = "new" | "contacted" | "scheduled" | "cancelled"

export type BookingRequest = {
  id: string
  clinic_id: string
  patient_name: string
  patient_whatsapp: string
  patient_whatsapp_digits?: string | null
  patient_email: string | null
  procedure_id: string | null
  dentist_id: string | null
  preferred_times: string[]
  notes: string | null
  status: BookingRequestStatus
  created_at: string
}

export type ScheduleBlock = {
  id: string
  clinic_id: string
  dentist_id: string | null
  start_time: string
  end_time: string
  title: string
  created_by: string | null
  created_at: string
}

export type Profile = {
  id: string
  clinic_id: string
  full_name: string | null
  role: ProfileRole
  cro: string | null
  specialty: string | null
  phone: string | null
  color: string | null
  working_hours?: ClinicWorkingHours | null
  active: boolean
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export type Patient = {
  id: string
  clinic_id: string
  name: string
  cpf: string | null
  cpf_digits?: string | null
  birth_date: string | null
  phone: string | null
  phone_digits?: string | null
  whatsapp: string | null
  whatsapp_digits?: string | null
  email: string | null
  address: PatientAddress | null
  gender: string | null
  blood_type: string | null
  observations: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export type Procedure = {
  id: string
  clinic_id: string
  name: string
  category: string | null
  duration_minutes: number | null
  base_price: number | null
  description: string | null
  active: boolean
  create_return_on_complete: boolean
  return_days: number | null
  created_at: string
  updated_at: string
}

export type Appointment = {
  id: string
  clinic_id: string
  patient_id: string
  dentist_id: string
  procedure_id: string | null
  start_time: string
  end_time: string
  status: AppointmentStatus
  notes: string | null
  room: string | null
  created_via: AppointmentCreatedVia
  created_at: string
}

export type MedicalRecord = {
  id: string
  clinic_id: string
  patient_id: string
  dentist_id: string
  appointment_id: string | null
  chief_complaint: string | null
  clinical_notes: string | null
  diagnosis: string | null
  treatment_plan: string | null
  tooth_map: ToothMap | null
  attachments: Json[]
  signed_by: string | null
  signed_at: string | null
  created_at: string
}

export type FinancialTransaction = {
  id: string
  clinic_id: string
  patient_id: string | null
  appointment_id: string | null
  type: TransactionType
  category: string | null
  description: string | null
  amount: number
  due_date: string | null
  paid_date: string | null
  status: TransactionStatus
  payment_method: PaymentMethod | null
  installments: number | null
  notes: string | null
  created_at: string
}

export type Anamnesis = {
  id: string
  clinic_id: string
  patient_id: string
  answered_at: string | null
  responses: Json | null
  allergies: string[]
  medications: string[]
  health_conditions: string[]
  smoker: boolean | null
  pregnant: boolean | null
}

export type ReturnControl = {
  id: string
  clinic_id: string
  patient_id: string
  procedure_id: string | null
  last_visit: string | null
  next_return_date: string | null
  reminder_sent: boolean
  notes: string | null
}

export type WhatsAppMessageKind = "confirm" | "cancel" | "manual" | "return_reminder"
export type WhatsAppMessageStatus = "queued" | "sent" | "failed"

export type WhatsAppMessage = {
  id: string
  clinic_id: string
  appointment_id: string | null
  patient_id: string | null
  kind: WhatsAppMessageKind
  to_phone: string
  message: string
  status: WhatsAppMessageStatus
  provider_response: Json | null
  error: string | null
  created_at: string
}

export type Database = {
  public: {
    Tables: {
      clinics: {
        Row: Clinic
        Insert: {
          id?: string
          name: string
          owner_id?: string
          plan_tier?: PlanTier
          billing_provider?: string | null
          billing_subscription_id?: string | null
          payment_status?: PaymentStatus
          booking_enabled?: boolean
          booking_slug?: string
          booking_window_days?: number
          booking_lead_time_hours?: number
          booking_mode?: BookingMode
          working_hours?: ClinicWorkingHours
          cnpj?: string | null
          address?: PatientAddress | null
          logo_url?: string | null
          slogan?: string | null
          whatsapp_confirmation_template?: string
          whatsapp_auto_booking_template?: string
          whatsapp_enabled?: boolean
          whatsapp_auto_confirm?: boolean
          whatsapp_auto_cancel?: boolean
          whatsapp_cancel_template?: string
          whatsapp_return_template?: string
          return_enabled?: boolean
          return_default_days?: number
          return_reminder_enabled?: boolean
          return_reminder_days_before?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          owner_id?: string
          plan_tier?: PlanTier
          billing_provider?: string | null
          billing_subscription_id?: string | null
          payment_status?: PaymentStatus
          booking_enabled?: boolean
          booking_slug?: string
          booking_window_days?: number
          booking_lead_time_hours?: number
          booking_mode?: BookingMode
          working_hours?: ClinicWorkingHours
          cnpj?: string | null
          address?: PatientAddress | null
          logo_url?: string | null
          slogan?: string | null
          whatsapp_confirmation_template?: string
          whatsapp_auto_booking_template?: string
          whatsapp_enabled?: boolean
          whatsapp_auto_confirm?: boolean
          whatsapp_auto_cancel?: boolean
          whatsapp_cancel_template?: string
          whatsapp_return_template?: string
          return_enabled?: boolean
          return_default_days?: number
          return_reminder_enabled?: boolean
          return_reminder_days_before?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      booking_requests: {
        Row: BookingRequest
        Insert: {
          id?: string
          clinic_id?: string
          patient_name: string
          patient_whatsapp: string
          patient_email?: string | null
          procedure_id?: string | null
          dentist_id?: string | null
          preferred_times: string[]
          notes?: string | null
          status?: BookingRequestStatus
          created_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          patient_name?: string
          patient_whatsapp?: string
          patient_email?: string | null
          procedure_id?: string | null
          dentist_id?: string | null
          preferred_times?: string[]
          notes?: string | null
          status?: BookingRequestStatus
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_requests_clinic_id_fkey"
            columns: ["clinic_id"]
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_requests_procedure_id_fkey"
            columns: ["procedure_id"]
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_requests_dentist_id_fkey"
            columns: ["dentist_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: Profile
        Insert: {
          id: string
          clinic_id: string
          full_name?: string | null
          role: ProfileRole
          cro?: string | null
          specialty?: string | null
          phone?: string | null
          color?: string | null
          working_hours?: ClinicWorkingHours | null
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          full_name?: string | null
          role?: ProfileRole
          cro?: string | null
          specialty?: string | null
          phone?: string | null
          color?: string | null
          working_hours?: ClinicWorkingHours | null
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_clinic_id_fkey"
            columns: ["clinic_id"]
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: Patient
        Insert: {
          id?: string
          clinic_id?: string
          name: string
          cpf?: string | null
          birth_date?: string | null
          phone?: string | null
          whatsapp?: string | null
          email?: string | null
          address?: PatientAddress | null
          gender?: string | null
          blood_type?: string | null
          observations?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          name?: string
          cpf?: string | null
          birth_date?: string | null
          phone?: string | null
          whatsapp?: string | null
          email?: string | null
          address?: PatientAddress | null
          gender?: string | null
          blood_type?: string | null
          observations?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_clinic_id_fkey"
            columns: ["clinic_id"]
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      procedures: {
        Row: Procedure
        Insert: {
          id?: string
          clinic_id?: string
          name: string
          category?: string | null
          duration_minutes?: number | null
          base_price?: number | null
          description?: string | null
          active?: boolean
          create_return_on_complete?: boolean
          return_days?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          name?: string
          category?: string | null
          duration_minutes?: number | null
          base_price?: number | null
          description?: string | null
          active?: boolean
          create_return_on_complete?: boolean
          return_days?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedures_clinic_id_fkey"
            columns: ["clinic_id"]
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: Appointment
        Insert: {
          id?: string
          clinic_id?: string
          patient_id: string
          dentist_id: string
          procedure_id?: string | null
          start_time: string
          end_time: string
          status?: AppointmentStatus
          notes?: string | null
          room?: string | null
          created_via?: AppointmentCreatedVia
          created_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          patient_id?: string
          dentist_id?: string
          procedure_id?: string | null
          start_time?: string
          end_time?: string
          status?: AppointmentStatus
          notes?: string | null
          room?: string | null
          created_via?: AppointmentCreatedVia
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_dentist_id_fkey"
            columns: ["dentist_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_procedure_id_fkey"
            columns: ["procedure_id"]
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_blocks: {
        Row: ScheduleBlock
        Insert: {
          id?: string
          clinic_id?: string
          dentist_id?: string | null
          start_time: string
          end_time: string
          title?: string
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          dentist_id?: string | null
          start_time?: string
          end_time?: string
          title?: string
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_blocks_clinic_id_fkey"
            columns: ["clinic_id"]
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_blocks_dentist_id_fkey"
            columns: ["dentist_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_blocks_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_records: {
        Row: MedicalRecord
        Insert: {
          id?: string
          clinic_id?: string
          patient_id: string
          dentist_id: string
          appointment_id?: string | null
          chief_complaint?: string | null
          clinical_notes?: string | null
          diagnosis?: string | null
          treatment_plan?: string | null
          tooth_map?: ToothMap | null
          attachments?: Json[]
          signed_by?: string | null
          signed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          patient_id?: string
          dentist_id?: string
          appointment_id?: string | null
          chief_complaint?: string | null
          clinical_notes?: string | null
          diagnosis?: string | null
          treatment_plan?: string | null
          tooth_map?: ToothMap | null
          attachments?: Json[]
          signed_by?: string | null
          signed_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_records_clinic_id_fkey"
            columns: ["clinic_id"]
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_patient_id_fkey"
            columns: ["patient_id"]
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_dentist_id_fkey"
            columns: ["dentist_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_appointment_id_fkey"
            columns: ["appointment_id"]
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_signed_by_fkey"
            columns: ["signed_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: FinancialTransaction
        Insert: {
          id?: string
          clinic_id?: string
          patient_id?: string | null
          appointment_id?: string | null
          type: TransactionType
          category?: string | null
          description?: string | null
          amount: number
          due_date?: string | null
          paid_date?: string | null
          status?: TransactionStatus
          payment_method?: PaymentMethod | null
          installments?: number | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          patient_id?: string | null
          appointment_id?: string | null
          type?: TransactionType
          category?: string | null
          description?: string | null
          amount?: number
          due_date?: string | null
          paid_date?: string | null
          status?: TransactionStatus
          payment_method?: PaymentMethod | null
          installments?: number | null
          notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_clinic_id_fkey"
            columns: ["clinic_id"]
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_patient_id_fkey"
            columns: ["patient_id"]
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_appointment_id_fkey"
            columns: ["appointment_id"]
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      anamnesis: {
        Row: Anamnesis
        Insert: {
          id?: string
          clinic_id?: string
          patient_id: string
          answered_at?: string | null
          responses?: Json | null
          allergies?: string[]
          medications?: string[]
          health_conditions?: string[]
          smoker?: boolean | null
          pregnant?: boolean | null
        }
        Update: {
          id?: string
          clinic_id?: string
          patient_id?: string
          answered_at?: string | null
          responses?: Json | null
          allergies?: string[]
          medications?: string[]
          health_conditions?: string[]
          smoker?: boolean | null
          pregnant?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "anamnesis_clinic_id_fkey"
            columns: ["clinic_id"]
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anamnesis_patient_id_fkey"
            columns: ["patient_id"]
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      return_controls: {
        Row: ReturnControl
        Insert: {
          id?: string
          clinic_id?: string
          patient_id: string
          procedure_id?: string | null
          last_visit?: string | null
          next_return_date?: string | null
          reminder_sent?: boolean
          notes?: string | null
        }
        Update: {
          id?: string
          clinic_id?: string
          patient_id?: string
          procedure_id?: string | null
          last_visit?: string | null
          next_return_date?: string | null
          reminder_sent?: boolean
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "return_controls_clinic_id_fkey"
            columns: ["clinic_id"]
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_controls_patient_id_fkey"
            columns: ["patient_id"]
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_controls_procedure_id_fkey"
            columns: ["procedure_id"]
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: WhatsAppMessage
        Insert: {
          id?: string
          clinic_id: string
          appointment_id?: string | null
          patient_id?: string | null
          kind: WhatsAppMessageKind
          to_phone: string
          message: string
          status?: WhatsAppMessageStatus
          provider_response?: Json | null
          error?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          appointment_id?: string | null
          patient_id?: string | null
          kind?: WhatsAppMessageKind
          to_phone?: string
          message?: string
          status?: WhatsAppMessageStatus
          provider_response?: Json | null
          error?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_clinic_id_fkey"
            columns: ["clinic_id"]
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_appointment_id_fkey"
            columns: ["appointment_id"]
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_patient_id_fkey"
            columns: ["patient_id"]
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_rsvp_tokens: {
        Row: {
          id: string
          clinic_id: string
          appointment_id: string
          token: string
          expires_at: string
          used_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          appointment_id: string
          token: string
          expires_at: string
          used_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          appointment_id?: string
          token?: string
          expires_at?: string
          used_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_rsvp_tokens_clinic_id_fkey"
            columns: ["clinic_id"]
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_rsvp_tokens_appointment_id_fkey"
            columns: ["appointment_id"]
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      bootstrap_clinic: {
        Args: { p_clinic_name: string; p_full_name: string }
        Returns: string
      }
      provision_paid_clinic: {
        Args: {
          p_user_id: string
          p_clinic_name: string
          p_full_name: string
          p_plan_tier: string
          p_billing_provider: string | null
          p_billing_subscription_id: string | null
        }
        Returns: string
      }
      set_clinic_payment_status_by_subscription: {
        Args: { p_billing_subscription_id: string; p_status: string }
        Returns: null
      }
      create_rsvp_token: {
        Args: { p_appointment_id: string; p_hours?: number }
        Returns: string
      }
      rsvp_appointment: {
        Args: { p_token: string; p_action: string }
        Returns: string
      }
      get_booking_config: {
        Args: { p_slug: string }
        Returns: {
          clinic_id: string
          clinic_name: string
          booking_mode: string
          booking_window_days: number
          booking_lead_time_hours: number
          dentists: Json
          procedures: Json
        }[]
      }
      get_booking_availability: {
        Args: { p_slug: string; p_dentist_id?: string | null; p_procedure_id?: string | null; p_days?: number }
        Returns: { start_time: string }[]
      }
      create_booking_request: {
        Args: {
          p_slug: string
          p_patient_name: string
          p_patient_whatsapp: string
          p_patient_email?: string | null
          p_dentist_id?: string | null
          p_procedure_id?: string | null
          p_preferred_times: string[]
          p_notes?: string | null
        }
        Returns: string
      }
      create_booking_appointment: {
        Args: {
          p_slug: string
          p_patient_name: string
          p_patient_whatsapp: string
          p_start_time: string
          p_patient_email?: string | null
          p_dentist_id?: string | null
          p_procedure_id?: string | null
          p_notes?: string | null
        }
        Returns: string
      }
      find_or_create_patient_for_booking: {
        Args: { p_patient_name: string; p_patient_whatsapp: string; p_patient_email?: string | null }
        Returns: string
      }
      transfer_clinic_ownership: {
        Args: { p_new_owner_id: string }
        Returns: null
      }
      compute_next_return_date: {
        Args: { p_clinic_id: string; p_procedure_id: string; p_completed_on: string }
        Returns: string
      }
      current_clinic_id: {
        Args: Record<string, never>
        Returns: string
      }
      current_clinic_owner_id: {
        Args: Record<string, never>
        Returns: string
      }
      current_is_owner: {
        Args: Record<string, never>
        Returns: boolean
      }
      current_plan_tier: {
        Args: Record<string, never>
        Returns: string
      }
      current_role: {
        Args: Record<string, never>
        Returns: string
      }
      backfill_return_controls: {
        Args: { p_since?: string | null }
        Returns: number
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
