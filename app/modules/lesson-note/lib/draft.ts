import { MAX_NOTE_LENGTH } from "~/lib/notes";

export type NoteDraft = {
  length: number;
  max: number;
  tooLong: boolean;
  unsaved: boolean;
  canSave: boolean;
};

/**
 * The character count against the limit, whether the box differs from the
 * saved Note, and whether Save is worth pressing. `savedBody` is null before
 * the Student has written a Note on this Lesson. Counts the trimmed text,
 * because that is what the save stores and checks against the limit.
 */
export function describeNoteDraft(
  draft: string,
  savedBody: string | null
): NoteDraft {
  const trimmed = draft.trim();
  const length = trimmed.length;
  const tooLong = length > MAX_NOTE_LENGTH;
  const unsaved = trimmed !== (savedBody ?? "");
  return {
    length,
    max: MAX_NOTE_LENGTH,
    tooLong,
    unsaved,
    canSave: unsaved && length > 0 && !tooLong,
  };
}
