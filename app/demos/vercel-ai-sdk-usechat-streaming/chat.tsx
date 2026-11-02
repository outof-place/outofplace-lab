"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState } from "react";

import styles from "./chat.module.css";

export function Chat() {
  const { messages, sendMessage, status } = useChat({
    // The default endpoint is /api/chat; this demo's route sits next to its page.
    transport: new DefaultChatTransport({ api: "/demos/vercel-ai-sdk-usechat-streaming/api/chat" }),
  });
  const [input, setInput] = useState("");
  // Busy only while a reply is on its way, so an "error" status does not lock the input.
  const busy = status === "submitted" || status === "streaming";

  return (
    <section className={styles.chat} aria-label="Chat">
      <p className={styles.status}>
        status <output aria-label="Status">{status}</output>
      </p>

      <ol className={styles.messages} aria-label="Messages">
        {messages.map((message) => (
          <li key={message.id} className={styles.message} data-role={message.role}>
            <span className={styles.role}>{message.role === "user" ? "You" : "Assistant"}</span>
            <p>
              {message.parts.map((part, index) =>
                part.type === "text" ? (
                  <span key={index} data-part="text">
                    {part.text}
                  </span>
                ) : null,
              )}
            </p>
            {message.role === "assistant" && (
              <code className={styles.parts}>parts: {message.parts.map((part) => part.type).join(", ")}</code>
            )}
          </li>
        ))}
      </ol>

      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (!input.trim()) return;
          sendMessage({ text: input });
          setInput("");
        }}
      >
        <input
          aria-label="Message"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={busy}
          placeholder="Say something"
        />
        <button type="submit" disabled={busy || !input.trim()}>
          Send
        </button>
      </form>
    </section>
  );
}
