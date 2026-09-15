import { describe, expect, it } from 'vitest'
import {
  firstLesson,
  flattenLessons,
  locateLesson,
} from '@/lib/lesson-navigation'
import type { CourseOutline } from '@/types'

function lesson(slug: string, position: number) {
  return {
    id: `lesson-${slug}`,
    title: slug.replace(/-/g, ' '),
    slug,
    summary: null,
    position,
    estimated_minutes: 10,
  }
}

/**
 * Two modules, two lessons each. The interesting case is the boundary between
 * them: `b` is the last lesson of module one and `c` the first of module two.
 */
const OUTLINE: CourseOutline = {
  course: {
    id: 'course-1',
    title: 'Course',
    slug: 'course',
    description: null,
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  modules: [
    {
      id: 'module-1',
      title: 'One',
      description: null,
      position: 1,
      lessons: [lesson('a', 1), lesson('b', 2)],
    },
    {
      id: 'module-2',
      title: 'Two',
      description: null,
      position: 2,
      lessons: [lesson('c', 1), lesson('d', 2)],
    },
  ],
  estimatedMinutes: 40,
  lessonCount: 4,
}

const EMPTY: CourseOutline = {
  ...OUTLINE,
  modules: [],
  estimatedMinutes: null,
  lessonCount: 0,
}

describe('flattenLessons', () => {
  it('returns every lesson in reading order across modules', () => {
    expect(flattenLessons(OUTLINE).map((l) => l.slug)).toEqual([
      'a',
      'b',
      'c',
      'd',
    ])
  })

  it('carries the owning module through, for the lesson header', () => {
    expect(flattenLessons(OUTLINE)[2]).toMatchObject({
      slug: 'c',
      moduleId: 'module-2',
      moduleTitle: 'Two',
    })
  })

  it('preserves the order given rather than re-sorting', () => {
    // The query orders both levels in SQL. If this function sorted as well,
    // a deliberate ordering change in the database would be silently undone.
    const reversed: CourseOutline = {
      ...OUTLINE,
      modules: [...OUTLINE.modules].reverse(),
    }
    expect(flattenLessons(reversed).map((l) => l.slug)).toEqual([
      'c',
      'd',
      'a',
      'b',
    ])
  })

  it('handles a course with no modules', () => {
    expect(flattenLessons(EMPTY)).toEqual([])
  })
})

describe('locateLesson', () => {
  it('reports the position within the whole course, not within the module', () => {
    expect(locateLesson(OUTLINE, 'c')).toMatchObject({ index: 2, total: 4 })
  })

  it('has no previous lesson at the very start', () => {
    const position = locateLesson(OUTLINE, 'a')
    expect(position?.previous).toBeNull()
    expect(position?.next?.slug).toBe('b')
  })

  it('has no next lesson at the very end', () => {
    const position = locateLesson(OUTLINE, 'd')
    expect(position?.next).toBeNull()
    expect(position?.previous?.slug).toBe('c')
  })

  it('walks across a module boundary rather than dead-ending', () => {
    // The bug this guards against: treating the end of a module as the end of
    // the course, so a student reading straight through stops halfway.
    expect(locateLesson(OUTLINE, 'b')?.next?.slug).toBe('c')
    expect(locateLesson(OUTLINE, 'c')?.previous?.slug).toBe('b')
  })

  it('returns null for a slug that is not in the outline', () => {
    expect(locateLesson(OUTLINE, 'nope')).toBeNull()
    expect(locateLesson(EMPTY, 'a')).toBeNull()
  })
})

describe('firstLesson', () => {
  it('is the first lesson of the first module', () => {
    expect(firstLesson(OUTLINE)?.slug).toBe('a')
  })

  it('is null when nothing is published', () => {
    expect(firstLesson(EMPTY)).toBeNull()
  })

  it('skips an empty leading module', () => {
    // A module whose lessons are all drafts arrives with an empty array, and
    // "start here" must not return nothing because of it.
    const withEmptyFirst: CourseOutline = {
      ...OUTLINE,
      modules: [
        { id: 'm0', title: 'Empty', description: null, position: 1, lessons: [] },
        ...OUTLINE.modules,
      ],
    }
    expect(firstLesson(withEmptyFirst)?.slug).toBe('a')
  })
})
