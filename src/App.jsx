// ぼくだけの鉄道運転シミュレーター
// React + Tailwind CSS + lucide-react（1ファイル完結）
// ※ 画面に出る文字は ひらがな・カタカナ のみ（コメントは保護者・開発者向け）

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  TrainFront, TramFront, Rocket, Zap, Moon, Flame, Package, Sun, Snowflake, Mountain,
  Star, Sparkles, Trophy, Megaphone, BookOpen, ArrowLeft, Play, Flag, X,
  ChevronsUp, ChevronsDown, RotateCcw, Crown,
} from "lucide-react";

/* =========================================================
   定数
   ========================================================= */
const MAX_SPEED = 100;      // km/h
const ACCEL = 9;            // かそく：1秒あたり +km/h
const BRAKE = 16;           // ぶれーき：1秒あたり -km/h
const COAST = 0.8;          // なにも押さない時の自然減速
const OK_RANGE = 5;         // ±5m で成功
const SAVE_KEY = "bokudake-densha-save-v1";

const STATIONS = [
  "さくら", "ひまわり", "うみべ", "どんぐり", "おほしさま", "にじいろ", "ぽかぽか",
  "きらきら", "パンダ", "ペンギン", "ケーキ", "おもちゃ", "ロケット", "ゆうえんち",
  "どうぶつえん", "おかし", "たんぽぽ", "くじら", "いちご", "おつきさま",
];

/* =========================================================
   200しゅるいのメダルデータを自動生成
   ========================================================= */
const KINDS = [
  { name: "シンカンセン", icon: Rocket },
  { name: "とっきゅう", icon: Zap },
  { name: "しんだいれっしゃ", icon: Moon },
  { name: "エスエル", icon: Flame },
  { name: "かもつれっしゃ", icon: Package },
  { name: "ドクターイエロー", icon: Sun },
  { name: "まちの でんしゃ", icon: TrainFront },
  { name: "ろめんでんしゃ", icon: TramFront },
  { name: "ゆきぐに れっしゃ", icon: Snowflake },
  { name: "やまのぼり でんしゃ", icon: Mountain },
];

// 0-9: ノーマル / 10-15: レア / 16-18: スーパーレア / 19: レジェンド
const VARIANTS = [
  ["あかい", "#ef4444"], ["あおい", "#3b82f6"], ["きいろい", "#facc15"], ["みどりの", "#22c55e"],
  ["しろい", "#f1f5f9"], ["くろい", "#334155"], ["オレンジの", "#f97316"], ["むらさきの", "#a855f7"],
  ["ピンクの", "#ec4899"], ["みずいろの", "#38bdf8"],
  ["ぴかぴか", "#fde68a"], ["あさひの", "#fb923c"], ["ゆうやけ", "#f43f5e"], ["ほしぞら", "#1e3a8a"],
  ["さくら", "#f9a8d4"], ["もみじ", "#dc2626"],
  ["ゆきんこ", "#bae6fd"], ["きんいろ", "#f59e0b"], ["ぎんいろ", "#94a3b8"],
  ["にじいろ", "rainbow"],
];

const PLACES = [
  "ほっかいどう", "とうほく", "かんとう", "ちゅうぶ", "ほくりく",
  "かんさい", "ちゅうごく", "しこく", "きゅうしゅう", "おきなわ",
];

const RARITY = [
  { name: "ノーマル", stars: 1, ring: "linear-gradient(135deg,#f3c597,#b8733a,#f0b27a)", weight: 60, perfectWeight: 10 },
  { name: "レア", stars: 2, ring: "linear-gradient(135deg,#ffffff,#9ca3af,#e5e7eb)", weight: 28, perfectWeight: 40 },
  { name: "スーパーレア", stars: 3, ring: "linear-gradient(135deg,#fff7ae,#f59e0b,#fde047)", weight: 10, perfectWeight: 35 },
  { name: "レジェンド", stars: 4, ring: "conic-gradient(#f43f5e,#f97316,#facc15,#22c55e,#06b6d4,#6366f1,#d946ef,#f43f5e)", weight: 2, perfectWeight: 15 },
];

const rarityOf = (i) => (i < 10 ? 0 : i < 16 ? 1 : i < 19 ? 2 : 3);

const MEDALS = (() => {
  const list = [];
  KINDS.forEach((kind, k) => {
    VARIANTS.forEach(([adj, color], i) => {
      list.push({
        id: k * 20 + i + 1,
        kind: k,
        name: `${adj} ${kind.name}`,
        place: PLACES[(i * 7 + k * 3) % PLACES.length],
        color,
        rarity: rarityOf(i),
        icon: kind.icon,
      });
    });
  });
  return list;
})();
const TOTAL = MEDALS.length; // 200

function pickMedal(owned, perfect) {
  const key = perfect ? "perfectWeight" : "weight";
  const sum = RARITY.reduce((s, r) => s + r[key], 0);
  let roll = Math.random() * sum;
  let tier = 0;
  for (let i = 0; i < RARITY.length; i++) {
    roll -= RARITY[i][key];
    if (roll <= 0) { tier = i; break; }
  }
  let cands = MEDALS.filter((m) => m.rarity === tier && !owned[m.id]);
  if (cands.length === 0) cands = MEDALS.filter((m) => !owned[m.id]);
  if (cands.length === 0) cands = MEDALS;
  return cands[Math.floor(Math.random() * cands.length)];
}

/* =========================================================
   セーブ（LocalStorage）
   ========================================================= */
const EMPTY_SAVE = { owned: {}, cleared: 0, perfect: 0 };

function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return { ...EMPTY_SAVE };
    const d = JSON.parse(raw);
    return {
      owned: d && typeof d.owned === "object" && d.owned ? d.owned : {},
      cleared: Number(d && d.cleared) || 0,
      perfect: Number(d && d.perfect) || 0,
    };
  } catch (e) {
    return { ...EMPTY_SAVE };
  }
}

function writeSave(data) {
  try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* 保存できなくても続行 */ }
}

/* =========================================================
   サウンド（Web Audio API だけで音を作る）
   ========================================================= */
const sound = {
  ctx: null, master: null, noiseBuf: null,
  motorGain: null, motorOsc: null, motorOsc2: null, motorFilter: null,
  rumbleGain: null, squealGain: null, squealOn: false,

  init() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        const ctx = new AC();
        this.ctx = ctx;
        this.master = ctx.createGain();
        this.master.gain.value = 0.9;
        this.master.connect(ctx.destination);

        const len = ctx.sampleRate * 2;
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.noiseBuf = buf;

        // モーター音（スピードで音が高くなる）
        this.motorFilter = ctx.createBiquadFilter();
        this.motorFilter.type = "lowpass";
        this.motorFilter.frequency.value = 900;
        this.motorGain = ctx.createGain();
        this.motorGain.gain.value = 0;
        this.motorOsc = ctx.createOscillator();
        this.motorOsc.type = "sawtooth";
        this.motorOsc.frequency.value = 60;
        this.motorOsc2 = ctx.createOscillator();
        this.motorOsc2.type = "square";
        this.motorOsc2.frequency.value = 90;
        this.motorOsc.connect(this.motorFilter);
        this.motorOsc2.connect(this.motorFilter);
        this.motorFilter.connect(this.motorGain).connect(this.master);
        this.motorOsc.start();
        this.motorOsc2.start();

        // ゴーッという走行ノイズ
        const rumble = ctx.createBufferSource();
        rumble.buffer = buf;
        rumble.loop = true;
        const rf = ctx.createBiquadFilter();
        rf.type = "lowpass";
        rf.frequency.value = 220;
        this.rumbleGain = ctx.createGain();
        this.rumbleGain.gain.value = 0;
        rumble.connect(rf).connect(this.rumbleGain).connect(this.master);
        rumble.start();

        // キーッというブレーキ音
        const sq = ctx.createOscillator();
        sq.type = "sine";
        sq.frequency.value = 2900;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 7;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 60;
        lfo.connect(lfoGain).connect(sq.frequency);
        const sq2 = ctx.createOscillator();
        sq2.type = "triangle";
        sq2.frequency.value = 3650;
        this.squealGain = ctx.createGain();
        this.squealGain.gain.value = 0;
        sq.connect(this.squealGain);
        sq2.connect(this.squealGain);
        this.squealGain.connect(this.master);
        sq.start(); sq2.start(); lfo.start();
      }
      if (this.ctx.state === "suspended") this.ctx.resume();
      return this.ctx;
    } catch (e) {
      return null;
    }
  },

  tone(t, freq, dur, { type = "sine", vol = 0.2, attack = 0.01, endFreq = null } = {}) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  },

  noiseHit(t, { freq = 400, type = "lowpass", vol = 0.4, dur = 0.12, q = 1 } = {}) {
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
  },

  // ガタン / ゴトン
  clack(alt) {
    if (!this.init()) return;
    const t = this.ctx.currentTime;
    const p = alt ? 1 : 0.78;
    this.noiseHit(t, { freq: 650 * p, vol: 0.45, dur: 0.09 });
    this.tone(t, 130 * p, 0.12, { vol: 0.35, endFreq: 55 });
    this.noiseHit(t + 0.11, { freq: 560 * p, vol: 0.38, dur: 0.09 });
    this.tone(t + 0.11, 115 * p, 0.12, { vol: 0.3, endFreq: 50 });
  },

  // プァーッ！
  horn() {
    if (!this.init()) return;
    const c = this.ctx;
    const t = c.currentTime;
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 2200;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.05);
    g.gain.setValueAtTime(0.22, t + 0.85);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.25);
    f.connect(g).connect(this.master);
    [349, 440, 523].forEach((hz) => {
      const o = c.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(hz * 0.9, t);
      o.frequency.exponentialRampToValueAtTime(hz, t + 0.09);
      o.connect(f);
      o.start(t);
      o.stop(t + 1.3);
    });
  },

  // プシューッ（ドアや停車のエアー音）
  air() {
    if (!this.init()) return;
    const c = this.ctx;
    const t = c.currentTime;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 1500;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
    s.stop(t + 1);
  },

  setMotor(speed, accel) {
    if (!this.ctx || !this.motorGain) return;
    const t = this.ctx.currentTime;
    const moving = speed > 0.3;
    this.motorOsc.frequency.setTargetAtTime(55 + speed * 7, t, 0.08);
    this.motorOsc2.frequency.setTargetAtTime(80 + speed * 10.5, t, 0.08);
    this.motorGain.gain.setTargetAtTime(moving ? (accel ? 0.07 : 0.025) : 0, t, 0.1);
    this.rumbleGain.gain.setTargetAtTime(moving ? Math.min(0.5, 0.08 + speed * 0.004) : 0, t, 0.15);
  },

  setSqueal(on) {
    if (!this.ctx || !this.squealGain || on === this.squealOn) return;
    this.squealOn = on;
    const t = this.ctx.currentTime;
    this.squealGain.gain.setTargetAtTime(on ? 0.035 : 0, t, on ? 0.05 : 0.08);
    if (on) this.noiseHit(t, { freq: 2500, type: "highpass", vol: 0.15, dur: 0.25 });
  },

  stopAll() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.motorGain) this.motorGain.gain.setTargetAtTime(0, t, 0.05);
    if (this.rumbleGain) this.rumbleGain.gain.setTargetAtTime(0, t, 0.05);
    if (this.squealGain) this.squealGain.gain.setTargetAtTime(0, t, 0.05);
    this.squealOn = false;
  },

  // えきの メロディ
  melody() {
    if (!this.init()) return;
    const t = this.ctx.currentTime + 0.05;
    const notes = [659, 784, 880, 1047, 880, 784, 880, 1319];
    notes.forEach((hz, i) => {
      this.tone(t + i * 0.22, hz, 0.4, { type: "triangle", vol: 0.16 });
      this.tone(t + i * 0.22, hz * 2, 0.25, { type: "sine", vol: 0.05 });
    });
  },

  // メダル ファンファーレ
  fanfare(big) {
    if (!this.init()) return;
    const t = this.ctx.currentTime + 0.05;
    const run = [523, 659, 784, 1047];
    run.forEach((hz, i) => this.tone(t + i * 0.12, hz, 0.25, { type: "square", vol: 0.09 }));
    const ct = t + run.length * 0.12;
    [523, 659, 784, 1047].forEach((hz) => this.tone(ct, hz, big ? 1.6 : 1.0, { type: "triangle", vol: 0.12 }));
    if (big) {
      const run2 = [1047, 1175, 1319, 1568, 2093];
      run2.forEach((hz, i) => this.tone(ct + 0.5 + i * 0.1, hz, 0.3, { type: "square", vol: 0.06 }));
      [1047, 1319, 1568, 2093].forEach((hz) => this.tone(ct + 1.1, hz, 1.8, { type: "triangle", vol: 0.1 }));
      for (let i = 0; i < 10; i++) this.tone(ct + 1.1 + i * 0.08, 2500 + Math.random() * 2000, 0.15, { vol: 0.04 });
    }
  },

  pop() {
    if (!this.init()) return;
    const t = this.ctx.currentTime;
    this.tone(t, 880, 0.12, { type: "triangle", vol: 0.15, endFreq: 1320 });
  },
};

/* =========================================================
   ゲームの はじめの じょうたい
   ========================================================= */
function newGame() {
  return {
    pos: 0, speed: 0, accel: false, brake: false,
    stationIdx: 0, startX: 0, stopX: 280, prevStopX: -1000,
    phase: "drive", jointAcc: 0, alt: false, announced: false,
  };
}

/* =========================================================
   しゃそう（キャンバス）を描く
   ========================================================= */
const PPM = 6; // 1メートル = 6px
const BRIDGE_BLOCK = 230;

function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function circle(ctx, x, y, r, color) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function bridgeAt(k, g) {
  if (k < 1 || hash(k * 7.31 + 2) > 0.45) return null;
  const s = k * BRIDGE_BLOCK + 60;
  const e = s + 80;
  if (e > g.stopX - 140 && s < g.stopX + 70) return null;
  if (e > g.prevStopX - 140 && s < g.prevStopX + 70) return null;
  return [s, e];
}

function drawScene(ctx, w, h, g, time) {
  const pos = g.pos;
  const noseX = w * 0.56;
  const horizon = h * 0.5;
  const trackY = h * 0.8;
  const sx = (wx) => noseX + (wx - pos) * PPM;
  const minW = pos - noseX / PPM - 20;
  const maxW = pos + (w - noseX) / PPM + 20;

  // そら
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, "#38bdf8");
  sky.addColorStop(1, "#e0f2fe");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon + 2);
  circle(ctx, w * 0.86, h * 0.13, h * 0.075, "#fde047");
  circle(ctx, w * 0.86, h * 0.13, h * 0.1, "rgba(253,224,71,0.25)");

  // くも
  {
    const off = pos * PPM * 0.04 + time * 6;
    const S = 170;
    for (let i = Math.floor(off / S) - 1; i <= Math.floor((off + w) / S) + 1; i++) {
      if (hash(i + 0.5) < 0.35) continue;
      const x = i * S - off + hash(i) * 60;
      const y = h * (0.07 + hash(i + 9) * 0.15);
      const s = h * (0.04 + hash(i + 3) * 0.03);
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.beginPath();
      ctx.arc(x, y, s, 0, Math.PI * 2);
      ctx.arc(x + s * 1.1, y - s * 0.4, s * 1.2, 0, Math.PI * 2);
      ctx.arc(x + s * 2.2, y, s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // やま
  {
    const off = pos * PPM * 0.12;
    const S = 130;
    for (let i = Math.floor(off / S) - 2; i <= Math.floor((off + w) / S) + 2; i++) {
      const x = i * S - off;
      const ph = h * (0.12 + hash(i * 1.3) * 0.2);
      const bw = S * 1.5;
      ctx.fillStyle = i % 2 ? "#4ade80" : "#16a34a";
      ctx.beginPath();
      ctx.moveTo(x - bw / 2, horizon + 1);
      ctx.lineTo(x, horizon - ph);
      ctx.lineTo(x + bw / 2, horizon + 1);
      ctx.closePath();
      ctx.fill();
      if (ph > h * 0.25) {
        const cap = 0.25;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.moveTo(x - (bw / 2) * cap, horizon - ph * (1 - cap));
        ctx.lineTo(x, horizon - ph);
        ctx.lineTo(x + (bw / 2) * cap, horizon - ph * (1 - cap));
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // じめん
  const grd = ctx.createLinearGradient(0, horizon, 0, h);
  grd.addColorStop(0, "#a3e635");
  grd.addColorStop(1, "#65a30d");
  ctx.fillStyle = grd;
  ctx.fillRect(0, horizon, w, h - horizon);

  // まち（ビル・おうち）
  {
    const off = pos * PPM * 0.4;
    const S = 58;
    const base = horizon + h * 0.07;
    const colors = ["#f87171", "#60a5fa", "#fbbf24", "#a78bfa", "#f472b6", "#94a3b8", "#fb923c"];
    for (let i = Math.floor(off / S) - 1; i <= Math.floor((off + w) / S) + 1; i++) {
      const r = hash(i * 2.1 + 5);
      const x = i * S - off;
      if (r < 0.4) {
        const bw = S * 0.72;
        const bh = h * (0.1 + hash(i + 1) * 0.2);
        ctx.fillStyle = colors[Math.floor(hash(i + 4) * colors.length)];
        ctx.fillRect(x, base - bh, bw, bh);
        ctx.fillStyle = "#fef9c3";
        for (let wy = base - bh + 5; wy < base - 8; wy += 10) {
          for (let wx = x + 5; wx < x + bw - 6; wx += 10) ctx.fillRect(wx, wy, 5, 5);
        }
      } else if (r < 0.7) {
        const bw = S * 0.6;
        const bh = h * 0.07;
        ctx.fillStyle = "#fff7ed";
        ctx.fillRect(x, base - bh, bw, bh);
        ctx.fillStyle = hash(i + 7) < 0.5 ? "#dc2626" : "#2563eb";
        ctx.beginPath();
        ctx.moveTo(x - 5, base - bh);
        ctx.lineTo(x + bw / 2, base - bh - h * 0.06);
        ctx.lineTo(x + bw + 5, base - bh);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#7dd3fc";
        ctx.fillRect(x + bw * 0.2, base - bh * 0.7, bw * 0.22, bh * 0.35);
      } else if (r < 0.85) {
        circle(ctx, x + 12, base - h * 0.05, h * 0.04, "#15803d");
      }
    }
  }

  // ちかくの き・でんちゅう（列車のむこうがわ）
  const nearZone = (wx) =>
    (wx > g.stopX - 100 && wx < g.stopX + 30) || (wx > g.prevStopX - 100 && wx < g.prevStopX + 30);
  const inBridge = (wx) => {
    const b = bridgeAt(Math.floor(wx / BRIDGE_BLOCK), g);
    return b && wx > b[0] - 5 && wx < b[1] + 5;
  };
  for (let i = Math.floor(minW / 7); i <= Math.ceil(maxW / 7); i++) {
    const wx = i * 7 + hash(i) * 2;
    const x = sx(wx);
    if (i % 5 === 0) {
      ctx.fillStyle = "#78716c";
      ctx.fillRect(x - 3, trackY - h * 0.5, 6, h * 0.46);
      ctx.fillRect(x - 14, trackY - h * 0.47, 28, 4);
      continue;
    }
    if (nearZone(wx) || inBridge(wx)) continue;
    const r = hash(i * 3.3);
    if (r < 0.45) {
      const s = h * (0.08 + hash(i + 2) * 0.05);
      ctx.fillStyle = "#92400e";
      ctx.fillRect(x - 3, trackY - h * 0.06 - s * 0.9, 6, s);
      circle(ctx, x, trackY - h * 0.06 - s * 1.2, s * 0.75, "#16a34a");
      circle(ctx, x - s * 0.4, trackY - h * 0.06 - s * 0.9, s * 0.5, "#22c55e");
      circle(ctx, x + s * 0.4, trackY - h * 0.06 - s * 0.9, s * 0.5, "#15803d");
    } else if (r < 0.62) {
      const fc = ["#f43f5e", "#facc15", "#ffffff", "#c084fc"][Math.floor(hash(i + 8) * 4)];
      for (let f = 0; f < 4; f++) circle(ctx, x + f * 6, trackY - h * 0.06 - (f % 2) * 4, 3.5, fc);
    }
  }
  // かせん（でんせん）
  ctx.strokeStyle = "#57534e";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, trackY - h * 0.455);
  ctx.lineTo(w, trackY - h * 0.455);
  ctx.stroke();

  // えき
  [[g.prevStopX, g.stationIdx - 1], [g.stopX, g.stationIdx]].forEach(([st, idx]) => {
    if (st < minW - 120 || st > maxW + 120) return;
    const name = STATIONS[((idx % STATIONS.length) + STATIONS.length) % STATIONS.length] + "えき";
    const x1 = sx(st - 95);
    const x2 = sx(st + 25);
    const top = trackY - h * 0.12;
    ctx.fillStyle = "#cbd5e1";
    ctx.fillRect(x1, top, x2 - x1, trackY - top);
    ctx.fillStyle = "#facc15";
    ctx.fillRect(x1, top, x2 - x1, 4);
    ctx.fillStyle = "#64748b";
    for (let m = st - 90; m <= st + 20; m += 18) ctx.fillRect(sx(m) - 3, trackY - h * 0.55, 6, h * 0.45);
    ctx.fillStyle = "#475569";
    ctx.fillRect(x1 - 6, trackY - h * 0.58, x2 - x1 + 12, h * 0.05);
    // えきめい ひょう
    const bx = sx(st - 14);
    const bw = Math.max(110, name.length * h * 0.06);
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, bx - bw / 2, trackY - h * 0.52, bw, h * 0.1, 8);
    ctx.fill();
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#1e3a8a";
    ctx.font = `bold ${Math.round(h * 0.055)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name, bx, trackY - h * 0.47);
    // ていしゃいち の あかい はた
    if (st === g.stopX) {
      const fx = sx(st);
      const wave = Math.sin(time * 6) * 4;
      ctx.fillStyle = "#e5e7eb";
      ctx.fillRect(fx - 2, trackY - h * 0.72, 5, h * 0.62);
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.moveTo(fx + 3, trackY - h * 0.72);
      ctx.quadraticCurveTo(fx + 30, trackY - h * 0.72 + wave, fx + 58, trackY - h * 0.7);
      ctx.lineTo(fx + 58, trackY - h * 0.58);
      ctx.quadraticCurveTo(fx + 30, trackY - h * 0.6 - wave, fx + 3, trackY - h * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${Math.round(h * 0.06)}px sans-serif`;
      ctx.fillText("ここ", fx + 30, trackY - h * 0.65);
    }
  });

  // せんろ
  ctx.fillStyle = "#a8a29e";
  ctx.fillRect(0, trackY, w, h * 0.07);
  ctx.fillStyle = "#4d7c0f";
  ctx.fillRect(0, trackY + h * 0.07, w, h);
  const kb0 = Math.floor(minW / BRIDGE_BLOCK);
  const kb1 = Math.floor(maxW / BRIDGE_BLOCK);
  for (let k = kb0; k <= kb1; k++) {
    const b = bridgeAt(k, g);
    if (!b) continue;
    const x1 = sx(b[0]);
    const x2 = sx(b[1]);
    ctx.fillStyle = "#0ea5e9";
    ctx.fillRect(x1, trackY + h * 0.05, x2 - x1, h);
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 2;
    for (let j = 0; j < 6; j++) {
      const wy = trackY + h * (0.1 + (j % 3) * 0.035);
      const wx0 = x1 + ((j * 47 + time * 25) % Math.max(1, x2 - x1 - 20));
      ctx.beginPath();
      ctx.moveTo(wx0, wy);
      ctx.quadraticCurveTo(wx0 + 6, wy - 4, wx0 + 12, wy);
      ctx.stroke();
    }
    ctx.fillStyle = "#b91c1c";
    ctx.fillRect(x1, trackY, x2 - x1, h * 0.06);
  }
  ctx.fillStyle = "#57534e";
  for (let m = Math.floor(minW / 1.2); m <= Math.ceil(maxW / 1.2); m++) {
    ctx.fillRect(sx(m * 1.2), trackY + 2, PPM * 0.6, h * 0.035);
  }
  ctx.fillStyle = "#d6d3d1";
  ctx.fillRect(0, trackY, w, 3);

  // ていしゃいち マーク（せんろの うえ）
  if (g.stopX > minW && g.stopX < maxW) {
    const fx = sx(g.stopX);
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.moveTo(fx, trackY + 4);
    ctx.lineTo(fx - 9, trackY + h * 0.065);
    ctx.lineTo(fx + 9, trackY + h * 0.065);
    ctx.closePath();
    ctx.fill();
  }

  // じぶんの でんしゃ
  drawTrain(ctx, noseX, trackY, h, pos);

  // てっきょうの ほね（でんしゃの てまえ）
  for (let k = kb0; k <= kb1; k++) {
    const b = bridgeAt(k, g);
    if (!b) continue;
    const x1 = sx(b[0]);
    const x2 = sx(b[1]);
    const topY = trackY - h * 0.4;
    ctx.strokeStyle = "rgba(185,28,28,0.9)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x1, trackY);
    ctx.lineTo(x1 + 20, topY);
    ctx.lineTo(x2 - 20, topY);
    ctx.lineTo(x2, trackY);
    ctx.stroke();
    ctx.lineWidth = 3;
    const step = 6 * PPM;
    let up = true;
    for (let x = x1 + 20; x < x2 - 20; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, up ? topY : trackY);
      ctx.lineTo(Math.min(x + step, x2 - 20), up ? trackY : topY);
      ctx.stroke();
      up = !up;
    }
  }
}

function drawTrain(ctx, noseX, trackY, h, pos) {
  const bottom = trackY - h * 0.045;
  const top = trackY - h * 0.34;
  const bh = bottom - top;
  const left = -40;
  const nx0 = noseX - bh * 0.45;

  // パンタグラフ
  const panX = nx0 - bh * 1.6;
  const wireY = trackY - h * 0.455;
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(panX - bh * 0.3, top);
  ctx.lineTo(panX, (top + wireY) / 2);
  ctx.lineTo(panX + bh * 0.3, top);
  ctx.moveTo(panX, (top + wireY) / 2);
  ctx.lineTo(panX, wireY);
  ctx.moveTo(panX - bh * 0.25, wireY);
  ctx.lineTo(panX + bh * 0.25, wireY);
  ctx.stroke();

  // しゃたい
  ctx.fillStyle = "#f8fafc";
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 2;
  roundRect(ctx, left, top, nx0 - left + 2, bh, 10);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(nx0, top);
  ctx.quadraticCurveTo(noseX, top, noseX, top + bh * 0.6);
  ctx.lineTo(noseX, bottom);
  ctx.lineTo(nx0, bottom);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // おびの いろ
  ctx.fillStyle = "#2563eb";
  ctx.fillRect(left, top + bh * 0.66, noseX - left, bh * 0.1);
  ctx.fillStyle = "#38bdf8";
  ctx.fillRect(left, top + bh * 0.78, noseX - left, bh * 0.05);

  // まど
  ctx.fillStyle = "#7dd3fc";
  for (let x = nx0 - bh * 0.9; x > left - bh; x -= bh * 0.7) {
    roundRect(ctx, x - bh * 0.45, top + bh * 0.18, bh * 0.45, bh * 0.32, 5);
    ctx.fill();
  }
  // ドア
  ctx.fillStyle = "#e2e8f0";
  ctx.strokeStyle = "#94a3b8";
  roundRect(ctx, nx0 - bh * 2.35, top + bh * 0.12, bh * 0.38, bh * 0.82, 4);
  ctx.fill();
  ctx.stroke();

  // うんてんせきの まど と うんてんしさん
  ctx.fillStyle = "#1e3a8a";
  roundRect(ctx, nx0 - bh * 0.15, top + bh * 0.14, bh * 0.5, bh * 0.38, 8);
  ctx.fill();
  const fx = nx0 + bh * 0.1;
  const fy = top + bh * 0.38;
  circle(ctx, fx, fy, bh * 0.1, "#fcd9b6");
  ctx.fillStyle = "#1d4ed8";
  ctx.fillRect(fx - bh * 0.12, fy - bh * 0.17, bh * 0.24, bh * 0.07);
  ctx.fillRect(fx - bh * 0.02, fy - bh * 0.12, bh * 0.17, bh * 0.025);
  circle(ctx, fx + bh * 0.04, fy - bh * 0.01, bh * 0.015, "#1f2937");

  // ライト
  circle(ctx, noseX - 6, top + bh * 0.72, bh * 0.06, "#fef08a");
  circle(ctx, noseX - 6, top + bh * 0.72, bh * 0.1, "rgba(254,240,138,0.35)");

  // したまわり と しゃりん
  ctx.fillStyle = "#334155";
  ctx.fillRect(left, bottom - 2, noseX - left - 4, h * 0.02);
  const r = h * 0.035;
  const angle = pos / 0.43;
  [nx0 - bh * 0.15, nx0 - bh * 0.5, nx0 - bh * 2.9, nx0 - bh * 3.25].forEach((wx) => {
    circle(ctx, wx, trackY - r + 1, r, "#111827");
    circle(ctx, wx, trackY - r + 1, r * 0.45, "#9ca3af");
    ctx.strokeStyle = "#d1d5db";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let s = 0; s < 3; s++) {
      const a = angle + (s * Math.PI * 2) / 3;
      ctx.moveTo(wx, trackY - r + 1);
      ctx.lineTo(wx + Math.cos(a) * r * 0.85, trackY - r + 1 + Math.sin(a) * r * 0.85);
    }
    ctx.stroke();
  });
}

/* =========================================================
   こまかい パーツ
   ========================================================= */
function isLight(hex) {
  if (!hex || hex[0] !== "#") return false;
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * gg + 0.114 * b > 175;
}

function MedalBadge({ medal, size = 90, owned = true, shine = false }) {
  if (!owned) {
    return (
      <div
        className="rounded-full flex items-center justify-center bg-slate-300 border-4 border-slate-400 shadow-inner"
        style={{ width: size, height: size }}
      >
        <span className="font-black text-slate-500" style={{ fontSize: size * 0.45 }}>？</span>
      </div>
    );
  }
  const Icon = medal.icon;
  const bg =
    medal.color === "rainbow"
      ? "radial-gradient(circle at 30% 25%, rgba(255,255,255,.85), rgba(255,255,255,0) 40%), conic-gradient(#f43f5e,#f97316,#facc15,#22c55e,#06b6d4,#6366f1,#d946ef,#f43f5e)"
      : `radial-gradient(circle at 30% 25%, rgba(255,255,255,.75), rgba(255,255,255,0) 42%), radial-gradient(circle, rgba(0,0,0,0) 55%, rgba(0,0,0,.28) 100%), ${medal.color}`;
  const iconColor = medal.color !== "rainbow" && isLight(medal.color) ? "#1e293b" : "#ffffff";
  return (
    <div
      className="relative rounded-full shadow-lg shrink-0"
      style={{ width: size, height: size, padding: size * 0.075, background: RARITY[medal.rarity].ring }}
    >
      <div className="relative w-full h-full rounded-full overflow-hidden flex items-center justify-center" style={{ background: bg }}>
        <Icon size={size * 0.46} color={iconColor} strokeWidth={2.4} />
        {shine && <div className="absolute top-0 bottom-0 w-1/3 bg-white/60 jc-shine" />}
      </div>
      {medal.rarity >= 2 && (
        <Sparkles className="absolute -top-1 -right-1 text-yellow-300 drop-shadow jc-twinkle" size={size * 0.3} fill="#fde047" />
      )}
    </div>
  );
}

function Stars({ n, size = 18 }) {
  return (
    <div className="flex justify-center gap-0.5">
      {Array.from({ length: n }).map((_, i) => (
        <Star key={i} size={size} className="text-yellow-400" fill="#facc15" />
      ))}
    </div>
  );
}

function Confetti({ count = 50 }) {
  const [pieces] = useState(() =>
    Array.from({ length: count }).map((_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 1.5,
      dur: 2.2 + Math.random() * 2,
      color: ["#f43f5e", "#facc15", "#22c55e", "#3b82f6", "#a855f7", "#f97316"][i % 6],
      size: 8 + Math.random() * 10,
      round: Math.random() < 0.4,
    }))
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <div
          key={i}
          className="absolute top-0 jc-fall"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 0.5,
            background: p.color,
            borderRadius: p.round ? "50%" : 2,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
          }}
        />
      ))}
    </div>
  );
}

// おしている あいだ ずっと はんのうする ボタン
function HoldButton({ onDown, onUp, className, pressedClass, children }) {
  const [on, setOn] = useState(false);
  const holding = useRef(false);
  const start = (e) => {
    if (e && e.cancelable) e.preventDefault();
    if (holding.current) return;
    holding.current = true;
    setOn(true);
    if (onDown) onDown();
  };
  const end = () => {
    if (!holding.current) return;
    holding.current = false;
    setOn(false);
    if (onUp) onUp();
  };
  return (
    <button
      type="button"
      onPointerDown={start}
      onPointerUp={end}
      onPointerCancel={end}
      onMouseDown={start}
      onMouseUp={end}
      onMouseLeave={end}
      onTouchStart={start}
      onTouchEnd={end}
      onTouchCancel={end}
      onContextMenu={(e) => e.preventDefault()}
      className={`${className} ${on ? pressedClass : ""} select-none transition-transform duration-75`}
      style={{ touchAction: "none", WebkitTapHighlightColor: "transparent" }}
    >
      {children}
    </button>
  );
}

/* =========================================================
   スピードメーター
   ========================================================= */
function Speedometer({ speed }) {
  const max = 120;
  const a0 = -115;
  const a1 = 115;
  const cx = 160;
  const cy = 135;
  const r = 118;
  const ang = a0 + (Math.min(speed, max) / max) * (a1 - a0);
  const pt = (deg, rad) => {
    const t = (deg * Math.PI) / 180;
    return [cx + rad * Math.sin(t), cy - rad * Math.cos(t)];
  };
  const arc = (from, to, color) => {
    const [x1, y1] = pt(a0 + (from / max) * (a1 - a0), r);
    const [x2, y2] = pt(a0 + (to / max) * (a1 - a0), r);
    const large = ((to - from) / max) * (a1 - a0) > 180 ? 1 : 0;
    return <path d={`M${x1} ${y1} A${r} ${r} 0 ${large} 1 ${x2} ${y2}`} stroke={color} strokeWidth="16" fill="none" strokeLinecap="butt" />;
  };
  const ticks = [];
  for (let v = 0; v <= max; v += 10) {
    const big = v % 20 === 0;
    const a = a0 + (v / max) * (a1 - a0);
    const [x1, y1] = pt(a, r - 12);
    const [x2, y2] = pt(a, r - (big ? 30 : 22));
    ticks.push(<line key={`t${v}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e2e8f0" strokeWidth={big ? 4 : 2} />);
    if (big) {
      const [lx, ly] = pt(a, r - 48);
      ticks.push(
        <text key={`l${v}`} x={lx} y={ly} fill="#f8fafc" fontSize="19" fontWeight="900" textAnchor="middle" dominantBaseline="middle">
          {v}
        </text>
      );
    }
  }
  const [nx, ny] = pt(ang, r - 26);
  return (
    <svg viewBox="0 0 320 250" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      <circle cx={cx} cy={cy} r={r + 14} fill="#0f172a" stroke="#64748b" strokeWidth="6" />
      {arc(0, 60, "#22c55e")}
      {arc(60, 90, "#facc15")}
      {arc(90, 120, "#ef4444")}
      {ticks}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#f97316" strokeWidth="8" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="14" fill="#f97316" stroke="#fff" strokeWidth="4" />
      <rect x={cx - 92} y={cy + 48} width="184" height="62" rx="16" fill="#111827" stroke="#38bdf8" strokeWidth="3" />
      <text x={cx - 14} y={cy + 81} fill="#7dd3fc" fontSize="54" fontWeight="900" textAnchor="middle" dominantBaseline="middle">
        {Math.round(speed)}
      </text>
      <text x={cx + 58} y={cy + 86} fill="#e0f2fe" fontSize="22" fontWeight="900" textAnchor="middle" dominantBaseline="middle">
        キロ
      </text>
    </svg>
  );
}

/* =========================================================
   うんてんせき（ゲーム がめん）
   ========================================================= */
function DriveScreen({ onHome, onZukan, award }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  if (!gameRef.current) gameRef.current = newGame();
  const awardRef = useRef(award);
  awardRef.current = award;

  const [hud, setHud] = useState({ speed: 0, remain: 280, progress: 0, hint: false, slow: false, station: 0 });
  const [toast, setToast] = useState(null);
  const [result, setResult] = useState(null);
  const toastTimer = useRef(null);
  const timers = useRef([]);

  const showToast = useCallback((text) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  const later = (fn, ms) => {
    timers.current.push(setTimeout(fn, ms));
  };

  // メインループ
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const ctx = canvas.getContext("2d");
    const size = { w: 0, h: 0 };

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      size.w = Math.max(1, rect.width);
      size.h = Math.max(1, rect.height);
      canvas.width = Math.round(size.w * dpr);
      canvas.height = Math.round(size.h * dpr);
      canvas.style.width = `${size.w}px`;
      canvas.style.height = `${size.h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    let ro = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(resize);
      ro.observe(wrap);
    }
    window.addEventListener("resize", resize);

    let raf = 0;
    let last = performance.now();
    let lastHud = "";

    const onStopped = (g) => {
      const err = g.stopX - g.pos;
      const r = Math.round(Math.abs(err));
      sound.air();
      if (r <= OK_RANGE) {
        g.phase = "clear";
        const perfect = r === 0;
        const got = awardRef.current(perfect);
        setResult({ type: perfect ? "perfect" : "success", err: r, ...got });
        later(() => sound.melody(), 400);
        later(() => sound.fanfare(perfect), 2300);
      } else if (err > 0) {
        showToast(`あと ${r}メートル！ もうすこし すすもう`);
      } else {
        g.phase = "over";
        setResult({ type: "over", err: r });
      }
    };

    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const g = gameRef.current;
      const remain = g.stopX - g.pos;
      let slow = false;

      if (g.phase === "drive") {
        let v = g.speed;
        const wasMoving = v > 0;
        let limit = MAX_SPEED;
        if (remain < 160 && remain > -60) { limit = 45; slow = true; }
        if (remain < 50 && remain > -60) limit = 25;
        const forceBrake = remain < -40;

        if (g.brake || forceBrake) v -= (v < 15 ? BRAKE * 0.85 : BRAKE) * dt;
        else if (g.accel) v += ACCEL * dt;
        else v -= COAST * dt;
        if (v > limit) v = Math.max(limit, v - 14 * dt);
        v = Math.max(0, Math.min(MAX_SPEED, v));
        g.speed = v;

        const move = (v / 3.6) * dt;
        g.pos += move;
        g.jointAcc += move;
        if (g.jointAcc >= 12.5) {
          g.jointAcc -= 12.5;
          g.alt = !g.alt;
          sound.clack(g.alt);
        }
        sound.setMotor(v, g.accel && !g.brake);
        sound.setSqueal((g.brake || forceBrake) && v > 0.5);

        if (!g.announced && g.stopX - g.pos < 130) {
          g.announced = true;
          showToast(`まもなく ${STATIONS[g.stationIdx % STATIONS.length]}えき！`);
        }
        if (wasMoving && v <= 0) {
          sound.setSqueal(false);
          onStopped(g);
        }
      } else {
        sound.setMotor(0, false);
        sound.setSqueal(false);
      }

      const rem = g.stopX - g.pos;
      const decel = BRAKE / 3.6;
      const vms = g.speed / 3.6;
      const stopDist = (vms * vms) / (2 * decel);
      const hint = g.phase === "drive" && g.speed > 0.5 && rem > 0 && rem <= stopDist + 4 && !g.brake;
      const progress = Math.max(0, Math.min(1, (g.pos - g.startX) / (g.stopX - g.startX)));
      const next = {
        speed: Math.round(g.speed),
        remain: Math.round(rem),
        progress: Math.round(progress * 200) / 200,
        hint,
        slow,
        station: g.stationIdx,
      };
      const key = JSON.stringify(next);
      if (key !== lastHud) {
        lastHud = key;
        setHud(next);
      }

      drawScene(ctx, size.w, size.h, g, now / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      window.removeEventListener("resize", resize);
      clearTimeout(toastTimer.current);
      timers.current.forEach(clearTimeout);
      timers.current = [];
      sound.stopAll();
    };
  }, [showToast]);

  const setAccel = (on) => {
    sound.init();
    gameRef.current.accel = on;
  };
  const setBrake = (on) => {
    sound.init();
    gameRef.current.brake = on;
  };

  const nextStation = () => {
    const g = gameRef.current;
    g.prevStopX = g.stopX;
    g.stationIdx += 1;
    g.startX = g.pos;
    g.stopX = g.pos + 260 + Math.random() * 180;
    g.phase = "drive";
    g.announced = false;
    g.speed = 0;
    setResult(null);
    sound.horn();
  };

  const retry = () => {
    const g = gameRef.current;
    g.speed = 0;
    g.pos = g.stopX - 200;
    g.startX = g.pos;
    g.jointAcc = 0;
    g.phase = "drive";
    g.announced = false;
    setResult(null);
  };

  const stationName = STATIONS[hud.station % STATIONS.length];

  return (
    <div className="flex flex-col w-full h-full bg-slate-800 text-white">
      {/* うえ：つぎの えき */}
      <div className="shrink-0 px-3 pt-2 pb-2 bg-gradient-to-b from-blue-700 to-blue-600">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { sound.stopAll(); onHome(); }}
            className="shrink-0 w-12 h-12 rounded-2xl bg-white/20 active:bg-white/40 flex items-center justify-center"
            aria-label="もどる"
          >
            <ArrowLeft size={30} strokeWidth={3} />
          </button>
          <div className="flex-1 min-w-0 text-center leading-tight">
            <div className="text-lg font-black text-yellow-200">つぎは {stationName}えき</div>
            {hud.remain >= 0 ? (
              <div className="text-2xl font-black whitespace-nowrap">
                あと <span className="text-4xl text-yellow-300 tabular-nums">{hud.remain}</span> メートル
              </div>
            ) : (
              <div className="text-2xl font-black text-red-300 whitespace-nowrap">
                いきすぎ！ <span className="text-4xl tabular-nums">{-hud.remain}</span> メートル
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => { sound.stopAll(); onZukan(); }}
            className="shrink-0 w-12 h-12 rounded-2xl bg-yellow-400 text-yellow-900 active:bg-yellow-300 flex items-center justify-center"
            aria-label="めだるずかん"
          >
            <BookOpen size={28} strokeWidth={3} />
          </button>
        </div>
        <div className="relative mt-2 h-7 rounded-full bg-blue-900/70 border-2 border-white/60">
          <div className="absolute left-0 top-0 bottom-0 rounded-full bg-gradient-to-r from-sky-300 to-yellow-300" style={{ width: `${hud.progress * 100}%` }} />
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2" style={{ left: `${Math.max(4, Math.min(92, hud.progress * 100))}%` }}>
            <div className="w-9 h-9 rounded-full bg-white text-blue-700 flex items-center justify-center shadow-lg border-2 border-blue-500">
              <TrainFront size={22} strokeWidth={2.6} />
            </div>
          </div>
          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1">
            <div className="w-9 h-9 rounded-full bg-red-500 flex items-center justify-center shadow-lg border-2 border-white">
              <Flag size={20} fill="#fff" strokeWidth={2.6} />
            </div>
          </div>
        </div>
      </div>

      {/* しゃそう */}
      <div ref={wrapRef} className="relative w-full shrink-0 overflow-hidden border-y-4 border-slate-900" style={{ height: "31dvh" }}>
        <canvas ref={canvasRef} className="block" />
        {hud.slow && result === null && (
          <div className="absolute top-2 left-2 px-3 py-1 rounded-xl bg-yellow-300 text-yellow-900 font-black text-lg shadow border-2 border-yellow-600">
            ゆっくり
          </div>
        )}
        {hud.hint && (
          <div className="absolute inset-x-0 top-1/3 flex justify-center pointer-events-none">
            <div className="px-6 py-2 rounded-3xl bg-red-600 text-white text-4xl font-black shadow-2xl border-4 border-white jc-blink">
              ぶれーき！
            </div>
          </div>
        )}
        {toast && (
          <div className="absolute inset-x-3 bottom-3 flex justify-center pointer-events-none">
            <div className="px-4 py-2 rounded-2xl bg-white/95 text-blue-800 text-2xl font-black shadow-xl text-center jc-pop">
              {toast}
            </div>
          </div>
        )}
      </div>

      {/* スピードメーター */}
      <div className="flex-1 min-h-0 flex items-center justify-center px-6 py-1">
        <Speedometer speed={hud.speed} />
      </div>

      {/* 3つの ボタン */}
      <div className="shrink-0 grid grid-cols-3 gap-3 px-3 pb-4 pt-1" style={{ height: "27dvh" }}>
        <HoldButton
          onDown={() => setBrake(true)}
          onUp={() => setBrake(false)}
          className="rounded-[2rem] bg-gradient-to-b from-red-400 to-red-600 border-b-[10px] border-red-800 shadow-xl flex flex-col items-center justify-center gap-1"
          pressedClass="translate-y-2 border-b-2 brightness-110"
        >
          <ChevronsDown size={58} strokeWidth={3.2} />
          <span className="text-3xl font-black">ぶれーき</span>
        </HoldButton>
        <HoldButton
          onDown={() => sound.horn()}
          className="rounded-[2rem] bg-gradient-to-b from-yellow-300 to-amber-500 text-amber-950 border-b-[10px] border-amber-700 shadow-xl flex flex-col items-center justify-center gap-1"
          pressedClass="translate-y-2 border-b-2 brightness-110"
        >
          <Megaphone size={54} strokeWidth={3} />
          <span className="text-3xl font-black">けいてき</span>
          <span className="text-base font-black">プァーッ！</span>
        </HoldButton>
        <HoldButton
          onDown={() => setAccel(true)}
          onUp={() => setAccel(false)}
          className="rounded-[2rem] bg-gradient-to-b from-green-400 to-green-600 border-b-[10px] border-green-800 shadow-xl flex flex-col items-center justify-center gap-1"
          pressedClass="translate-y-2 border-b-2 brightness-110"
        >
          <ChevronsUp size={58} strokeWidth={3.2} />
          <span className="text-3xl font-black">かそく</span>
        </HoldButton>
      </div>

      {result && (
        <ResultOverlay result={result} onNext={nextStation} onRetry={retry} onZukan={() => { sound.stopAll(); onZukan(); }} />
      )}
    </div>
  );
}

/* =========================================================
   けっか がめん
   ========================================================= */
function ResultOverlay({ result, onNext, onRetry, onZukan }) {
  if (result.type === "over") {
    return (
      <div className="absolute inset-0 z-30 bg-black/60 flex items-center justify-center p-6">
        <div className="w-full rounded-[2rem] bg-white text-slate-800 p-6 text-center shadow-2xl jc-pop">
          <div className="text-5xl font-black text-orange-500">おしい！</div>
          <div className="mt-3 text-2xl font-black">{result.err}メートル いきすぎちゃった</div>
          <div className="mt-2 text-xl font-bold text-slate-500">「ぶれーき！」が でたら おしてね</div>
          <button
            type="button"
            onClick={onRetry}
            className="mt-6 w-full h-24 rounded-3xl bg-gradient-to-b from-sky-400 to-blue-600 text-white text-3xl font-black border-b-8 border-blue-800 active:translate-y-1 active:border-b-2 flex items-center justify-center gap-3"
          >
            <RotateCcw size={40} strokeWidth={3} /> もういっかい
          </button>
        </div>
      </div>
    );
  }

  const perfect = result.type === "perfect";
  const medal = result.medal;
  return (
    <div className={`absolute inset-0 z-30 flex items-center justify-center p-4 ${perfect ? "jc-rainbow-bg" : "bg-black/60"}`}>
      <Confetti count={perfect ? 90 : 45} />
      <div className="relative w-full rounded-[2rem] bg-white text-slate-800 px-5 py-6 text-center shadow-2xl jc-pop">
        {perfect ? (
          <>
            <div className="flex justify-center gap-2 text-yellow-400">
              <Crown size={56} fill="#facc15" className="jc-float" />
            </div>
            <div className="text-5xl font-black jc-rainbow-text">ちょうぴったり！</div>
            <div className="mt-1 text-2xl font-black text-purple-600">でんせつの うんてんし！</div>
          </>
        ) : (
          <>
            <Trophy size={56} className="mx-auto text-yellow-400 jc-float" fill="#fde047" />
            <div className="text-5xl font-black text-green-600">だいせいこう！</div>
          </>
        )}
        <div className="mt-2 text-xl font-black text-slate-600">
          ずれ：<span className="text-3xl text-blue-600">{result.err}</span>メートル
        </div>

        {medal && (
          <div className="mt-4 rounded-3xl bg-gradient-to-b from-yellow-50 to-amber-100 border-4 border-yellow-300 p-4 jc-pop-late">
            <div className="text-xl font-black text-amber-700">
              {result.isNew ? "あたらしい メダル ゲット！" : "メダル ゲット！"}
            </div>
            <div className="mt-3 flex justify-center">
              <MedalBadge medal={medal} size={130} shine />
            </div>
            <div className="mt-3 text-2xl font-black">{medal.name}</div>
            <div className="text-base font-bold text-slate-500">{medal.place} ・ {RARITY[medal.rarity].name}</div>
            <div className="mt-1"><Stars n={RARITY[medal.rarity].stars} size={24} /></div>
          </div>
        )}

        <div className="mt-5 grid grid-cols-3 gap-3">
          <button
            type="button"
            onClick={onZukan}
            className="h-24 rounded-3xl bg-gradient-to-b from-yellow-300 to-amber-500 text-amber-950 font-black text-lg border-b-8 border-amber-700 active:translate-y-1 active:border-b-2 flex flex-col items-center justify-center"
          >
            <BookOpen size={34} strokeWidth={3} />
            ずかん
          </button>
          <button
            type="button"
            onClick={onNext}
            className="col-span-2 h-24 rounded-3xl bg-gradient-to-b from-green-400 to-green-600 text-white text-2xl font-black whitespace-nowrap border-b-8 border-green-800 active:translate-y-1 active:border-b-2 flex items-center justify-center gap-2"
          >
            <Play size={32} fill="#fff" /> つぎの えきへ
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   めだるずかん
   ========================================================= */
function ZukanScreen({ owned, onBack }) {
  const [detail, setDetail] = useState(null);
  const count = MEDALS.filter((m) => owned[m.id]).length;

  return (
    <div className="flex flex-col w-full h-full bg-gradient-to-b from-indigo-900 via-purple-900 to-slate-900 text-white">
      <div className="shrink-0 px-3 pt-3 pb-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="shrink-0 w-14 h-14 rounded-2xl bg-white/20 active:bg-white/40 flex items-center justify-center"
            aria-label="もどる"
          >
            <ArrowLeft size={34} strokeWidth={3} />
          </button>
          <div className="flex-1 text-center">
            <div className="text-3xl font-black text-yellow-300 drop-shadow">めだるずかん</div>
            <div className="text-xl font-black">
              <span className="text-3xl text-yellow-200 tabular-nums">{count}</span> / {TOTAL}まい
            </div>
          </div>
          <div className="w-14" />
        </div>
        <div className="mt-2 h-4 rounded-full bg-white/20 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-yellow-300 via-pink-400 to-sky-400" style={{ width: `${(count / TOTAL) * 100}%` }} />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-8" style={{ overscrollBehavior: "contain" }}>
        {KINDS.map((kind, k) => {
          const list = MEDALS.filter((m) => m.kind === k);
          const got = list.filter((m) => owned[m.id]).length;
          const KIcon = kind.icon;
          return (
            <section key={kind.name} className="mt-4">
              <div className="flex items-center gap-2 mb-2 px-1">
                <KIcon size={26} className="text-yellow-300" />
                <div className="text-xl font-black flex-1">{kind.name}</div>
                <div className="text-lg font-black text-yellow-200">{got} / {list.length}</div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {list.map((m) => {
                  const has = !!owned[m.id];
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => { if (has) { sound.pop(); setDetail(m); } }}
                      className={`relative rounded-3xl p-2 pt-3 flex flex-col items-center overflow-hidden ${
                        has ? "bg-white/15 border-2 border-yellow-300/70 active:scale-95" : "bg-black/25 border-2 border-white/10"
                      }`}
                    >
                      {has && <div className="absolute inset-0 jc-card-glow pointer-events-none" />}
                      <MedalBadge medal={m} owned={has} size={78} />
                      <div className="mt-1 text-xs font-bold text-white/60 tabular-nums">No.{String(m.id).padStart(3, "0")}</div>
                      <div className="text-sm font-black leading-tight min-h-[2.4em] flex items-center text-center">
                        {has ? m.name : "？？？"}
                      </div>
                      {has && <Stars n={RARITY[m.rarity].stars} size={12} />}
                      {has && owned[m.id] > 1 && (
                        <div className="absolute top-1 right-1 rounded-full bg-pink-500 text-white text-xs font-black px-2 py-0.5">
                          ×{owned[m.id]}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {detail && (
        <div className="absolute inset-0 z-30 bg-black/70 flex items-center justify-center p-6" onClick={() => setDetail(null)}>
          <div className="relative w-full rounded-[2rem] bg-white text-slate-800 p-6 text-center shadow-2xl jc-pop" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setDetail(null)}
              className="absolute top-3 right-3 w-14 h-14 rounded-full bg-slate-200 active:bg-slate-300 flex items-center justify-center"
              aria-label="とじる"
            >
              <X size={32} strokeWidth={3} />
            </button>
            <div className="text-lg font-black text-slate-400 tabular-nums">No.{String(detail.id).padStart(3, "0")}</div>
            <div className="mt-2 flex justify-center">
              <MedalBadge medal={detail} size={180} shine />
            </div>
            <div className="mt-4 text-3xl font-black">{detail.name}</div>
            <div className="mt-1 text-lg font-bold text-slate-500">{detail.place}の メダル</div>
            <div className="mt-2 text-xl font-black text-amber-600">{RARITY[detail.rarity].name}</div>
            <Stars n={RARITY[detail.rarity].stars} size={30} />
            <div className="mt-3 text-xl font-black text-pink-500">{owned[detail.id]}まい もってるよ</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   タイトル がめん
   ========================================================= */
function TitleScreen({ save, onStart, onZukan }) {
  const count = MEDALS.filter((m) => save.owned[m.id]).length;
  return (
    <div className="relative flex flex-col w-full h-full overflow-hidden bg-gradient-to-b from-sky-400 via-sky-300 to-lime-300 text-slate-900">
      <div className="absolute top-8 right-8 w-24 h-24 rounded-full bg-yellow-300 shadow-[0_0_60px_20px_rgba(253,224,71,0.6)]" />
      <div className="absolute bottom-[18%] left-0 right-0 h-3 bg-stone-500" />
      <div className="absolute bottom-[18%] left-0 jc-title-train">
        <div className="w-28 h-20 -translate-y-full rounded-t-3xl rounded-br-[3rem] bg-white border-4 border-blue-600 flex items-center justify-center">
          <TrainFront size={44} className="text-blue-600" />
        </div>
      </div>

      <div className="relative flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="text-2xl font-black text-white drop-shadow-[0_2px_0_rgba(30,64,175,1)]">ぼくだけの</div>
        <div className="mt-1 text-5xl font-black text-blue-800 leading-tight drop-shadow-[0_3px_0_rgba(255,255,255,1)]">
          てつどう
          <br />
          うんてん
        </div>
        <div className="mt-1 text-3xl font-black text-orange-600 drop-shadow-[0_2px_0_rgba(255,255,255,1)]">シミュレーター</div>

        <div className="mt-4 jc-float">
          <div className="w-32 h-32 rounded-full bg-white/90 border-8 border-blue-600 flex items-center justify-center shadow-2xl">
            <TrainFront size={80} className="text-blue-600" strokeWidth={2.2} />
          </div>
        </div>
      </div>

      <div className="relative shrink-0 px-6 pb-10 flex flex-col gap-4">
        <button
          type="button"
          onClick={() => { sound.init(); sound.horn(); onStart(); }}
          className="h-28 rounded-[2rem] bg-gradient-to-b from-green-400 to-green-600 text-white text-5xl font-black border-b-[12px] border-green-800 shadow-2xl active:translate-y-2 active:border-b-4 flex items-center justify-center gap-3"
        >
          <Play size={52} fill="#fff" /> しゅっぱつ！
        </button>
        <button
          type="button"
          onClick={() => { sound.init(); sound.pop(); onZukan(); }}
          className="h-24 rounded-[2rem] bg-gradient-to-b from-yellow-300 to-amber-500 text-amber-950 text-3xl font-black border-b-[10px] border-amber-700 shadow-xl active:translate-y-2 active:border-b-4 flex items-center justify-center gap-3"
        >
          <BookOpen size={40} strokeWidth={3} />
          <span>
            めだるずかん
            <span className="block text-lg leading-none">{count} / {TOTAL}まい</span>
          </span>
        </button>
        <div className="text-center text-base font-black text-green-900 whitespace-nowrap">
          ていしゃ せいこう：{save.cleared}かい ・ ぴったり：{save.perfect}かい
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   アニメーション（CSS）
   ========================================================= */
const STYLE = `
@keyframes jc-fall { 0% { transform: translateY(-20px) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) rotate(720deg); opacity: .9; } }
@keyframes jc-pop { 0% { transform: scale(.3) rotate(-8deg); opacity: 0; } 60% { transform: scale(1.08) rotate(2deg); opacity: 1; } 100% { transform: scale(1) rotate(0); } }
@keyframes jc-shine { 0% { transform: translateX(-200%) skewX(-20deg); } 100% { transform: translateX(400%) skewX(-20deg); } }
@keyframes jc-blink { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.12); opacity: .75; } }
@keyframes jc-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
@keyframes jc-twinkle { 0%,100% { transform: scale(.8) rotate(0); opacity: .7; } 50% { transform: scale(1.15) rotate(20deg); opacity: 1; } }
@keyframes jc-rainbow { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
@keyframes jc-glow { 0%,100% { opacity: .15; } 50% { opacity: .4; } }
@keyframes jc-run { 0% { transform: translateX(-140px); } 100% { transform: translateX(110vw); } }
.jc-fall { animation: jc-fall 3s linear infinite; }
.jc-pop { animation: jc-pop .5s cubic-bezier(.2,1.4,.4,1) both; }
.jc-pop-late { animation: jc-pop .6s cubic-bezier(.2,1.4,.4,1) 1.9s both; }
.jc-shine { animation: jc-shine 2.2s ease-in-out infinite; }
.jc-blink { animation: jc-blink .5s ease-in-out infinite; }
.jc-float { animation: jc-float 2s ease-in-out infinite; }
.jc-twinkle { animation: jc-twinkle 1.4s ease-in-out infinite; }
.jc-rainbow-text { background: linear-gradient(90deg,#f43f5e,#f97316,#eab308,#22c55e,#06b6d4,#8b5cf6,#f43f5e); background-size: 200% auto; -webkit-background-clip: text; background-clip: text; color: transparent; animation: jc-rainbow 2s linear infinite; }
.jc-rainbow-bg { background: linear-gradient(120deg,rgba(244,63,94,.8),rgba(250,204,21,.8),rgba(34,197,94,.8),rgba(59,130,246,.8),rgba(168,85,247,.8),rgba(244,63,94,.8)); background-size: 300% 300%; animation: jc-rainbow 3s linear infinite; }
.jc-card-glow { background: radial-gradient(circle at 50% 30%, rgba(253,224,71,.6), transparent 60%); animation: jc-glow 2.4s ease-in-out infinite; }
.jc-title-train { animation: jc-run 6s linear infinite; }
`;

/* =========================================================
   アプリ ほんたい
   ========================================================= */
export default function App() {
  const [screen, setScreen] = useState("title");
  const [backTo, setBackTo] = useState("title");
  const [save, setSave] = useState(loadSave);
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => { writeSave(save); }, [save]);

  // メダルを 1まい もらう（うんてんせき から よばれる）
  const award = useCallback((perfect) => {
    const cur = saveRef.current;
    const medal = pickMedal(cur.owned, perfect);
    const isNew = !cur.owned[medal.id];
    const next = {
      owned: { ...cur.owned, [medal.id]: (cur.owned[medal.id] || 0) + 1 },
      cleared: cur.cleared + 1,
      perfect: cur.perfect + (perfect ? 1 : 0),
    };
    saveRef.current = next;
    setSave(next);
    return { medal, isNew };
  }, []);

  const [driveKey, setDriveKey] = useState(0);
  const [inDrive, setInDrive] = useState(false);

  const goZukan = (from) => { setBackTo(from); setScreen("zukan"); };

  return (
    <div
      className="fixed inset-0 bg-slate-900 flex justify-center select-none"
      style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none", overscrollBehavior: "none", touchAction: "manipulation" }}
    >
      <style>{STYLE}</style>
      <div className="relative w-full max-w-[480px] h-[100dvh] overflow-hidden" style={{ fontFamily: "'Hiragino Maru Gothic ProN','Rounded Mplus 1c','Noto Sans JP',system-ui,sans-serif" }}>
        {screen === "title" && (
          <TitleScreen
            save={save}
            onStart={() => { setInDrive(true); setDriveKey((k) => k + 1); setScreen("drive"); }}
            onZukan={() => goZukan("title")}
          />
        )}
        {screen === "drive" && inDrive && (
          <DriveScreen
            key={driveKey}
            award={award}
            onHome={() => { setInDrive(false); setScreen("title"); }}
            onZukan={() => goZukan("title")}
          />
        )}
        {screen === "zukan" && (
          <ZukanScreen owned={save.owned} onBack={() => setScreen(backTo)} />
        )}
      </div>
    </div>
  );
}
