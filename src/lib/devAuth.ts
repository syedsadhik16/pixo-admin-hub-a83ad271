// Temporary development bypass for admin auth.
// Set to `false` to fully restore the original Supabase auth + employee_profiles flow.
export const DEV_BYPASS_AUTH = true;

export const DEV_ADMIN_SESSION = {
  email: "admin@pixolearn.com",
  role: "admin" as const,
  status: "active" as const,
};
