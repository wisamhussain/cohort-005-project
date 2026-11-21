import { MAX_NOTE_LENGTH } from "~/lib/notes";

export type NoteDraft = {
  length: number;
  max: number;
  tooLong: boolean;
  empty: boolean;
  unsaved: boolean;
  canSave: boolean;
};

export function describe(draft: string, savedBody: string | null): NoteDraft {
  const length = draft.length;
  const tooLong = length > MAX_NOTE_LENGTH;
  const empty = draft.trim().length === 0;
  const unsaved = draft.trim() !== (savedBody ?? "");
  return {
    length,
    max: MAX_NOTE_LENGTH,
    tooLong,
    empty,
    unsaved,
    canSave: unsaved && !empty && !tooLong,
  };
}
