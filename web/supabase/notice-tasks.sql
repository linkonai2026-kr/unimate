-- 내 마감(공지에서 "신청 준비해 줘"로 담은 할 일). 서버(service role)만 읽고 쓴다.
-- 이 표가 없으면 앱은 서버 메모리에 저장한다(재시작하면 사라짐)
create table if not exists notice_tasks (
  id text primary key,
  "userId" text not null,
  board text not null,
  "noticeId" text not null,
  data jsonb not null,
  "createdAt" bigint not null,
  unique ("userId", board, "noticeId")
);
create index if not exists notice_tasks_user on notice_tasks ("userId");
alter table notice_tasks enable row level security;
