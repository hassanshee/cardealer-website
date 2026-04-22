const DEFAULT_SITE_URL = "http://localhost:3000";

export const env = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  supabasePublishableKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "",
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY || "",
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || "",
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || "",
  resendApiKey: process.env.RESEND_API_KEY || "",
  adminNotificationEmail:
    process.env.ADMIN_NOTIFICATION_EMAIL || "sales@example.com",
  adminSuperEmail: process.env.ADMIN_SUPER_EMAIL || "",
  adminDefaultPassword: process.env.ADMIN_DEFAULT_PASSWORD || "",
  demoAdminEmail: process.env.DEMO_ADMIN_EMAIL || "",
  demoAdminPassword: process.env.DEMO_ADMIN_PASSWORD || "",
  demoAdminSessionSecret: process.env.DEMO_ADMIN_SESSION_SECRET || "",
};

export const hasAdminSuperEmailConfig = Boolean(env.adminSuperEmail);
export const hasAdminDefaultPasswordConfig = Boolean(env.adminDefaultPassword);
export const hasAdminManagementConfig =
  hasAdminSuperEmailConfig && hasAdminDefaultPasswordConfig;

export const hasSupabaseConfig = Boolean(
  env.supabaseUrl && env.supabasePublishableKey,
);

export const hasSupabaseSecretConfig = Boolean(
  env.supabaseUrl && env.supabaseSecretKey,
);

export const hasCloudinaryConfig = Boolean(
  env.cloudinaryCloudName && env.cloudinaryApiKey && env.cloudinaryApiSecret,
);

export const hasResendConfig = Boolean(env.resendApiKey);

export const isLocalDevelopment = process.env.NODE_ENV === "development";
export const isE2ETestRuntime = process.env.E2E_TEST_MODE === "1";

export const allowLocalDemoMode =
  process.env.ENABLE_DEMO_ADMIN === "1" &&
  (isLocalDevelopment || isE2ETestRuntime);

export const hasDemoAdminCredentials = Boolean(
  env.demoAdminEmail &&
    env.demoAdminPassword &&
    env.demoAdminSessionSecret,
);

export const allowDemoAdmin = allowLocalDemoMode && hasDemoAdminCredentials;
