"use client";

import { useState, useEffect, useRef } from "react";

const API_URL = "https://danielchenn04-bert-dialect-api.hf.space/predict";

const CITIES: Record<string, { lat: number; lng: number; zh: string }> = {
  Beijing:  { lat: 39.9042, lng: 116.4074, zh: "北京" },
  Fuzhou:   { lat: 26.0745, lng: 119.2965, zh: "福州" },
  Kunming:  { lat: 25.0389, lng: 102.7183, zh: "昆明" },
  Shanghai: { lat: 31.2304, lng: 121.4737, zh: "上海" },
  Shenyang: { lat: 41.8057, lng: 123.4315, zh: "沈阳" },
  Shenzhen: { lat: 22.5431, lng: 114.0579, zh: "深圳" },
  Taiyuan:  { lat: 37.8706, lng: 112.5489, zh: "太原" },
  Wuhan:    { lat: 30.5928, lng: 114.3055, zh: "武汉" },
};

const EXAMPLES = [
  "你今天吃饭了吗？",
  "这个东西多少钱啊？",
  "公司将及时披露后续进展情况，敬请广大投资者注意投资风险",
  "我们认为是全年把握结构性投资机会非常重要的时间窗口",
];

const STAGES = [
  "Tokenizing input · 字符 → embeddings",
  "BERT classifier · scoring 8 regions",
  "LangChain · retrieving dialect context",
  "GPT-4o-mini · composing explanation",
];

const GC = "#4dd6ff";
const MC = "#ff9d4d";

function hexToRgba(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(f, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

interface PredictResult {
  predicted_region: string;
  confidence: number;
  dialect_family_facts: string;
  explanation: string;
}

export default function Home() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<PredictResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stageText, setStageText] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  const globeContainerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<any>(null);
  const stageTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Mobile detection
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Globe init
  useEffect(() => {
    let mounted = true;

    function graticule() {
      const lines: number[][][] = [];
      for (let lng = -180; lng < 180; lng += 15) {
        const l: number[][] = [];
        for (let lat = -80; lat <= 80; lat += 3) l.push([lat, lng]);
        lines.push(l);
      }
      for (let lat = -75; lat <= 75; lat += 15) {
        const l: number[][] = [];
        for (let lng = -180; lng <= 180; lng += 3) l.push([lat, lng]);
        lines.push(l);
      }
      return lines;
    }

    function makeMarker(mc: string) {
      return (d: any) => {
        const w = document.createElement("div");
        w.style.cssText = "pointer-events:none;transform:translate(-50%,-50%);font-family:'IBM Plex Mono',monospace;position:relative;";
        w.innerHTML =
          `<div style="position:relative;width:14px;height:14px;">` +
          `<div style="position:absolute;inset:0;border-radius:50%;background:${mc};box-shadow:0 0 16px 3px ${hexToRgba(mc, 0.85)};"></div>` +
          `<div style="position:absolute;inset:-7px;border-radius:50%;border:1px solid ${hexToRgba(mc, 0.7)};animation:pulseDot 1.7s ease-out infinite;"></div>` +
          `</div>` +
          `<div style="position:absolute;left:22px;top:-8px;white-space:nowrap;background:rgba(8,12,20,0.85);border:1px solid ${hexToRgba(mc, 0.45)};border-radius:5px;padding:6px 10px;">` +
          `<div style="color:#ffe6cc;font-size:12px;font-weight:600;">${d.zh} ${d.name}</div>` +
          `<div style="color:#8a94a6;font-size:9px;letter-spacing:0.06em;margin-top:2px;">${d.lat.toFixed(2)}°N · ${d.lng.toFixed(2)}°E</div>` +
          `</div>`;
        return w;
      };
    }

    async function init() {
      if (!globeContainerRef.current || !mounted) return;
      const { default: Globe } = await import("globe.gl");
      if (!mounted || !globeContainerRef.current) return;

      const el = globeContainerRef.current;
      const globe = (Globe as any)()(el)
        .backgroundColor("rgba(0,0,0,0)")
        .showAtmosphere(true)
        .atmosphereColor(GC)
        .atmosphereAltitude(0.22)
        .polygonsData([])
        .polygonCapColor(() => hexToRgba(GC, 0.1))
        .polygonSideColor(() => "rgba(8,18,32,0)")
        .polygonStrokeColor(() => hexToRgba(GC, 0.9))
        .polygonAltitude(0.006)
        .pathsData(graticule())
        .pathPointLat((p: any) => p[0])
        .pathPointLng((p: any) => p[1])
        .pathColor(() => hexToRgba(GC, 0.28))
        .pathStroke(0.7)
        .pathPointAlt(0.004)
        .pathTransitionDuration(0)
        .ringColor(() => (t: number) => hexToRgba(MC, 1 - t))
        .ringMaxRadius(6)
        .ringPropagationSpeed(3)
        .ringRepeatPeriod(900)
        .htmlElementsData([])
        .htmlAltitude(0.02)
        .htmlElement(makeMarker(MC));

      try {
        globe.globeMaterial().color.set("#0b1a30");
        globe.globeMaterial().emissive.set("#06101e");
      } catch (_) {}

      globe.controls().enableZoom = false;
      globe.controls().autoRotate = true;
      globe.controls().autoRotateSpeed = 0.5;
      globe.pointOfView({ lat: 30, lng: 108, altitude: 2.4 }, 0);
      globe.width(el.clientWidth).height(el.clientHeight);
      globeRef.current = globe;

      // Load country borders
      try {
        const topo = await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json").then((r) => r.json());
        const tj = await import("topojson-client");
        if (mounted) globe.polygonsData((tj as any).feature(topo, topo.objects.countries).features);
      } catch (_) {
        try {
          const geo = await fetch("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson").then((r) => r.json());
          if (mounted) globe.polygonsData(geo.features);
        } catch (_) {}
      }
    }

    init();

    const onResize = () => {
      if (globeRef.current && globeContainerRef.current) {
        const el = globeContainerRef.current;
        globeRef.current.width(el.clientWidth).height(el.clientHeight);
      }
    };
    window.addEventListener("resize", onResize);
    return () => {
      mounted = false;
      window.removeEventListener("resize", onResize);
    };
  }, []);

  function locate(region: string) {
    const g = globeRef.current;
    const c = CITIES[region];
    if (!g || !c) return;
    g.controls().autoRotate = false;
    const pt = { lat: c.lat, lng: c.lng, name: region, zh: c.zh };
    g.ringsData([pt]);
    g.htmlElementsData([pt]);
    g.pointOfView({ lat: c.lat, lng: c.lng, altitude: 1.45 }, 1700);
  }

  function startStages() {
    if (stageTimerRef.current) clearInterval(stageTimerRef.current);
    let i = 0;
    setStageText(STAGES[0]);
    stageTimerRef.current = setInterval(() => {
      i = Math.min(i + 1, STAGES.length - 1);
      setStageText(STAGES[i]);
    }, 1900);
  }

  function stopStages() {
    if (stageTimerRef.current) {
      clearInterval(stageTimerRef.current);
      stageTimerRef.current = null;
    }
  }

  async function submit() {
    const t = text.trim();
    if (!t || status === "loading") return;
    setStatus("loading");
    setError(null);
    setResult(null);
    startStages();
    const g = globeRef.current;
    if (g) {
      g.htmlElementsData([]);
      g.ringsData([]);
      g.controls().autoRotate = true;
    }
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t }),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data: PredictResult = await res.json();
      stopStages();
      setStatus("done");
      setResult(data);
      locate(data.predicted_region);
    } catch (e) {
      stopStages();
      const msg = String((e as any)?.message ?? e).includes("Failed to fetch")
        ? "The model endpoint could not be reached. The Space may be waking up — please try again in a few seconds."
        : "Could not reach the model right now. Please wait a moment and try again.";
      setStatus("error");
      setError(msg);
    }
  }

  const hudText =
    status === "loading"
      ? "◌  ANALYZING SIGNAL…"
      : status === "done" && result
      ? `◉  TARGET ACQUIRED · ${result.predicted_region.toUpperCase()}`
      : status === "error"
      ? "✕  NO SIGNAL"
      : "●  AUTO-ROTATE · AWAITING INPUT";

  const conf = result?.confidence ?? 0;
  const regionName = result?.predicted_region ?? "";
  const zh = CITIES[regionName]?.zh ?? "";
  const canSubmit = !!text.trim() && status !== "loading";

  return (
    <main
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: isMobile ? "column" : "row-reverse",
        background: "#05070d",
        overflow: "hidden",
      }}
    >
      {/* Globe panel */}
      <div
        style={{
          position: "relative",
          flex: isMobile ? "0 0 auto" : "1 1 auto",
          width: isMobile ? "100%" : "auto",
          height: isMobile ? "46vh" : "100vh",
          background: "radial-gradient(circle at 58% 42%, #0c1424 0%, #05070d 72%)",
        }}
      >
        <div ref={globeContainerRef} style={{ position: "absolute", inset: 0 }} />

        {/* Corner brackets */}
        {[
          { top: 18, left: 18, borderLeft: "1px solid rgba(77,214,255,0.4)", borderTop: "1px solid rgba(77,214,255,0.4)" },
          { top: 18, right: 18, borderRight: "1px solid rgba(77,214,255,0.4)", borderTop: "1px solid rgba(77,214,255,0.4)" },
          { bottom: 18, left: 18, borderLeft: "1px solid rgba(77,214,255,0.4)", borderBottom: "1px solid rgba(77,214,255,0.4)" },
          { bottom: 18, right: 18, borderRight: "1px solid rgba(77,214,255,0.4)", borderBottom: "1px solid rgba(77,214,255,0.4)" },
        ].map((s, i) => (
          <div key={i} style={{ position: "absolute", width: 28, height: 28, pointerEvents: "none", ...s }} />
        ))}

        {/* HUD label */}
        <div
          style={{
            position: "absolute",
            top: 24,
            left: "50%",
            transform: "translateX(-50%)",
            fontFamily: "'IBM Plex Mono',monospace",
            fontSize: 11,
            letterSpacing: "0.16em",
            color: "#9fe7ff",
            background: "rgba(8,12,20,0.62)",
            border: "1px solid rgba(77,214,255,0.22)",
            borderRadius: 999,
            padding: "7px 16px",
            whiteSpace: "nowrap",
            backdropFilter: "blur(4px)",
            pointerEvents: "none",
          }}
        >
          {hudText}
        </div>
      </div>

      {/* Scrollable side panel */}
      <div
        className="scrollpanel"
        style={{
          width: isMobile ? "100%" : 440,
          flex: isMobile ? "1 1 auto" : "0 0 440px",
          height: isMobile ? "auto" : "100vh",
          overflowY: "auto",
          padding: isMobile ? "26px 20px 48px" : "42px 36px",
          background: "#0a0e17",
          borderRight: isMobile ? "none" : "1px solid rgba(255,255,255,0.07)",
          borderTop: isMobile ? "1px solid rgba(255,255,255,0.07)" : "none",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 540 }}>

          {/* Header */}
          <header style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, letterSpacing: "0.22em", color: "#4dd6ff", textTransform: "uppercase" }}>
              Chinese Dialect Geolocator
            </div>
            <h1 style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 27, lineHeight: 1.18, fontWeight: 700, color: "#eaf0f8", margin: "12px 0 0" }}>
              Where is this text from?
            </h1>
            <p style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 14, lineHeight: 1.6, color: "#8a94a6", margin: "11px 0 0" }}>
              A fine-tuned BERT model classifies the text&apos;s likely Chinese regional dialect, then an LLM explains the linguistic reasoning behind the prediction.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 16 }}>
              {["BERT", "HuggingFace", "LangChain", "FastAPI", "GPT-4o-mini"].map((tag) => (
                <span
                  key={tag}
                  style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: "0.04em", color: "#7c8aa0", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 5, padding: "4px 8px" }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </header>

          {/* Input */}
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(); }}
              placeholder="输入中文…  e.g. 你今天吃饭了吗？"
              rows={3}
              style={{
                width: "100%",
                resize: "vertical",
                minHeight: 88,
                background: "#070b12",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 9,
                padding: "14px 16px",
                color: "#eaf0f8",
                fontFamily: "'IBM Plex Sans',sans-serif",
                fontSize: 16,
                lineHeight: 1.5,
                outline: "none",
                transition: "border-color .2s",
              }}
            />

            {/* Example presets */}
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: "0.14em", color: "#5d6878", textTransform: "uppercase" }}>
                Try an example
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => { setText(ex); setResult(null); setError(null); }}
                    style={{ background: "rgba(77,214,255,0.06)", border: "1px solid rgba(77,214,255,0.22)", borderRadius: 7, padding: "8px 11px", color: "#bfe6f5", fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 13, cursor: "pointer" }}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit button */}
            <button
              onClick={submit}
              disabled={!canSubmit}
              style={{
                width: "100%",
                padding: 14,
                borderRadius: 9,
                border: "none",
                fontFamily: "'IBM Plex Sans',sans-serif",
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: "0.02em",
                transition: "filter .15s, opacity .15s",
                cursor: canSubmit ? "pointer" : "not-allowed",
                background: canSubmit ? "linear-gradient(90deg,#4dd6ff,#3aa9ff)" : "rgba(255,255,255,0.07)",
                color: canSubmit ? "#04121c" : "#5d6878",
              }}
            >
              {status === "loading" ? "Analyzing…" : "Locate dialect →"}
            </button>
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: "#4a5568", letterSpacing: "0.04em" }}>
              Cmd / Ctrl + Enter to run
            </div>
          </div>

          {/* Loading */}
          {status === "loading" && (
            <div style={{ border: "1px solid rgba(77,214,255,0.22)", background: "rgba(77,214,255,0.04)", borderRadius: 11, padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <div style={{ width: 15, height: 15, border: "2px solid rgba(77,214,255,0.28)", borderTopColor: "#4dd6ff", borderRadius: "50%", animation: "spin .8s linear infinite", flex: "none" }} />
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, color: "#cfe9ff" }}>{stageText}</div>
              </div>
              <div style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 12, color: "#6b7689", marginTop: 13, lineHeight: 1.55 }}>
                First request after idle may take 10–20s while the model wakes up (HuggingFace Spaces cold start). Subsequent calls run in under 2s.
              </div>
            </div>
          )}

          {/* Error */}
          {status === "error" && error && (
            <div style={{ border: "1px solid rgba(255,107,107,0.35)", background: "rgba(255,107,107,0.07)", borderRadius: 11, padding: 16, color: "#ffb3b3", fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 14, lineHeight: 1.55 }}>
              {error}
            </div>
          )}

          {/* Result */}
          {status === "done" && result && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18, animation: "fadeUp .5s ease" }}>

              {/* Region + confidence */}
              <div style={{ border: "1px solid rgba(255,157,77,0.32)", background: "linear-gradient(180deg,rgba(255,157,77,0.09),rgba(255,157,77,0.02))", borderRadius: 13, padding: 20 }}>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: "0.18em", color: "#ffb27a", textTransform: "uppercase" }}>
                  Predicted region
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 9 }}>
                  <span style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 42, fontWeight: 700, color: "#ffe2c2", lineHeight: 1 }}>{zh}</span>
                  <span style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 22, fontWeight: 600, color: "#eaf0f8" }}>{regionName}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18, marginBottom: 7 }}>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: "0.14em", color: "#8a94a6", textTransform: "uppercase" }}>Confidence</span>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 14, color: "#ffd9b0", fontWeight: 500 }}>{(conf * 100).toFixed(1)}%</span>
                </div>
                <div style={{ width: "100%", height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ width: `${conf * 100}%`, height: "100%", background: "linear-gradient(90deg,#ff9d4d,#ffd9b0)", borderRadius: 999, transition: "width 1.2s cubic-bezier(.2,.8,.2,1)" }} />
                </div>
              </div>

              {/* Dialect facts */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: "0.16em", color: "#4dd6ff", textTransform: "uppercase" }}>About this dialect</div>
                <p style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 14, lineHeight: 1.65, color: "#b6c0d0", margin: 0 }}>{result.dialect_family_facts}</p>
              </div>

              {/* Explanation */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: "0.16em", color: "#4dd6ff", textTransform: "uppercase" }}>Why this prediction?</div>
                <p style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 14, lineHeight: 1.65, color: "#b6c0d0", margin: 0 }}>{result.explanation}</p>
              </div>

            </div>
          )}

        </div>
      </div>
    </main>
  );
}
