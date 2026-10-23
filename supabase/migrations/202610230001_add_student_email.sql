ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS email text;

CREATE UNIQUE INDEX IF NOT EXISTS students_email_unique
ON public.students (lower(email))
WHERE email IS NOT NULL;
