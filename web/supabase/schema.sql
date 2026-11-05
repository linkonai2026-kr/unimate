-- Unimate 데이터베이스 스키마(Supabase SQL Editor에 그대로 붙여 실행, 여러 번 실행해도 된다). 컬럼 이름은 앱 타입과 같은 camelCase
-- 모든 테이블은 RLS를 켜고 정책을 두지 않는다: 브라우저(anon 키)는 직접 읽고 쓸 수 없고, 서버(service role)만 접근한다

create table if not exists profiles (
  id text primary key, handle text unique not null, nickname text not null, nationality text not null,
  lang text not null, "passHash" text not null, "createdAt" bigint not null,
  avatar int, major text, year text, photo text, pins text[]
);
alter table profiles add column if not exists photo text;
alter table profiles add column if not exists pins text[];

create table if not exists posts (
  id text primary key, board text not null, "authorId" text not null, anonymous boolean not null,
  title text not null, body text not null, lang text not null, tr jsonb not null default '{}',
  likes text[] not null default '{}', scraps text[] not null default '{}', images text[] not null default '{}',
  "createdAt" bigint not null
);
alter table posts add column if not exists images text[] not null default '{}';
create index if not exists posts_board_created on posts (board, "createdAt" desc);
create index if not exists posts_created on posts ("createdAt" desc);
create index if not exists posts_author on posts ("authorId", "createdAt" desc);
-- 스크랩한 글 찾기(scraps @> {사용자})
create index if not exists posts_scraps on posts using gin (scraps);

create table if not exists comments (
  id text primary key, "postId" text not null, "parentId" text, "authorId" text not null, anonymous boolean not null,
  body text not null, lang text not null, tr jsonb not null default '{}', likes text[] not null default '{}', "createdAt" bigint not null
);
create index if not exists comments_post on comments ("postId", "createdAt");
create index if not exists comments_author on comments ("authorId", "createdAt" desc);

create table if not exists tables (
  id text primary key, "userId" text not null, sem text not null, name text not null,
  "primary" boolean not null, colors jsonb not null default '{}', "createdAt" bigint not null
);
create index if not exists tables_user_sem on tables ("userId", sem, "createdAt");

create table if not exists courses (
  id text primary key, "userId" text not null, "tableId" text not null, code text, credit int, prof text,
  name text not null, place text not null, day int not null, start int not null, "end" int not null
);
create index if not exists courses_table on courses ("tableId");

create table if not exists friends (a text not null, b text not null, primary key (a, b));
create index if not exists friends_b on friends (b);
create table if not exists friend_requests ("from" text not null, "to" text not null, "createdAt" bigint not null, primary key ("from", "to"));
create index if not exists friend_requests_to on friend_requests ("to");

create table if not exists messages (
  id text primary key, "fromId" text not null, "toId" text not null, body text not null, lang text not null,
  tr jsonb not null default '{}', "createdAt" bigint not null
);
create index if not exists messages_pair on messages ("fromId", "toId", "createdAt");
create index if not exists messages_to on messages ("toId", "createdAt");

create table if not exists reviews (
  id text primary key, "courseName" text not null, professor text not null, "authorId" text not null,
  rating int not null, fields jsonb not null default '{}', body text not null, lang text not null,
  tr jsonb not null default '{}', "createdAt" bigint not null
);
create index if not exists reviews_course on reviews ("courseName", "createdAt" desc);

create table if not exists catalog (
  code text primary key, name text not null, prof text not null, credit int not null, type text not null,
  place text not null, slots jsonb not null
);

-- 게시판·프로필 사진(브라우저에서 줄인 JPEG을 base64로 저장, 형식은 앞 바이트로 확인한 값)
create table if not exists images (id text primary key, type text not null, "ownerId" text not null, data text not null, "createdAt" bigint not null);

create table if not exists boards (
  id text primary key, name text not null, "desc" text not null default '', lang text not null,
  tr jsonb not null default '{}', "ownerId" text not null, "createdAt" bigint not null
);
create table if not exists grades ("userId" text primary key, sems jsonb not null default '[]');

-- 공감·스크랩 토글: UPDATE 한 번이라 같은 순간 여러 명이 눌러도 빠지지 않는다(행 잠금 뒤 새 값으로 다시 계산).
-- 서버(service role)만 부를 수 있다. 행이 없으면 null
create or replace function toggle_post_like(p_id text, p_user text) returns integer language sql as $$
  update posts set likes = case when p_user = any(likes) then array_remove(likes, p_user) else array_append(likes, p_user) end
  where id = p_id returning cardinality(likes);
$$;
create or replace function toggle_comment_like(p_id text, p_user text) returns integer language sql as $$
  update comments set likes = case when p_user = any(likes) then array_remove(likes, p_user) else array_append(likes, p_user) end
  where id = p_id returning cardinality(likes);
$$;
create or replace function toggle_post_scrap(p_id text, p_user text) returns boolean language sql as $$
  update posts set scraps = case when p_user = any(scraps) then array_remove(scraps, p_user) else array_append(scraps, p_user) end
  where id = p_id returning p_user = any(scraps);
$$;
-- 시간표 강의 통째 교체: 시간표 행을 잠그고 한 트랜잭션에서 지우고 넣는다(동시에 두 번 바꿔도 섞이지 않는다)
create or replace function replace_table_courses(p_table text, p_courses jsonb) returns void language plpgsql as $$
declare v_user text;
begin
  select "userId" into v_user from tables where id = p_table for update;
  if v_user is null then return; end if;
  delete from courses where "tableId" = p_table;
  insert into courses (id, "userId", "tableId", code, credit, prof, name, place, day, start, "end")
  select gen_random_uuid()::text, v_user, p_table, c.code, c.credit, c.prof, c.name, c.place, c.day, c.start, c."end"
  from jsonb_to_recordset(coalesce(p_courses, '[]'::jsonb)) as c(code text, credit int, prof text, name text, place text, day int, start int, "end" int);
end
$$;
revoke all on function toggle_post_like(text, text), toggle_comment_like(text, text), toggle_post_scrap(text, text), replace_table_courses(text, jsonb) from public, anon, authenticated;
grant execute on function toggle_post_like(text, text), toggle_comment_like(text, text), toggle_post_scrap(text, text), replace_table_courses(text, jsonb) to service_role;

alter table profiles enable row level security;
alter table boards enable row level security;
alter table posts enable row level security;
alter table comments enable row level security;
alter table tables enable row level security;
alter table courses enable row level security;
alter table friends enable row level security;
alter table friend_requests enable row level security;
alter table messages enable row level security;
alter table reviews enable row level security;
alter table catalog enable row level security;
alter table grades enable row level security;
alter table images enable row level security;

-- =====================================================================================================
-- 신고·AI 검수·자동 제재(2026-11 추가). 이 블록만 따로 SQL Editor에 붙여 실행해도 되고, 여러 번 실행해도 된다
-- =====================================================================================================
-- 위반 횟수(1·2번 경고, 3번째부터 이용 제한), 제한 끝 시각(ms), 마지막 제한 사유(규칙 id)
alter table profiles add column if not exists violations int not null default 0;
alter table profiles add column if not exists "suspendedUntil" bigint;
alter table profiles add column if not exists "sanctionReason" text;
-- 규칙 위반으로 가려진 글·댓글
alter table posts add column if not exists hidden boolean not null default false;
alter table comments add column if not exists hidden boolean not null default false;

-- 신고: 한 사람이 같은 글·댓글은 한 번만. status는 AI 검수 결과(pending = 검수 전·실패)
create table if not exists reports (
  id text primary key, "reporterId" text not null, kind text not null check (kind in ('post', 'comment')),
  "targetId" text not null, "authorId" text not null, reason text not null, detail text not null default '',
  status text not null default 'pending' check (status in ('pending', 'violation', 'clean')), "createdAt" bigint not null,
  unique ("reporterId", kind, "targetId")
);
create index if not exists reports_target on reports (kind, "targetId");
alter table reports enable row level security;

-- 위반 처리: 아직 가려지지 않은 글·댓글이면 가리고(행 잠금) 작성자 위반 횟수 +1, p_free번을 넘으면 이용 제한.
-- 같은 글을 동시에 두 번 처리해도 두 번째는 hidden = false 조건에 걸려 아무것도 하지 않는다(null). 기간 상수는 앱이 넘긴다
create or replace function apply_violation(p_kind text, p_id text, p_rule text, p_now bigint, p_free int, p_first_ms bigint, p_repeat_ms bigint)
returns jsonb language plpgsql as $$
declare v_author text; v_count int; v_until bigint;
begin
  if p_kind = 'post' then
    update posts set hidden = true where id = p_id and hidden = false returning "authorId" into v_author;
  elsif p_kind = 'comment' then
    update comments set hidden = true where id = p_id and hidden = false returning "authorId" into v_author;
  end if;
  if v_author is null then return null; end if;
  update profiles set violations = violations + 1 where id = v_author returning violations, "suspendedUntil" into v_count, v_until;
  if v_count is null then
    return jsonb_build_object('authorId', v_author, 'violations', 0, 'suspendedUntil', null);
  end if;
  if v_count > p_free then
    v_until := greatest(coalesce(v_until, 0), p_now + case when v_count = p_free + 1 then p_first_ms else p_repeat_ms end);
    update profiles set "suspendedUntil" = v_until, "sanctionReason" = p_rule where id = v_author;
  end if;
  return jsonb_build_object('authorId', v_author, 'violations', v_count, 'suspendedUntil', v_until);
end
$$;
revoke all on function apply_violation(text, text, text, bigint, int, bigint, bigint) from public, anon, authenticated;
grant execute on function apply_violation(text, text, text, bigint, int, bigint, bigint) to service_role;
