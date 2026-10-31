-- 007_clean_profile_names.sql
-- Strip trailing role suffixes in parentheses from public.profiles.name
-- Only strips: (سرپرست اکیپ), (تکنسین نصب), (مسئول QC), (مسئول فنی و QC)
-- Trims surrounding whitespace and is idempotent.

update public.profiles
set name = trim(
  regexp_replace(
    name,
    '\s*\((سرپرست اکیپ|تکنسین نصب|مسئول QC|مسئول فنی و QC)\)\s*$',
    '',
    'g'
  )
)
where name ~ '\((سرپرست اکیپ|تکنسین نصب|مسئول QC|مسئول فنی و QC)\)\s*$';
