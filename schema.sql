-- ============================================================
--  Minecraft 生电服 · 里程碑数据库
--  用法：Supabase → SQL Editor → New query → 粘贴全文 → Run
--  本文件可以重复执行，不会报错，也不会清空已有数据。
-- ============================================================


-- ------------------------------------------------------------
-- 1. 里程碑主表
-- ------------------------------------------------------------
create table if not exists public.milestones (
  id            uuid primary key default gen_random_uuid(),
  era           text        not null check (era in ('past', 'present', 'future')),
  title         text        not null check (char_length(title) between 1 and 80),
  summary       text        not null default '',
  -- 对应界面上的「功能」。刻意不叫 function，避开 SQL 保留字。
  function_desc text        not null default '',
  dimension     text        not null default 'overworld'
                            check (dimension in ('overworld', 'nether', 'end')),
  coord_x       integer,
  coord_y       integer,
  coord_z       integer,
  author        text        not null default '',
  category      text        not null default '',
  progress      integer     not null default 0 check (progress between 0 and 100),
  -- 分数排序：拖动时取前后邻居的中点，只需写一行。
  sort_order    double precision not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 规范排序恒为 ORDER BY sort_order ASC, id ASC
create index if not exists milestones_era_sort_idx
  on public.milestones (era, sort_order, id);


-- ------------------------------------------------------------
-- 2. updated_at 自动维护
-- ------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_touch_milestones on public.milestones;
create trigger trg_touch_milestones
  before update on public.milestones
  for each row execute function public.touch_updated_at();


-- ------------------------------------------------------------
-- 3. 群口令
--    存在 app_config，这张表开了 RLS 但不建任何 policy，
--    所以匿名用户读不到，只有下面的 definer 函数能取到。
-- ------------------------------------------------------------
create table if not exists public.app_config (
  key   text primary key,
  value text not null
);

alter table public.app_config enable row level security;
revoke all on public.app_config from anon, authenticated;

-- ★★★ 请把下面这行的 CHANGE-ME 换成你自己的群口令 ★★★
--     换的时候注意保留单引号。改完重新执行本文件即可生效。
insert into public.app_config (key, value)
values ('write_passcode', 'CHANGE-ME')
on conflict (key) do nothing;


create or replace function public.check_passcode(p text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p is null
     or p = ''
     or p <> (select value from public.app_config where key = 'write_passcode') then
    raise exception '群口令不正确' using errcode = '28000';
  end if;
end $$;


-- ------------------------------------------------------------
-- 4. 读取权限：只开 SELECT
-- ------------------------------------------------------------
alter table public.milestones enable row level security;

drop policy if exists "milestones_read_all" on public.milestones;
create policy "milestones_read_all" on public.milestones
  for select to anon, authenticated
  using (true);

-- Supabase 默认会给 anon 授予全部权限，必须显式收回增删改，
-- 否则上面那道群口令就完全绕过去了。
revoke insert, update, delete on public.milestones from anon, authenticated;


-- ------------------------------------------------------------
-- 5. 写入通道：全部走带口令校验的 RPC
-- ------------------------------------------------------------

-- 5.1 新建 / 编辑
--     传入 jsonb，含 id 就是编辑，不含就是新建。
create or replace function public.upsert_milestone(p_passcode text, p_data jsonb)
returns public.milestones
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.milestones;
begin
  perform public.check_passcode(p_passcode);

  -- 用 jsonb_exists() 而不是 ? 运算符：问号在某些客户端里会被当成占位符
  if jsonb_exists(p_data, 'id') and coalesce(p_data->>'id', '') <> '' then
    update public.milestones set
      era           = coalesce(p_data->>'era', era),
      title         = coalesce(p_data->>'title', title),
      summary       = coalesce(p_data->>'summary', summary),
      function_desc = coalesce(p_data->>'function_desc', function_desc),
      dimension     = coalesce(p_data->>'dimension', dimension),
      coord_x       = nullif(p_data->>'coord_x', '')::int,
      coord_y       = nullif(p_data->>'coord_y', '')::int,
      coord_z       = nullif(p_data->>'coord_z', '')::int,
      author        = coalesce(p_data->>'author', author),
      category      = coalesce(p_data->>'category', category),
      progress      = coalesce((p_data->>'progress')::int, progress)
    where id = (p_data->>'id')::uuid
    returning * into r;

    if r.id is null then
      raise exception '找不到要编辑的卡片' using errcode = 'P0002';
    end if;
  else
    insert into public.milestones
      (era, title, summary, function_desc, dimension,
       coord_x, coord_y, coord_z, author, category, progress, sort_order)
    values
      (p_data->>'era',
       p_data->>'title',
       coalesce(p_data->>'summary', ''),
       coalesce(p_data->>'function_desc', ''),
       coalesce(p_data->>'dimension', 'overworld'),
       nullif(p_data->>'coord_x', '')::int,
       nullif(p_data->>'coord_y', '')::int,
       nullif(p_data->>'coord_z', '')::int,
       coalesce(p_data->>'author', ''),
       coalesce(p_data->>'category', ''),
       coalesce((p_data->>'progress')::int, 0),
       -- 新建的卡片排在目标区段末尾
       coalesce((select max(sort_order) + 1 from public.milestones
                  where era = p_data->>'era'), 0))
    returning * into r;
  end if;

  return r;
end $$;


-- 5.2 拖动
--     客户端只传目标区段和前后邻居的 id，浮点数由服务端算，
--     避免客户端拿过期状态算出一个坏值。
create or replace function public.move_milestone(
  p_passcode text,
  p_id       uuid,
  p_era      text,
  p_prev     uuid,
  p_next     uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev double precision;
  v_next double precision;
  v_new  double precision;
begin
  perform public.check_passcode(p_passcode);

  if p_era not in ('past', 'present', 'future') then
    raise exception '区段不合法' using errcode = '22023';
  end if;

  select sort_order into v_prev from public.milestones where id = p_prev;
  select sort_order into v_next from public.milestones where id = p_next;

  if    v_prev is null and v_next is null then v_new := 0;
  elsif v_prev is null                     then v_new := v_next - 1;
  elsif v_next is null                     then v_new := v_prev + 1;
  else                                          v_new := (v_prev + v_next) / 2;
  end if;

  -- 只有发生碰撞或浮点精度耗尽时才整段重排（按 1024 的间隔重铺）。
  if (v_prev is not null and v_new <= v_prev)
     or (v_next is not null and v_new >= v_next) then

    with ordered as (
      select id, row_number() over (order by sort_order, id) * 1024.0 as pos
      from public.milestones
      where era = p_era and id <> p_id
    )
    update public.milestones m
       set sort_order = o.pos
      from ordered o
     where m.id = o.id;

    select sort_order into v_prev from public.milestones where id = p_prev;
    select sort_order into v_next from public.milestones where id = p_next;

    if    v_prev is null and v_next is null then v_new := 0;
    elsif v_prev is null                     then v_new := v_next - 1;
    elsif v_next is null                     then v_new := v_prev + 1;
    else                                          v_new := (v_prev + v_next) / 2;
    end if;
  end if;

  update public.milestones
     set era = p_era, sort_order = v_new
   where id = p_id;
end $$;


-- 5.3 删除
create or replace function public.delete_milestone(p_passcode text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.check_passcode(p_passcode);
  delete from public.milestones where id = p_id;
end $$;


-- ------------------------------------------------------------
-- 6. 给匿名用户开放这三个函数的调用权
--    （表本身的写权限上面已经收回了，所以只能从这儿进）
-- ------------------------------------------------------------
grant execute on function public.upsert_milestone(text, jsonb)          to anon, authenticated;
grant execute on function public.move_milestone(text, uuid, text, uuid, uuid) to anon, authenticated;
grant execute on function public.delete_milestone(text, uuid)           to anon, authenticated;


-- ------------------------------------------------------------
-- 7. 自检：三条都应该是 true
-- ------------------------------------------------------------
select
  (select relrowsecurity from pg_class where relname = 'milestones')  as "里程碑表已开行级安全",
  (select relrowsecurity from pg_class where relname = 'app_config')  as "口令表已开行级安全",
  (select count(*) = 0 from information_schema.role_table_grants
    where table_name = 'milestones' and grantee = 'anon'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE'))           as "匿名用户已无写权限";
