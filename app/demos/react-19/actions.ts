"use server";

export type Note = { id: string; text: string; savedAt: string };
export type NotesState = { notes: Note[]; error: string | null };

// A Server Function for useActionState: it gets the previous state first, then the form's
// data, and what it returns becomes the new state in the browser. `previous` comes from the
// browser, so a real app would read and write its notes in a database instead.
export async function addNote(previous: NotesState, formData: FormData): Promise<NotesState> {
  const text = String(formData.get("note") ?? "").trim();
  if (!text) return { ...previous, error: "Write a note first." };

  // Stands in for a slow write, so the pending and optimistic states stay on screen.
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const note = { id: crypto.randomUUID(), text: text.slice(0, 40), savedAt: new Date().toISOString() };
  return { notes: [note, ...previous.notes].slice(0, 3), error: null };
}
