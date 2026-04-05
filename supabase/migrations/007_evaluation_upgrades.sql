alter type question_type add value if not exists 'matching';
alter type question_type add value if not exists 'creative_writing';

alter table question_bank
add column if not exists metadata jsonb;

alter table tests
add column if not exists generation_config jsonb,
add column if not exists variant_label text;
