create table if not exists public.billing_customers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_subscription_id text not null unique,
  stripe_customer_id text not null,
  status text not null,
  billing_interval text check (billing_interval in ('monthly', 'annual')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  is_pro boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.billing_customers enable row level security;
alter table public.billing_subscriptions enable row level security;

-- El navegador solo puede leer el entitlement de su propio usuario.
create policy "Users can read their own billing subscription"
  on public.billing_subscriptions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- No se conceden INSERT/UPDATE/DELETE a anon/authenticated. Las Edge Functions
-- verificadas usan el service role en servidor y son la única autoridad de escritura.
revoke all on table public.billing_customers from anon, authenticated;
revoke all on table public.billing_subscriptions from anon, authenticated;
grant select on table public.billing_subscriptions to authenticated;
grant all on table public.billing_customers to service_role;
grant all on table public.billing_subscriptions to service_role;
