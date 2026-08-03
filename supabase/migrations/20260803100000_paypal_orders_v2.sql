create unique index if not exists payment_orders_provider_order_unique
  on public.payment_orders (provider, provider_order_id)
  where provider_order_id is not null;

alter table public.payment_webhook_events
  add column if not exists processing_status text not null default 'received',
  add column if not exists processed_at timestamptz,
  add column if not exists last_error text;

alter table public.payment_webhook_events
  drop constraint if exists payment_webhook_events_processing_status_check;

alter table public.payment_webhook_events
  add constraint payment_webhook_events_processing_status_check
  check (processing_status in ('received', 'processed', 'ignored', 'failed'));

create or replace function public.finalize_paypal_payment(
  p_order_id uuid,
  p_provider_order_id text,
  p_provider_payment_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.payment_orders%rowtype;
begin
  if nullif(btrim(p_provider_order_id), '') is null then
    raise exception 'PayPal order ID is required';
  end if;
  if nullif(btrim(p_provider_payment_id), '') is null then
    raise exception 'PayPal capture ID is required';
  end if;

  select * into v_order
  from public.payment_orders
  where id = p_order_id and provider = 'paypal'
  for update;

  if not found then
    raise exception 'FINISH payment order not found';
  end if;
  if v_order.provider_order_id is distinct from p_provider_order_id then
    raise exception 'PayPal order mismatch';
  end if;
  if upper(v_order.currency) <> 'USD' or v_order.amount <> 1 then
    raise exception 'FINISH payment amount mismatch';
  end if;
  if v_order.terms_accepted_at is null
     or v_order.no_refund_accepted_at is null
     or v_order.terms_version <> '2026-08-03'
     or v_order.no_refund_version <> '2026-08-03' then
    raise exception 'Payment order is missing current policy acceptance';
  end if;

  update public.payment_orders
  set status = 'paid',
      provider_payment_id = p_provider_payment_id,
      updated_at = now()
  where id = v_order.id;

  insert into public.enrollments (user_id, challenge_id, access_status, enrolled_at, updated_at)
  values (v_order.user_id, v_order.challenge_id, 'paid', now(), now())
  on conflict (user_id, challenge_id)
  do update set access_status = 'paid', updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'status', 'paid',
    'order_id', v_order.id,
    'user_id', v_order.user_id,
    'challenge_id', v_order.challenge_id,
    'capture_id', p_provider_payment_id
  );
end;
$$;

create or replace function public.revoke_paypal_payment(
  p_order_id uuid,
  p_status text default 'refunded'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.payment_orders%rowtype;
  v_status text := lower(coalesce(p_status, 'refunded'));
begin
  if v_status not in ('refunded', 'failed') then
    raise exception 'Unsupported revocation status';
  end if;

  select * into v_order
  from public.payment_orders
  where id = p_order_id and provider = 'paypal'
  for update;

  if not found then
    raise exception 'FINISH payment order not found';
  end if;

  update public.payment_orders
  set status = v_status, updated_at = now()
  where id = v_order.id;

  insert into public.enrollments (user_id, challenge_id, access_status, enrolled_at, updated_at)
  values (v_order.user_id, v_order.challenge_id, v_status, now(), now())
  on conflict (user_id, challenge_id)
  do update set access_status = v_status, updated_at = now();

  return jsonb_build_object('ok', true, 'status', v_status, 'order_id', v_order.id);
end;
$$;

revoke all on function public.finalize_paypal_payment(uuid, text, text) from public, anon, authenticated;
revoke all on function public.revoke_paypal_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.finalize_paypal_payment(uuid, text, text) to service_role;
grant execute on function public.revoke_paypal_payment(uuid, text) to service_role;
