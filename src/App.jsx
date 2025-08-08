import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * ЛАБУБА — весёлая игра-разрушалка (мультяшно, без жестокости)
 * v2 — Больше веселья: звуки, вибрация, магазин, редкости, ежедневный бонус,
 * мини-квесты, комбо-мультипликатор, всплывающие лут-боксы.
 *
 * УПРОЩЁННЫЕ ИКОНКИ: вместо библиотеки иконок используются эмодзи,
 * чтобы исключить ошибки сборки на Vercel.
 */

// --- Utils
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const rand = (a=0, b=1) => a + Math.random()*(b-a);
const irand = (a, b) => Math.floor(rand(a, b+1));
const chance = (p) => Math.random() < p;
const fmt = (n) => new Intl.NumberFormat().format(n);

// --- Audio (генерируем короткие SFX через WebAudio, без ассетов)
const audioCtx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext) ? new (window.AudioContext || window.webkitAudioContext)() : null;
function beep({ freq=440, dur=0.08, type="sine", gain=0.03 }={}){
  if(!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type; o.frequency.value = freq; g.gain.value = gain;
  o.connect(g); g.connect(audioCtx.destination);
  o.start();
  o.stop(audioCtx.currentTime + dur);
}
const vibrate = (ms=20) => navigator.vibrate?.(ms);

// --- Types
/** @typedef {{ id: string; name: string; icon: string; dmg: [number, number]; particles?: string[]; status?: "burn"|"freeze"|"shock"|"paint"|"slime"|"wind"|"wet"|"grow"|"shrink"|"ghost"; knock?: number; cooldown?: number; unlockAt?: number; comboBonus?: number; desc?: string; rarity?: 'common'|'rare'|'epic'|'legend'; }} Tool */

// --- Tool Catalog (эмодзи вместо импортов)
/** @type {Tool[]} */
const TOOLS_BASE = [
  { id: "hammer", name: "Молот", icon: "🔨", dmg: [8, 14], knock: 18, desc: "Классический удар.", rarity:'common' },
  { id: "saw", name: "Пила", icon: "🪚", dmg: [3, 6], knock: 4, status: "shock", comboBonus: 1, desc: "Ж-ж-ж-ж...", rarity:'common' },
  { id: "laser", name: "Лазер", icon: "🪄", dmg: [6, 10], particles: ["✦","✧","★"], status: "shock", desc: "Будущее здесь.", rarity:'rare', unlockAt: 60 },
  { id: "fire", name: "Огонь", icon: "🔥", dmg: [5, 8], particles: ["🔥"], status: "burn", desc: "Поджарим!", rarity:'common' },
  { id: "ice", name: "Лёд", icon: "❄️", dmg: [4, 7], particles: ["❄️"], status: "freeze", desc: "Заморозка.", rarity:'common' },
  { id: "water", name: "Вода", icon: "💧", dmg: [2, 5], particles: ["💧"], status: "wet", desc: "Мокро и смешно.", rarity:'common' },
  { id: "paint", name: "Краска", icon: "🎨", dmg: [2, 4], particles: ["🎨","🟡","🟣","🟢"], status: "paint", desc: "Артист!", rarity:'common' },
  { id: "wind", name: "Ветер", icon: "💨", dmg: [1, 3], knock: 30, status: "wind", desc: "Сдувает.", rarity:'common' },
  { id: "tnt", name: "Бум!", icon: "🧨", dmg: [10, 25], particles: ["💥","✨"], knock: 44, cooldown: 800, desc: "Конфетти-взрыв.", rarity:'epic', unlockAt: 120 },
  { id: "zap", name: "Молния", icon: "⚡", dmg: [6, 12], particles: ["⚡"], status: "shock", desc: "Энергия!", rarity:'rare', unlockAt: 80 },
  { id: "anvil", name: "Наковальня", icon: "⚒️", dmg: [9, 18], knock: 50, desc: "Тяжесть комедии.", rarity:'rare', unlockAt: 90 },
  { id: "feather", name: "Пёрышко", icon: "🪶", dmg: [1, 1], particles: ["🪶"], desc: "Щекотка.", rarity:'common' },
  { id: "sun", name: "Солнце", icon: "☀️", dmg: [3, 6], particles: ["☀️","✨"], desc: "Лучисто.", rarity:'common' },
  { id: "rocket", name: "Ракета", icon: "🚀", dmg: [8, 15], particles: ["🚀","✨"], knock: 36, cooldown: 600, desc: "Свист и бац!", rarity:'epic', unlockAt: 150 },
  { id: "drill", name: "Дрель", icon: "🛠️", dmg: [4, 7], particles: ["🌀"], status: "shock", desc: "Ж-ж-ж!", rarity:'common' },
  { id: "scissors", name: "Ножницы", icon: "✂️", dmg: [3, 6], desc: "Подравняем мех.", rarity:'common' },
  { id: "magnet", name: "Магнит", icon: "🧲", dmg: [2, 4], desc: "Притягательная беда.", rarity:'common' },
  { id: "slime", name: "Слизь", icon: "🧪", dmg: [2, 3], particles: ["🟩","🧪"], status: "slime", desc: "Липко.", rarity:'common' },
  { id: "flower", name: "Цветы", icon: "🌸", dmg: [1, 2], particles: ["🌸","🌼"], desc: "Чих!", rarity:'common' },
  { id: "storm", name: "Гроза", icon: "⛈️", dmg: [7, 12], particles: ["⛈️"], status: "shock", desc: "Громыхаем.", rarity:'rare', unlockAt: 70 },
  { id: "rain", name: "Ливень", icon: "🌧️", dmg: [2, 4], particles: ["🌧️"], status: "wet", desc: "Мокренько.", rarity:'common' },
  { id: "snow", name: "Снег", icon: "❄️", dmg: [2, 5], particles: ["❄️"], status: "freeze", desc: "Зима.", rarity:'common' },
  { id: "ghost", name: "Призрак", icon: "👻", dmg: [5, 9], status: "ghost", desc: "Бу!", rarity:'rare', unlockAt: 110 },
  { id: "shield", name: "Щит Лабубы", icon: "🛡️", dmg: [0, 0], desc: "Временная защита.", rarity:'rare', unlockAt: 50 },
  { id: "heal", name: "Супчик (+)", icon: "🍲", dmg: [-15, -10], desc: "Лечит за 20 монет.", rarity:'common' },
  { id: "coin", name: "Монеты", icon: "🪙", dmg: [0, 0], desc: "+10 монет.", rarity:'common' },
  { id: "gift", name: "Подарок", icon: "🎁", dmg: [0, 0], desc: "Сюрприз-бонус.", rarity:'epic', unlockAt: 140 },
  { id: "reset", name: "Сброс", icon: "🔄", dmg: [0, 0], desc: "Перезапуск боя.", rarity:'common' },
  { id: "starfall", name: "Звездопад", icon: "🌟", dmg: [14,22], particles:["✨","⭐","🌟"], knock:40, cooldown:900, desc:"Красивая буря частиц.", rarity:'legend', unlockAt: 220 },
  { id: "dice", name: "Куб удачи", icon: "🎲", dmg: [0,30], particles:["🎲","✨"], knock:20, cooldown:900, desc:"Может ничего, а может — вау!", rarity:'legend', unlockAt: 250 },
];

const ACHIEVEMENTS = [
  { id: "firstHit", title: "Первый шлеп", cond: (s) => s.hits >= 1, reward: 5, icon: "🏆" },
  { id: "tenHit", title: "Десяток!", cond: (s) => s.hits >= 10, reward: 20, icon: "🏆" },
  { id: "hundredHit", title: "Соточка", cond: (s) => s.hits >= 100, reward: 200, icon: "🏆" },
  { id: "combo25", title: "Комбо 25", cond: (s) => s.combo >= 25, reward: 30, icon: "🔁" },
  { id: "burn", title: "Поджарили", cond: (s) => s.statusSeen.burn, reward: 10, icon: "🔥" },
  { id: "freeze", title: "Остудили", cond: (s) => s.statusSeen.freeze, reward: 10, icon: "❄️" },
  { id: "shock", title: "Электрошок!", cond: (s) => s.statusSeen.shock, reward: 10, icon: "⚡" },
  { id: "paint", title: "Артист", cond: (s) => s.statusSeen.paint, reward: 10, icon: "🎨" },
  { id: "slime", title: "Липучка", cond: (s) => s.statusSeen.slime, reward: 10, icon: "🧪" },
  { id: "bossWin", title: "Босс повержен", cond: (s) => s.bossKills >= 1, reward: 100, icon: "💀" },
  { id: "legend", title: "Легенда!", cond: (s)=> s.legendUsed, reward: 150, icon: "🌟" },
];

const QUESTS = [
  { id:"q_combo10", text:"Сделай комбо 10", cond:(s)=> s.comboBest>=10, reward:20 },
  { id:"q_status3", text:"Наложи 3 разных статуса", cond:(s)=> Object.values(s.statusSeen).filter(Boolean).length>=3, reward:25 },
  { id:"q_fiveTools", text:"Используй 5 разных инструментов подряд", cond:(s)=> s.uniqueStreak>=5, reward:30 },
];

const LS_KEY = "labuba_save_v2";

export default function App(){
  const [hp, setHp] = useState(100);
  const [maxHp, setMaxHp] = useState(100);
  const [coins, setCoins] = useState(0);
  const [hits, setHits] = useState(0);
  const [combo, setCombo] = useState(0);
  const [comboBest, setComboBest] = useState(0);
  const [cooldowns, setCooldowns] = useState({});
  const [status, setStatus] = useState({});
  const [statusSeen, setStatusSeen] = useState({ burn:false, freeze:false, shock:false, paint:false, slime:false });
  const [floating, setFloating] = useState([]);
  const [achUnlocked, setAchUnlocked] = useState({});
  const [bossKills, setBossKills] = useState(0);
  const [labubaTilt, setLabubaTilt] = useState(0);
  const [message, setMessage] = useState("");
  const [owned, setOwned] = useState(/** @type {Record<string, boolean>} */({ hammer:true, saw:true, fire:true, ice:true, water:true, paint:true, wind:true, feather:true, heal:true, coin:true, reset:true }));
  const [muted, setMuted] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [legendUsed, setLegendUsed] = useState(false);
  const [uniqueStreak, setUniqueStreak] = useState(0);
  const lastToolRef = useRef(null);
  const [dailyClaimed, setDailyClaimed] = useState(false);

  const save = () => localStorage.setItem(LS_KEY, JSON.stringify({ hp,maxHp,coins,hits,comboBest,cooldowns,status,statusSeen,achUnlocked,bossKills,owned,muted,legendUsed,uniqueStreak, lastDaily: dailyClaimed? new Date().toDateString(): (loadCache.lastDaily||null) }));
  const loadCache = useRef({}).current;
  const load = () => {
    try { const raw = localStorage.getItem(LS_KEY); if(raw){ const d=JSON.parse(raw); Object.assign(loadCache,d);
      setHp(d.hp ?? 100); setMaxHp(d.maxHp ?? 100); setCoins(d.coins ?? 0); setHits(d.hits ?? 0);
      setComboBest(d.comboBest ?? 0); setCooldowns(d.cooldowns ?? {}); setStatus(d.status ?? {});
      setStatusSeen(d.statusSeen ?? statusSeen); setAchUnlocked(d.achUnlocked ?? {}); setBossKills(d.bossKills ?? 0);
      setOwned(d.owned ?? owned); setMuted(!!d.muted); setLegendUsed(!!d.legendUsed); setUniqueStreak(d.uniqueStreak ?? 0);
      const lastDailyStr = d.lastDaily; setDailyClaimed(lastDailyStr === new Date().toDateString());
    }} catch {}
  };
  useEffect(()=>{ load(); },[]);
  useEffect(()=>{ const id=setTimeout(save,250); return ()=>clearTimeout(id); },[hp,maxHp,coins,hits,comboBest,cooldowns,status,statusSeen,achUnlocked,bossKills,owned,muted,legendUsed,uniqueStreak,dailyClaimed]);

  const isFrozen = (status.freeze ?? 0) > 0;
  const isBurning = (status.burn ?? 0) > 0;
  const isShocked = (status.shock ?? 0) > 0;
  const isWet = (status.wet ?? 0) > 0;
  const isPainted = (status.paint ?? 0) > 0;
  const isSlimed = (status.slime ?? 0) > 0;
  const hasShield = (status.shield ?? 0) > 0;
  const isGhost = (status.ghost ?? 0) > 0;

  // timers
  useEffect(()=>{ const id=setInterval(()=> setStatus(prev=>{ const n={...prev}; for(const k in n) n[k]=Math.max(0,n[k]-1); return n; }), 250); return ()=>clearInterval(id); },[]);
  useEffect(()=>{ const id=setInterval(()=>{ let dot=0; if(isBurning) dot+=1; if(isShocked) dot+=0.5; if(isSlimed) dot+=0.2; if(dot>0) applyDamage(dot,{label:"DoT"}); }, 750); return ()=>clearInterval(id); },[isBurning,isShocked,isSlimed]);
  useEffect(()=>{ const id=setInterval(()=> setFloating((f)=> f.slice(1)), 400); return ()=>clearInterval(id); },[]);
  useEffect(()=>{ const id=setInterval(()=> setCooldowns((cd)=>({...cd})), 250); return ()=>clearInterval(id); },[]);

  // ачивки + квесты
  useEffect(()=>{
    const state = { hits, combo, comboBest, statusSeen, bossKills, legendUsed, uniqueStreak };
    for(const a of ACHIEVEMENTS){ if(!achUnlocked[a.id] && a.cond(state)){ setAchUnlocked(p=>({...p,[a.id]:true})); setCoins(c=>c+a.reward); toast(`Ачивка: ${a.title} +${a.reward}💰`); if(!muted){ beep({freq:900,type:'triangle'}); vibrate(30);} } }
  },[hits,combo,comboBest,statusSeen,bossKills,legendUsed,uniqueStreak,achUnlocked,muted]);

  // ежедневный бонус
  useEffect(()=>{
    if(!loadCache.lastDaily || loadCache.lastDaily !== new Date().toDateString()){
      setDailyClaimed(false);
    }
  },[]);
  function claimDaily(){ if(dailyClaimed) return; const reward = 50 + irand(0,50); setCoins(c=>c+reward); setDailyClaimed(true); toast(`Ежедневный бонус +${reward}💰`); if(!muted){ beep({freq:660}); beep({freq:880}); } }

  const toast = (t) => { setMessage(t); setTimeout(()=>setMessage(""), 2000); };

  function startCd(id, ms=350){ setCooldowns((cd)=> ({...cd,[id]:Date.now()+ms})); }
  const onCd = (id) => (cooldowns[id] ?? 0) > Date.now();

  function applyDamage(amount, opts={}){
    if (hasShield && amount > 0) { toast("Щит поглотил урон!"); return; }
    if (isGhost && amount > 0) amount *= 0.5;
    const crit = chance(0.05) ? 2 : 1;
    let dmg = Math.round(amount * crit);
    if (dmg !== 0) setHits(h=>h+1);
    if (dmg > 0) { setCombo(c=>{ const nc=c+1; setComboBest(b=>Math.max(b,nc)); return nc; }); setCoins(c=> c + Math.max(1, Math.round(dmg/2)) ); if(!muted){ beep({freq: 240+Math.min(800,dmg*30), type:'square'}); vibrate(10); } }
    else setCombo(0);

    if (dmg < 0) { setHp(h=>clamp(h - dmg, 0, maxHp)); float(dmg, "heal"); if(!muted) beep({freq:520,type:'sine'}); }
    else if (dmg > 0) { setHp(h=>clamp(h - dmg, 0, maxHp)); float(-dmg, crit>1?"crit":"dmg"); }
  }

  function float(value, kind="dmg"){ setFloating(arr=>[ ...arr, { id: Math.random().toString(36).slice(2), value, kind, x: rand(30,70), y: rand(10,30) } ]); }

  function spawnParticles(chars=["✨"]){ for(let i=0;i<12;i++){ setFloating(arr=>[ ...arr, { id: Math.random().toString(36).slice(2), value: chars[Math.floor(rand(0,chars.length))], kind: "part", x: rand(20,80), y: rand(20,50) } ]); } }

  function useTool(tool){
    if(!owned[tool.id]){ toast("Сначала купи в магазине"); if(!muted) beep({freq:180}); return; }
    if (onCd(tool.id)) return;
    startCd(tool.id, tool.cooldown ?? 300);

    // уникальная серия разных инструментов
    const lastId = lastToolRef.current; lastToolRef.current = tool.id; setUniqueStreak((s)=> (lastId && lastId!==tool.id) ? s+1 : 1);

    // base damage + модификаторы
    const base = rand(tool.dmg[0], tool.dmg[1]);
    let amount = base;
    if (isWet && tool.id === "zap") amount *= 1.5;
    if (isFrozen && tool.id === "hammer") amount *= 1.4;
    if (tool.id === "feather") amount = chance(0.1) ? 5 : 1;
    if (tool.id === "dice") amount = irand(0,30);

    applyDamage(amount, { label: tool.name });

    // статусы/эффекты
    if (tool.status) { setStatus((s)=> ({...s,[tool.status]:(s[tool.status]??0)+8})); setStatusSeen((seen)=>({...seen,[tool.status]:true})); }
    if (tool.id === "shield") setStatus((s)=> ({...s, shield: 8}));
    if (tool.id === "heal") { if (coins >= 20) { setCoins(c=>c-20); applyDamage(rand(-15,-10)); } else toast("Нужно 20 монет"); }
    if (tool.id === "coin") { setCoins(c=>c+10); float("+10","coin"); }
    if (tool.id === "gift") { const prizes=[()=>setCoins(c=>c+25),()=>applyDamage(-20),()=>setStatus(s=>({...s, shield:10}))]; prizes[Math.floor(rand(0,prizes.length))](); toast("Сюрприз!"); }
    if (tool.id === "starfall") { spawnParticles(["✨","⭐","🌟","💥","🎊"]); setLegendUsed(true); }
    if (tool.particles) spawnParticles(tool.particles);

    setLabubaTilt((t)=> clamp(t + (tool.knock ?? 0)/200, -0.25, 0.25)); setTimeout(()=> setLabubaTilt(0), 250);
  }

  useEffect(()=>{ if(hp<=0){ setBossKills(k=>k+1); const reward = 50 + Math.round(maxHp/5); setCoins(c=>c+reward); toast(`Раунд пройден! +${reward}💰`); const nxt = Math.round(maxHp*1.25 + 25); setMaxHp(nxt); setHp(nxt); setStatus({}); setCombo(0); confettiBurst(); if(!muted){ beep({freq:660}); beep({freq:990,type:'triangle'}); vibrate(60);} } },[hp,muted]);

  function confettiBurst(){ spawnParticles(["✨","⭐","💥","🎉","🎊"]); }

  const hpPct = Math.round((hp/maxHp)*100);
  const cdLeft = (id) => Math.max(0, (cooldowns[id] ?? 0) - Date.now());

  const tools = useMemo(()=> TOOLS_BASE,[]);
  const toolButtons = useMemo(()=> tools.map(t=>{
    const disabled = onCd(t.id); const locked = !owned[t.id];
    return (
      <button key={t.id} onClick={()=>useTool(t)} disabled={disabled}
        title={`${t.name} — ${t.desc ?? ''}`}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm shadow-sm transition active:scale-95 disabled:opacity-40 ${disabled? 'cursor-not-allowed' : 'hover:shadow'} ${locked? 'opacity-60' : ''} bg-white/70 backdrop-blur`}> 
        <span className="w-4 h-4">{t.icon}</span>
        <span>{t.name}</span>
        {t.rarity && (
          <span className={`text-[10px] px-1 rounded ${t.rarity==='legend'?'bg-purple-100': t.rarity==='epic'?'bg-pink-100':'bg-zinc-100'}`}>
            {t.rarity}
          </span>
        )}
        {disabled && <span className="text-[10px] opacity-70">{Math.ceil(cdLeft(t.id)/100)/10}s</span>}
      </button>
    );
  }),[cooldowns,owned]);

  function PlushLabuba(){
    const scale = isFrozen ? 0.95 : isGhost ? 0.9 : 1;
    const tint = isPainted ? "hue-rotate-90" : isBurning ? "[filter:brightness(1.1)_saturate(1.2)]" : isSlimed ? "[filter:hue-rotate(250deg)]" : "";
    const shake = isShocked ? { rotate: [0, -2, 2, -2, 2, 0], transition: { repeat: Infinity, duration: 0.4 } } : {};
    return (
      <motion.div className={`relative select-none`} animate={{ rotate: labubaTilt*10 }} transition={{ type:"spring", stiffness:200, damping:10 }}>
        <motion.div style={{ scale }} animate={shake} className={`transition ${tint}`}>
          <svg width="220" height="220" viewBox="0 0 220 220" className="drop-shadow-2xl">
            <defs>
              <radialGradient id="fur" cx="50%" cy="40%" r="60%">
                <stop offset="0%" stopColor="#ffe9e9"/>
                <stop offset="100%" stopColor="#ffb0b0"/>
              </radialGradient>
            </defs>
            <ellipse cx="110" cy="120" rx="70" ry="80" fill="url(#fur)" stroke="#c76" strokeWidth="3" />
            <path d="M55 40 C50 5, 85 5, 80 40" fill="#ffc4c4" stroke="#c76" strokeWidth="3"/>
            <path d="M160 40 C155 5, 190 5, 185 40" fill="#ffc4c4" stroke="#c76" strokeWidth="3"/>
            <circle cx="85" cy="110" r="10" fill="#222"/>
            <circle cx="135" cy="110" r="10" fill="#222"/>
            <path d="M90 145 Q110 160 130 145" stroke="#222" strokeWidth="4" fill="none"/>
            <circle cx="70" cy="130" r="6" fill="#ff9aa2"/>
            <circle cx="150" cy="130" r="6" fill="#ff9aa2"/>
            {isBurning && <text x="100" y="30" fontSize="24">🔥</text>}
            {isFrozen && <text x="95" y="30" fontSize="24">❄️</text>}
            {isPainted && <text x="100" y="30" fontSize="24">🎨</text>}
            {isSlimed && <text x="100" y="30" fontSize="24">🧪</text>}
            {isWet && <text x="110" y="30" fontSize="24">💧</text>}
            {hasShield && <text x="110" y="30" fontSize="24">🛡️</text>}
            {isGhost && <text x="110" y="30" fontSize="24">👻</text>}
          </svg>
        </motion.div>
      </motion.div>
    );
  }

  // Магазин
  const shopList = useMemo(()=> tools.filter(t=> t.unlockAt), [tools]);
  function buyTool(t){ if(owned[t.id]) return; const price = t.unlockAt ?? 50; if(coins>=price){ setCoins(c=>c-price); setOwned(o=>({...o,[t.id]:true})); toast(`Открыт: ${t.name}`); if(!muted){ beep({freq:520}); beep({freq:780}); } } else toast("Не хватает монет"); }

  // Настройки
  function toggleMute(){ setMuted(m=>!m); if(!muted) beep({freq:180}); }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-amber-50 to-sky-50 text-zinc-900 p-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4">
        {/* Left */}
        <div className="rounded-2xl bg-white/70 backdrop-blur p-4 shadow-lg border">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-bold">Лабуба: мультяшная разрушалка</h1>
            <div className="flex items-center gap-2">
              <button onClick={()=>setShowShop(true)} className="px-3 py-2 rounded-lg bg-white/80 border shadow-sm hover:bg-white flex items-center gap-2">🏪 Магазин</button>
              <button onClick={()=>setShowSettings(true)} className="px-3 py-2 rounded-lg bg-white/80 border shadow-sm hover:bg-white flex items-center gap-2">⚙️ Настройки</button>
            </div>
          </div>

          {/* HP */}
          <div className="mt-3 bg-zinc-200 rounded-full overflow-hidden">
            <div className="h-3 bg-gradient-to-r from-emerald-400 to-red-400" style={{ width: `${hpPct}%` }} />
          </div>
          <div className="flex items-center justify-between mt-1 text-sm">
            <div>HP: {hp}/{maxHp} ({hpPct}%)</div>
            <div>Комбо: {combo} (лучшее: {comboBest})</div>
          </div>

          {/* Stage */}
          <div className="relative mt-4 h-[360px] rounded-xl bg-gradient-to-b from-white to-zinc-100 border overflow-hidden flex items-center justify-center">
            <PlushLabuba />
            <div className="absolute inset-0 pointer-events-none">
              <AnimatePresence>
                {floating.map((f) => (
                  <motion.div key={f.id} initial={{ opacity: 0, y: 0 }} animate={{ opacity: 1, y: -40 }} exit={{ opacity: 0, y: -60 }} transition={{ duration: 0.6 }} className={`absolute text-sm ${f.kind==='crit'?'text-red-600 font-bold text-xl': f.kind==='heal'?'text-emerald-600':'text-zinc-700'}`} style={{ left: `${f.x}%`, top: `${f.y}%` }}>
                    {typeof f.value === 'number' ? (f.value>0?`+${Math.abs(f.value)}`:`-${Math.abs(f.value)}`) : f.value}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Messages & controls */}
          <AnimatePresence>
            {message && (
              <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}} className="mt-3 text-sm px-3 py-2 bg-amber-100 border border-amber-200 rounded-lg">{message}</motion.div>
            )}
          </AnimatePresence>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="px-3 py-2 rounded-lg bg-white/80 border shadow-sm">Монеты: <b>💰 {fmt(coins)}</b></div>
            <button onClick={()=>{ localStorage.removeItem(LS_KEY); window.location.reload(); }} className="px-3 py-2 rounded-lg bg-white/80 border shadow-sm hover:bg-white">Сбросить прогресс</button>
            <button onClick={()=>{ confettiBurst(); toast('Праздничная вспышка!') }} className="px-3 py-2 rounded-lg bg-white/80 border shadow-sm hover:bg-white">🎉 Конфетти</button>
            <button onClick={claimDaily} disabled={dailyClaimed} className="px-3 py-2 rounded-lg bg-emerald-50 border shadow_sm hover:bg-white disabled:opacity-50">Ежедневный бонус</button>
          </div>
        </div>

        {/* Right */}
        <div className="rounded-2xl bg-white/70 backdrop-blur p-4 shadow-lg border flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">🛠️ Инструменты</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[360px] overflow-auto pr-1">
              {toolButtons}
            </div>
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-2 flex items_center gap-2">🏆 Награды и Квесты</h2>
            <div className="space-y-2 max-h-[240px] overflow-auto pr-1">
              {ACHIEVEMENTS.map(a=>{ const got = !!achUnlocked[a.id]; return (
                <div key={a.id} className={`flex items-center justify-between p-2 rounded-xl border ${got? 'bg-emerald-50 border-emerald-200':'bg-white border-zinc-200'}`}>
                  <div className="flex items-center gap-2"><span>{a.icon}</span><div className="text-sm">{a.title}</div></div>
                  <div className={`text-xs ${got? 'text-emerald-700':'text-zinc-500'}`}>{got? 'получено' : 'скрыто'}</div>
                </div> ); })}
              {QUESTS.map(q=>{ const done = q.cond({comboBest, statusSeen, uniqueStreak}); return (
                <div key={q.id} className={`flex items-center justify-between p-2 rounded-xl border ${done? 'bg-sky-50 border-sky-200':'bg-white border-zinc-200'}`}>
                  <div className="text-sm">{q.text}</div>
                  <button onClick={()=>{ if(done){ setCoins(c=>c+q.reward); toast(`Квест: +${q.reward}💰`);} }} className="text-xs px-2 py-1 rounded border hover:bg-white" disabled={!done}>{done? 'Забрать' : 'В процессе'}</button>
                </div> ); })}
            </div>
          </div>
        </div>
      </div>

      {/* Магазин */}
      <AnimatePresence>
        {showShop && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/40 backdrop-blur flex items-center justify-center p-4">
            <div className="max-w-lg w-full rounded-2xl bg-white p-4 border shadow-xl">
              <div className="flex items-center justify-between mb-2"><div className="font-semibold flex items-center gap-2">🏪 Магазин инструментов</div><button onClick={()=>setShowShop(false)} className="text-sm px-2 py-1 border rounded">Закрыть</button></div>
              <div className="grid grid-cols-1 gap-2 max-h-[60vh] overflow-auto pr-1">
                {shopList.map(t=>{ const price = t.unlockAt ?? 50; const ownedFlag = !!owned[t.id]; return (
                  <div key={t.id} className="flex items-center justify-between p-2 rounded-xl border bg-white/80">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{t.icon}</span>
                      <div>
                        <div className="text-sm font-medium">{t.name} <span className="text-[10px] px-1 rounded bg-zinc-100 ml-1">{t.rarity}</span></div>
                        <div className="text-xs opacity-70">{t.desc}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm">{ownedFlag? 'Открыт' : `Цена: ${price}`}</div>
                      {!ownedFlag && <button onClick={()=>buyTool(t)} className="px-2 py-1 rounded border hover:bg-white">Купить</button>}
                    </div>
                  </div>
                ); })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Настройки */}
      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/30 backdrop-blur flex items-center justify-center p-4">
            <div className="max-w-md w-full rounded-2xl bg-white p-4 border shadow-xl">
              <div className="flex items-center justify-between mb-2"><div className="font-semibold flex items-center gap-2">⚙️ Настройки</div><button onClick={()=>setShowSettings(false)} className="text-sm px-2 py-1 border rounded">Закрыть</button></div>
              <div className="space-y-3">
                <button onClick={toggleMute} className="px-3 py-2 rounded-lg bg-white/80 border shadow-sm hover:bg-white flex items-center gap-2">{muted? '🔇 Звук выключен' : '🔊 Звук включен'}</button>
                <div className="text-xs opacity-70">Включите звук в системе/браузере для эффектов. На телефоне доступна лёгкая вибрация.</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-6xl mx-auto mt-6 text-xs opacity-70">
        <div>Все эффекты — мультяшные и комичные. Персонаж — вымышленный плюшевый зверёк «Лабуба».</div>
        <div className="mt-1">Добавляйте инструменты в TOOLS_BASE, ачивки — в ACHIEVEMENTS, квесты — в QUESTS.</div>
      </div>
    </div>
  );
}
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * ЛАБУБА — весёлая игра-разрушалка (мультяшно, без жестокости)
 * v2 — Больше веселья: звуки, вибрация, магазин, редкости, ежедневный бонус,
 * мини-квесты, комбо-мультипликатор, всплывающие лут-боксы.
 *
 * УПРОЩЁННЫЕ ИКОНКИ: вместо библиотеки иконок используются эмодзи,
 * чтобы исключить ошибки сборки на Vercel.
 */

// --- Utils
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const rand = (a=0, b=1) => a + Math.random()*(b-a);
const irand = (a, b) => Math.floor(rand(a, b+1));
const chance = (p) => Math.random() < p;
const fmt = (n) => new Intl.NumberFormat().format(n);

// --- Audio (генерируем короткие SFX через WebAudio, без ассетов)
const audioCtx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext) ? new (window.AudioContext || window.webkitAudioContext)() : null;
function beep({ freq=440, dur=0.08, type="sine", gain=0.03 }={}){
  if(!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type; o.frequency.value = freq; g.gain.value = gain;
  o.connect(g); g.connect(audioCtx.destination);
  o.start();
  o.stop(audioCtx.currentTime + dur);
}
const vibrate = (ms=20) => navigator.vibrate?.(ms);

// --- Types
/** @typedef {{ id: string; name: string; icon: string; dmg: [number, number]; particles?: string[]; status?: "burn"|"freeze"|"shock"|"paint"|"slime"|"wind"|"wet"|"grow"|"shrink"|"ghost"; knock?: number; cooldown?: number; unlockAt?: number; comboBonus?: number; desc?: string; rarity?: 'common'|'rare'|'epic'|'legend'; }} Tool */

// --- Tool Catalog (эмодзи вместо импортов)
/** @type {Tool[]} */
const TOOLS_BASE = [
  { id: "hammer", name: "Молот", icon: "🔨", dmg: [8, 14], knock: 18, desc: "Классический удар.", rarity:'common' },
  { id: "saw", name: "Пила", icon: "🪚", dmg: [3, 6], knock: 4, status: "shock", comboBonus: 1, desc: "Ж-ж-ж-ж...", rarity:'common' },
  { id: "laser", name: "Лазер", icon: "🪄", dmg: [6, 10], particles: ["✦","✧","★"], status: "shock", desc: "Будущее здесь.", rarity:'rare', unlockAt: 60 },
  { id: "fire", name: "Огонь", icon: "🔥", dmg: [5, 8], particles: ["🔥"], status: "burn", desc: "Поджарим!", rarity:'common' },
  { id: "ice", name: "Лёд", icon: "❄️", dmg: [4, 7], particles: ["❄️"], status: "freeze", desc: "Заморозка.", rarity:'common' },
  { id: "water", name: "Вода", icon: "💧", dmg: [2, 5], particles: ["💧"], status: "wet", desc: "Мокро и смешно.", rarity:'common' },
  { id: "paint", name: "Краска", icon: "🎨", dmg: [2, 4], particles: ["🎨","🟡","🟣","🟢"], status: "paint", desc: "Артист!", rarity:'common' },
  { id: "wind", name: "Ветер", icon: "💨", dmg: [1, 3], knock: 30, status: "wind", desc: "Сдувает.", rarity:'common' },
  { id: "tnt", name: "Бум!", icon: "🧨", dmg: [10, 25], particles: ["💥","✨"], knock: 44, cooldown: 800, desc: "Конфетти-взрыв.", rarity:'epic', unlockAt: 120 },
  { id: "zap", name: "Молния", icon: "⚡", dmg: [6, 12], particles: ["⚡"], status: "shock", desc: "Энергия!", rarity:'rare', unlockAt: 80 },
  { id: "anvil", name: "Наковальня", icon: "⚒️", dmg: [9, 18], knock: 50, desc: "Тяжесть комедии.", rarity:'rare', unlockAt: 90 },
  { id: "feather", name: "Пёрышко", icon: "🪶", dmg: [1, 1], particles: ["🪶"], desc: "Щекотка.", rarity:'common' },
  { id: "sun", name: "Солнце", icon: "☀️", dmg: [3, 6], particles: ["☀️","✨"], desc: "Лучисто.", rarity:'common' },
  { id: "rocket", name: "Ракета", icon: "🚀", dmg: [8, 15], particles: ["🚀","✨"], knock: 36, cooldown: 600, desc: "Свист и бац!", rarity:'epic', unlockAt: 150 },
  { id: "drill", name: "Дрель", icon: "🛠️", dmg: [4, 7], particles: ["🌀"], status: "shock", desc: "Ж-ж-ж!", rarity:'common' },
  { id: "scissors", name: "Ножницы", icon: "✂️", dmg: [3, 6], desc: "Подравняем мех.", rarity:'common' },
  { id: "magnet", name: "Магнит", icon: "🧲", dmg: [2, 4], desc: "Притягательная беда.", rarity:'common' },
  { id: "slime", name: "Слизь", icon: "🧪", dmg: [2, 3], particles: ["🟩","🧪"], status: "slime", desc: "Липко.", rarity:'common' },
  { id: "flower", name: "Цветы", icon: "🌸", dmg: [1, 2], particles: ["🌸","🌼"], desc: "Чих!", rarity:'common' },
  { id: "storm", name: "Гроза", icon: "⛈️", dmg: [7, 12], particles: ["⛈️"], status: "shock", desc: "Громыхаем.", rarity:'rare', unlockAt: 70 },
  { id: "rain", name: "Ливень", icon: "🌧️", dmg: [2, 4], particles: ["🌧️"], status: "wet", desc: "Мокренько.", rarity:'common' },
  { id: "snow", name: "Снег", icon: "❄️", dmg: [2, 5], particles: ["❄️"], status: "freeze", desc: "Зима.", rarity:'common' },
  { id: "ghost", name: "Призрак", icon: "👻", dmg: [5, 9], status: "ghost", desc: "Бу!", rarity:'rare', unlockAt: 110 },
  { id: "shield", name: "Щит Лабубы", icon: "🛡️", dmg: [0, 0], desc: "Временная защита.", rarity:'rare', unlockAt: 50 },
  { id: "heal", name: "Супчик (+)", icon: "🍲", dmg: [-15, -10], desc: "Лечит за 20 монет.", rarity:'common' },
  { id: "coin", name: "Монеты", icon: "🪙", dmg: [0, 0], desc: "+10 монет.", rarity:'common' },
  { id: "gift", name: "Подарок", icon: "🎁", dmg: [0, 0], desc: "Сюрприз-бонус.", rarity:'epic', unlockAt: 140 },
  { id: "reset", name: "Сброс", icon: "🔄", dmg: [0, 0], desc: "Перезапуск боя.", rarity:'common' },
  { id: "starfall", name: "Звездопад", icon: "🌟", dmg: [14,22], particles:["✨","⭐","🌟"], knock:40, cooldown:900, desc:"Красивая буря частиц.", rarity:'legend', unlockAt: 220 },
  { id: "dice", name: "Куб удачи", icon: "🎲", dmg: [0,30], particles:["🎲","✨"], knock:20, cooldown:900, desc:"Может ничего, а может — вау!", rarity:'legend', unlockAt: 250 },
];

const ACHIEVEMENTS = [
  { id: "firstHit", title: "Первый шлеп", cond: (s) => s.hits >= 1, reward: 5, icon: "🏆" },
  { id: "tenHit", title: "Десяток!", cond: (s) => s.hits >= 10, reward: 20, icon: "🏆" },
  { id: "hundredHit", title: "Соточка", cond: (s) => s.hits >= 100, reward: 200, icon: "🏆" },
  { id: "combo25", title: "Комбо 25", cond: (s) => s.combo >= 25, reward: 30, icon: "🔁" },
  { id: "burn", title: "Поджарили", cond: (s) => s.statusSeen.burn, reward: 10, icon: "🔥" },
  { id: "freeze", title: "Остудили", cond: (s) => s.statusSeen.freeze, reward: 10, icon: "❄️" },
  { id: "shock", title: "Электрошок!", cond: (s) => s.statusSeen.shock, reward: 10, icon: "⚡" },
  { id: "paint", title: "Артист", cond: (s) => s.statusSeen.paint, reward: 10, icon: "🎨" },
  { id: "slime", title: "Липучка", cond: (s) => s.statusSeen.slime, reward: 10, icon: "🧪" },
  { id: "bossWin", title: "Босс повержен", cond: (s) => s.bossKills >= 1, reward: 100, icon: "💀" },
  { id: "legend", title: "Легенда!", cond: (s)=> s.legendUsed, reward: 150, icon: "🌟" },
];

const QUESTS = [
  { id:"q_combo10", text:"Сделай комбо 10", cond:(s)=> s.comboBest>=10, reward:20 },
  { id:"q_status3", text:"Наложи 3 разных статуса", cond:(s)=> Object.values(s.statusSeen).filter(Boolean).length>=3, reward:25 },
  { id:"q_fiveTools", text:"Используй 5 разных инструментов подряд", cond:(s)=> s.uniqueStreak>=5, reward:30 },
];

const LS_KEY = "labuba_save_v2";

export default function App(){
  const [hp, setHp] = useState(100);
  const [maxHp, setMaxHp] = useState(100);
  const [coins, setCoins] = useState(0);
  const [hits, setHits] = useState(0);
  const [combo, setCombo] = useState(0);
  const [comboBest, setComboBest] = useState(0);
  const [cooldowns, setCooldowns] = useState({});
  const [status, setStatus] = useState({});
  const [statusSeen, setStatusSeen] = useState({ burn:false, freeze:false, shock:false, paint:false, slime:false });
  const [floating, setFloating] = useState([]);
  const [achUnlocked, setAchUnlocked] = useState({});
  const [bossKills, setBossKills] = useState(0);
  const [labubaTilt, setLabubaTilt] = useState(0);
  const [message, setMessage] = useState("");
  const [owned, setOwned] = useState(/** @type {Record<string, boolean>} */({ hammer:true, saw:true, fire:true, ice:true, water:true, paint:true, wind:true, feather:true, heal:true, coin:true, reset:true }));
  const [muted, setMuted] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [legendUsed, setLegendUsed] = useState(false);
  const [uniqueStreak, setUniqueStreak] = useState(0);
  const lastToolRef = useRef(null);
  const [dailyClaimed, setDailyClaimed] = useState(false);

  const save = () => localStorage.setItem(LS_KEY, JSON.stringify({ hp,maxHp,coins,hits,comboBest,cooldowns,status,statusSeen,achUnlocked,bossKills,owned,muted,legendUsed,uniqueStreak, lastDaily: dailyClaimed? new Date().toDateString(): (loadCache.lastDaily||null) }));
  const loadCache = useRef({}).current;
  const load = () => {
    try { const raw = localStorage.getItem(LS_KEY); if(raw){ const d=JSON.parse(raw); Object.assign(loadCache,d);
      setHp(d.hp ?? 100); setMaxHp(d.maxHp ?? 100); setCoins(d.coins ?? 0); setHits(d.hits ?? 0);
      setComboBest(d.comboBest ?? 0); setCooldowns(d.cooldowns ?? {}); setStatus(d.status ?? {});
      setStatusSeen(d.statusSeen ?? statusSeen); setAchUnlocked(d.achUnlocked ?? {}); setBossKills(d.bossKills ?? 0);
      setOwned(d.owned ?? owned); setMuted(!!d.muted); setLegendUsed(!!d.legendUsed); setUniqueStreak(d.uniqueStreak ?? 0);
      const lastDailyStr = d.lastDaily; setDailyClaimed(lastDailyStr === new Date().toDateString());
    }} catch {}
  };
  useEffect(()=>{ load(); },[]);
  useEffect(()=>{ const id=setTimeout(save,250); return ()=>clearTimeout(id); },[hp,maxHp,coins,hits,comboBest,cooldowns,status,statusSeen,achUnlocked,bossKills,owned,muted,legendUsed,uniqueStreak,dailyClaimed]);

  const isFrozen = (status.freeze ?? 0) > 0;
  const isBurning = (status.burn ?? 0) > 0;
  const isShocked = (status.shock ?? 0) > 0;
  const isWet = (status.wet ?? 0) > 0;
  const isPainted = (status.paint ?? 0) > 0;
  const isSlimed = (status.slime ?? 0) > 0;
  const hasShield = (status.shield ?? 0) > 0;
  const isGhost = (status.ghost ?? 0) > 0;

  // timers
  useEffect(()=>{ const id=setInterval(()=> setStatus(prev=>{ const n={...prev}; for(const k in n) n[k]=Math.max(0,n[k]-1); return n; }), 250); return ()=>clearInterval(id); },[]);
  useEffect(()=>{ const id=setInterval(()=>{ let dot=0; if(isBurning) dot+=1; if(isShocked) dot+=0.5; if(isSlimed) dot+=0.2; if(dot>0) applyDamage(dot,{label:"DoT"}); }, 750); return ()=>clearInterval(id); },[isBurning,isShocked,isSlimed]);
  useEffect(()=>{ const id=setInterval(()=> setFloating((f)=> f.slice(1)), 400); return ()=>clearInterval(id); },[]);
  useEffect(()=>{ const id=setInterval(()=> setCooldowns((cd)=>({...cd})), 250); return ()=>clearInterval(id); },[]);

  // ачивки + квесты
  useEffect(()=>{
    const state = { hits, combo, comboBest, statusSeen, bossKills, legendUsed, uniqueStreak };
    for(const a of ACHIEVEMENTS){ if(!achUnlocked[a.id] && a.cond(state)){ setAchUnlocked(p=>({...p,[a.id]:true})); setCoins(c=>c+a.reward); toast(`Ачивка: ${a.title} +${a.reward}💰`); if(!muted){ beep({freq:900,type:'triangle'}); vibrate(30);} } }
  },[hits,combo,comboBest,statusSeen,bossKills,legendUsed,uniqueStreak,achUnlocked,muted]);

  // ежедневный бонус
  useEffect(()=>{
    if(!loadCache.lastDaily || loadCache.lastDaily !== new Date().toDateString()){
      setDailyClaimed(false);
    }
  },[]);
  function claimDaily(){ if(dailyClaimed) return; const reward = 50 + irand(0,50); setCoins(c=>c+reward); setDailyClaimed(true); toast(`Ежедневный бонус +${reward}💰`); if(!muted){ beep({freq:660}); beep({freq:880}); } }

  const toast = (t) => { setMessage(t); setTimeout(()=>setMessage(""), 2000); };

  function startCd(id, ms=350){ setCooldowns((cd)=> ({...cd,[id]:Date.now()+ms})); }
  const onCd = (id) => (cooldowns[id] ?? 0) > Date.now();

  function applyDamage(amount, opts={}){
    if (hasShield && amount > 0) { toast("Щит поглотил урон!"); return; }
    if (isGhost && amount > 0) amount *= 0.5;
    const crit = chance(0.05) ? 2 : 1;
    let dmg = Math.round(amount * crit);
    if (dmg !== 0) setHits(h=>h+1);
    if (dmg > 0) { setCombo(c=>{ const nc=c+1; setComboBest(b=>Math.max(b,nc)); return nc; }); setCoins(c=> c + Math.max(1, Math.round(dmg/2)) ); if(!muted){ beep({freq: 240+Math.min(800,dmg*30), type:'square'}); vibrate(10); } }
    else setCombo(0);

    if (dmg < 0) { setHp(h=>clamp(h - dmg, 0, maxHp)); float(dmg, "heal"); if(!muted) beep({freq:520,type:'sine'}); }
    else if (dmg > 0) { setHp(h=>clamp(h - dmg, 0, maxHp)); float(-dmg, crit>1?"crit":"dmg"); }
  }

  function float(value, kind="dmg"){ setFloating(arr=>[ ...arr, { id: Math.random().toString(36).slice(2), value, kind, x: rand(30,70), y: rand(10,30) } ]); }

  function spawnParticles(chars=["✨"]){ for(let i=0;i<12;i++){ setFloating(arr=>[ ...arr, { id: Math.random().toString(36).slice(2), value: chars[Math.floor(rand(0,chars.length))], kind: "part", x: rand(20,80), y: rand(20,50) } ]); } }

  function useTool(tool){
    if(!owned[tool.id]){ toast("Сначала купи в магазине"); if(!muted) beep({freq:180}); return; }
    if (onCd(tool.id)) return;
    startCd(tool.id, tool.cooldown ?? 300);

    // уникальная серия разных инструментов
    const lastId = lastToolRef.current; lastToolRef.current = tool.id; setUniqueStreak((s)=> (lastId && lastId!==tool.id) ? s+1 : 1);

    // base damage + модификаторы
    const base = rand(tool.dmg[0], tool.dmg[1]);
    let amount = base;
    if (isWet && tool.id === "zap") amount *= 1.5;
    if (isFrozen && tool.id === "hammer") amount *= 1.4;
    if (tool.id === "feather") amount = chance(0.1) ? 5 : 1;
    if (tool.id === "dice") amount = irand(0,30);

    applyDamage(amount, { label: tool.name });

    // статусы/эффекты
    if (tool.status) { setStatus((s)=> ({...s,[tool.status]:(s[tool.status]??0)+8})); setStatusSeen((seen)=>({...seen,[tool.status]:true})); }
    if (tool.id === "shield") setStatus((s)=> ({...s, shield: 8}));
    if (tool.id === "heal") { if (coins >= 20) { setCoins(c=>c-20); applyDamage(rand(-15,-10)); } else toast("Нужно 20 монет"); }
    if (tool.id === "coin") { setCoins(c=>c+10); float("+10","coin"); }
    if (tool.id === "gift") { const prizes=[()=>setCoins(c=>c+25),()=>applyDamage(-20),()=>setStatus(s=>({...s, shield:10}))]; prizes[Math.floor(rand(0,prizes.length))](); toast("Сюрприз!"); }
    if (tool.id === "starfall") { spawnParticles(["✨","⭐","🌟","💥","🎊"]); setLegendUsed(true); }
    if (tool.particles) spawnParticles(tool.particles);

    setLabubaTilt((t)=> clamp(t + (tool.knock ?? 0)/200, -0.25, 0.25)); setTimeout(()=> setLabubaTilt(0), 250);
  }

  useEffect(()=>{ if(hp<=0){ setBossKills(k=>k+1); const reward = 50 + Math.round(maxHp/5); setCoins(c=>c+reward); toast(`Раунд пройден! +${reward}💰`); const nxt = Math.round(maxHp*1.25 + 25); setMaxHp(nxt); setHp(nxt); setStatus({}); setCombo(0); confettiBurst(); if(!muted){ beep({freq:660}); beep({freq:990,type:'triangle'}); vibrate(60);} } },[hp,muted]);

  function confettiBurst(){ spawnParticles(["✨","⭐","💥","🎉","🎊"]); }

  const hpPct = Math.round((hp/maxHp)*100);
  const cdLeft = (id) => Math.max(0, (cooldowns[id] ?? 0) - Date.now());

  const tools = useMemo(()=> TOOLS_BASE,[]);
  const toolButtons = useMemo(()=> tools.map(t=>{
    const disabled = onCd(t.id); const locked = !owned[t.id];
    return (
      <button key={t.id} onClick={()=>useTool(t)} disabled={disabled}
        title={`${t.name} — ${t.desc ?? ''}`}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm shadow-sm transition active:scale-95 disabled:opacity-40 ${disabled? 'cursor-not-allowed' : 'hover:shadow'} ${locked? 'opacity-60' : ''} bg-white/70 backdrop-blur`}> 
        <span className="w-4 h-4">{t.icon}</span>
        <span>{t.name}</span>
        {t.rarity && (
          <span className={`text-[10px] px-1 rounded ${t.rarity==='legend'?'bg-purple-100': t.rarity==='epic'?'bg-pink-100':'bg-zinc-100'}`}>
            {t.rarity}
          </span>
        )}
        {disabled && <span className="text-[10px] opacity-70">{Math.ceil(cdLeft(t.id)/100)/10}s</span>}
      </button>
    );
  }),[cooldowns,owned]);

  function PlushLabuba(){
    const scale = isFrozen ? 0.95 : isGhost ? 0.9 : 1;
    const tint = isPainted ? "hue-rotate-90" : isBurning ? "[filter:brightness(1.1)_saturate(1.2)]" : isSlimed ? "[filter:hue-rotate(250deg)]" : "";
    const shake = isShocked ? { rotate: [0, -2, 2, -2, 2, 0], transition: { repeat: Infinity, duration: 0.4 } } : {};
    return (
      <motion.div className={`relative select-none`} animate={{ rotate: labubaTilt*10 }} transition={{ type:"spring", stiffness:200, damping:10 }}>
        <motion.div style={{ scale }} animate={shake} className={`transition ${tint}`}>
          <svg width="220" height="220" viewBox="0 0 220 220" className="drop-shadow-2xl">
            <defs>
              <radialGradient id="fur" cx="50%" cy="40%" r="60%">
                <stop offset="0%" stopColor="#ffe9e9"/>
                <stop offset="100%" stopColor="#ffb0b0"/>
              </radialGradient>
            </defs>
            <ellipse cx="110" cy="120" rx="70" ry="80" fill="url(#fur)" stroke="#c76" strokeWidth="3" />
            <path d="M55 40 C50 5, 85 5, 80 40" fill="#ffc4c4" stroke="#c76" strokeWidth="3"/>
            <path d="M160 40 C155 5, 190 5, 185 40" fill="#ffc4c4" stroke="#c76" strokeWidth="3"/>
            <circle cx="85" cy="110" r="10" fill="#222"/>
            <circle cx="135" cy="110" r="10" fill="#222"/>
            <path d="M90 145 Q110 160 130 145" stroke="#222" strokeWidth="4" fill="none"/>
            <circle cx="70" cy="130" r="6" fill="#ff9aa2"/>
            <circle cx="150" cy="130" r="6" fill="#ff9aa2"/>
            {isBurning && <text x="100" y="30" fontSize="24">🔥</text>}
            {isFrozen && <text x="95" y="30" fontSize="24">❄️</text>}
            {isPainted && <text x="100" y="30" fontSize="24">🎨</text>}
            {isSlimed && <text x="100" y="30" fontSize="24">🧪</text>}
            {isWet && <text x="110" y="30" fontSize="24">💧</text>}
            {hasShield && <text x="110" y="30" fontSize="24">🛡️</text>}
            {isGhost && <text x="110" y="30" fontSize="24">👻</text>}
          </svg>
        </motion.div>
      </motion.div>
    );
  }

  // Магазин
  const shopList = useMemo(()=> tools.filter(t=> t.unlockAt), [tools]);
  function buyTool(t){ if(owned[t.id]) return; const price = t.unlockAt ?? 50; if(coins>=price){ setCoins(c=>c-price); setOwned(o=>({...o,[t.id]:true})); toast(`Открыт: ${t.name}`); if(!muted){ beep({freq:520}); beep({freq:780}); } } else toast("Не хватает монет"); }

  // Настройки
  function toggleMute(){ setMuted(m=>!m); if(!muted) beep({freq:180}); }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-amber-50 to-sky-50 text-zinc-900 p-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4">
        {/* Left */}
        <div className="rounded-2xl bg-white/70 backdrop-blur p-4 shadow-lg border">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-bold">Лабуба: мультяшная разрушалка</h1>
            <div className="flex items-center gap-2">
              <button onClick={()=>setShowShop(true)} className="px-3 py-2 rounded-lg bg-white/80 border shadow-sm hover:bg-white flex items-center gap-2">🏪 Магазин</button>
              <button onClick={()=>setShowSettings(true)} className="px-3 py-2 rounded-lg bg-white/80 border shadow-sm hover:bg-white flex items-center gap-2">⚙️ Настройки</button>
            </div>
          </div>

          {/* HP */}
          <div className="mt-3 bg-zinc-200 rounded-full overflow-hidden">
            <div className="h-3 bg-gradient-to-r from-emerald-400 to-red-400" style={{ width: `${hpPct}%` }} />
          </div>
          <div className="flex items-center justify-between mt-1 text-sm">
            <div>HP: {hp}/{maxHp} ({hpPct}%)</div>
            <div>Комбо: {combo} (лучшее: {comboBest})</div>
          </div>

          {/* Stage */}
          <div className="relative mt-4 h-[360px] rounded-xl bg-gradient-to-b from-white to-zinc-100 border overflow-hidden flex items-center justify-center">
            <PlushLabuba />
            <div className="absolute inset-0 pointer-events-none">
              <AnimatePresence>
                {floating.map((f) => (
                  <motion.div key={f.id} initial={{ opacity: 0, y: 0 }} animate={{ opacity: 1, y: -40 }} exit={{ opacity: 0, y: -60 }} transition={{ duration: 0.6 }} className={`absolute text-sm ${f.kind==='crit'?'text-red-600 font-bold text-xl': f.kind==='heal'?'text-emerald-600':'text-zinc-700'}`} style={{ left: `${f.x}%`, top: `${f.y}%` }}>
                    {typeof f.value === 'number' ? (f.value>0?`+${Math.abs(f.value)}`:`-${Math.abs(f.value)}`) : f.value}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Messages & controls */}
          <AnimatePresence>
            {message && (
              <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}} className="mt-3 text-sm px-3 py-2 bg-amber-100 border border-amber-200 rounded-lg">{message}</motion.div>
            )}
          </AnimatePresence>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="px-3 py-2 rounded-lg bg-white/80 border shadow-sm">Монеты: <b>💰 {fmt(coins)}</b></div>
            <button onClick={()=>{ localStorage.removeItem(LS_KEY); window.location.reload(); }} className="px-3 py-2 rounded-lg bg-white/80 border shadow-sm hover:bg-white">Сбросить прогресс</button>
            <button onClick={()=>{ confettiBurst(); toast('Праздничная вспышка!') }} className="px-3 py-2 rounded-lg bg-white/80 border shadow-sm hover:bg-white">🎉 Конфетти</button>
            <button onClick={claimDaily} disabled={dailyClaimed} className="px-3 py-2 rounded-lg bg-emerald-50 border shadow_sm hover:bg-white disabled:opacity-50">Ежедневный бонус</button>
          </div>
        </div>

        {/* Right */}
        <div className="rounded-2xl bg-white/70 backdrop-blur p-4 shadow-lg border flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">🛠️ Инструменты</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[360px] overflow-auto pr-1">
              {toolButtons}
            </div>
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-2 flex items_center gap-2">🏆 Награды и Квесты</h2>
            <div className="space-y-2 max-h-[240px] overflow-auto pr-1">
              {ACHIEVEMENTS.map(a=>{ const got = !!achUnlocked[a.id]; return (
                <div key={a.id} className={`flex items-center justify-between p-2 rounded-xl border ${got? 'bg-emerald-50 border-emerald-200':'bg-white border-zinc-200'}`}>
                  <div className="flex items-center gap-2"><span>{a.icon}</span><div className="text-sm">{a.title}</div></div>
                  <div className={`text-xs ${got? 'text-emerald-700':'text-zinc-500'}`}>{got? 'получено' : 'скрыто'}</div>
                </div> ); })}
              {QUESTS.map(q=>{ const done = q.cond({comboBest, statusSeen, uniqueStreak}); return (
                <div key={q.id} className={`flex items-center justify-between p-2 rounded-xl border ${done? 'bg-sky-50 border-sky-200':'bg-white border-zinc-200'}`}>
                  <div className="text-sm">{q.text}</div>
                  <button onClick={()=>{ if(done){ setCoins(c=>c+q.reward); toast(`Квест: +${q.reward}💰`);} }} className="text-xs px-2 py-1 rounded border hover:bg-white" disabled={!done}>{done? 'Забрать' : 'В процессе'}</button>
                </div> ); })}
            </div>
          </div>
        </div>
      </div>

      {/* Магазин */}
      <AnimatePresence>
        {showShop && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/40 backdrop-blur flex items-center justify-center p-4">
            <div className="max-w-lg w-full rounded-2xl bg-white p-4 border shadow-xl">
              <div className="flex items-center justify-between mb-2"><div className="font-semibold flex items-center gap-2">🏪 Магазин инструментов</div><button onClick={()=>setShowShop(false)} className="text-sm px-2 py-1 border rounded">Закрыть</button></div>
              <div className="grid grid-cols-1 gap-2 max-h-[60vh] overflow-auto pr-1">
                {shopList.map(t=>{ const price = t.unlockAt ?? 50; const ownedFlag = !!owned[t.id]; return (
                  <div key={t.id} className="flex items-center justify-between p-2 rounded-xl border bg-white/80">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{t.icon}</span>
                      <div>
                        <div className="text-sm font-medium">{t.name} <span className="text-[10px] px-1 rounded bg-zinc-100 ml-1">{t.rarity}</span></div>
                        <div className="text-xs opacity-70">{t.desc}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm">{ownedFlag? 'Открыт' : `Цена: ${price}`}</div>
                      {!ownedFlag && <button onClick={()=>buyTool(t)} className="px-2 py-1 rounded border hover:bg-white">Купить</button>}
                    </div>
                  </div>
                ); })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Настройки */}
      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/30 backdrop-blur flex items-center justify-center p-4">
            <div className="max-w-md w-full rounded-2xl bg-white p-4 border shadow-xl">
              <div className="flex items-center justify-between mb-2"><div className="font-semibold flex items-center gap-2">⚙️ Настройки</div><button onClick={()=>setShowSettings(false)} className="text-sm px-2 py-1 border rounded">Закрыть</button></div>
              <div className="space-y-3">
                <button onClick={toggleMute} className="px-3 py-2 rounded-lg bg-white/80 border shadow-sm hover:bg-white flex items-center gap-2">{muted? '🔇 Звук выключен' : '🔊 Звук включен'}</button>
                <div className="text-xs opacity-70">Включите звук в системе/браузере для эффектов. На телефоне доступна лёгкая вибрация.</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-6xl mx-auto mt-6 text-xs opacity-70">
        <div>Все эффекты — мультяшные и комичные. Персонаж — вымышленный плюшевый зверёк «Лабуба».</div>
        <div className="mt-1">Добавляйте инструменты в TOOLS_BASE, ачивки — в ACHIEVEMENTS, квесты — в QUESTS.</div>
      </div>
    </div>
  );
}
