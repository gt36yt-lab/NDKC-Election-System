alter table public.students
  add column if not exists email text,
  add column if not exists raw_password text;

alter table public.candidates
  rename column image_url to photo_url;

alter table public.parties
  add column if not exists logo_url text;

insert into storage.buckets (id, name, public)
values ('candidate-photos', 'candidate-photos', true), ('party-logos', 'party-logos', true)
on conflict (id) do update set public = excluded.public;