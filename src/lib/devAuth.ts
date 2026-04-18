// Dev bypass disabled — use real Supabase auth via /admin/login.
export const DEV_BYPASS_AUTH = false;

export const DEV_ADMIN_SESSION = {
  email: "admin@pixolearn.com",
  role: "admin" as const,
  status: "active" as const,
};
