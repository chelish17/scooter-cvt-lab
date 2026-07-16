"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type AudioRig = {
  context: AudioContext;
  master: GainNode;
  oscillators: OscillatorNode[];
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function makeBeltPath(r1: number, r2: number) {
  const x1 = 255;
  const x2 = 755;
  const cy = 305;
  const distance = x2 - x1;
  const nx = clamp((r1 - r2) / distance, -0.8, 0.8);
  const ny = Math.sqrt(1 - nx * nx);
  const top1 = [x1 + nx * r1, cy - ny * r1];
  const top2 = [x2 + nx * r2, cy - ny * r2];
  const bottom2 = [x2 + nx * r2, cy + ny * r2];
  const bottom1 = [x1 + nx * r1, cy + ny * r1];

  return [
    `M ${top1[0]} ${top1[1]}`,
    `L ${top2[0]} ${top2[1]}`,
    `A ${r2} ${r2} 0 0 1 ${bottom2[0]} ${bottom2[1]}`,
    `L ${bottom1[0]} ${bottom1[1]}`,
    `A ${r1} ${r1} 0 0 1 ${top1[0]} ${top1[1]}`,
  ].join(" ");
}

export default function Home() {
  const [throttle, setThrottle] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const audioRef = useRef<AudioRig | null>(null);
  const demoDirection = useRef(1);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("cvt-theme");
    if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("cvt-theme", theme);
  }, [theme]);

  const t = throttle / 100;
  const rpm = Math.round(1500 + t * 7500);
  const frontRadius = 66 + t * 78;
  const rearRadius = 144 - t * 78;
  const reduction = rearRadius / frontRadius;
  const rearRpm = rpm / reduction;
  const speed = Math.round(clamp((rearRpm - 450) / 55, 0, 115));
  const beltPath = useMemo(
    () => makeBeltPath(frontRadius, rearRadius),
    [frontRadius, rearRadius],
  );
  const frontSpinDuration = Math.max(0.28, 2.45 - Math.pow(t, 0.82) * 2.17);
  const rearSpinDuration = Math.max(0.22, frontSpinDuration * reduction);
  const beltDuration = Math.max(0.24, 2.25 - Math.pow(t, 0.78) * 2.01);
  const state =
    throttle < 32
      ? { name: "起步／低速", short: "前小、後大", tone: "low" }
      : throttle < 68
        ? { name: "自動變速中", short: "皮帶正在換位置", tone: "mid" }
        : { name: "高速巡航", short: "前大、後小", tone: "high" };

  const ensureAudio = () => {
    setHasInteracted(true);
    if (!soundOn || typeof window === "undefined") return;
    if (!audioRef.current) {
      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass();
      const master = context.createGain();
      master.gain.value = 0.0001;
      master.connect(context.destination);

      const frequencies = [1, 2, 0.5];
      const types: OscillatorType[] = ["sawtooth", "square", "triangle"];
      const oscillators = frequencies.map((multiplier, index) => {
        const oscillator = context.createOscillator();
        oscillator.type = types[index];
        oscillator.frequency.value = 50 * multiplier;
        const gain = context.createGain();
        gain.gain.value = index === 0 ? 0.55 : index === 1 ? 0.12 : 0.22;
        oscillator.connect(gain);
        gain.connect(master);
        oscillator.start();
        return oscillator;
      });
      audioRef.current = { context, master, oscillators };
    }
    if (audioRef.current.context.state === "suspended") {
      void audioRef.current.context.resume();
    }
  };

  useEffect(() => {
    const rig = audioRef.current;
    if (!rig) return;
    const now = rig.context.currentTime;
    const base = 48 + t * 126;
    rig.oscillators[0].frequency.setTargetAtTime(base, now, 0.045);
    rig.oscillators[1].frequency.setTargetAtTime(base * 2.03, now, 0.04);
    rig.oscillators[2].frequency.setTargetAtTime(base * 0.52, now, 0.06);
    const volume = soundOn && hasInteracted ? 0.025 + t * 0.055 : 0.0001;
    rig.master.gain.setTargetAtTime(volume, now, soundOn ? 0.05 : 0.015);
  }, [t, soundOn, hasInteracted]);

  useEffect(() => {
    if (!isDemo) return;
    ensureAudio();
    const timer = window.setInterval(() => {
      setThrottle((current) => {
        let next = current + demoDirection.current * 1.25;
        if (next >= 100) {
          next = 100;
          demoDirection.current = -1;
        } else if (next <= 0) {
          next = 0;
          demoDirection.current = 1;
        }
        return next;
      });
    }, 50);
    return () => window.clearInterval(timer);
    // ensureAudio is intentionally triggered only when demo starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo]);

  useEffect(
    () => () => {
      if (audioRef.current) void audioRef.current.context.close();
    },
    [],
  );

  const setPreset = (value: number) => {
    ensureAudio();
    setIsDemo(false);
    setThrottle(value);
  };

  const rollerDots = Array.from({ length: 6 }, (_, index) => {
    const angle = (index / 6) * Math.PI * 2;
    const radius = 35 + t * 28;
    return {
      cx: 255 + Math.cos(angle) * radius,
      cy: 305 + Math.sin(angle) * radius,
    };
  });

  return (
    <main className="site-shell">
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">
          <span>CVT</span>
          <small>動力機械群</small>
        </div>
        <div className="title-block">
          <p>南投國中職業試探與體驗示範中心</p>
          <h1>
            機車 <em>CVT</em> 傳動互動教室
          </h1>
          <span>拖動油門，觀察普利盤、普利珠、皮帶與速度的關係</span>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="theme-toggle"
            aria-label={`切換為${theme === "dark" ? "淺色" : "深色"}版`}
            aria-pressed={theme === "light"}
            onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}
          >
            <span className={`theme-icon ${theme}`} aria-hidden="true" />
            <strong>{theme === "dark" ? "淺色版" : "深色版"}</strong>
          </button>
          <div className="mode-chip">
            <i /> 互動模式
          </div>
        </div>
      </header>

      <section className="workbench" aria-label="CVT 互動模擬器">
        <div className="machine-panel metal-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">TRANSMISSION VIEW</span>
              <h2>CVT 傳動剖面</h2>
            </div>
            <div className={`state-badge ${state.tone}`}>
              <span>{state.name}</span>
              <strong>{state.short}</strong>
            </div>
          </div>

          <div className="diagram-wrap">
            <svg
              viewBox="0 0 1010 610"
              className="cvt-diagram"
              role="img"
              aria-labelledby="cvt-title cvt-desc"
            >
              <title id="cvt-title">機車 CVT 無段變速傳動示意圖</title>
              <desc id="cvt-desc">
                左側為前驅動普利盤，右側為後從動普利盤。油門增加時，前後普利盤與皮帶一起加速，皮帶在兩盤上的有效半徑也隨之改變。
              </desc>
              <defs>
                <radialGradient id="metalDisc" cx="36%" cy="32%">
                  <stop offset="0" stopColor="#aab3b0" />
                  <stop offset="0.34" stopColor="#58615e" />
                  <stop offset="0.72" stopColor="#252b29" />
                  <stop offset="1" stopColor="#0c100f" />
                </radialGradient>
                <radialGradient id="hubMetal">
                  <stop offset="0" stopColor="#e4e8e2" />
                  <stop offset="0.48" stopColor="#717b76" />
                  <stop offset="1" stopColor="#202624" />
                </radialGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <pattern id="beltRibs" width="18" height="18" patternUnits="userSpaceOnUse">
                  <path d="M0 16 L10 6 M8 20 L18 10" stroke="#ffc12e" strokeWidth="5" />
                </pattern>
              </defs>

              <rect x="18" y="26" width="974" height="548" rx="34" className="gearbox" />
              <path d="M110 305H900" className="shaft-line" />

              <g className="pulley-label">
                <path d="M255 81V132" />
                <rect x="145" y="37" width="220" height="52" rx="13" />
                <text x="255" y="70" textAnchor="middle">前驅動普利盤</text>
              </g>
              <g className="pulley-label">
                <path d="M755 81V132" />
                <rect x="645" y="37" width="220" height="52" rx="13" />
                <text x="755" y="70" textAnchor="middle">後從動普利盤</text>
              </g>

              <g
                className="pulley front-pulley"
                style={{
                  "--spin-duration": `${frontSpinDuration}s`,
                  transformOrigin: "255px 305px",
                } as React.CSSProperties}
              >
                <circle cx="255" cy="305" r="154" className="outer-sheave" />
                <circle cx="255" cy="305" r="132" fill="url(#metalDisc)" />
                {Array.from({ length: 12 }, (_, index) => (
                  <line
                    key={index}
                    x1="255"
                    y1="218"
                    x2="255"
                    y2="183"
                    className="fan-spoke"
                    transform={`rotate(${index * 30} 255 305)`}
                  />
                ))}
                <circle cx="255" cy="169" r="13" className="pulley-marker" />
                <line x1="255" y1="188" x2="255" y2="219" className="pulley-marker-line" />
                <circle cx="255" cy="305" r="73" className="roller-track" />
                {rollerDots.map((dot, index) => (
                  <circle key={index} cx={dot.cx} cy={dot.cy} r="9" className="roller-dot" />
                ))}
                <circle cx="255" cy="305" r="43" fill="url(#hubMetal)" className="hub" />
                <circle cx="255" cy="305" r="14" className="axle" />
              </g>

              <g
                className="pulley rear-pulley"
                style={{
                  "--spin-duration": `${rearSpinDuration}s`,
                  transformOrigin: "755px 305px",
                } as React.CSSProperties}
              >
                <circle cx="755" cy="305" r="154" className="outer-sheave" />
                <circle cx="755" cy="305" r="132" fill="url(#metalDisc)" />
                {Array.from({ length: 8 }, (_, index) => (
                  <circle
                    key={index}
                    cx="755"
                    cy="243"
                    r="11"
                    className="clutch-hole"
                    transform={`rotate(${index * 45} 755 305)`}
                  />
                ))}
                <circle cx="755" cy="169" r="13" className="pulley-marker" />
                <line x1="755" y1="188" x2="755" y2="219" className="pulley-marker-line" />
                <circle cx="755" cy="305" r="67" className="clutch-bell" />
                <circle cx="755" cy="305" r="43" fill="url(#hubMetal)" className="hub" />
                <circle cx="755" cy="305" r="14" className="axle" />
              </g>

              <path d={beltPath} className="belt-shadow" />
              <path d={beltPath} className="belt-main" />
              <path
                d={beltPath}
                className="belt-motion"
                style={{ animationDuration: `${beltDuration}s` }}
              />
              <path
                d={beltPath}
                className="belt-tracer"
                style={{ animationDuration: `${beltDuration}s` }}
              />

              <g className="effective-ring front-ring">
                <circle cx="255" cy="305" r={frontRadius} />
                <text x="255" y="493" textAnchor="middle">
                  有效半徑 {Math.round(frontRadius)}
                </text>
              </g>
              <g className="effective-ring rear-ring">
                <circle cx="755" cy="305" r={rearRadius} />
                <text x="755" y="493" textAnchor="middle">
                  有效半徑 {Math.round(rearRadius)}
                </text>
              </g>

            </svg>
          </div>

          <div className="explain-strip" aria-live="polite">
            <span className="info-icon">i</span>
            <p>
              {throttle < 32
                ? "起步時：前普利盤的皮帶半徑較小，後普利盤較大，扭力較大、車速較低。"
                : throttle < 68
                  ? "加速時：普利珠受到離心力向外甩，推動盤面夾緊，皮帶逐漸往前盤外側移動。"
                  : "高速時：皮帶在前盤外側、後盤內側，減速比變小，後輪轉速提高。"}
            </p>
          </div>
        </div>

        <aside className="gauges" aria-label="即時數據">
          <article className="gauge-card metal-panel rpm-card">
            <header><span>01</span><h3>引擎轉速</h3></header>
            <div className="arc-meter" style={{ "--meter": `${t * 225}deg` } as React.CSSProperties}>
              <div className="needle" style={{ transform: `rotate(${-112 + t * 225}deg)` }} />
              <div className="meter-center" />
            </div>
            <strong>{rpm.toLocaleString()}</strong><small>RPM</small>
          </article>

          <article className="gauge-card metal-panel ratio-card">
            <header><span>02</span><h3>CVT 減速比</h3></header>
            <strong>{reduction.toFixed(2)}<b>：1</b></strong>
            <div className="ratio-track"><i style={{ width: `${100 - throttle}%` }} /></div>
            <p>後盤半徑 ÷ 前盤半徑</p>
          </article>

          <article className="gauge-card metal-panel speed-card">
            <header><span>03</span><h3>模擬車速</h3></header>
            <strong>{speed}<b> km/h</b></strong>
            <div className="speed-bars">
              {Array.from({ length: 12 }, (_, index) => (
                <i key={index} className={index < Math.ceil(speed / 10) ? "active" : ""} />
              ))}
            </div>
          </article>

          <article className="concept-card">
            <span>記住這句</span>
            <strong>前小後大 → 有力</strong>
            <strong>前大後小 → 速度快</strong>
          </article>
        </aside>
      </section>

      <section className="control-deck metal-panel" aria-label="油門控制區">
        <div className="control-label">
          <span className="grip-icon" aria-hidden="true">↻</span>
          <div><small>THROTTLE</small><strong>油門</strong></div>
        </div>
        <div className="slider-area">
          <div className="preset-row">
            <button onClick={() => setPreset(10)} className={throttle < 32 ? "active" : ""}>起步</button>
            <button onClick={() => setPreset(50)} className={throttle >= 32 && throttle < 68 ? "active" : ""}>變速中</button>
            <button onClick={() => setPreset(88)} className={throttle >= 68 ? "active" : ""}>高速</button>
          </div>
          <label htmlFor="throttle-slider">
            <span>收油門</span>
            <output>{Math.round(throttle)}%</output>
            <span>加油門</span>
          </label>
          <input
            id="throttle-slider"
            type="range"
            min="0"
            max="100"
            step="1"
            value={throttle}
            onPointerDown={ensureAudio}
            onKeyDown={ensureAudio}
            onChange={(event) => {
              ensureAudio();
              setIsDemo(false);
              setThrottle(Number(event.target.value));
            }}
            style={{ "--value": `${throttle}%` } as React.CSSProperties}
            aria-label="油門開度"
          />
        </div>
        <div className="control-actions">
          <button
            type="button"
            className={`demo-button ${isDemo ? "active" : ""}`}
            onClick={() => {
              ensureAudio();
              setIsDemo((value) => !value);
            }}
          >
            <span>{isDemo ? "Ⅱ" : "▶"}</span>{isDemo ? "暫停示範" : "自動示範"}
          </button>
          <button
            type="button"
            className={`sound-button ${soundOn ? "active" : ""}`}
            aria-pressed={soundOn}
            onClick={() => {
              ensureAudio();
              setSoundOn((value) => !value);
            }}
          >
            <span>{soundOn ? "🔊" : "🔇"}</span>
            <div><small>引擎聲音</small><strong>{soundOn ? "開啟" : "關閉"}</strong></div>
          </button>
        </div>
      </section>

      <section className="lesson-row" aria-label="學習任務">
        <article><span>觀察 1</span><h3>油門增加時</h3><p>普利珠為什麼會向外移動？</p></article>
        <article><span>觀察 2</span><h3>前盤變大時</h3><p>後盤的皮帶半徑如何改變？</p></article>
        <article><span>挑戰題</span><h3>想要爬坡有力</h3><p>CVT 應該維持「前小後大」還是「前大後小」？</p></article>
      </section>
    </main>
  );
}
