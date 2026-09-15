/**
 * Lesson ordering helpers.
 *
 * Pure functions over a course outline, deliberately separated from the page
 * that renders them and from anything that touches the database. Previous/next
 * across a module boundary is the kind of off-by-one that is tedious to
 * exercise through a rendered page and trivial to exercise directly.
 */
import type { CourseOutline, SyllabusLesson } from '@/types'

export type LessonRef = SyllabusLesson & {
  moduleId: string
  moduleTitle: string
}

/**
 * Every lesson in the course, flattened into reading order.
 *
 * Modules and lessons arrive already sorted by `position` (the query asks
 * PostgREST to order both levels), so this preserves that order rather than
 * re-sorting. A second sort here would be a second opinion about ordering, and
 * the database's is the one that matters.
 */
export function flattenLessons(outline: CourseOutline): LessonRef[] {
  return outline.modules.flatMap((module) =>
    module.lessons.map((lesson) => ({
      ...lesson,
      moduleId: module.id,
      moduleTitle: module.title,
    })),
  )
}

export type LessonPosition = {
  index: number
  total: number
  previous: LessonRef | null
  next: LessonRef | null
}

/**
 * Where a lesson sits in the course, and what comes either side of it.
 *
 * Navigation crosses module boundaries: the last lesson of module 1 is
 * followed by the first lesson of module 2, not by nothing. A student reading
 * straight through should never hit a dead end halfway.
 *
 * Returns null when the slug is not in the outline — which happens routinely,
 * not just on a typo: an unenrolled visitor's outline omits nothing, but an
 * outline fetched after a lesson was unpublished will.
 */
export function locateLesson(
  outline: CourseOutline,
  lessonSlug: string,
): LessonPosition | null {
  const lessons = flattenLessons(outline)
  const index = lessons.findIndex((lesson) => lesson.slug === lessonSlug)
  if (index === -1) return null

  return {
    index,
    total: lessons.length,
    previous: index > 0 ? lessons[index - 1] : null,
    next: index < lessons.length - 1 ? lessons[index + 1] : null,
  }
}

/** The first lesson of a course, for a "start here" link. */
export function firstLesson(outline: CourseOutline): LessonRef | null {
  return flattenLessons(outline)[0] ?? null
}
