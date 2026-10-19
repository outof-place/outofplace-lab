import { connection } from "next/server";
import { Suspense } from "react";

import { clearCity } from "./actions";
import { getStamp, type City } from "./get-stamp";
import styles from "./stamps.module.css";

export default function Page() {
  return (
    <>
      <div className={styles.rows}>
        <CachedRow city="gdansk" name="Gdansk" clearable />
        <CachedRow city="gdansk" name="Gdansk again" />
        <CachedRow city="krakow" name="Krakow" clearable />
        <Suspense fallback={<Row name="Not cached" call="connection()" pending />}>
          <UncachedRow />
        </Suspense>
      </div>
      <p className={styles.reload}>
        <a href="/demos/nextjs-use-cache">Reload</a>, then clear one city.
      </p>
    </>
  );
}

// Same function, same argument, same entry: both Gdansk rows show one id.
async function CachedRow({ city, name, clearable }: { city: City; name: string; clearable?: boolean }) {
  const stamp = await getStamp(city);
  return <Row name={name} call={`getStamp("${city}")`} stamp={stamp} clear={clearable ? city : undefined} />;
}

// No cache: connection() waits for a request, so this runs on every load.
async function UncachedRow() {
  await connection();
  const stamp = { id: crypto.randomUUID().slice(0, 8), at: new Date().toISOString() };
  return <Row name="Not cached" call="connection()" stamp={stamp} />;
}

type RowProps = { name: string; call: string; stamp?: { id: string; at: string }; clear?: City; pending?: boolean };

function Row({ name, call, stamp, clear, pending }: RowProps) {
  return (
    <section className={styles.row} aria-label={name}>
      <div>
        <h2>{name}</h2>
        <code>{call}</code>
      </div>
      <p className={styles.stamp}>
        {stamp ? (
          <>
            <output>{stamp.id}</output>
            <time dateTime={stamp.at}>{stamp.at.slice(11, 19)} UTC</time>
          </>
        ) : (
          pending && <span>rendering…</span>
        )}
      </p>
      {clear && (
        <form action={clearCity}>
          <button name="city" value={clear}>
            Clear
          </button>
        </form>
      )}
    </section>
  );
}
