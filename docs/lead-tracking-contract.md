# Lead & Payment Tracking Contract

> **For the student/parent app team.** This admin panel reads everything you write to two tables: `lead_events` and `payment_funnel_events`. Wire these calls in your app and the PIXO admin CRM populates automatically — leads get auto-classified server-side via the `lead_events_autobump` trigger.

## Setup (once)

Copy `src/lib/leadTracking.ts` from this admin repo into your student app, or re-implement the same calls. Both tables already allow `anon` insert via RLS, so no auth is required to track signals.

## What to call, when

### 1. On signup (just after `auth.signUp` succeeds)

```ts
import { trackSignup } from "@/lib/leadTracking";

await trackSignup({
  user_id: data.user.id,
  email: data.user.email,
  phone: data.user.phone,
  role: "student",          // or "parent"
  source: "website_signup", // or "referral", "landing_page", etc.
});
```

→ Pipeline stage becomes **cold**.

### 2. On every login attempt

```ts
import { trackLeadEvent } from "@/lib/leadTracking";

trackLeadEvent({ event_type: "login_attempt", email, role_attempted: "student" });

const { data, error } = await supabase.auth.signInWithPassword({ email, password });

if (error) {
  trackLeadEvent({
    event_type: "login_failed",
    email,
    success: false,
    failure_reason: error.message,
  });
} else {
  trackLeadEvent({
    event_type: "login_success",
    email,
    user_id: data.user?.id,
    success: true,
  });
}
```

→ Pipeline stage becomes **warm**.

### 3. On pricing page view

```ts
import { trackPricingPageView } from "@/lib/leadTracking";

useEffect(() => {
  trackPricingPageView({ user_id: session?.user?.id, email: session?.user?.email });
}, []);
```

→ Pipeline stage becomes **hot**.

### 4. On the payment / checkout flow

```ts
import { trackPaymentFunnel } from "@/lib/leadTracking";

// When the checkout page loads
useEffect(() => {
  trackPaymentFunnel({ user_id, event_type: "page_view", plan_name, amount });
}, []);

// When the user clicks "Pay now"
const handlePay = async () => {
  await trackPaymentFunnel({ user_id, event_type: "initiated", plan_name, amount });

  const result = await razorpay.checkout(...);

  if (result.success) {
    await trackPaymentFunnel({ user_id, event_type: "success", plan_name, amount });
  } else {
    await trackPaymentFunnel({
      user_id, event_type: "failed", plan_name, amount,
      failure_reason: result.error_code,
    });
  }
};
```

→ `page_view`/`initiated`/`failed` keep stage at **hot**. `success` promotes to **converted**.

## Server-side stage classification (already deployed)

You don't need to set the pipeline stage manually. The `lead_events_autobump` trigger does it:

| event_type             | New stage   |
|------------------------|-------------|
| `signup`               | `cold`      |
| `login_*`              | `warm`      |
| `payment_page_view`    | `hot`       |
| `payment_initiated`    | `hot`       |
| `payment_failed`       | `hot`       |
| `payment_success`      | `converted` |

Stages only ever move forward (hot stays hot if a `login_attempt` comes later).

## Where it shows up in admin

- **`/admin/crm`** — every profile with their current stage, remarks, follow-up date.
- **`/admin/leads`** — login attempt log + payment funnel + hot leads + failed payments + pipeline summary.
- **`/admin/leads`** export buttons → CSV (Sheets sync coming next).

## Reverting demo seed data

The admin was seeded with realistic demo events for initial dashboard usability. To remove:

```sql
DELETE FROM public.lead_events           WHERE meta->>'source' = 'seed';
DELETE FROM public.payment_funnel_events WHERE meta->>'source' = 'seed';
```

Real events from the student app are not tagged and will not be deleted.
