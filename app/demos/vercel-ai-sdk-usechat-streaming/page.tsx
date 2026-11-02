import { Chat } from "./chat";

export default function Page() {
  return (
    <>
      <Chat />
      <p className="hint">
        The reply comes from a mock model in this demo&apos;s route handler: no API key, no provider, nothing stored.
        Reload to clear the chat.
      </p>
    </>
  );
}
