import { describe, it, expect } from "vitest";
import { describeNoteDraft } from "../index";
import { MAX_NOTE_LENGTH } from "~/lib/notes";

describe("describeNoteDraft", () => {
  it("cannot save an empty box before any Note exists", () => {
    const draft = describeNoteDraft("", null);
    expect(draft).toEqual({
      length: 0,
      max: MAX_NOTE_LENGTH,
      tooLong: false,
      unsaved: false,
      canSave: false,
    });
  });

  it("treats whitespace as empty", () => {
    const draft = describeNoteDraft("   \n ", null);
    expect(draft.length).toBe(0);
    expect(draft.canSave).toBe(false);
  });

  it("can save new text", () => {
    const draft = describeNoteDraft("Result types beat throwing", null);
    expect(draft.length).toBe(26);
    expect(draft.unsaved).toBe(true);
    expect(draft.canSave).toBe(true);
  });

  it("has nothing to save when the box matches the saved Note", () => {
    const draft = describeNoteDraft("Same text", "Same text");
    expect(draft.unsaved).toBe(false);
    expect(draft.canSave).toBe(false);
  });

  it("ignores surrounding whitespace, which the save trims anyway", () => {
    expect(describeNoteDraft("  Same text\n", "Same text").unsaved).toBe(false);
  });

  it("can save an edit to the saved Note", () => {
    const draft = describeNoteDraft("Edited", "Original");
    expect(draft.unsaved).toBe(true);
    expect(draft.canSave).toBe(true);
  });

  it("allows exactly the limit", () => {
    const draft = describeNoteDraft("a".repeat(MAX_NOTE_LENGTH), null);
    expect(draft.tooLong).toBe(false);
    expect(draft.canSave).toBe(true);
  });

  it("refuses one character over the limit", () => {
    const draft = describeNoteDraft("a".repeat(MAX_NOTE_LENGTH + 1), null);
    expect(draft.length).toBe(MAX_NOTE_LENGTH + 1);
    expect(draft.tooLong).toBe(true);
    expect(draft.canSave).toBe(false);
  });

  it("counts only the text the save keeps, not surrounding whitespace", () => {
    const draft = describeNoteDraft(`  ${"a".repeat(MAX_NOTE_LENGTH)}\n`, null);
    expect(draft.length).toBe(MAX_NOTE_LENGTH);
    expect(draft.tooLong).toBe(false);
    expect(draft.canSave).toBe(true);
  });

  it("marks clearing a saved Note as unsaved but not saveable", () => {
    const draft = describeNoteDraft("", "Original");
    expect(draft.unsaved).toBe(true);
    expect(draft.canSave).toBe(false);
  });
});
