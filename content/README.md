# Lesson drafts

One Markdown file per lesson, reviewed here and loaded into the database once
approved. Prose is reviewable in a way SQL is not.

## Front matter

Every file opens with a `---` block carrying `module`, `title`, `slug`,
`blueprint` (the section code from `docs/exam-facts.md`), `summary`,
`estimated_minutes`, `status` and `review`. The importer strips it; it is
never part of the lesson body.

## The `review` line is load-bearing

```
review: UNREVIEWED — drafted by Claude, not yet checked by a licensed producer
```

Nothing carrying that line may be published. The intended enforcement is the
importer refusing to set `status: active` on a lesson still marked UNREVIEWED,
so no amount of forgetting can put unreviewed material in front of somebody
who paid for it.

This matters more here than the phrasing suggests. Drafts are written against
the published blueprint and read fluently and confidently; that is exactly
what makes an error in them hard to notice. The general-knowledge sections
(GK.I–VI) cover concepts that have been taught the same way for decades and
are the safer ground. The Texas sections (TX.I–II) turn on specific statutes,
and a draft written without the statute in front of the writer will be
plausible and occasionally wrong. Review those hardest.

## Authoring rules

- **Never reproduce ISO policy form language.** Explaining what an HO-3 covers
  is general industry knowledge. Quoting the form is somebody's copyright.
- **Never use recalled or leaked exam questions.** The candidate handbook
  describes exam-security monitoring and score cancellation; material built on
  stolen questions puts the business and its students at risk.
- **Cite the statute** for anything in TX.I or TX.II. The blueprint names the
  chapter and section for each sub-topic — use it.
- Raw HTML renders as literal text, by design (`lib/markdown.ts`). An HTML
  comment will therefore be *visible on the page*, so answers and notes cannot
  be hidden that way. Put answers in their own section.
