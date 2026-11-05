"use client";

import { useActionState, useOptimistic } from "react";
import { useFormStatus } from "react-dom";

import { addNote, type Note, type NotesState } from "./actions";
import styles from "./react-19.module.css";

const initialState: NotesState = { notes: [], error: null };

type Shown = Note | { id: string; text: string; savedAt: null };

export function Notes() {
  // useActionState keeps what the last action returned: the notes the server saved, or an error.
  const [state, formAction] = useActionState(async (previous: NotesState, formData: FormData) => {
    const text = String(formData.get("note") ?? "").trim();
    if (text) addOptimistic(text);
    return addNote(previous, formData);
  }, initialState);

  // While the action runs, the list shows the new note too; when it ends, React drops the
  // optimistic note and renders state.notes, which now holds the saved one.
  const [notes, addOptimistic] = useOptimistic<Shown[], string>(state.notes, (current, text) => [
    { id: `sending-${current.length}`, text, savedAt: null },
    ...current,
  ]);

  return (
    <section className={styles.notes} aria-label="Notes">
      <form action={formAction} className={styles.form}>
        <input name="note" aria-label="Note" placeholder="Write a note" maxLength={40} autoComplete="off" />
        <SubmitButton />
      </form>
      {state.error && (
        <p role="alert" className={styles.error}>
          {state.error}
        </p>
      )}
      <ul className={styles.list}>
        {notes.map((note) => (
          <li key={note.id} data-state={note.savedAt ? "saved" : "sending"}>
            <span>{note.text}</span>
            {note.savedAt ? (
              <time dateTime={note.savedAt}>saved {note.savedAt.slice(11, 19)} UTC</time>
            ) : (
              <em>sending…</em>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

// useFormStatus reads the <form> around it, so it has to sit in a child component.
function SubmitButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending}>{pending ? "Adding…" : "Add"}</button>;
}
