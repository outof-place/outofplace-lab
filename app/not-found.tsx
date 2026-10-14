import { LabMark } from "@/lab/demo-shell";

export default function NotFound() {
  return (
    <div className="page">
      <header className="top">
        <a className="brand" href="/">
          <LabMark />
          <span>outofplace lab</span>
        </a>
      </header>
      <section className="lead">
        <h1>No demo here</h1>
        <p>
          The address may be wrong, or the demo was renamed. <a href="/">See all demos</a>.
        </p>
      </section>
    </div>
  );
}
