import { describe, type NoteDraft } from "./lib/draft";

export type { NoteDraft };

/**
 * What the Lesson page's note form shows for the text in the box: the
 * character count against the limit, whether it differs from the saved Note,
 * and whether Save is worth pressing. `savedBody` is null before the Student
 * has written a Note on this Lesson.
 */
export function describeNoteDraft(
  draft: string,
  savedBody: string | null
): NoteDraft {
  return describe(draft, savedBody);
}
