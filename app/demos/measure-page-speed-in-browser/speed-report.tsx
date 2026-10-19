"use client";

import { useEffect, useState } from "react";

import styles from "./speed.module.css";
import { observeCls, observeLcp, onNavigation, rate, type Rating } from "./vitals";

// undefined while measuring, "unsupported" where the browser has no API for it.
type Value = number | "unsupported" | undefined;

export function SpeedReport() {
  const [ttfb, setTtfb] = useState<Value>();
  const [load, setLoad] = useState<Value>();
  const [lcp, setLcp] = useState<Value>();
  const [cls, setCls] = useState<Value>();
  const [banner, setBanner] = useState<"off" | "pending" | "on">("off");
  const [lateHero, setLateHero] = useState(false);

  // Browser APIs exist only in the browser: measure in an effect, after hydration.
  useEffect(() => {
    onNavigation((ttfb, load) => {
      setTtfb(ttfb);
      setLoad(load);
    });
    const stopLcp = observeLcp(setLcp);
    const stopCls = observeCls(setCls);
    if (!stopLcp) setLcp("unsupported");
    if (!stopCls) setCls("unsupported");
    return () => {
      stopLcp?.();
      stopCls?.();
    };
  }, []);

  // ?late paints a big block 3 s after the navigation started, like a slow hero image.
  useEffect(() => {
    if (!new URLSearchParams(location.search).has("late")) return;
    const timer = setTimeout(() => setLateHero(true), 3000 - performance.now());
    return () => clearTimeout(timer);
  }, []);

  // The banner lands 1 s after the click: a shift within 500 ms of input would not count.
  function insertBanner() {
    setBanner("pending");
    setTimeout(() => setBanner("on"), 1000);
  }

  return (
    <>
      {banner === "on" && (
        <div className={styles.banner}>A banner that arrived 1 s after your click, with no space kept for it.</div>
      )}

      <div className={styles.metrics}>
        <Metric name="LCP" title="Largest Contentful Paint" value={lcp} rating={(v) => rate("lcp", v)} />
        <Metric name="CLS" title="Cumulative Layout Shift" value={cls} rating={(v) => rate("cls", v)} />
        <Metric name="TTFB" title="Time to First Byte" value={ttfb} rating={(v) => rate("ttfb", v)} />
        <Metric name="Load" title="Load time" value={load} />
      </div>

      <div className={styles.actions}>
        <button type="button" onClick={insertBanner} disabled={banner !== "off"}>
          Insert banner
        </button>
        <a href="?late">Late hero</a>
        <a href="?">Reset</a>
      </div>

      {lateHero && <p className={styles.hero}>Late hero: painted 3 s after the page started loading.</p>}
    </>
  );
}

function Metric({
  name,
  title,
  value,
  rating,
}: {
  name: string;
  title: string;
  value: Value;
  rating?: (value: number) => Rating;
}) {
  const measured = typeof value === "number";
  const label = value === "unsupported" ? "not in this browser" : !measured ? "" : rating ? rating(value) : "no threshold";
  return (
    <section className={styles.metric} aria-label={title}>
      <abbr className={styles.name} title={title}>
        {name}
      </abbr>
      <data className={styles.value} value={measured ? value : ""}>
        {measured ? format(name, value) : "–"}
      </data>
      <span className={styles.rating} data-rating={label}>
        {label}
      </span>
    </section>
  );
}

// CLS is a score; the rest are milliseconds, shown in seconds from 1 s up.
function format(name: string, value: number) {
  if (name === "CLS") return value.toFixed(3);
  return value < 1000 ? `${Math.round(value)} ms` : `${(value / 1000).toFixed(2)} s`;
}
