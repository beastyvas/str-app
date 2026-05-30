-- Add training_notes column to users for Lifter DNA profile
alter table public.users add column if not exists training_notes text;
