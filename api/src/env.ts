export interface Env {
  DB: D1Database;
  DEV_MODE?: string;
  FLIGHT_PROVIDER?: string;
  EMAIL_FROM?: string;
  RESEND_API_KEY?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_WHATSAPP_FROM?: string;
  FLIGHTAWARE_API_KEY?: string;
  ADMIN_TOKEN?: string;
  ID_CHECK?: string;
  VERIFY_PROVIDER?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
}

export interface Session {
  userId: string;
  kind: 'family' | 'parent';
  travellerId: string | null;
}

export type AppEnv = {
  Bindings: Env;
  Variables: { session: Session };
};
