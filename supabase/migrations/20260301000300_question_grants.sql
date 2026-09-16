-- Grants and policies for the readable half of the question bank.
--
-- Same posture as Phase 2: revoke Supabase's default blanket grants, then
-- grant back exactly what each role needs, then let RLS decide the rows.

alter table public.questions        enable row level security;
alter table public.question_options enable row level security;

revoke all on table public.questions        from anon, authenticated;
revoke all on table public.question_options from anon, authenticated;

-- Students read questions and options. They never write either: an attempt
-- records an answer in attempt_questions, it does not modify the bank.
grant select on table public.questions        to authenticated;
grant select on table public.question_options to authenticated;

-- Nothing for anon. Unlike the course syllabus, which is public marketing,
-- the question bank is the product. An anonymous visitor gets none of it --
-- not even the stems, which are most of the value and the easiest thing to
-- scrape.

-- ---------------------------------------------------------------------------

-- A question is visible when it is published AND its parent course is active
-- AND the reader holds a live enrollment. The whole chain is checked, so
-- archiving a course hides its questions without anyone cascading by hand.
create policy questions_select_enrolled
  on public.questions
  for select
  to authenticated
  using (
    status = 'active'::public.content_status
    and exists (
      select 1 from public.courses c
       where c.id = questions.course_id
         and c.status = 'active'::public.course_status
    )
    and public.is_enrolled_in_course(course_id)
  );

create policy questions_select_admin
  on public.questions for select to authenticated
  using (public.is_admin());

create policy questions_insert_admin
  on public.questions for insert to authenticated
  with check (public.is_admin());
create policy questions_update_admin
  on public.questions for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy questions_delete_admin
  on public.questions for delete to authenticated
  using (public.is_admin());

-- Options follow their question exactly. Expressed as a lookup against
-- questions rather than repeating the conditions, so the two can never drift:
-- if the question is invisible the option is invisible, by construction.
create policy question_options_select_visible_question
  on public.question_options
  for select
  to authenticated
  using (
    exists (
      select 1 from public.questions q where q.id = question_options.question_id
    )
  );

create policy question_options_insert_admin
  on public.question_options for insert to authenticated
  with check (public.is_admin());
create policy question_options_update_admin
  on public.question_options for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy question_options_delete_admin
  on public.question_options for delete to authenticated
  using (public.is_admin());

comment on policy question_options_select_visible_question
  on public.question_options is
  'An option is visible exactly when its question is. The EXISTS re-enters '
  'the questions table, so the questions policy does the work and there is '
  'one place to change the rule rather than two that must agree.';
