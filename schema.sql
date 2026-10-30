-- SSLG E-Voting System schema for Supabase.
-- Run in the Supabase SQL Editor. Safe to re-run on a fresh/current schema.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.parties (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key references auth.users (id) on delete cascade,
  student_id text not null unique,
  lrn text not null unique,
  full_name text not null,
  email text not null unique,
  grade_level integer not null check (grade_level between 7 and 12),
  section text not null,
  division text not null check (division in ('JHS', 'SHS')),
  role text not null default 'student',
  has_voted boolean not null default false,
  has_agreed_terms boolean not null default false,
  otp_code text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  constraint students_student_id_format check (student_id ~ '^[0-9]{8}$'),
  constraint students_lrn_format check (lrn ~ '^[0-9]{8}$'),
  constraint students_status_check check (status in ('pending', 'approved', 'rejected')),
  constraint students_otp_format check (otp_code is null or otp_code ~ '^[0-9]{6}$')
);

create table if not exists public.election_settings (
  id smallint primary key default 1 check (id = 1),
  status text not null default 'scheduled' check (status in ('scheduled', 'active', 'ended', 'cancelled')),
  start_time timestamptz,
  end_time timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.students (id) on delete set null,
  constraint election_settings_time_order check (start_time is null or end_time is null or end_time > start_time)
);

insert into public.election_settings (id, status)
values (1, 'scheduled')
on conflict (id) do nothing;

create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  position text not null,
  party_id uuid references public.parties (id) on delete set null,
  party_affiliation text,
  eligible_grades text[],
  allowed_grade_levels integer[],
  division text check (division is null or division in ('JHS', 'SHS')),
  photo_url text,
  image_url text,
  manifesto text,
  platform text,
  created_at timestamptz not null default now(),
  constraint candidates_eligible_grades_format check (
    eligible_grades is null or eligible_grades <@ array['7', '8', '9', '10', '11', '12']::text[]
  ),
  constraint candidates_allowed_grade_levels_format check (
    allowed_grade_levels is null or allowed_grade_levels <@ array[7, 8, 9, 10, 11, 12]::integer[]
  )
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  voter_id uuid not null references public.students (id) on delete cascade,
  student_lrn text not null references public.students (lrn) on update cascade on delete cascade,
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  position text not null,
  created_at timestamptz not null default now(),
  constraint votes_one_candidate_per_position unique (voter_id, position, candidate_id)
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('candidate-photos', 'candidate-photos', true, 4194304, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- CREATE TABLE IF NOT EXISTS does not add columns to tables created by older versions.
alter table public.students
  add column if not exists student_id text,
  add column if not exists lrn text,
  add column if not exists email text,
  add column if not exists division text,
  add column if not exists role text not null default 'student',
  add column if not exists has_voted boolean not null default false,
  add column if not exists has_agreed_terms boolean not null default false,
  add column if not exists otp_code text,
  add column if not exists status text,
  add column if not exists created_at timestamptz not null default now();

alter table public.candidates
  add column if not exists party_id uuid references public.parties (id) on delete set null,
  add column if not exists party_affiliation text,
  add column if not exists eligible_grades text[],
  add column if not exists allowed_grade_levels integer[],
  add column if not exists division text,
  add column if not exists photo_url text,
  add column if not exists image_url text,
  add column if not exists manifesto text,
  add column if not exists platform text,
  add column if not exists created_at timestamptz not null default now();

alter table public.votes
  add column if not exists voter_id uuid,
  add column if not exists student_lrn text,
  add column if not exists candidate_id uuid,
  add column if not exists position text,
  add column if not exists created_at timestamptz not null default now();

update public.students
set student_id = coalesce(student_id, lrn),
    lrn = coalesce(lrn, student_id),
    division = case when grade_level::integer >= 11 then 'SHS' else 'JHS' end;

update public.students
set status = 'approved'
where status is null or status not in ('pending', 'approved', 'rejected');

update public.students
set status = 'approved'
where student_id in ('20253810', '20212146');

alter table public.students alter column status set default 'pending';
alter table public.students alter column status set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.students'::regclass
      and conname = 'students_status_check'
  ) then
    alter table public.students
      add constraint students_status_check
      check (status in ('pending', 'approved', 'rejected'));
  end if;
end;
$$;

update public.candidates
set allowed_grade_levels = coalesce(
      allowed_grade_levels,
      (select array_agg(value::integer order by value::integer)
       from unnest(eligible_grades) as grade(value))
    ),
    eligible_grades = coalesce(
      eligible_grades,
      (select array_agg(value::text order by value)
       from unnest(allowed_grade_levels) as grade(value))
    ),
    photo_url = coalesce(photo_url, image_url),
    image_url = coalesce(image_url, photo_url),
    manifesto = coalesce(manifesto, platform),
    platform = coalesce(platform, manifesto);

update public.candidates
set division = case
  when position ilike '%(JHS)%' or position ilike '% JHS%' then 'JHS'
  when position ilike '%(SHS)%' or position ilike '% SHS%' then 'SHS'
  when allowed_grade_levels is not null and allowed_grade_levels <@ array[7, 8, 9, 10]::integer[] then 'JHS'
  when allowed_grade_levels is not null and allowed_grade_levels <@ array[11, 12]::integer[] then 'SHS'
  else division
end;

update public.votes as vote
set voter_id = student.id
from public.students as student
where vote.voter_id is null
  and vote.student_lrn = student.lrn;

update public.votes as vote
set student_lrn = student.lrn
from public.students as student
where vote.student_lrn is null
  and vote.voter_id = student.id;

create unique index if not exists students_student_id_unique_idx on public.students (student_id);
create unique index if not exists students_lrn_unique_idx on public.students (lrn);

alter table public.votes alter column voter_id set not null;
alter table public.votes alter column student_lrn set not null;
alter table public.votes alter column candidate_id set not null;
alter table public.votes alter column position set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.votes'::regclass
      and conname = 'votes_voter_id_fkey'
  ) then
    alter table public.votes
      add constraint votes_voter_id_fkey
      foreign key (voter_id) references public.students (id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.votes'::regclass
      and conname = 'votes_student_lrn_fkey'
  ) then
    alter table public.votes
      add constraint votes_student_lrn_fkey
      foreign key (student_lrn) references public.students (lrn)
      on update cascade on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.votes'::regclass
      and conname = 'votes_candidate_id_fkey'
  ) then
    alter table public.votes
      add constraint votes_candidate_id_fkey
      foreign key (candidate_id) references public.candidates (id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.votes'::regclass
      and conname = 'votes_one_candidate_per_position'
  ) then
    alter table public.votes
      add constraint votes_one_candidate_per_position
      unique (voter_id, position, candidate_id);
  end if;
end;
$$;

create index if not exists votes_voter_id_idx on public.votes (voter_id);
create index if not exists votes_student_lrn_idx on public.votes (student_lrn);
create index if not exists votes_candidate_position_idx on public.votes (candidate_id, position);
create index if not exists candidates_position_idx on public.candidates (position);
create unique index if not exists students_email_lower_unique_idx on public.students (lower(email));

create or replace function public.sync_student_compatibility_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.student_id := coalesce(new.student_id, new.lrn);
    new.lrn := coalesce(new.lrn, new.student_id);
  elsif new.student_id is distinct from old.student_id then
    new.lrn := new.student_id;
  elsif new.lrn is distinct from old.lrn then
    new.student_id := new.lrn;
  end if;

  new.division := case when new.grade_level >= 11 then 'SHS' else 'JHS' end;
  return new;
end;
$$;

drop trigger if exists students_sync_compatibility_fields on public.students;
create trigger students_sync_compatibility_fields
before insert or update of student_id, lrn, grade_level on public.students
for each row execute function public.sync_student_compatibility_fields();

create or replace function public.sync_candidate_compatibility_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.allowed_grade_levels := coalesce(
      new.allowed_grade_levels,
      (select array_agg(value::integer order by value::integer)
       from unnest(new.eligible_grades) as grade(value))
    );
    new.eligible_grades := coalesce(
      new.eligible_grades,
      (select array_agg(value::text order by value)
       from unnest(new.allowed_grade_levels) as grade(value))
    );
    new.image_url := coalesce(new.image_url, new.photo_url);
    new.photo_url := coalesce(new.photo_url, new.image_url);
    new.platform := coalesce(new.platform, new.manifesto);
    new.manifesto := coalesce(new.manifesto, new.platform);
  else
    if new.allowed_grade_levels is distinct from old.allowed_grade_levels then
      new.eligible_grades := (
        select array_agg(value::text order by value)
        from unnest(new.allowed_grade_levels) as grade(value)
      );
    elsif new.eligible_grades is distinct from old.eligible_grades then
      new.allowed_grade_levels := (
        select array_agg(value::integer order by value::integer)
        from unnest(new.eligible_grades) as grade(value)
      );
    end if;

    if new.image_url is distinct from old.image_url then
      new.photo_url := new.image_url;
    elsif new.photo_url is distinct from old.photo_url then
      new.image_url := new.photo_url;
    end if;

    if new.platform is distinct from old.platform then
      new.manifesto := new.platform;
    elsif new.manifesto is distinct from old.manifesto then
      new.platform := new.manifesto;
    end if;
  end if;

  if new.party_id is not null then
    select party.name into new.party_affiliation
    from public.parties as party
    where party.id = new.party_id;
  elsif new.party_affiliation is not null and tg_op = 'INSERT' then
    select party.id into new.party_id
    from public.parties as party
    where lower(party.name) = lower(new.party_affiliation)
    limit 1;
  end if;

  return new;
end;
$$;

drop trigger if exists candidates_sync_compatibility_fields on public.candidates;
create trigger candidates_sync_compatibility_fields
before insert or update of party_id, party_affiliation, eligible_grades, allowed_grade_levels,
  photo_url, image_url, manifesto, platform on public.candidates
for each row execute function public.sync_candidate_compatibility_fields();

create or replace function public.sync_vote_compatibility_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  student_uuid uuid;
  student_number text;
begin
  if new.voter_id is null and new.student_lrn is not null then
    select student.id into student_uuid
    from public.students as student where student.lrn = new.student_lrn;
    new.voter_id := student_uuid;
  elsif new.student_lrn is null and new.voter_id is not null then
    select student.lrn into student_number
    from public.students as student where student.id = new.voter_id;
    new.student_lrn := student_number;
  elsif new.voter_id is not null and new.student_lrn is not null then
    if not exists (
      select 1 from public.students as student
      where student.id = new.voter_id and student.lrn = new.student_lrn
    ) then
      raise exception 'voter_id and student_lrn must identify the same student';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists votes_sync_compatibility_fields on public.votes;
create trigger votes_sync_compatibility_fields
before insert or update of voter_id, student_lrn on public.votes
for each row execute function public.sync_vote_compatibility_fields();

drop function if exists public.submit_student_ballot(uuid, text, text, jsonb);

create function public.submit_student_ballot(
  p_student_id uuid,
  p_student_lrn text,
  p_provided_otp text,
  p_votes jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  student_row public.students%rowtype;
  election_status text;
begin
  if auth.uid() is null or auth.uid() <> p_student_id then
    raise exception 'Not authorized to submit this ballot';
  end if;
  if p_votes is null or jsonb_typeof(p_votes) is distinct from 'array' then
    raise exception 'The ballot must be a JSON array';
  end if;
  if jsonb_array_length(p_votes) = 0 then
    raise exception 'The ballot must contain at least one selection';
  end if;

  select * into student_row
  from public.students as student
  where student.id = p_student_id
  for update;

  if not found or student_row.lrn <> p_student_lrn then
    raise exception 'Student profile could not be verified';
  end if;
  if student_row.status <> 'approved' then
    raise exception 'This student account is not approved';
  end if;
  select setting.status into election_status
  from public.election_settings as setting
  where setting.id = 1;
  if election_status is distinct from 'active' then
    raise exception 'Voting is not currently active';
  end if;
  if not student_row.has_agreed_terms then
    raise exception 'Election terms must be accepted before voting';
  end if;
  if student_row.has_voted then
    raise exception 'A ballot has already been submitted';
  end if;
  if student_row.otp_code is null or student_row.otp_code <> p_provided_otp then
    raise exception 'The OTP is invalid';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_votes) as submitted(candidate_id uuid, position text)
    group by submitted.candidate_id
    having count(*) > 1
  ) then
    raise exception 'A candidate can only be selected once';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_votes) as submitted(candidate_id uuid, position text)
    left join public.candidates as candidate on candidate.id = submitted.candidate_id
    where candidate.id is null
      or candidate.position <> submitted.position
      or (candidate.allowed_grade_levels is not null
          and not (student_row.grade_level = any(candidate.allowed_grade_levels)))
  ) then
    raise exception 'The ballot contains an ineligible candidate';
  end if;

  if exists (
    select submitted.position
    from jsonb_to_recordset(p_votes) as submitted(candidate_id uuid, position text)
    group by submitted.position
    having count(*) > case
      when submitted.position ilike '%business manager%'
        or submitted.position ilike '%social media manager%' then 2
      else 1
    end
  ) then
    raise exception 'Too many candidates were selected for a position';
  end if;

  if exists (
    select 1
    from public.candidates as candidate
    where (candidate.allowed_grade_levels is null
           or student_row.grade_level = any(candidate.allowed_grade_levels))
      and candidate.position not ilike '%business manager%'
      and candidate.position not ilike '%social media manager%'
      and not exists (
        select 1
        from jsonb_to_recordset(p_votes) as submitted(candidate_id uuid, position text)
        where submitted.position = candidate.position
      )
  ) then
    raise exception 'A required position is missing from the ballot';
  end if;

  insert into public.votes (voter_id, student_lrn, candidate_id, position)
  select p_student_id, p_student_lrn, submitted.candidate_id, submitted.position
  from jsonb_to_recordset(p_votes) as submitted(candidate_id uuid, position text);

  update public.students
  set has_voted = true, otp_code = null
  where id = p_student_id;
end;
$$;

drop function if exists public.get_my_election_otp();

create function public.get_my_election_otp()
returns table (status text, otp_code text)
language sql
stable
security definer
set search_path = ''
as $$
  select setting.status,
    case
      when setting.status = 'active'
        and student.status = 'approved'
        and not student.has_voted then student.otp_code
      else null
    end as otp_code
  from public.election_settings as setting
  join public.students as student on student.id = auth.uid()
  where setting.id = 1
$$;

drop function if exists public.get_my_votes();

create function public.get_my_votes()
returns table (candidate_id uuid, "position" text)
language sql
stable
security definer
set search_path = ''
as $$
  select vote.candidate_id, vote.position
  from public.votes as vote
  where vote.voter_id = auth.uid()
$$;

drop function if exists public.reset_student_vote(text);

create function public.reset_student_vote(p_student_lrn text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Not authorized to reset a ballot';
  end if;

  delete from public.votes where student_lrn = p_student_lrn;
  update public.students
  set has_voted = false, otp_code = null
  where lrn = p_student_lrn;
end;
$$;

alter table public.students enable row level security;
alter table public.election_settings enable row level security;
alter table public.parties enable row level security;
alter table public.candidates enable row level security;
alter table public.votes enable row level security;

drop policy if exists students_select_own on public.students;
create policy students_select_own on public.students
for select to authenticated using (id = (select auth.uid()));

drop policy if exists students_update_own_terms on public.students;
create policy students_update_own_terms on public.students
for update to authenticated using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists parties_read_authenticated on public.parties;
create policy parties_read_authenticated on public.parties
for select to authenticated using (true);

drop policy if exists election_settings_read_authenticated on public.election_settings;
create policy election_settings_read_authenticated on public.election_settings
for select to authenticated using (true);

drop policy if exists candidates_read_authenticated on public.candidates;
create policy candidates_read_authenticated on public.candidates
for select to authenticated using (true);

drop policy if exists votes_read_authenticated_results on public.votes;
create policy votes_read_authenticated_results on public.votes
for select to authenticated using (true);

revoke all on public.students, public.parties, public.candidates, public.votes from anon, authenticated;
revoke all on public.election_settings from anon, authenticated;
grant select (id, student_id, lrn, full_name, email, grade_level, section, division, role,
  has_voted, has_agreed_terms, status, created_at) on public.students to authenticated;
grant update (has_agreed_terms) on public.students to authenticated;
grant select on public.election_settings to authenticated;
grant select on public.parties, public.candidates to authenticated;
grant select (candidate_id, position, created_at) on public.votes to authenticated;
grant all on public.students, public.parties, public.candidates, public.votes to service_role;

revoke all on function public.submit_student_ballot(uuid, text, text, jsonb) from public, anon;
grant execute on function public.submit_student_ballot(uuid, text, text, jsonb) to authenticated;
revoke all on function public.get_my_votes() from public, anon;
grant execute on function public.get_my_votes() to authenticated;
revoke all on function public.get_my_election_otp() from public, anon;
grant execute on function public.get_my_election_otp() to authenticated;
revoke all on function public.reset_student_vote(text) from public, anon, authenticated;
grant execute on function public.reset_student_vote(text) to service_role;

-- Admin authorization is enforced by the application's server-side allowlist.
-- Do not treat user-editable auth.users user_metadata as an authorization source.

-- Optional admin account examples (create accounts through Supabase Auth first):
-- insert into public.students
--   (id, student_id, lrn, full_name, email, grade_level, section, division, role, status)
-- values
--   ('<AUTH_USER_UUID_FOR_RHEANNE>', '20253810', '20253810', 'Rheanne Julia G. Gafate',
--    'rheanne@example.com', 12, 'A', 'SHS', 'admin', 'approved'),
--   ('<AUTH_USER_UUID_FOR_KLEO>', '20212146', '20212146', 'Kleo Andrei R. Sabino',
--    'kleo@example.com', 12, 'A', 'SHS', 'admin', 'approved')
-- on conflict (id) do update set role = excluded.role;