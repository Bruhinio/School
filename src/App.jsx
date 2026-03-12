import React, { useState, useEffect, useRef, useCallback } from "react";
// emailjs loaded dynamically to avoid crash if not installed
import { db, auth } from "./firebase";
import {
  collection, doc, addDoc, updateDoc, deleteDoc, setDoc,
  onSnapshot, query, orderBy, where, getDocs, serverTimestamp, writeBatch
} from "firebase/firestore";
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged
} from "firebase/auth";

// ─── SOUND SYSTEM ─────────────────────────────────────────────────────────────
const SFX = {
  _ctx: null,
  _get() { if (!this._ctx) try { this._ctx = new (window.AudioContext||window.webkitAudioContext)(); } catch{} return this._ctx; },
  play(type="click") {
    try {
      const ctx = this._get(); if (!ctx) return;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      const now = ctx.currentTime;
      if (type==="click") {
        o.frequency.setValueAtTime(520,now); o.frequency.exponentialRampToValueAtTime(320,now+0.06);
        g.gain.setValueAtTime(0.18,now); g.gain.exponentialRampToValueAtTime(0.001,now+0.1);
        o.start(now); o.stop(now+0.1);
      } else if (type==="login") {
        [523,659,784].forEach((f,i)=>{
          const o2=ctx.createOscillator(),g2=ctx.createGain();
          o2.connect(g2); g2.connect(ctx.destination);
          const t=now+i*0.12;
          o2.frequency.setValueAtTime(f,t); g2.gain.setValueAtTime(0.22,t);
          g2.gain.exponentialRampToValueAtTime(0.001,t+0.2); o2.start(t); o2.stop(t+0.22);
        });
      } else if (type==="alert") {
        [440,880,440].forEach((f,i)=>{
          const o2=ctx.createOscillator(),g2=ctx.createGain();
          o2.connect(g2); g2.connect(ctx.destination);
          const t=now+i*0.15;
          o2.frequency.setValueAtTime(f,t); g2.gain.setValueAtTime(0.25,t);
          g2.gain.exponentialRampToValueAtTime(0.001,t+0.18); o2.start(t); o2.stop(t+0.2);
        });
      } else if (type==="success") {
        [784,1047].forEach((f,i)=>{
          const o2=ctx.createOscillator(),g2=ctx.createGain();
          o2.connect(g2); g2.connect(ctx.destination);
          const t=now+i*0.1;
          o2.frequency.setValueAtTime(f,t); g2.gain.setValueAtTime(0.2,t);
          g2.gain.exponentialRampToValueAtTime(0.001,t+0.18); o2.start(t); o2.stop(t+0.2);
        });
      } else if (type==="notification") {
        [880,1109].forEach((f,i)=>{
          const o2=ctx.createOscillator(),g2=ctx.createGain();
          o2.connect(g2); g2.connect(ctx.destination);
          const t=now+i*0.08;
          o2.frequency.setValueAtTime(f,t); g2.gain.setValueAtTime(0.15,t);
          g2.gain.exponentialRampToValueAtTime(0.001,t+0.15); o2.start(t); o2.stop(t+0.18);
        });
      }
    } catch {}
  }
};
// Global click sound wrapper
const useSfxClick = () => { return () => SFX.play("click"); };

// ─── HOLIDAY THEMES ───────────────────────────────────────────────────────────
const HOLIDAY_THEMES = {
  default: { name:"Normal", emoji:"🏫", bg:"#F2F2F7", accent:"#007AFF", headerBg:"", headerText:"", decorations:[], css:"" },
  muertos: {
    name:"Día de Muertos", emoji:"💀",
    bg:"#1a0a2e", accent:"#FF9500",
    headerBg:"linear-gradient(135deg,#4a0e8f,#8b1a8b)",
    headerText:"#fff",
    decorations:["💀","🌺","🕯️","🦋","🌙"],
    css:`body{background:#1a0a2e!important;} .card-bg{background:#2a1050!important;border-color:#6b2fa0!important;} .txt-primary{color:#f0d080!important;} .txt-secondary{color:#c8a0e0!important;}`,
    gradient:"linear-gradient(135deg,#4a0e8f,#8b1a8b)",
    cardBg:"#2a1050", cardBorder:"#6b2fa0", textPrimary:"#f0d080", textSecondary:"#c8a0e0"
  },
  navidad: {
    name:"Navidad 🎄", emoji:"🎄",
    bg:"#0d1f0d", accent:"#34C759",
    headerBg:"linear-gradient(135deg,#1a4a1a,#8b1a1a)",
    headerText:"#fff",
    decorations:["⭐","🎄","🎁","❄️","🦌"],
    css:``,
    gradient:"linear-gradient(135deg,#1a4a1a,#8b1a1a)",
    cardBg:"#1a3020", cardBorder:"#2a6030", textPrimary:"#f0fff0", textSecondary:"#90c090"
  },
  independencia: {
    name:"Independencia 🇲🇽", emoji:"🇲🇽",
    bg:"#F2F2F7", accent:"#006847",
    headerBg:"linear-gradient(135deg,#006847,#ce1126)",
    headerText:"#fff",
    decorations:["🇲🇽","🦅","🌵","🎉","⭐"],
    css:``,
    gradient:"linear-gradient(135deg,#006847,#ce1126)",
    cardBg:"#fff", cardBorder:"#00684730", textPrimary:"#000", textSecondary:"#555"
  },
  amor: {
    name:"Día del Amor 💝", emoji:"💝",
    bg:"#fff0f3", accent:"#FF2D55",
    headerBg:"linear-gradient(135deg,#FF2D55,#AF52DE)",
    headerText:"#fff",
    decorations:["❤️","💝","🌹","🎀","✨"],
    css:``,
    gradient:"linear-gradient(135deg,#FF2D55,#AF52DE)",
    cardBg:"#fff5f8", cardBorder:"#ffb3c6", textPrimary:"#3d0020", textSecondary:"#8b4060"
  },
  halloween: {
    name:"Halloween 🎃", emoji:"🎃",
    bg:"#1a0d00", accent:"#FF9500",
    headerBg:"linear-gradient(135deg,#3d1a00,#1a0d1a)",
    headerText:"#ff9500",
    decorations:["🎃","🕷️","👻","🦇","🕸️"],
    css:``,
    gradient:"linear-gradient(135deg,#3d1a00,#6b2fa0)",
    cardBg:"#2a1500", cardBorder:"#6b3a00", textPrimary:"#ff9500", textSecondary:"#c87030"
  },
  primavera: {
    name:"Primavera 🌸", emoji:"🌸",
    bg:"#f0fff8", accent:"#34C759",
    headerBg:"linear-gradient(135deg,#34C759,#FF9500)",
    headerText:"#fff",
    decorations:["🌸","🌺","🦋","🌻","🐝"],
    css:``,
    gradient:"linear-gradient(135deg,#34C759,#FF2D55)",
    cardBg:"#f8fff8", cardBorder:"#a0e8b0", textPrimary:"#0a2a10", textSecondary:"#3a7040"
  },
};

// Global holiday theme state (singleton)
let _globalHolidayTheme = "default";
let _holidayThemeListeners = [];
const getHolidayTheme = () => HOLIDAY_THEMES[_globalHolidayTheme] || HOLIDAY_THEMES.default;
const setGlobalHolidayTheme = (key) => {
  _globalHolidayTheme = key;
  _holidayThemeListeners.forEach(fn => fn(key));
};
const useHolidayTheme = () => {
  const [theme, setTheme] = useState(_globalHolidayTheme);
  useEffect(() => {
    const fn = (k) => setTheme(k);
    _holidayThemeListeners.push(fn);
    return () => { _holidayThemeListeners = _holidayThemeListeners.filter(f=>f!==fn); };
  }, []);
  return HOLIDAY_THEMES[theme] || HOLIDAY_THEMES.default;
};

// ─── IN-APP NOTIFICATION SYSTEM ───────────────────────────────────────────────
let _notifListeners = [];
let _notifQueue = [];
const pushNotification = (msg) => {
  const id = Date.now();
  _notifQueue = [..._notifQueue, { id, ...msg }];
  _notifListeners.forEach(fn => fn([..._notifQueue]));
  SFX.play("notification");
  // Browser push notification
  if (Notification?.permission === "granted") {
    try { new Notification("Instituto Educativo", { body: msg.text, icon: "🏫" }); } catch {}
  }
  setTimeout(() => {
    _notifQueue = _notifQueue.filter(n => n.id !== id);
    _notifListeners.forEach(fn => fn([..._notifQueue]));
  }, 2500);
};
const useNotifications = () => {
  const [notifs, setNotifs] = useState([]);
  useEffect(() => {
    const fn = (q) => setNotifs([...q]);
    _notifListeners.push(fn);
    return () => { _notifListeners = _notifListeners.filter(f=>f!==fn); };
  }, []);
  return notifs;
};

// ─── iOS TOKENS ───────────────────────────────────────────────────────────────
const C = {
  blue:"#007AFF",green:"#34C759",red:"#FF3B30",orange:"#FF9500",
  yellow:"#FFCC00",purple:"#AF52DE",pink:"#FF2D55",teal:"#5AC8FA",
  indigo:"#5856D6",
  g1:"#8E8E93",g2:"#AEAEB2",g3:"#C7C7CC",g4:"#D1D1D6",g5:"#E5E5EA",g6:"#F2F2F7",
  bg:"#FFFFFF",bg2:"#F2F2F7",bg3:"#FFFFFF",
  sep:"rgba(60,60,67,0.12)",
  lbl:"#000000",lbl2:"rgba(60,60,67,0.6)",lbl3:"rgba(60,60,67,0.3)",
  fill:"rgba(120,120,128,0.2)",fill2:"rgba(120,120,128,0.16)",
  fill3:"rgba(118,118,128,0.12)",fill4:"rgba(116,116,128,0.08)",
};
const SF = "-apple-system,'SF Pro Text',system-ui,sans-serif";
const SFD = "-apple-system,'SF Pro Display',system-ui,sans-serif";

// ─── GLOBAL STATE ─────────────────────────────────────────────────────────────
const initialState = {
  cycles:[{id:1,name:"2025–2026",active:true}],
  activeCycle:1,
  teachers:[
    {id:1,name:"Prof. Ana Ramírez",contact:"55-1111-2222",email:"a.ramirez@inst.edu",subjects:["Matemáticas"],groups:["3°A","3°B"],key:"ana.R247",avatar:"AR",color:C.blue},
    {id:2,name:"Prof. Juan Castillo",contact:"55-3333-4444",email:"j.castillo@inst.edu",subjects:["Ciencias"],groups:["2°A"],key:"juan.C819",avatar:"JC",color:C.green},
  ],
  students:[
    {id:1,name:"Luis Pérez García",group:"3°A",grade:3,section:"A",parentEmail:"rosa@mail.com",parentContact:"55-5555-6666",key:"Luis.PG3A472",avatar:"LP",color:C.blue,
     attendance:[{date:"2026-03-01",s:"present"},{date:"2026-03-02",s:"absent"},{date:"2026-03-03",s:"present"},{date:"2026-03-04",s:"justified"},{date:"2026-03-05",s:"present"}],
     subjects:{Matemáticas:{grade:7.8,tasks:[]},Ciencias:{grade:8.5,tasks:[]},Historia:{grade:9.1,tasks:[]},Español:{grade:8.2,tasks:[]}},
     participation:12,tabBoardLikes:34},
    {id:2,name:"María Torres Vega",group:"3°A",grade:3,section:"A",parentEmail:"laura@mail.com",parentContact:"55-7777-8888",key:"Maria.TV3A391",avatar:"MT",color:C.purple,
     attendance:[{date:"2026-03-01",s:"present"},{date:"2026-03-02",s:"present"},{date:"2026-03-03",s:"present"},{date:"2026-03-04",s:"present"},{date:"2026-03-05",s:"present"}],
     subjects:{Matemáticas:{grade:9.6,tasks:[]},Ciencias:{grade:9.8,tasks:[]},Historia:{grade:9.5,tasks:[]},Español:{grade:9.9,tasks:[]}},
     participation:28,tabBoardLikes:87},
    {id:3,name:"Carlos Ruiz Soto",group:"3°B",grade:3,section:"B",parentEmail:"martin@mail.com",parentContact:"55-9999-0000",key:"Carlos.RS3B614",avatar:"CR",color:C.orange,
     attendance:[{date:"2026-03-01",s:"absent"},{date:"2026-03-02",s:"absent"},{date:"2026-03-03",s:"present"},{date:"2026-03-04",s:"present"},{date:"2026-03-05",s:"absent"}],
     subjects:{Matemáticas:{grade:6.4,tasks:[]},Ciencias:{grade:7.1,tasks:[]},Historia:{grade:7.8,tasks:[]},Español:{grade:6.9,tasks:[]}},
     participation:5,tabBoardLikes:12},
  ],
  groups:[
    {id:1,name:"3°A",grade:3,section:"A",teacherId:1,subject:"Matemáticas",
     subjects:[{subject:"Matemáticas",teacherId:1},{subject:"Historia",teacherId:1},{subject:"Español",teacherId:1}],students:[1,2]},
    {id:2,name:"3°B",grade:3,section:"B",teacherId:1,subject:"Matemáticas",
     subjects:[{subject:"Matemáticas",teacherId:1},{subject:"Ciencias",teacherId:2}],students:[3]},
    {id:3,name:"2°A",grade:2,section:"A",teacherId:2,subject:"Ciencias",
     subjects:[{subject:"Ciencias",teacherId:2},{subject:"Español",teacherId:1}],students:[]},
  ],
  posts:[
    {id:1,authorId:"dir",authorName:"Directora Gómez",authorRole:"Directora",avatar:"DG",avatarColor:C.indigo,time:"Hace 2h",title:"Festival de Primavera 🌸",body:"¡Este viernes celebraremos nuestro Festival de Primavera! Habrá presentaciones de todos los grados. Iniciaremos a las 9:00 AM en el patio central.",type:"event",likes:[],comments:[{id:1,author:"Prof. Ramírez",text:"¡Qué emocionante! Los alumnos están muy preparados.",time:"Hace 1h"}]},
    {id:2,authorId:"t1",authorName:"Prof. Ana Ramírez",authorRole:"Matemáticas",avatar:"AR",avatarColor:C.blue,time:"Hace 4h",title:"Dato curioso del día 🔢",body:"¿Sabías que el número cero fue inventado en India en el siglo VII? Sin el cero, las computadoras modernas no existirían.",type:"fact",likes:["dir"],comments:[]},
    {id:3,authorId:"dir",authorName:"Directora Gómez",authorRole:"Directora",avatar:"DG",avatarColor:C.indigo,time:"Ayer",title:"Aviso: Lunes sin clases 📢",body:"El próximo lunes 9 de marzo NO habrá clases por junta de Consejo Técnico Escolar. Actividades reinician el martes 10.",type:"notice",likes:["t1","s1","s2"],comments:[{id:1,author:"Alumna Torres",text:"Gracias por el aviso 🙏",time:"Ayer"}]},
  ],
  pendingContent:[
    {id:1,teacherId:1,teacherName:"Prof. Ana Ramírez",title:"Examen Álgebra Unidad 3",type:"examen",groupId:1,groupName:"3°A",date:"2026-03-10",content:"Contenido del examen..."},
    {id:2,teacherId:2,teacherName:"Prof. Juan Castillo",title:"Práctica Ecosistemas",type:"actividad",groupId:3,groupName:"2°A",date:"2026-03-11",content:"Práctica de laboratorio..."},
  ],
  approvedContent:[
    {id:3,teacherId:1,teacherName:"Prof. Ana Ramírez",title:"Tarea: Ecuaciones p.45",type:"tarea",groupId:1,groupName:"3°A",date:"2026-03-06"},
  ],
  teacherAttendance:{
    "2026-03-05":{1:{status:"present",time:"07:52"},2:{status:"absent",time:null}},
    "2026-03-04":{1:{status:"present",time:"08:01"},2:{status:"present",time:"07:55"}},
  },
  avisos:[
    {id:1,fromName:"Prof. Ana Ramírez",fromRole:"Docente",type:"accident",title:"Accidente en recreo — Luis Pérez",body:"El alumno Luis Pérez García sufrió una caída leve durante el recreo. Se le brindó atención en enfermería y se notificó al tutor. El alumno continúa en clases.",time:"2026-03-05",read:false},
    {id:2,fromName:"Prof. Juan Castillo",fromRole:"Docente",type:"board",title:"Publicación pendiente de revisión",body:"Se subió al tablón el contenido de la práctica de laboratorio de ecosistemas para el grupo 2°A. Favor de revisar y aprobar.",time:"2026-03-04",read:true},
  ],
  actividades:[
    {id:1,title:"Exposición: Revolución Mexicana",type:"exposicion",date:"2026-03-20",teacherId:"all",description:"Cada grupo presentará una exposición sobre los principales eventos de la Revolución Mexicana.",status:"pendiente"},
  ],
  numParciales: 3, // configurable from developer panel
  chats: [
    {id:"chat_dir_t1",type:"direct",participants:["dir","t1"],name:"Directora Gómez",lastMsg:"Bienvenido al sistema",lastTime:"Hace 2h",unread:{t1:1}},
    {id:"chat_dir_t2",type:"direct",participants:["dir","t2"],name:"Directora Gómez",lastMsg:"Buenos días",lastTime:"Ayer",unread:{}},
  ],
  chatMessages: {
    "chat_dir_t1":[
      {id:1,from:"dir",fromName:"Directora Gómez",text:"Bienvenido al sistema escolar 👋",time:"10:00",date:"2026-03-12",type:"text"},
    ],
    "chat_dir_t2":[
      {id:1,from:"dir",fromName:"Directora Gómez",text:"Buenos días Prof. Castillo",time:"09:00",date:"2026-03-11",type:"text"},
    ],
  },
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().split("T")[0];
const genKey = (name, group) => {
  const p = name.trim().split(/\s+/);
  const first = p[0] || "X";
  const initials = p.slice(1).map(x=>x[0]?.toUpperCase()||"").join("");
  const num = Math.floor(100+Math.random()*900);
  const g = group?.replace(/[°\s]/g,"") || "";
  return `${first}.${initials}${g}${num}`;
};
const genTeacherKey = (name) => {
  const p = name.trim().split(/\s+/);
  const last = p[p.length-1] || "X";
  const num = Math.floor(100+Math.random()*900);
  return `${(p[1]||p[0]).toLowerCase()}.${last[0].toUpperCase()}${num}`;
};
const fmt = {
  headline:{fontSize:17,fontWeight:600,letterSpacing:"-0.3px"},
  body:{fontSize:17,fontWeight:400,letterSpacing:"-0.2px"},
  callout:{fontSize:16,fontWeight:400,letterSpacing:"-0.2px"},
  subhead:{fontSize:15,fontWeight:400,letterSpacing:"-0.1px"},
  footnote:{fontSize:13,fontWeight:400},
  caption:{fontSize:12,fontWeight:400},
  caption2:{fontSize:11,fontWeight:400,letterSpacing:"0.06px"},
  title1:{fontSize:28,fontWeight:700,letterSpacing:"-0.5px"},
  title2:{fontSize:22,fontWeight:700,letterSpacing:"-0.3px"},
  title3:{fontSize:20,fontWeight:600,letterSpacing:"-0.2px"},
};

// ─── SUBJECT MASCOTS ──────────────────────────────────────────────────────────
const MASCOTS = {
  "Matemáticas": { emoji:"🦉", name:"Búho Euler",      color:C.blue,   frames:["M10,20 Q12,14 14,20 Q16,14 18,20","M10,18 Q12,22 14,18 Q16,22 18,18"] },
  "Ciencias":    { emoji:"🐸", name:"Rana Darwin",     color:C.green,  frames:["M8,20 Q12,12 16,20","M8,16 Q12,24 16,16"] },
  "Historia":    { emoji:"🦊", name:"Zorro Clío",      color:C.orange, frames:["M9,20 Q12,15 15,20","M9,17 Q12,21 15,17"] },
  "Español":     { emoji:"🦋", name:"Mariposa Sílaba", color:C.purple, frames:["M8,12 Q12,6 16,12 Q12,18 8,12","M8,14 Q12,8 16,14 Q12,20 8,14"] },
  "Arte":        { emoji:"🐙", name:"Pulpo Picasso",   color:C.pink,   frames:["M12,8 Q8,14 10,20","M12,8 Q16,14 14,20"] },
};

// Animal mascots by id (from developer panel mascot picker)
const ANIMAL_MASCOTS = {
  owl:      { emoji:"🦉", name:"Búho",     color:C.blue   },
  bear:     { emoji:"🐻", name:"Oso",      color:C.brown||"#7B5230" },
  whale:    { emoji:"🐋", name:"Ballena",  color:"#4A9EFF" },
  elephant: { emoji:"🐘", name:"Elefante", color:"#9E9E9E" },
  giraffe:  { emoji:"🦒", name:"Jirafa",   color:"#FFA726" },
  lion:     { emoji:"🦁", name:"León",     color:"#FB8C00" },
  fox:      { emoji:"🦊", name:"Zorro",    color:C.orange  },
  rabbit:   { emoji:"🐰", name:"Conejo",   color:C.pink    },
  dragon:   { emoji:"🐲", name:"Dragón",   color:C.green   },
  cat:      { emoji:"🐱", name:"Gato",     color:C.purple  },
};

// Resolve mascot data: prefers stored animal id, falls back to subject name, then default
const resolveMascot = (animalId, subjectName) => {
  if(animalId && ANIMAL_MASCOTS[animalId]) return ANIMAL_MASCOTS[animalId];
  if(subjectName && MASCOTS[subjectName]) return MASCOTS[subjectName];
  return MASCOTS["Matemáticas"];
};

// ─── MASCOT SVG WITH INTEGRATED ACCESSORIES ───────────────────────────────────
// Per-animal head anchors: where the head center sits in a 100×100 viewBox
// Emoji rendered at x=50, y=66 baseline, fontSize=62
// So emoji top≈y4, head center varies by animal shape
const ANIMAL_HEADS={
  owl:      {x:50,y:24}, // round owl head, centered
  bear:     {x:50,y:22}, // round bear head
  whale:    {x:38,y:42}, // whale horizontal, head left
  elephant: {x:48,y:30}, // elephant large round head
  giraffe:  {x:50,y:10}, // giraffe head very high up on long neck
  lion:     {x:50,y:26}, // lion with big mane, head slightly lower
  fox:      {x:50,y:22}, // fox pointed snout
  rabbit:   {x:50,y:26}, // rabbit body-centered (ears above)
  dragon:   {x:50,y:24},
  cat:      {x:50,y:22},
  default:  {x:50,y:22},
};

const MascotSVG=({subject,outfit,size=80,animal=null})=>{
  const m=resolveMascot(animal, subject);
  const animalKey=animal||"default";
  const head=ANIMAL_HEADS[animalKey]||ANIMAL_HEADS.default;
  const hx=head.x, hy=head.y;
  // Each accessory is drawn with (0,0) = head center, then translated
  const T=(children)=><g transform={`translate(${hx},${hy})`}>{children}</g>;

  // ── HAT accessories (sit above head, y negative) ────────────────────────────
  const Birrete=()=>T(<><rect x="-19" y="-29" width="38" height="7" rx="2" fill="#1a1a2e"/><rect x="-13" y="-37" width="26" height="9" rx="2" fill="#1a1a2e"/><line x1="11" y1="-35" x2="21" y2="-26" stroke="#FFD700" strokeWidth="2.5" strokeLinecap="round"/><circle cx="22" cy="-25" r="3.5" fill="#FFD700"/></>);
  const Corona=()=>T(<><path d="M-20 -20 L-20 -30 L-8 -24 L0 -36 L8 -24 L20 -30 L20 -20 Z" fill="#FFD700"/><line x1="-20" y1="-20" x2="20" y2="-20" stroke="#F9A825" strokeWidth="2"/><circle cx="0" cy="-35" r="3.5" fill="#E53935"/><circle cx="-19" cy="-29" r="2.5" fill="#4CAF50"/><circle cx="19" cy="-29" r="2.5" fill="#4CAF50"/><circle cx="-8" cy="-23" r="2" fill="#2196F3"/><circle cx="8" cy="-23" r="2" fill="#2196F3"/></>);
  const SombreroPaja=()=>T(<><ellipse cx="0" cy="-20" rx="28" ry="6" fill="#F9A825"/><path d="M-22 -20 Q-20 -36 0 -38 Q20 -36 22 -20" fill="#F9A825"/><ellipse cx="0" cy="-21" rx="16" ry="4" fill="#F57F17" opacity="0.5"/></>);
  const SombreroVaquero=()=>T(<><ellipse cx="0" cy="-18" rx="26" ry="7" fill="#6D4C41"/><path d="M-20 -18 Q-18 -36 0 -38 Q18 -36 20 -18" fill="#795548"/><ellipse cx="0" cy="-19" rx="14" ry="4" fill="#5D4037" opacity="0.5"/><path d="M-20 -17 Q0 -10 20 -17" stroke="#4E342E" strokeWidth="1.5" fill="none"/></>);
  const CascoAntiguo=()=>T(<><path d="M-26 -6 Q-28 -30 0 -32 Q28 -30 26 -6 L26 -2 L-26 -2 Z" fill="#B0BEC5"/><rect x="-6" y="-32" width="12" height="20" rx="3" fill="#CFD8DC"/><ellipse cx="0" cy="-2" rx="26" ry="5" fill="#90A4AE"/><path d="M-26 -2 L-32 12 L-22 12 L-18 -2" fill="#B0BEC5"/><path d="M26 -2 L32 12 L22 12 L18 -2" fill="#B0BEC5"/></>);
  const SombreroTeatro=()=>T(<><ellipse cx="0" cy="-18" rx="28" ry="6" fill="#6A1B9A"/><path d="M-22 -18 Q-20 -36 0 -38 Q20 -36 22 -18" fill="#4A148C"/><ellipse cx="0" cy="-19" rx="16" ry="4" fill="#7B1FA2" opacity="0.5"/><circle cx="-10" cy="-28" r="3" fill="#FFD700"/><circle cx="10" cy="-28" r="3" fill="#FFD700"/><circle cx="0" cy="-33" r="3.5" fill="#FF6F00"/></>);

  // ── FACE accessories (at eye level, slight y positive) ─────────────────────
  const GafasNerd=()=>T(<><circle cx="-14" cy="6" r="9" fill="none" stroke="#222" strokeWidth="2.2"/><circle cx="14" cy="6" r="9" fill="none" stroke="#222" strokeWidth="2.2"/><line x1="-5" y1="6" x2="5" y2="6" stroke="#222" strokeWidth="2.2"/><line x1="-23" y1="6" x2="-29" y2="4" stroke="#222" strokeWidth="2.2" strokeLinecap="round"/><line x1="23" y1="6" x2="29" y2="4" stroke="#222" strokeWidth="2.2" strokeLinecap="round"/><circle cx="-14" cy="6" r="6" fill="#E3F2FD" opacity="0.4"/><circle cx="14" cy="6" r="6" fill="#E3F2FD" opacity="0.4"/></>);
  const GafasLab=()=>T(<><rect x="-28" y="0" width="56" height="14" rx="6" fill="#4FC3F7" opacity="0.5" stroke="#0277BD" strokeWidth="2"/><line x1="0" y1="0" x2="0" y2="14" stroke="#0277BD" strokeWidth="1.5"/><line x1="-28" y1="7" x2="-36" y2="5" stroke="#0277BD" strokeWidth="2.5" strokeLinecap="round"/><line x1="28" y1="7" x2="36" y2="5" stroke="#0277BD" strokeWidth="2.5" strokeLinecap="round"/></>);

  // ── BODY accessories (below head) ───────────────────────────────────────────
  const CapaHeroe=()=>T(<><rect x="-14" y="20" width="28" height="5" rx="2" fill="#FFD700"/><path d="M-14 25 Q-18 35 -16 50 L0 44 L16 50 Q18 35 14 25 Z" fill="#E53935"/><path d="M-14 25 Q-7 31 0 28 Q7 31 14 25" fill="#B71C1C" opacity="0.7"/></>);
  const BataBlanca=()=>T(<><path d="M-22 16 L-28 55 L28 55 L22 16 Q10 22 0 20 Q-10 22 -22 16Z" fill="white" stroke="#B0BEC5" strokeWidth="1.5"/><path d="M0 20 L0 55" stroke="#CFD8DC" strokeWidth="1"/><circle cx="0" cy="30" r="2" fill="#90A4AE"/><circle cx="0" cy="38" r="2" fill="#90A4AE"/><circle cx="0" cy="46" r="2" fill="#90A4AE"/></>);
  const TrajeEspacial=()=>T(<><circle cx="0" cy="0" r="28" fill="#E3F2FD" stroke="#1565C0" strokeWidth="2.5" opacity="0.88"/><ellipse cx="-5" cy="-10" rx="9" ry="6" fill="white" opacity="0.45"/><circle cx="0" cy="0" r="28" fill="none" stroke="#90CAF9" strokeWidth="1.5" opacity="0.5"/></>);

  // ── SIDE accessories (held to side) ────────────────────────────────────────
  const LupaArqueologo=()=>T(<><circle cx="26" cy="-4" r="14" fill="none" stroke="#37474F" strokeWidth="2.5"/><circle cx="26" cy="-4" r="10" fill="#E3F2FD" opacity="0.55"/><circle cx="22" cy="-8" r="3" fill="white" opacity="0.4"/><line x1="16" y1="7" x2="4" y2="20" stroke="#37474F" strokeWidth="3.5" strokeLinecap="round"/></>);
  const Pergamino=()=>T(<><rect x="16" y="-14" width="22" height="32" rx="3" fill="#FFF9C4" stroke="#F9A825" strokeWidth="1.5"/><ellipse cx="27" cy="-14" rx="11" ry="3.5" fill="#FFE082"/><ellipse cx="27" cy="18" rx="11" ry="3.5" fill="#FFE082"/><line x1="20" y1="-6" x2="34" y2="-6" stroke="#F9A825" strokeWidth="1.3"/><line x1="20" y1="0" x2="34" y2="0" stroke="#F9A825" strokeWidth="1.3"/><line x1="20" y1="6" x2="34" y2="6" stroke="#F9A825" strokeWidth="1.3"/></>);
  const Pluma=()=>T(<><path d="M22 -22 Q36 -12 28 4 Q20 14 14 24" fill="#FFF8E1" stroke="#FFA000" strokeWidth="1.5"/><path d="M22 -22 Q14 -8 14 24" fill="#FFE082" opacity="0.65"/><path d="M14 24 L11 36" stroke="#5D4037" strokeWidth="2.5" strokeLinecap="round"/></>);
  const LibroMagico=()=>T(<><rect x="14" y="-10" width="26" height="34" rx="3" fill="#7B1FA2"/><rect x="16" y="-8" width="22" height="30" rx="2" fill="#CE93D8"/><line x1="27" y1="-8" x2="27" y2="22" stroke="#7B1FA2" strokeWidth="2"/><circle cx="27" cy="8" r="5" fill="#FFD700" opacity="0.9"/><path d="M24 6 L27 3 L30 6 L29 11 L25 11 Z" fill="#FFF176"/></>);
  const EstrellaAutor=()=>T(<><path d="M0 -32 L5 -20 L18 -20 L8 -12 L12 0 L0 -8 L-12 0 L-8 -12 L-18 -20 L-5 -20 Z" fill="#FFD700" stroke="#F9A825" strokeWidth="1"/><path d="M0 -32 L3 -24 L10 -24 L4 -19 L7 -11 L0 -16 L-7 -11 L-4 -19 L-10 -24 L-3 -24 Z" fill="#FFF176" opacity="0.6"/></>);

  const outfitMap={
    m1:<Birrete/>,m2:<GafasNerd/>,m3:<CapaHeroe/>,m4:<Corona/>,
    c1:<GafasLab/>,c2:<BataBlanca/>,c3:<SombreroPaja/>,c4:<TrajeEspacial/>,
    h1:<SombreroVaquero/>,h2:<CascoAntiguo/>,h3:<LupaArqueologo/>,h4:<Pergamino/>,
    e1:<Pluma/>,e2:<SombreroTeatro/>,e3:<LibroMagico/>,e4:<EstrellaAutor/>,
    d1:<Birrete/>,d2:<EstrellaAutor/>,d3:<Corona/>,d4:<CapaHeroe/>,
  };

  return(
    <svg width={size} height={size} viewBox="0 0 100 100" style={{overflow:"visible",display:"block"}}>
      <text x="50" y="66" textAnchor="middle" fontSize="62" style={{userSelect:"none"}}>{m.emoji}</text>
      {outfit&&outfitMap[outfit]}
    </svg>
  );
};

const FloatingMascot = ({ subject, progress, outfit=null, style={}, animal=null }) => {
  const m = resolveMascot(animal, subject);
  const [pos, setPos] = useState({ x: Math.random()*55+10, y: Math.random()*35+25, dx:(Math.random()>0.5?1:-1)*0.25, dy:(Math.random()>0.5?1:-1)*0.18 });
  const size = 30 + Math.floor((progress||0)/20)*5;

  useEffect(()=>{
    const t = setInterval(()=>{
      setPos(p=>{
        let nx=p.x+p.dx, ny=p.y+p.dy;
        let ndx=p.dx, ndy=p.dy;
        if(nx>80||nx<5){ndx=-ndx;}
        if(ny>75||ny<10){ndy=-ndy;}
        return {x:Math.max(5,Math.min(80,nx)),y:Math.max(10,Math.min(75,ny)),dx:ndx,dy:ndy};
      });
    },60);
    return ()=>clearInterval(t);
  },[]);

  return (
    <div style={{
      position:"absolute", left:`${pos.x}%`, top:`${pos.y}%`,
      pointerEvents:"none", zIndex:1,
      transition:"left 0.08s linear,top 0.08s linear",
      ...style
    }}>
      <div style={{
        width:size+12, height:size+12, borderRadius:"50%",
        background:`${m.color}15`, border:`1.5px solid ${m.color}28`,
        display:"flex",alignItems:"center",justifyContent:"center",
        animation:`mascotBob 2s ease-in-out infinite`,
        boxShadow:`0 2px 10px ${m.color}18`,
      }}>
        <MascotSVG subject={subject} animal={animal} outfit={outfit} size={size}/>
      </div>
    </div>
  );
};

// ─── iOS PRIMITIVES ───────────────────────────────────────────────────────────
// ─── BREAKPOINT CONTEXT (single global listener) ──────────────────────────────
const getBp = () => {
  if (typeof window === "undefined") return "mobile";
  const w = window.innerWidth;
  if (w >= 1024) return "desktop";
  if (w >= 640) return "tablet";
  return "mobile";
};
const BpCtx = React.createContext("mobile");
const BpProvider = ({ children }) => {
  const [bp, setBp] = useState(getBp);
  useEffect(() => {
    let raf = null;
    const fn = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setBp(getBp())); };
    window.addEventListener("resize", fn, { passive: true });
    return () => { window.removeEventListener("resize", fn); cancelAnimationFrame(raf); };
  }, []);
  return <BpCtx.Provider value={bp}>{children}</BpCtx.Provider>;
};
const useBreakpoint = () => {
  const bp = React.useContext(BpCtx);
  return { bp, isMobile: bp==="mobile", isTablet: bp==="tablet", isDesktop: bp==="desktop" };
};

// ─── RESPONSIVE TOKEN HELPER ───────────────────────────────────────────────────
const R_TOKENS = {
  mobile:  { sp:16, spSm:10, radius:14, radiusSm:10,
              fs:{ title:22, head:17, body:15, sub:13, cap:12, xs:11 },
              avatar:{ lg:56, md:40, sm:32 },
              navH:50, tabH:58, rowPad:"11px 16px", iconBox:30, iconFs:16 },
  tablet:  { sp:20, spSm:12, radius:16, radiusSm:12,
              fs:{ title:26, head:19, body:16, sub:14, cap:13, xs:12 },
              avatar:{ lg:72, md:48, sm:38 },
              navH:58, tabH:62, rowPad:"13px 20px", iconBox:34, iconFs:18 },
  desktop: { sp:28, spSm:16, radius:18, radiusSm:14,
              fs:{ title:30, head:21, body:17, sub:15, cap:14, xs:13 },
              avatar:{ lg:84, md:54, sm:42 },
              navH:64, tabH:0, rowPad:"14px 24px", iconBox:38, iconFs:20 },
};
const useR = () => {
  const { bp } = useBreakpoint();
  return R_TOKENS[bp] || R_TOKENS.mobile;
};


// ─── CORE UI COMPONENTS (fully responsive) ────────────────────────────────────
const Btn = ({children,onPress,variant="filled",color,size="md",disabled,full,style:sx={}})=>{
  const [p,setP]=useState(false);
  const R = useR();
  const cl=color||C.blue;
  const v={
    filled:{background:cl,color:"#fff",border:"none"},
    tinted:{background:`${cl}18`,color:cl,border:"none"},
    outlined:{background:"transparent",color:cl,border:`1.5px solid ${cl}`},
    plain:{background:"transparent",color:cl,border:"none",padding:0},
    ghost:{background:C.fill3,color:C.lbl,border:"none"},
    danger:{background:`${C.red}15`,color:C.red,border:"none"},
  }[variant]||{background:cl,color:"#fff",border:"none"};
  // Size scales with breakpoint
  const fsMap = { sm: R.fs.sub, md: R.fs.body, lg: R.fs.head };
  const padMap = {
    sm: `${Math.round(R.sp*0.3)}px ${Math.round(R.sp*0.7)}px`,
    md: `${Math.round(R.sp*0.55)}px ${Math.round(R.sp*1.1)}px`,
    lg: `${Math.round(R.sp*0.75)}px ${Math.round(R.sp*1.4)}px`,
  };
  const s={ padding:padMap[size]||padMap.md, fontSize:fsMap[size]||fsMap.md, fontWeight:600, borderRadius:R.radiusSm };
  const handleClick=()=>{ if(!disabled){ SFX.play("click"); onPress&&onPress(); } };
  return(
    <button onClick={handleClick} disabled={disabled}
      onMouseDown={()=>setP(true)} onMouseUp={()=>setP(false)} onMouseLeave={()=>setP(false)}
      style={{...v,...s,width:full?"100%":undefined,opacity:disabled?0.3:p?0.7:1,
        transform:p?"scale(0.97)":"scale(1)",transition:"all 0.1s ease",
        cursor:disabled?"not-allowed":"pointer",
        display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,
        fontFamily:SF,letterSpacing:"-0.2px",...sx}}>
      {children}
    </button>
  );
};

const NavBar=({title,large,sub,right,back,onBack,accent=C.blue,bg="rgba(242,242,247,0.88)"})=>{
  const R = useR();
  return(
    <div style={{position:"sticky",top:0,zIndex:200,background:bg,
      backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",
      borderBottom:`0.5px solid ${C.sep}`}}>
      <div style={{display:"flex",alignItems:"center",
        padding:`10px ${R.sp}px`,minHeight:R.navH}}>
        {back&&<button onClick={onBack} style={{background:"none",border:"none",color:accent,cursor:"pointer",
          display:"flex",alignItems:"center",gap:3,fontFamily:SF,fontSize:R.fs.body,
          padding:`0 ${R.spSm}px 0 0`,letterSpacing:"-0.2px"}}>
          <svg width="10" height="17" viewBox="0 0 10 17" fill="none">
            <path d="M8 1L1 8.5L8 16" stroke={accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>{back}
        </button>}
        {!large&&<div style={{flex:1,textAlign:"center",fontSize:R.fs.head,fontWeight:600,
          color:C.lbl,fontFamily:SF,letterSpacing:"-0.3px"}}>{title}</div>}
        {large&&<div style={{flex:1}}/>}
        {right&&<div style={{marginLeft:"auto"}}>{right}</div>}
      </div>
      {large&&<div style={{padding:`0 ${R.sp}px ${R.spSm}px`}}>
        <div style={{fontSize:R.fs.title,fontWeight:700,color:C.lbl,fontFamily:SFD,
          letterSpacing:"-0.5px"}}>{title}</div>
        {sub&&<div style={{fontSize:R.fs.sub,color:C.lbl2,fontFamily:SF,marginTop:3}}>{sub}</div>}
      </div>}
    </div>
  );
};

const TabBar=({tabs,active,onChange,accent=C.blue})=>{
  const R = useR();
  // On desktop show as horizontal top strip (not bottom fixed)
  const isDesktop = R.tabH === 0;
  if (isDesktop) {
    return (
      <div style={{display:"flex",gap:4,padding:"8px 16px",background:"rgba(255,255,255,0.95)",
        borderBottom:`0.5px solid rgba(60,60,67,0.1)`,
        backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",
        position:"sticky",top:0,zIndex:250,flexWrap:"wrap"}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>{SFX.play("click");onChange(t.id);}}
            style={{display:"flex",alignItems:"center",gap:6,
              padding:"7px 14px",borderRadius:10,border:"none",cursor:"pointer",
              background:active===t.id?`${accent}15`:"transparent",
              color:active===t.id?accent:"rgba(60,60,67,0.6)",
              fontSize:14,fontWeight:active===t.id?600:400,fontFamily:SF,
              transition:"all 0.15s"}}>
            <span style={{fontSize:16}}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    );
  }
  return(
    <div className="tab-bar-bottom">
      {tabs.map(t=>(
        <button key={t.id} onClick={()=>{SFX.play("click");onChange(t.id);}}
          style={{flex:1,display:"flex",flexDirection:"column",
            alignItems:"center",gap:2,background:"none",border:"none",cursor:"pointer",
            padding:`2px ${R.spSm*0.5}px`,
            transition:"transform 0.1s",transform:active===t.id?"scale(1.06)":"scale(1)"}}>
          <span style={{fontSize:R.fs.head+4,lineHeight:1,filter:active===t.id?"none":"grayscale(0.6)",
            transition:"filter 0.15s",opacity:active===t.id?1:0.65}}>{t.icon}</span>
          <span style={{fontSize:R.fs.xs,fontWeight:active===t.id?600:400,
            color:active===t.id?accent:C.g1,fontFamily:SF,letterSpacing:"-0.1px"}}>{t.label}</span>
        </button>
      ))}
    </div>
  );
};

const Card=({children,style:sx={},onPress,noPad})=>{
  const [p,setP]=useState(false);
  const R = useR();
  const handleClick=()=>{ if(onPress){ SFX.play("click"); onPress(); } };
  return(
    <div onClick={handleClick} onMouseDown={()=>onPress&&setP(true)}
      onMouseUp={()=>setP(false)} onMouseLeave={()=>setP(false)}
      style={{background:C.bg,borderRadius:R.radius,
        boxShadow:"0 1px 4px rgba(0,0,0,0.07)",
        overflow:"hidden",transform:p?"scale(0.985)":"scale(1)",
        transition:"transform 0.1s ease",cursor:onPress?"pointer":undefined,...sx}}>
      {children}
    </div>
  );
};

const Row=({label,detail,right,icon,iconBg,chevron,onPress,danger,badge})=>{
  const [p,setP]=useState(false);
  const R = useR();
  const handleClick=()=>{ if(onPress){ SFX.play("click"); onPress(); } };
  return(
    <div onClick={handleClick} onMouseDown={()=>onPress&&setP(true)}
      onMouseUp={()=>setP(false)} onMouseLeave={()=>setP(false)}
      style={{display:"flex",alignItems:"center",gap:R.spSm,padding:R.rowPad,
        cursor:onPress?"pointer":undefined,background:p?C.fill4:"transparent",
        transition:"background 0.1s"}}>
      {icon&&<div style={{width:R.iconBox,height:R.iconBox,borderRadius:Math.round(R.iconBox*0.26),
        background:iconBg||C.fill3,display:"flex",alignItems:"center",
        justifyContent:"center",flexShrink:0,fontSize:R.iconFs}}>{icon}</div>}
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:R.fs.body,color:danger?C.red:C.lbl,fontFamily:SF,letterSpacing:"-0.2px"}}>{label}</div>
        {detail&&<div style={{fontSize:R.fs.cap,color:C.lbl2,fontFamily:SF,marginTop:2}}>{detail}</div>}
      </div>
      {badge&&<div style={{background:C.red,color:"#fff",fontSize:R.fs.xs,fontWeight:700,
        borderRadius:10,padding:"2px 8px",fontFamily:SF}}>{badge}</div>}
      {right&&<div style={{color:C.lbl2,fontFamily:SF,fontSize:R.fs.body}}>{right}</div>}
      {chevron&&<svg width="8" height="13" viewBox="0 0 8 13" fill="none">
        <path d="M1 1L7 6.5L1 12" stroke={C.g3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
    </div>
  );
};

const Div=({indent=0})=><div style={{height:"0.5px",background:C.sep,marginLeft:indent}}/>;

const Sec=({title,children,footer,style:sx={}})=>{
  const R = useR();
  return(
    <div style={{marginBottom:R.sp,...sx}}>
      {title&&<div style={{fontSize:R.fs.xs,color:C.lbl2,textTransform:"uppercase",letterSpacing:"0.06em",
        fontWeight:600,fontFamily:SF,marginBottom:6,paddingLeft:R.sp}}>{title}</div>}
      <Card>{children}</Card>
      {footer&&<div style={{fontSize:R.fs.cap,color:C.lbl2,fontFamily:SF,padding:`5px ${R.sp}px 0`}}>{footer}</div>}
    </div>
  );
};

const Pill=({children,color=C.blue,size="sm"})=>{
  const R = useR();
  return(
    <span style={{display:"inline-flex",alignItems:"center",
      padding:size==="xs"?`2px ${R.spSm*0.6}px`:`3px ${R.spSm}px`,
      borderRadius:20,background:`${color}18`,color,
      fontSize:size==="xs"?R.fs.xs:R.fs.cap,fontWeight:600,fontFamily:SF,letterSpacing:"-0.1px"}}>
      {children}
    </span>
  );
};

const Ava=({initials,color=C.blue,size=40,img})=>(
  <div style={{width:size,height:size,borderRadius:"50%",
    background:img?"transparent":`${color}20`,border:img?"none":`1.5px solid ${color}40`,
    display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden"}}>
    {img?<img src={img} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>
      :<span style={{color,fontWeight:700,fontSize:Math.round(size*0.38),letterSpacing:"-0.5px",fontFamily:SF}}>{initials}</span>}
  </div>
);

const Input=({label,placeholder,value,onChange,type="text",mono})=>{
  const R = useR();
  return(
    <div style={{background:C.fill4,borderRadius:R.radiusSm,
      padding:`${R.spSm}px ${R.spSm+4}px`,marginBottom:10}}>
      {label&&<div style={{fontSize:R.fs.xs,color:C.lbl2,fontWeight:600,textTransform:"uppercase",
        letterSpacing:"0.05em",marginBottom:4,fontFamily:SF}}>{label}</div>}
      <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        style={{width:"100%",background:"transparent",border:"none",fontSize:R.fs.body,
          color:C.lbl,outline:"none",letterSpacing:"-0.2px",padding:0,
          fontFamily:mono?"'SF Mono','Menlo',monospace":SF,boxSizing:"border-box"}}/>
    </div>
  );
};

const Modal=({open,onClose,title,children})=>{
  const R = useR();
  if(!open)return null;
  return(
    <div className="modal-sheet">
      <div className="modal-body" style={{background:C.bg}}>
        <div style={{display:"flex",alignItems:"center",
          padding:`${R.sp*0.75}px ${R.sp}px 0`}}>
          <div style={{flex:1,fontSize:R.fs.head,fontWeight:600,
            color:C.lbl,fontFamily:SF,letterSpacing:"-0.3px"}}>{title}</div>
          <button onClick={onClose} style={{width:30,height:30,borderRadius:"50%",background:C.fill3,
            border:"none",cursor:"pointer",display:"flex",alignItems:"center",
            justifyContent:"center",color:C.lbl2,fontSize:R.fs.body,fontFamily:SF}}>✕</button>
        </div>
        <div style={{padding:`${R.spSm}px ${R.sp}px 0`}}>{children}</div>
      </div>
    </div>
  );
};

// ─── ATTENDANCE CALENDAR ──────────────────────────────────────────────────────
const AttCalendar=({attendance})=>{
  const days=["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
  const months=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const now=new Date(2026,2,1);
  const grid=[];
  const first=new Date(2026,2,1).getDay();
  for(let i=0;i<first;i++)grid.push(null);
  for(let d=1;d<=31;d++){
    const dateStr=`2026-03-${String(d).padStart(2,"0")}`;
    const rec=attendance?.find(a=>a.date===dateStr);
    grid.push({d,status:rec?.s||null});
  }
  const statusColor={present:C.green,absent:C.red,justified:C.orange};
  const counts={present:(attendance||[]).filter(a=>a.s==="present").length,
    absent:(attendance||[]).filter(a=>a.s==="absent").length,
    justified:(attendance||[]).filter(a=>a.s==="justified").length};
  return(
    <div>
      <div style={{display:"flex",gap:12,marginBottom:12}}>
        {[["✅",counts.present,"Asistencias",C.green],["❌",counts.absent,"Faltas",C.red],["🟠",counts.justified,"Justificadas",C.orange]].map(([e,n,l,c])=>(
          <div key={l} style={{flex:1,background:`${c}12`,borderRadius:10,padding:"8px 10px",textAlign:"center"}}>
            <div style={{fontSize:18}}>{e}</div>
            <div style={{fontSize:20,fontWeight:700,color:c,fontFamily:SF}}>{n}</div>
            <div style={{fontSize:10,color:C.lbl2,fontFamily:SF}}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:6}}>
        {days.map(d=><div key={d} style={{textAlign:"center",fontSize:10,color:C.lbl2,fontFamily:SF,fontWeight:600}}>{d}</div>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
        {grid.map((cell,i)=>(
          <div key={i} style={{aspectRatio:"1",borderRadius:6,
            background:cell?.status?`${statusColor[cell.status]}25`:cell?.d?C.fill4:"transparent",
            border:cell?.status?`1px solid ${statusColor[cell.status]}40`:"none",
            display:"flex",alignItems:"center",justifyContent:"center"}}>
            {cell?.d&&<span style={{fontSize:11,fontWeight:600,
              color:cell.status?statusColor[cell.status]:C.lbl3,fontFamily:SF}}>{cell.d}</span>}
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:12,marginTop:10,flexWrap:"wrap"}}>
        {[["verde","Asistencia",C.green],["rojo","Falta",C.red],["naranja","Justificada",C.orange]].map(([_,l,c])=>(
          <div key={l} style={{display:"flex",alignItems:"center",gap:4}}>
            <div style={{width:10,height:10,borderRadius:2,background:c}}/>
            <span style={{fontSize:10,color:C.lbl2,fontFamily:SF}}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
};


// ── Draggable Bell wrapper (mobile only) ─────────────────────────────────────
const useDraggableBell=(storageKey)=>{
  const isMobile=typeof window!=="undefined"&&window.innerWidth<=768;
  const [pos,setPos]=useState(()=>{
    try{const s=localStorage.getItem(storageKey);return s?JSON.parse(s):null;}catch{return null;}
  });
  const dragging=useRef(false);
  const startTouch=useRef({x:0,y:0,px:0,py:0});

  const onTouchStart=useCallback((e)=>{
    if(!isMobile)return;
    const t=e.touches[0];
    const el=e.currentTarget.getBoundingClientRect();
    dragging.current=true;
    startTouch.current={x:t.clientX,y:t.clientY,px:el.left,py:el.top};
    e.stopPropagation();
  },[isMobile]);

  const onTouchMove=useCallback((e)=>{
    if(!dragging.current||!isMobile)return;
    const t=e.touches[0];
    const dx=t.clientX-startTouch.current.x;
    const dy=t.clientY-startTouch.current.y;
    const newX=Math.max(8,Math.min(window.innerWidth-54,startTouch.current.px+dx));
    const newY=Math.max(54,Math.min(window.innerHeight-80,startTouch.current.py+dy));
    setPos({x:newX,y:newY});
    // Note: no preventDefault() — React uses passive listeners for touch events
  },[isMobile]);

  const onTouchEnd=useCallback((e)=>{
    if(!dragging.current)return;
    dragging.current=false;
    setPos(p=>{
      if(p) try{localStorage.setItem(storageKey,JSON.stringify(p));}catch{}
      return p;
    });
  },[storageKey]);

  const style=isMobile&&pos?{position:"fixed",left:pos.x,top:pos.y,right:"auto",zIndex:650,touchAction:"none"}:{};
  return{style,onTouchStart,onTouchMove,onTouchEnd,isMobile};
};

// ─── GLOBAL FEED ──────────────────────────────────────────────────────────────
const Feed=({state,setState,userId,userName,userAvatar,userColor,userRole,accent=C.blue,newsItems=[],urgentCount=0})=>{
  const [composer,setComposer]=useState(false);
  const [form,setForm]=useState({title:"",body:"",type:"news"});
  const [commentOpen,setCommentOpen]=useState(null);
  const [commentText,setCommentText]=useState("");
  const [attachImages,setAttachImages]=useState([]);
  const [attachLink,setAttachLink]=useState("");
  const [showLinkInput,setShowLinkInput]=useState(false);
  const [attachFiles,setAttachFiles]=useState([]);
  const [bellOpen,setBellOpen]=useState(false);
  const [selNews,setSelNews]=useState(null);
  const bellDrag=useDraggableBell(`lms_bell_pos_feed_${userId}`);
  const imgRef=useRef();
  const fileRef=useRef();
  const canPost=userRole==="director"||userRole==="teacher";
  const toggleLike=(postId)=>setState(s=>({...s,posts:s.posts.map(p=>p.id===postId?{...p,likes:p.likes.includes(userId)?p.likes.filter(l=>l!==userId):[...p.likes,userId]}:p)}));
  const addComment=(postId)=>{
    if(!commentText.trim())return;
    setState(s=>({...s,posts:s.posts.map(p=>p.id===postId?{...p,comments:[...p.comments,{id:Date.now(),author:userName,text:commentText,time:"Ahora"}]}:p)}));
    setCommentText("");
  };
  const addImage=(e)=>{
    Array.from(e.target.files||[]).forEach(f=>{
      const r=new FileReader();
      r.onload=ev=>setAttachImages(a=>[...a,{id:Date.now()+Math.random(),src:ev.target.result,name:f.name}]);
      r.readAsDataURL(f);
    });
    e.target.value="";
  };
  const addFile=(e)=>{
    setAttachFiles(a=>[...a,...Array.from(e.target.files||[]).map(f=>({id:Date.now()+Math.random(),name:f.name,size:(f.size/1024).toFixed(0)+"KB",mime:f.type}))]);
    e.target.value="";
  };
  const publish=()=>{
    if(!form.title.trim())return;
    const p={id:Date.now(),authorId:userId,authorName:userName,
      authorRole:userRole==="director"?"Directora":userRole==="teacher"?"Maestro(a)":"Alumno",
      avatar:userAvatar,avatarColor:userColor,time:"Ahora",title:form.title,body:form.body,
      type:form.type,likes:[],comments:[],
      images:[...attachImages],files:[...attachFiles],link:attachLink.trim()||null};
    setState(s=>({...s,posts:[p,...s.posts]}));
    setForm({title:"",body:"",type:"news"});
    setAttachImages([]);setAttachFiles([]);setAttachLink("");setShowLinkInput(false);setComposer(false);
  };
  const typeC={event:C.blue,fact:C.purple,contest:C.orange,notice:C.red,news:C.green};
  const typeL={event:"Evento",fact:"Dato",contest:"Concurso",notice:"Aviso",news:"Noticia"};
  const typeE={event:"📅",fact:"💡",contest:"🏆",notice:"📢",news:"📰"};
  const fileIcon=(mime)=>mime?.includes("pdf")?"📄":mime?.includes("image")?"🖼️":mime?.includes("word")?"📝":"📎";

  const [bellReadIds,setBellReadIds]=useState(()=>{ try{return JSON.parse(localStorage.getItem(`lms_bell_feed_${userId}`)||"[]");}catch{return[];} });
  const unreadFeedBellCount=newsItems.filter(n=>!bellReadIds.includes(n.id)).length;
  const markAllFeedBellRead=()=>{ const ids=newsItems.map(n=>n.id); setBellReadIds(ids); localStorage.setItem(`lms_bell_feed_${userId}`,JSON.stringify(ids)); };
  const markOneFeedBellRead=(id)=>{ if(!bellReadIds.includes(id)){ const ids=[...bellReadIds,id]; setBellReadIds(ids); localStorage.setItem(`lms_bell_feed_${userId}`,JSON.stringify(ids)); } };

  const BellPanel=()=>(
    <>
      <div onClick={()=>setBellOpen(false)} style={{position:"fixed",inset:0,zIndex:650}}/>
      <div style={{position:"fixed",top:58,right:10,width:300,maxHeight:"70vh",
        background:"#fff",borderRadius:18,boxShadow:"0 12px 48px rgba(0,0,0,0.22)",
        border:`1px solid ${C.g5}`,overflow:"hidden",zIndex:700,animation:"fadeUp 0.18s ease"}}>
        <div style={{background:`linear-gradient(135deg,${accent},${accent}bb)`,padding:"12px 14px 10px",
          display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:"#fff",fontFamily:SF}}>📣 Noticias y Avisos {unreadFeedBellCount>0&&`(${unreadFeedBellCount} nuevos)`}</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.75)",fontFamily:SF}}>
              {unreadFeedBellCount} notificaci{unreadFeedBellCount!==1?"ones":"ón"} nueva{unreadFeedBellCount!==1?"s":""}
              {urgentCount>0&&` · ${urgentCount} urgente${urgentCount>1?"s":""}`}
            </div>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            {unreadFeedBellCount>0&&<button onClick={(e)=>{e.stopPropagation();markAllFeedBellRead();}} style={{background:"rgba(255,255,255,0.25)",border:"none",borderRadius:8,padding:"3px 8px",cursor:"pointer",color:"#fff",fontSize:11,fontWeight:600,fontFamily:SF}}>Leer todas</button>}
            <button onClick={()=>setBellOpen(false)} style={{background:"rgba(255,255,255,0.2)",border:"none",
              borderRadius:"50%",width:24,height:24,cursor:"pointer",color:"#fff",fontSize:13,
              display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
          </div>
        </div>
        <div style={{overflowY:"auto",maxHeight:"calc(70vh - 58px)"}}>
          {(()=>{const visibleNews=newsItems.filter(n=>!bellReadIds.includes(n.id));return(<>
          {visibleNews.length===0&&<div style={{padding:"28px 16px",textAlign:"center",color:C.lbl2,fontSize:13,fontFamily:SF}}>¡Todo al día! 🎉 No hay notificaciones nuevas.</div>}
          {visibleNews.map((n,i)=>(
            <div key={n.id}>
              <div onClick={()=>{markOneFeedBellRead(n.id);setSelNews(selNews===n.id?null:n.id);}}
                style={{padding:"9px 12px",cursor:"pointer",borderLeft:`4px solid ${n.color}`,
                  background:`${n.color}08`,transition:"background 0.1s"}}>
                <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                  <span style={{fontSize:18,flexShrink:0,marginTop:1}}>{n.icon}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <span style={{fontSize:9,fontWeight:800,color:n.color,fontFamily:SF}}>● NUEVO  </span>
                    {n.urgent&&<span style={{fontSize:9,fontWeight:800,color:C.red,background:`${C.red}15`,borderRadius:3,padding:"1px 5px",fontFamily:SF,letterSpacing:"0.05em"}}>🚨 URGENTE</span>}
                    <div style={{fontSize:12,fontWeight:700,color:C.lbl,fontFamily:SF,lineHeight:1.35,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:selNews===n.id?"normal":"nowrap",marginTop:2}}>{n.title}</div>
                    <div style={{display:"flex",gap:5,marginTop:3,alignItems:"center"}}>
                      <span style={{fontSize:9,fontWeight:600,color:n.color,background:`${n.color}15`,borderRadius:4,padding:"1px 6px",fontFamily:SF}}>{n.badge}</span>
                      <span style={{fontSize:9,color:C.lbl3,fontFamily:SF}}>{n.time}</span>
                    </div>
                    {selNews===n.id&&<div style={{fontSize:11,color:C.lbl2,fontFamily:SF,lineHeight:1.5,marginTop:6,padding:"6px 8px",background:C.fill4,borderRadius:7}}>{n.body}</div>}
                  </div>
                </div>
              </div>
              {i<visibleNews.length-1&&<div style={{height:"0.5px",background:C.sep,marginLeft:44}}/>}
            </div>
          ))}
          </>);})()}
        </div>
      </div>
    </>
  );

  return(
    <div style={{background:C.bg2,minHeight:"100vh"}}>
      <NavBar title="Tablón Escolar" large sub="Instituto Educativo" accent={accent} bg="rgba(242,242,247,0.9)"
        right={
          <div style={{position:"relative"}}>
            <div {...(bellDrag.isMobile?{style:{...bellDrag.style,display:"inline-block"},onTouchStart:bellDrag.onTouchStart,onTouchMove:bellDrag.onTouchMove,onTouchEnd:bellDrag.onTouchEnd}:{style:{position:"relative"}})} >
            <button onClick={()=>setBellOpen(o=>!o)}
              style={{width:36,height:36,borderRadius:"50%",
                background:bellOpen?C.fill3:`linear-gradient(135deg,${accent},${accent}bb)`,
                border:"none",cursor:"pointer",boxShadow:"0 2px 10px rgba(0,0,0,0.12)",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,transition:"all 0.18s",
                position:"relative"}}>
              <span>🔔</span>
              {unreadFeedBellCount>0&&<span style={{position:"absolute",top:-4,right:-4,
                background:urgentCount>0?C.red:accent,color:"#fff",fontSize:9,fontWeight:800,
                borderRadius:"50%",minWidth:16,height:16,display:"flex",alignItems:"center",
                justifyContent:"center",fontFamily:SF,border:"2px solid #f2f2f7",padding:"0 3px"}}>
                {unreadFeedBellCount}
              </span>}
            </button>
            {bellOpen&&<BellPanel/>}
            </div>
          </div>
        }/>

      <div style={{padding:"12px 16px 100px"}}>
        {canPost&&!composer&&(
          <div onClick={()=>setComposer(true)} style={{display:"flex",alignItems:"center",gap:10,
            background:C.bg,borderRadius:12,padding:"12px 14px",marginBottom:12,
            boxShadow:"0 1px 3px rgba(0,0,0,0.07)",cursor:"pointer"}}>
            <Ava initials={userAvatar} color={userColor} size={36}/>
            <div style={{...fmt.body,color:C.lbl3,fontFamily:SF,flex:1}}>¿Qué quieres publicar?</div>
            <div style={{background:accent,borderRadius:20,padding:"4px 14px",color:"#fff",fontSize:13,fontWeight:600,fontFamily:SF}}>Publicar</div>
          </div>
        )}

        {canPost&&composer&&(
          <Card style={{marginBottom:12}}>
            <div style={{padding:"14px 14px 12px",display:"flex",alignItems:"center",gap:8,borderBottom:`0.5px solid ${C.sep}`}}>
              <Ava initials={userAvatar} color={userColor} size={34}/>
              <div style={{...fmt.callout,fontWeight:600,color:C.lbl,fontFamily:SF}}>Nueva Publicación</div>
              <button onClick={()=>{setComposer(false);setAttachImages([]);setAttachFiles([]);setAttachLink("");setShowLinkInput(false);}}
                style={{marginLeft:"auto",background:C.fill3,border:"none",borderRadius:"50%",width:28,height:28,
                  cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:C.lbl2,fontSize:15}}>✕</button>
            </div>
            <div style={{padding:"12px 14px 0"}}>
              <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
                {[{v:"news",e:"📰",l:"Noticia"},{v:"event",e:"📅",l:"Evento"},{v:"fact",e:"💡",l:"Dato"},{v:"contest",e:"🏆",l:"Concurso"},{v:"notice",e:"📢",l:"Aviso"}].map(t=>(
                  <button key={t.v} onClick={()=>setForm(f=>({...f,type:t.v}))}
                    style={{padding:"5px 12px",borderRadius:20,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:SF,
                      background:form.type===t.v?typeC[t.v]:C.fill4,color:form.type===t.v?"#fff":C.lbl2,transition:"all 0.15s"}}>
                    {t.e} {t.l}
                  </button>
                ))}
              </div>
              <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}
                placeholder="Título de la publicación…"
                style={{width:"100%",background:C.fill4,border:"none",borderRadius:10,padding:"10px 13px",
                  fontSize:15,fontWeight:600,color:C.lbl,fontFamily:SF,outline:"none",boxSizing:"border-box",marginBottom:8}}/>
              <textarea value={form.body} onChange={e=>setForm(f=>({...f,body:e.target.value}))}
                placeholder="Escribe tu publicación…" rows={3}
                style={{width:"100%",background:C.fill4,border:"none",borderRadius:10,padding:"10px 13px",
                  fontSize:14,color:C.lbl,fontFamily:SF,resize:"none",outline:"none",boxSizing:"border-box",lineHeight:1.5}}/>
              {attachImages.length>0&&(
                <div style={{display:"flex",gap:7,flexWrap:"wrap",marginTop:8}}>
                  {attachImages.map(img=>(
                    <div key={img.id} style={{position:"relative"}}>
                      <img src={img.src} style={{width:78,height:78,borderRadius:10,objectFit:"cover",border:`1px solid ${C.g5}`}}/>
                      <button onClick={()=>setAttachImages(a=>a.filter(x=>x.id!==img.id))}
                        style={{position:"absolute",top:-6,right:-6,width:20,height:20,borderRadius:"50%",background:C.red,
                          border:"2px solid #fff",cursor:"pointer",color:"#fff",fontSize:10,
                          display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              {attachFiles.length>0&&(
                <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:5}}>
                  {attachFiles.map(f=>(
                    <div key={f.id} style={{display:"flex",alignItems:"center",gap:8,background:C.fill4,borderRadius:8,padding:"7px 10px"}}>
                      <span style={{fontSize:17}}>{fileIcon(f.mime)}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:600,color:C.lbl,fontFamily:SF,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</div>
                        <div style={{fontSize:10,color:C.lbl3,fontFamily:SF}}>{f.size}</div>
                      </div>
                      <button onClick={()=>setAttachFiles(a=>a.filter(x=>x.id!==f.id))} style={{background:"none",border:"none",color:C.lbl3,cursor:"pointer",fontSize:15,padding:"0 4px"}}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              {showLinkInput&&(
                <div style={{display:"flex",gap:7,marginTop:8,alignItems:"center"}}>
                  <span style={{fontSize:18}}>🔗</span>
                  <input value={attachLink} onChange={e=>setAttachLink(e.target.value)}
                    placeholder="https://…"
                    style={{flex:1,background:C.fill4,border:`0.5px solid ${C.sep}`,borderRadius:9,
                      padding:"8px 11px",fontSize:14,color:C.lbl,fontFamily:SF,outline:"none"}}/>
                  <button onClick={()=>{setShowLinkInput(false);setAttachLink("");}}
                    style={{background:"none",border:"none",color:C.lbl3,cursor:"pointer",fontSize:15}}>✕</button>
                </div>
              )}
            </div>
            <div style={{padding:"10px 14px",borderTop:`0.5px solid ${C.sep}`,marginTop:10,
              display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
              <div style={{display:"flex",gap:4}}>
                {[{icon:"🖼️",tip:"Imagen",action:()=>imgRef.current?.click()},
                  {icon:"📎",tip:"Archivo",action:()=>fileRef.current?.click()},
                  {icon:"🔗",tip:"Enlace",action:()=>setShowLinkInput(v=>!v)},
                ].map(b=>(
                  <button key={b.tip} onClick={b.action} title={b.tip}
                    style={{width:34,height:34,borderRadius:10,background:C.fill4,border:"none",cursor:"pointer",
                      display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,
                      transition:"background 0.1s"}}
                    onMouseEnter={e=>e.currentTarget.style.background=C.fill3}
                    onMouseLeave={e=>e.currentTarget.style.background=C.fill4}>
                    {b.icon}
                  </button>
                ))}
                <input ref={imgRef} type="file" accept="image/*" multiple style={{display:"none"}} onChange={addImage}/>
                <input ref={fileRef} type="file" multiple style={{display:"none"}} onChange={addFile}/>
              </div>
              <Btn onPress={publish} disabled={!form.title.trim()} color={accent} size="sm" style={{minWidth:100}}>Publicar</Btn>
            </div>
          </Card>
        )}

        {state.posts.map(post=>{
          const liked=post.likes.includes(userId);
          const showComments=commentOpen===post.id;
          const postColor=typeC[post.type]||C.blue;
          return(
            <Card key={post.id} style={{marginBottom:10}}>
              <div style={{display:"flex",alignItems:"center",gap:10,padding:"13px 14px 8px"}}>
                <Ava initials={post.avatar} color={post.avatarColor} size={40}/>
                <div style={{flex:1}}>
                  <div style={{...fmt.callout,fontWeight:600,color:C.lbl,fontFamily:SF}}>{post.authorName}</div>
                  <div style={{...fmt.caption,color:C.lbl2,fontFamily:SF}}>{post.authorRole} · {post.time}</div>
                </div>
                <Pill color={postColor} size="xs">{typeE[post.type]} {typeL[post.type]}</Pill>
              </div>
              <div style={{padding:"0 14px 10px"}}>
                <div style={{...fmt.headline,color:C.lbl,fontFamily:SF,marginBottom:4}}>{post.title}</div>
                {post.body&&<div style={{...fmt.subhead,color:C.lbl2,fontFamily:SF,lineHeight:1.55}}>{post.body}</div>}
                {post.images?.length>0&&(
                  <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:9}}>
                    {post.images.map(img=>(
                      <img key={img.id} src={img.src}
                        style={{width:post.images.length===1?"100%":86,height:post.images.length===1?200:86,
                          borderRadius:10,objectFit:"cover",border:`1px solid ${C.g5}`}}/>
                    ))}
                  </div>
                )}
                {post.files?.length>0&&(
                  <div style={{marginTop:9,display:"flex",flexDirection:"column",gap:5}}>
                    {post.files.map(f=>(
                      <div key={f.id} style={{display:"flex",alignItems:"center",gap:8,background:`${postColor}08`,
                        borderRadius:9,padding:"7px 10px",border:`1px solid ${postColor}20`}}>
                        <span style={{fontSize:18}}>{fileIcon(f.mime)}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12,fontWeight:600,color:C.lbl,fontFamily:SF,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</div>
                          <div style={{fontSize:10,color:C.lbl3,fontFamily:SF}}>{f.size}</div>
                        </div>
                        <span style={{fontSize:11,color:postColor,fontFamily:SF,fontWeight:600}}>Ver →</span>
                      </div>
                    ))}
                  </div>
                )}
                {post.link&&(
                  <a href={post.link} target="_blank" rel="noreferrer"
                    style={{display:"flex",alignItems:"center",gap:8,marginTop:9,padding:"9px 12px",
                      background:`${postColor}08`,borderRadius:10,border:`1px solid ${postColor}25`,textDecoration:"none"}}>
                    <span style={{fontSize:18}}>🔗</span>
                    <div style={{flex:1,overflow:"hidden"}}>
                      <div style={{fontSize:12,fontWeight:600,color:postColor,fontFamily:SF,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{post.link}</div>
                    </div>
                    <span style={{fontSize:13,color:postColor}}>↗</span>
                  </a>
                )}
              </div>
              <div style={{display:"flex",borderTop:`0.5px solid ${C.sep}`,padding:"4px"}}>
                <button onClick={()=>toggleLike(post.id)} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,background:"none",border:"none",cursor:"pointer",padding:"8px",borderRadius:8,color:liked?C.red:C.lbl2,fontFamily:SF,fontSize:14,fontWeight:500}}>
                  <span style={{fontSize:17,display:"inline-block",transition:"transform 0.15s",transform:liked?"scale(1.2)":"scale(1)"}}>{liked?"❤️":"🤍"}</span>{post.likes.length}
                </button>
                <button onClick={()=>setCommentOpen(showComments?null:post.id)}
                  style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,background:"none",border:"none",cursor:"pointer",padding:"8px",borderRadius:8,color:showComments?accent:C.lbl2,fontFamily:SF,fontSize:14,fontWeight:500}}>
                  <span style={{fontSize:17}}>💬</span>{post.comments.length}
                </button>
              </div>
              {showComments&&(
                <div style={{borderTop:`0.5px solid ${C.sep}`,padding:"10px 14px"}}>
                  {post.comments.map(c=>(
                    <div key={c.id} style={{marginBottom:9,padding:"8px 12px",background:C.fill4,borderRadius:10}}>
                      <div style={{...fmt.caption,fontWeight:600,color:C.lbl,fontFamily:SF}}>{c.author}<span style={{color:C.lbl3,fontWeight:400}}> · {c.time}</span></div>
                      <div style={{...fmt.subhead,color:C.lbl2,fontFamily:SF,marginTop:2,lineHeight:1.45}}>{c.text}</div>
                    </div>
                  ))}
                  <div style={{display:"flex",gap:8,alignItems:"center",marginTop:4}}>
                    <input value={commentText} onChange={e=>setCommentText(e.target.value)}
                      placeholder="Añade un comentario…" onKeyDown={e=>e.key==="Enter"&&addComment(post.id)}
                      style={{flex:1,background:C.fill4,border:"none",borderRadius:20,padding:"8px 14px",fontSize:14,color:C.lbl,fontFamily:SF,outline:"none"}}/>
                    <button onClick={()=>addComment(post.id)} style={{background:accent,border:"none",borderRadius:"50%",width:32,height:32,cursor:"pointer",color:"#fff",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>↑</button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};
// ─── DEVELOPER APP ────────────────────────────────────────────────────────────
// ─── EMAIL HELPER ─────────────────────────────────────────────────────────────
const sendWelcomeEmail = async ({ toEmail, toName, key, role, group }) => {
  // emailjs is optional — silently skip if not installed
  try {
    const ejs = await import(/* @vite-ignore */ "@emailjs/browser").catch(()=>null);
    if (!ejs) return;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(key)}`;
    await ejs.default.send(
      import.meta.env.VITE_EMAILJS_SERVICE_ID || "service_schoollms",
      import.meta.env.VITE_EMAILJS_TEMPLATE_ID || "template_schoollms",
      { to_email: toEmail, to_name: toName, access_key: key,
        role_label: role === "student" ? "Alumno" : "Docente",
        group_info: group || "", qr_url: qrUrl },
      import.meta.env.VITE_EMAILJS_PUBLIC_KEY || ""
    );
  } catch (e) { /* email is optional, no-op */ }
};


// ─── HOLIDAY GRID (proper component — no hooks-in-map) ────────────────────────
// ─── COLLAPSIBLE LEFT SIDEBAR (shared by Director, Teacher, Student) ──────────
const AppSidebar=({open,onToggle,gradient,logoEmoji="🏫",logoLine1="Instituto",logoLine2="Educativo",
  userEmoji,userName,userSub,navItems=[],onLogout})=>{
  const {isMobile}=useBreakpoint();
  const SF2="-apple-system,'SF Pro Text','Helvetica Neue',sans-serif";

  // ── MOBILE: horizontal top bar ──────────────────────────────────────────────
  if(isMobile){
    // Flatten main items + their active subItems for the scrollable pill row
    const allItems=navItems.flatMap(item=>[
      item,
      ...(item.active&&item.subItems?.length>0 ? item.subItems : [])
    ]);
    return(
      <div style={{position:"sticky",top:0,zIndex:200,background:gradient,
        boxShadow:"0 2px 12px rgba(0,0,0,0.18)"}}>
        {/* Title row */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
          padding:"10px 14px 0",gap:10}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:20}}>{logoEmoji}</span>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:"#fff",fontFamily:SF2,lineHeight:1.2}}>{logoLine1} {logoLine2}</div>
              {userName&&<div style={{fontSize:10,color:"rgba(255,255,255,0.65)",fontFamily:SF2}}>{userEmoji} {userName}</div>}
            </div>
          </div>
          <button onClick={()=>{SFX.play("click");onLogout();}}
            style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.2)",
              borderRadius:8,padding:"5px 10px",color:"#fff",fontSize:11,fontWeight:600,
              cursor:"pointer",fontFamily:SF2,whiteSpace:"nowrap"}}>
            🚪 Salir
          </button>
        </div>
        {/* Horizontal scrollable tab pills */}
        <div style={{display:"flex",gap:6,padding:"8px 12px 10px",overflowX:"auto",
          scrollbarWidth:"none",WebkitOverflowScrolling:"touch"}}>
          {allItems.map(item=>{
            const active=item.active;
            const isSub=navItems.every(n=>n.id!==item.id); // is a sub-item
            return(
              <button key={item.id} onClick={item.onClick}
                style={{flexShrink:0,display:"flex",alignItems:"center",gap:5,
                  padding:isSub?"5px 12px":"6px 14px",
                  borderRadius:20,border:"none",cursor:"pointer",
                  background:active?"rgba(255,255,255,0.95)":"rgba(255,255,255,0.15)",
                  transition:"background 0.15s",position:"relative",whiteSpace:"nowrap"}}>
                <span style={{fontSize:isSub?13:15}}>{item.icon}</span>
                <span style={{fontSize:isSub?11:12,fontWeight:active?700:500,fontFamily:SF2,
                  color:active?"#000":"#fff"}}>{item.label}</span>
                {item.badge>0&&(
                  <span style={{background:"#ef4444",color:"#fff",fontSize:8,fontWeight:700,
                    borderRadius:8,padding:"1px 4px",fontFamily:SF2,marginLeft:2}}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── TABLET / DESKTOP: collapsible left sidebar ───────────────────────────────
  const W=open?220:60;
  return(
    <div style={{width:W,flexShrink:0,minHeight:"100vh",background:gradient,display:"flex",
      flexDirection:"column",position:"sticky",top:0,height:"100vh",overflowY:"auto",overflowX:"hidden",
      boxShadow:"2px 0 16px rgba(0,0,0,0.15)",transition:"width 0.22s cubic-bezier(.4,0,.2,1)",zIndex:150}}>
      {/* Header + toggle */}
      <div style={{padding:open?"18px 14px 12px":"12px 10px",borderBottom:"1px solid rgba(255,255,255,0.12)",
        display:"flex",alignItems:"center",justifyContent:open?"space-between":"center",gap:6,flexShrink:0}}>
        {open&&(
          <div style={{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:0}}>
            <div style={{width:34,height:34,borderRadius:10,background:"rgba(255,255,255,0.18)",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{logoEmoji}</div>
            <div style={{minWidth:0}}>
              <div style={{fontSize:12,fontWeight:700,color:"#fff",fontFamily:SF2,lineHeight:1.3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{logoLine1}</div>
              <div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.75)",fontFamily:SF2,lineHeight:1.3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{logoLine2}</div>
            </div>
          </div>
        )}
        <button onClick={onToggle}
          style={{width:30,height:30,borderRadius:8,background:"rgba(255,255,255,0.15)",border:"none",
            cursor:"pointer",color:"#fff",fontSize:13,display:"flex",alignItems:"center",
            justifyContent:"center",flexShrink:0,transition:"background 0.15s"}}
          onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.28)"}
          onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.15)"}>
          {open?"◀":"▶"}
        </button>
      </div>
      {/* User info */}
      {(userEmoji||userName)&&(
        <div style={{padding:open?"10px 14px":"10px 8px",borderBottom:"1px solid rgba(255,255,255,0.1)",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:open?10:0,justifyContent:open?"flex-start":"center"}}>
            <div style={{width:32,height:32,borderRadius:9,background:"rgba(255,255,255,0.18)",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{userEmoji}</div>
            {open&&<div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:600,color:"#fff",fontFamily:SF2,
                overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{userName}</div>
              {userSub&&<div style={{fontSize:10,color:"rgba(255,255,255,0.6)",fontFamily:SF2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{userSub}</div>}
            </div>}
          </div>
        </div>
      )}
      {/* Nav */}
      <div style={{flex:1,padding:open?"8px 6px":"8px 4px",overflowY:"auto"}}>
        {navItems.map(item=>{
          const active=item.active;
          return(
            <div key={item.id}>
              <button onClick={item.onClick}
                style={{width:"100%",display:"flex",alignItems:"center",
                  gap:open?10:0,justifyContent:open?"flex-start":"center",
                  padding:open?"8px 10px":"8px 6px",borderRadius:10,border:"none",cursor:"pointer",
                  marginBottom:2,background:active?"rgba(255,255,255,0.22)":"transparent",
                  transition:"background 0.15s",position:"relative"}}
                onMouseEnter={e=>{ if(!active) e.currentTarget.style.background="rgba(255,255,255,0.11)"; }}
                onMouseLeave={e=>{ if(!active) e.currentTarget.style.background="transparent"; }}>
                <span style={{fontSize:17,width:22,textAlign:"center",flexShrink:0,lineHeight:1}}>{item.icon}</span>
                {open&&<span style={{fontSize:13,fontWeight:active?700:500,color:"#fff",fontFamily:SF2,flex:1,textAlign:"left",whiteSpace:"nowrap"}}>{item.label}</span>}
                {item.badge>0&&(
                  <span style={{background:"#ef4444",color:"#fff",fontSize:9,fontWeight:700,borderRadius:8,
                    padding:"1px 5px",fontFamily:SF2,flexShrink:0,
                    position:open?"relative":"absolute",top:open?"auto":-4,right:open?"auto":-4}}>
                    {item.badge}
                  </span>
                )}
              </button>
              {open&&active&&item.subItems?.length>0&&(
                <div style={{paddingLeft:10,borderLeft:"2px solid rgba(255,255,255,0.15)",marginLeft:20,marginBottom:4}}>
                  {item.subItems.map(sub=>(
                    <button key={sub.id} onClick={sub.onClick}
                      style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"6px 10px",
                        borderRadius:8,border:"none",cursor:"pointer",marginBottom:1,
                        background:sub.active?"rgba(255,255,255,0.2)":"transparent",transition:"background 0.15s"}}
                      onMouseEnter={e=>{ if(!sub.active) e.currentTarget.style.background="rgba(255,255,255,0.09)"; }}
                      onMouseLeave={e=>{ if(!sub.active) e.currentTarget.style.background="transparent"; }}>
                      <span style={{fontSize:13,width:16,textAlign:"center",flexShrink:0}}>{sub.icon}</span>
                      <span style={{fontSize:12,fontWeight:sub.active?700:400,flex:1,textAlign:"left",
                        color:sub.active?"#fff":"rgba(255,255,255,0.75)",fontFamily:SF2,whiteSpace:"nowrap"}}>{sub.label}</span>
                      {sub.badge>0&&<span style={{background:"#ef4444",color:"#fff",fontSize:9,fontWeight:700,borderRadius:6,padding:"1px 4px",fontFamily:SF2}}>{sub.badge}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Logout */}
      <div style={{padding:open?"8px 6px 18px":"8px 4px 18px",borderTop:"1px solid rgba(255,255,255,0.1)",flexShrink:0}}>
        <button onClick={()=>{SFX.play("click");onLogout();}}
          style={{width:"100%",background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.18)",
            borderRadius:10,padding:open?"8px 12px":"8px 6px",color:"rgba(255,255,255,0.88)",
            fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:SF2,
            display:"flex",alignItems:"center",justifyContent:open?"flex-start":"center",gap:8,
            transition:"background 0.15s"}}
          onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.2)"}
          onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.1)"}>
          <span style={{fontSize:16}}>🚪</span>
          {open&&"Cerrar Sesión"}
        </button>
      </div>
    </div>
  );
};

const HolidayGrid = () => {
  const currentTheme = useHolidayTheme();
  // Find the current key by matching the theme object
  const currentKey = Object.keys(HOLIDAY_THEMES).find(
    k => HOLIDAY_THEMES[k] === currentTheme
  ) || _globalHolidayTheme;

  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
      {Object.entries(HOLIDAY_THEMES).map(([key,ht])=>{
        const isActive = currentKey === key;
        return (
          <div key={key}
            onClick={()=>{
              SFX.play("click");
              setGlobalHolidayTheme(key);
              pushNotification({title:"🎨 Tema aplicado",text:`Tema "${ht.name}" activado.`});
            }}
            style={{
              background: isActive
                ? (ht.gradient || `${ht.accent}30`)
                : `linear-gradient(135deg,${ht.bg}f0,${ht.bg}cc)`,
              border:`2.5px solid ${isActive ? ht.accent : "transparent"}`,
              borderRadius:16, padding:"16px 12px", cursor:"pointer",
              textAlign:"center", transition:"all 0.25s",
              boxShadow: isActive
                ? `0 4px 16px ${ht.accent}40`
                : "0 1px 4px rgba(0,0,0,0.08)"
            }}>
            <div style={{fontSize:32,marginBottom:8}}>{ht.emoji}</div>
            <div style={{fontWeight:700,fontSize:13,fontFamily:"-apple-system,sans-serif",
              color:isActive?"#fff":C.lbl,marginBottom:4}}>{ht.name}</div>
            {isActive && (
              <div style={{fontSize:10,fontWeight:700,color:"#fff",
                background:"rgba(255,255,255,0.3)",borderRadius:8,
                padding:"2px 8px",display:"inline-block",fontFamily:"-apple-system,sans-serif"}}>
                ✓ Activo
              </div>
            )}
            {ht.decorations?.length > 0 && (
              <div style={{fontSize:14,marginTop:6,opacity:0.7}}>
                {ht.decorations.slice(0,3).join(" ")}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const DeveloperApp=({state,setState,onLogout})=>{
  const [tab,setTab]=useState("teachers");
  const [newT,setNewT]=useState({name:"",contact:"",email:"",subjects:"",groups:""});
  const [newS,setNewS]=useState({name:"",parentEmail:"",parentContact:"",group:""});
  const [newG,setNewG]=useState({name:"",grade:"",section:"",teacherId:"",subject:""});
  const [tErr,setTErr]=useState("");
  const [sErr,setSErr]=useState("");
  const [gErr,setGErr]=useState("");
  const [newCycleName,setNewCycleName]=useState("");
  const [cErr,setCErr]=useState("");
  const [showTForm,setShowTForm]=useState(false);
  const [showSForm,setShowSForm]=useState(false);
  const [showGForm,setShowGForm]=useState(false);
  const devColor="#1a1a2e";

  const [editTeacher, setEditTeacher] = useState(null);
  const [editForm, setEditForm] = useState({ subjects:"", groups:"" });

  // ── Groups tab state (component level — Rules of Hooks) ──
  const [expandedGroup,setExpandedGroup]=useState(null);
  const [newSubjInput,setNewSubjInput]=useState("");
  const [newSubjTeacher,setNewSubjTeacher]=useState("");
  const [newSubjMascot,setNewSubjMascot]=useState("");

  // ── Assign tab: map studentId -> selected groupId string ──
  const [assignSelections,setAssignSelections]=useState({});

  const addTeacher=async()=>{
    const errs=[];
    if(!newT.name.trim())errs.push("Nombre requerido");
    if(!newT.email.trim())errs.push("Correo requerido");
    if(errs.length){setTErr(errs.join(". "));return;}
    const key=genTeacherKey(newT.name);
    const data={name:newT.name,contact:newT.contact,email:newT.email,
      subjects:newT.subjects.split(",").map(s=>s.trim()).filter(Boolean),
      groups:newT.groups.split(",").map(g=>g.trim()).filter(Boolean),
      key,avatar:newT.name.split(" ").filter((_,i)=>i<2).map(p=>p[0].toUpperCase()).join(""),
      color:[C.blue,C.green,C.purple,C.orange,C.pink][Math.floor(Math.random()*5)]};
    try {
      await addDoc(collection(db,"teachers"),{...data,_createdAt:serverTimestamp()});
      // Send welcome email to teacher
      sendWelcomeEmail({ toEmail:data.email, toName:data.name, key:data.key, role:"teacher", group:(data.groups||[]).join(", ") });
    } catch { setState(s=>({...s,teachers:[...s.teachers,{id:Date.now(),...data}]})); }
    setNewT({name:"",contact:"",email:"",subjects:"",groups:""});
    setShowTForm(false);setTErr("");
  };

  const saveTeacherEdit = async () => {
    if (!editTeacher) return;
    const subjects = editForm.subjects.split(",").map(s=>s.trim()).filter(Boolean);
    const groups = editForm.groups.split(",").map(g=>g.trim()).filter(Boolean);
    try {
      if (typeof editTeacher.id === "string") {
        await updateDoc(doc(db,"teachers",editTeacher.id), { subjects, groups });
      }
    } catch {}
    setState(s=>({...s,teachers:s.teachers.map(t=>t.id===editTeacher.id?{...t,subjects,groups}:t)}));
    setEditTeacher(null);
  };

  const deleteTeacherFb = async (t) => {
    if (!window.confirm(`¿Eliminar a ${t.name}?`)) return;
    try {
      if (typeof t.id === "string") await deleteDoc(doc(db,"teachers",t.id));
    } catch {}
    setState(s=>({...s,teachers:s.teachers.filter(tt=>tt.id!==t.id)}));
  };

  const addStudent=async()=>{
    const errs=[];
    const parts=newS.name.trim().split(/\s+/);
    if(parts.length<3)errs.push("Escribe nombre y ambos apellidos");
    if(!newS.parentEmail.trim())errs.push("Correo del padre requerido");
    if(!newS.group.trim())errs.push("Grupo requerido");
    if(errs.length){setSErr(errs.join(". "));return;}
    const key=genKey(newS.name,newS.group);
    const grp=newS.group.match(/(\d+)[°]?([A-Z])/i);
    const data={name:newS.name,group:newS.group,
      grade:grp?parseInt(grp[1]):0,section:grp?grp[2].toUpperCase():"A",
      parentEmail:newS.parentEmail,parentContact:newS.parentContact,key,
      avatar:parts.filter((_,i)=>i<2).map(p=>p[0].toUpperCase()).join(""),
      color:[C.blue,C.green,C.purple,C.orange][Math.floor(Math.random()*4)],
      attendance:[],subjects:{},participation:0,tabBoardLikes:0};
    try {
      await addDoc(collection(db,"students"),{...data,_createdAt:serverTimestamp()});
    } catch { setState(prev=>({...prev,students:[...prev.students,{id:Date.now(),...data}]})); }
    setNewS({name:"",parentEmail:"",parentContact:"",group:""});
    setShowSForm(false);setSErr("");
  };

  const deleteStudentFb = async (s) => {
    if (!window.confirm(`¿Eliminar a ${s.name}?`)) return;
    try {
      if (typeof s.id === "string") await deleteDoc(doc(db,"students",s.id));
    } catch {}
    setState(prev=>({...prev,students:prev.students.filter(ss=>ss.id!==s.id)}));
  };

  const addGroup=async()=>{
    const errs=[];
    if(!newG.name.trim())errs.push("Nombre requerido");
    if(errs.length){setGErr(errs.join(". "));return;}
    const data={
      name:newG.name.trim(),
      grade:parseInt(newG.grade)||0,
      section:newG.section.trim(),
      teacherId:newG.teacherId?Number(newG.teacherId):null,
      subject:newG.subject.trim()||"Sin materia",
      subjects:[],   // populated later via subjects management
      students:[],
    };
    const newId=Date.now();
    try {
      const ref=await addDoc(collection(db,"groups"),{...data,_createdAt:serverTimestamp()});
      setState(s=>({...s,groups:[...s.groups,{id:ref.id,...data}]}));
    } catch {
      setState(s=>({...s,groups:[...s.groups,{id:newId,...data}]}));
    }
    setNewG({name:"",grade:"",section:"",teacherId:"",subject:""});
    setShowGForm(false);setGErr("");
    SFX.play("success");
    pushNotification({title:"✅ Grupo creado",text:`Grupo "${data.name}" creado. Ahora agrega sus materias.`});
  };

  // Add a subject+teacher to a group and also persist to Firebase
  const addSubjectToGroup=(gId)=>{
    if(!newSubjInput.trim())return;
    const entry={subject:newSubjInput.trim(),teacherId:newSubjTeacher||null,mascot:newSubjMascot||null};
    setState(prev=>{
      const grp=prev.groups.find(g=>g.id===gId);
      if(!grp)return prev;
      const newSubjects=[...(grp.subjects||[]),entry];
      const newSubject=grp.subject||entry.subject;
      // Persist to Firebase
      if(typeof gId==="string"){
        updateDoc(doc(db,"groups",gId),{subjects:newSubjects,subject:newSubject}).catch(()=>{});
      }
      // Also push new subject to students already in the group
      const updStudents=prev.students.map(st=>{
        if(!(grp.students||[]).includes(st.id))return st;
        if(st.subjects?.[entry.subject])return st;
        const newSub={...(st.subjects||{}),[entry.subject]:{grade:8,tasks:[]}};
        if(typeof st.id==="string"){
          updateDoc(doc(db,"students",st.id),{subjects:newSub}).catch(()=>{});
        }
        return{...st,subjects:newSub};
      });
      return{...prev,
        groups:prev.groups.map(g=>g.id===gId?{...g,subjects:newSubjects,subject:newSubject}:g),
        students:updStudents,
      };
    });
    setNewSubjInput("");setNewSubjTeacher("");setNewSubjMascot("");
    SFX.play("success");
  };

  // Remove a subject from a group and persist to Firebase
  const removeSubjectFromGroup=(gId,subjName)=>{
    setState(prev=>{
      const grp=prev.groups.find(g=>g.id===gId);
      if(!grp)return prev;
      const newSubjects=(grp.subjects||[]).filter(s=>s.subject!==subjName);
      if(typeof gId==="string"){
        updateDoc(doc(db,"groups",gId),{subjects:newSubjects}).catch(()=>{});
      }
      // Cascade: remove this subject from all students in the group
      const updStudents=prev.students.map(st=>{
        if(!(grp.students||[]).includes(st.id))return st;
        if(!st.subjects?.[subjName])return st;
        const newSub={...st.subjects};
        delete newSub[subjName];
        if(typeof st.id==="string"){
          updateDoc(doc(db,"students",st.id),{subjects:newSub}).catch(()=>{});
        }
        return{...st,subjects:newSub};
      });
      return{...prev,
        groups:prev.groups.map(g=>g.id===gId?{...g,subjects:newSubjects}:g),
        students:updStudents,
      };
    });
  };

  // Assign a student to a group and auto-apply that group's subjects
  // Delete a group: remove from Firebase, unassign all students (clear group + subjects from this group)
  const deleteGroup=async(g)=>{
    if(!window.confirm(`¿Eliminar el grupo "${g.name}"? Los alumnos quedarán sin grupo asignado.`))return;
    const groupSubjectNames=(g.subjects||[]).map(s=>s.subject);
    // Update all students in this group
    setState(prev=>{
      const updStudents=prev.students.map(st=>{
        if(!(g.students||[]).includes(st.id))return st;
        // Remove subjects that came from this group
        const newSub={...st.subjects};
        groupSubjectNames.forEach(sn=>delete newSub[sn]);
        const updated={...st,group:"Sin grupo",subjects:newSub};
        if(typeof st.id==="string"){
          updateDoc(doc(db,"students",st.id),{group:"Sin grupo",subjects:newSub}).catch(()=>{});
        }
        return updated;
      });
      return{...prev,
        groups:prev.groups.filter(grp=>grp.id!==g.id),
        students:updStudents,
      };
    });
    if(typeof g.id==="string"){
      deleteDoc(doc(db,"groups",g.id)).catch(()=>{});
    }
    SFX.play("alert");
    pushNotification({title:"🗑️ Grupo eliminado",text:`Grupo "${g.name}" eliminado. ${(g.students||[]).length} alumno(s) quedaron sin grupo.`});
  };

  const assignStudentToGroup=async(student,grpId)=>{
    const grp=state.groups.find(g=>String(g.id)===String(grpId));
    if(!grp||!student)return;
    const newStudents=[...(grp.students||[]).filter(id=>id!==student.id),student.id];
    // Build subjects from group
    const autoSubjs=(grp.subjects||[]).reduce((acc,{subject})=>({
      ...acc,[subject]:{grade:8,tasks:[]}
    }),{});
    const finalSubjects={...autoSubjs,...(student.subjects||{})};
    // Persist to Firebase
    if(typeof grp.id==="string"){
      updateDoc(doc(db,"groups",grp.id),{students:newStudents}).catch(()=>{});
    }
    if(typeof student.id==="string"){
      updateDoc(doc(db,"students",student.id),{group:grp.name,subjects:finalSubjects}).catch(()=>{});
    }
    setState(prev=>({...prev,
      students:prev.students.map(st=>st.id===student.id
        ?{...st,group:grp.name,subjects:finalSubjects}
        :st),
      groups:prev.groups.map(g=>g.id===grp.id?{...g,students:newStudents}:g),
    }));
    setAssignSelections(prev=>({...prev,[student.id]:""}));
    SFX.play("success");
    const subjList=(grp.subjects||[]).map(s=>s.subject).join(", ")||"sin materias";
    pushNotification({title:"✅ Alumno asignado",
      text:`${student.name} → ${grp.name} · Materias: ${subjList}`});
  };

  const addCycle=async()=>{
    if(!newCycleName.trim()){setCErr("Escribe el nombre del ciclo");return;}
    try {
      await addDoc(collection(db,"cycles"),{name:newCycleName.trim(),active:false,_createdAt:serverTimestamp()});
    } catch { setState(s=>({...s,cycles:[...s.cycles,{id:Date.now(),name:newCycleName.trim(),active:false}]})); }
    setNewCycleName("");setCErr("");
  };

  const setActiveCycle=async(id)=>{
    try {
      const snap = await getDocs(collection(db,"cycles"));
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.update(d.ref,{active:d.id===id}));
      await batch.commit();
    } catch {}
    setState(s=>({...s,activeCycle:id}));
  };

  return(
    <div style={{background:C.bg2,minHeight:"100vh",fontFamily:SF}}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{background:devColor,padding:"0 0 1px"}}>
        <div style={{padding:"20px 16px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",fontFamily:SF,marginBottom:3}}>Panel de Desarrollo</div>
            <div style={{fontSize:22,fontWeight:700,color:"#fff",letterSpacing:"-0.4px",fontFamily:SFD}}>Administración del Sistema</div>
          </div>
          <button onClick={onLogout} style={{background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:10,padding:"7px 14px",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:SF}}>Salir</button>
        </div>
        <div style={{display:"flex",gap:0,padding:"0 16px",borderTop:"1px solid rgba(255,255,255,0.1)",overflowX:"auto",scrollbarWidth:"none"}}>
          {[{id:"teachers",label:"Docentes"},{id:"students",label:"Alumnos"},{id:"groups",label:"Grupos"},{id:"cycles",label:"Ciclos"},{id:"temas",label:"🎨 Temas"},{id:"assign",label:"📋 Asignar"}].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"12px 16px",background:"none",border:"none",cursor:"pointer",fontFamily:SF,fontSize:13,fontWeight:600,flexShrink:0,color:tab===t.id?"#fff":"rgba(255,255,255,0.45)",borderBottom:tab===t.id?"2px solid #fff":"2px solid transparent",transition:"all 0.15s"}}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="page-pad" style={{animation:"fadeUp 0.3s ease"}}>

        {tab==="teachers"&&(
          <>
            <Btn onPress={()=>setShowTForm(!showTForm)} full color={devColor} variant={showTForm?"ghost":"filled"} style={{marginBottom:12}}>
              {showTForm?"Cancelar":"+ Registrar Docente"}
            </Btn>
            {showTForm&&(
              <Card style={{padding:16,marginBottom:14}}>
                <div style={{...fmt.headline,color:C.lbl,fontFamily:SF,marginBottom:12}}>Nuevo Docente</div>
                <Input label="Nombre Completo *" placeholder="Prof. Ana Ramírez" value={newT.name} onChange={v=>setNewT(t=>({...t,name:v}))}/>
                <Input label="Correo Electrónico *" placeholder="prof@inst.edu" value={newT.email} onChange={v=>setNewT(t=>({...t,email:v}))} type="email"/>
                <Input label="Número de Contacto" placeholder="55-1234-5678" value={newT.contact} onChange={v=>setNewT(t=>({...t,contact:v}))}/>
                <Input label="Materias (separar por coma)" placeholder="Matemáticas, Álgebra" value={newT.subjects} onChange={v=>setNewT(t=>({...t,subjects:v}))}/>
                <Input label="Grupos Asignados" placeholder="3°A, 3°B" value={newT.groups} onChange={v=>setNewT(t=>({...t,groups:v}))}/>
                {tErr&&<div style={{background:`${C.red}12`,borderRadius:10,padding:"10px 14px",color:C.red,fontSize:13,marginBottom:10,fontFamily:SF}}>{tErr}</div>}
                <Btn onPress={addTeacher} full color={devColor}>Generar Clave y Registrar</Btn>
              </Card>
            )}
            <Sec title={`Docentes registrados — ${state.teachers.length}`}>
              {state.teachers.length === 0 && (
                <div style={{padding:"20px 16px",textAlign:"center",color:C.lbl3,fontSize:14,fontFamily:SF}}>Sin docentes registrados</div>
              )}
              {state.teachers.map((t,i)=>(
                <div key={t.id}>
                  <div style={{padding:"12px 16px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
                      <Ava initials={t.avatar} color={t.color} size={42}/>
                      <div style={{flex:1}}>
                        <div style={{...fmt.callout,fontWeight:600,color:C.lbl,fontFamily:SF}}>{t.name}</div>
                        <div style={{...fmt.caption,color:C.lbl2,fontFamily:SF,marginTop:1}}>{t.email}</div>
                        <div style={{fontFamily:"'SF Mono','Menlo',monospace",fontSize:11,color:devColor,marginTop:2,opacity:0.7}}>{t.key}</div>
                      </div>
                      <div style={{display:"flex",gap:6}}>
                        <button onClick={()=>{setEditTeacher(t);setEditForm({subjects:(t.subjects||[]).join(", "),groups:(t.groups||[]).join(", ")});}}
                          style={{background:`${C.blue}15`,border:"none",borderRadius:8,padding:"5px 10px",color:C.blue,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:SF}}>Editar</button>
                        <button onClick={()=>deleteTeacherFb(t)}
                          style={{background:`${C.red}15`,border:"none",borderRadius:8,padding:"5px 10px",color:C.red,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:SF}}>✕</button>
                      </div>
                    </div>
                    {/* Subjects and groups pills */}
                    <div style={{display:"flex",flexWrap:"wrap",gap:6,paddingLeft:54}}>
                      {(t.subjects||[]).map(s=>(
                        <span key={s} style={{fontSize:11,fontWeight:600,color:C.blue,background:`${C.blue}15`,padding:"2px 8px",borderRadius:20,fontFamily:SF}}>📚 {s}</span>
                      ))}
                      {(t.groups||[]).map(g=>(
                        <span key={g} style={{fontSize:11,fontWeight:600,color:C.purple,background:`${C.purple}15`,padding:"2px 8px",borderRadius:20,fontFamily:SF}}>👥 {g}</span>
                      ))}
                      {(!t.subjects?.length && !t.groups?.length) && (
                        <span style={{fontSize:11,color:C.lbl3,fontFamily:SF,fontStyle:"italic"}}>Sin materias ni grupos asignados</span>
                      )}
                    </div>
                  </div>
                  {i<state.teachers.length-1&&<Div indent={70}/>}
                </div>
              ))}
            </Sec>
            {/* Edit teacher modal */}
            <Modal open={!!editTeacher} onClose={()=>setEditTeacher(null)} title={`Editar: ${editTeacher?.name?.split(" ")[0]}`}>
              <div style={{marginBottom:8,fontSize:13,color:C.lbl2,fontFamily:SF}}>Separa cada materia o grupo con coma.</div>
              <Input label="📚 Materias (separar con coma)" placeholder="Matemáticas, Álgebra, Geometría" value={editForm.subjects} onChange={v=>setEditForm(f=>({...f,subjects:v}))}/>
              <Input label="👥 Grupos asignados (separar con coma)" placeholder="3°A, 3°B, 2°A" value={editForm.groups} onChange={v=>setEditForm(f=>({...f,groups:v}))}/>
              <Btn onPress={saveTeacherEdit} full color={devColor}>Guardar cambios</Btn>
            </Modal>
          </>
        )}

        {tab==="students"&&(
          <>
            <Btn onPress={()=>setShowSForm(!showSForm)} full color={devColor} variant={showSForm?"ghost":"filled"} style={{marginBottom:12}}>
              {showSForm?"Cancelar":"+ Registrar Alumno"}
            </Btn>
            {showSForm&&(
              <Card style={{padding:16,marginBottom:14}}>
                <div style={{...fmt.headline,color:C.lbl,fontFamily:SF,marginBottom:12}}>Nuevo Alumno</div>
                <div style={{background:`${C.blue}10`,borderRadius:10,padding:"10px 14px",marginBottom:12}}>
                  <div style={{...fmt.caption,color:C.blue,fontFamily:SF}}>Se generará automáticamente una clave de acceso para el alumno.</div>
                </div>
                <Input label="Nombre Completo * (nombre + 2 apellidos)" placeholder="María González Hernández" value={newS.name} onChange={v=>setNewS(s=>({...s,name:v}))}/>
                <Input label="Correo del Padre / Tutor *" placeholder="padre@correo.com" value={newS.parentEmail} onChange={v=>setNewS(s=>({...s,parentEmail:v}))} type="email"/>
                <Input label="Contacto del Padre" placeholder="55-0000-0000" value={newS.parentContact} onChange={v=>setNewS(s=>({...s,parentContact:v}))}/>
                <Input label="Grupo *" placeholder="3°A" value={newS.group} onChange={v=>setNewS(s=>({...s,group:v}))}/>
                {sErr&&<div style={{background:`${C.red}12`,borderRadius:10,padding:"10px 14px",color:C.red,fontSize:13,marginBottom:10,fontFamily:SF}}>{sErr}</div>}
                <Btn onPress={addStudent} full color={devColor}>Generar Clave y Registrar</Btn>
              </Card>
            )}
            <Sec title={`Alumnos registrados — ${state.students.length}`}>
              {state.students.length === 0 && (
                <div style={{padding:"20px 16px",textAlign:"center",color:C.lbl3,fontSize:14,fontFamily:SF}}>Sin alumnos registrados</div>
              )}
              {state.students.map((s,i)=>(
                <div key={s.id}>
                  <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px"}}>
                    <Ava initials={s.avatar} color={s.color} size={42}/>
                    <div style={{flex:1}}>
                      <div style={{...fmt.callout,fontWeight:600,color:C.lbl,fontFamily:SF}}>{s.name}</div>
                      <div style={{...fmt.caption,color:C.lbl2,fontFamily:SF,marginTop:1}}>Grupo {s.group}</div>
                      <div style={{fontFamily:"'SF Mono','Menlo',monospace",fontSize:11,color:C.green,marginTop:2,opacity:0.85}}>{s.key}</div>
                    </div>
                    <button onClick={()=>deleteStudentFb(s)}
                      style={{background:`${C.red}15`,border:"none",borderRadius:8,padding:"5px 10px",color:C.red,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:SF}}>✕</button>
                  </div>
                  {i<state.students.length-1&&<Div indent={70}/>}
                </div>
              ))}
            </Sec>
          </>
        )}

        {tab==="groups"&&(
          <>
            <Btn onPress={()=>setShowGForm(!showGForm)} full color={devColor}
              variant={showGForm?"ghost":"filled"} style={{marginBottom:12}}>
              {showGForm?"Cancelar":"+ Crear Grupo"}
            </Btn>

            {showGForm&&(
              <Card style={{padding:16,marginBottom:14}}>
                <div style={{...fmt.headline,color:C.lbl,fontFamily:SF,marginBottom:12}}>
                  Nuevo Grupo
                </div>
                <Input label="Nombre del Grupo *" placeholder="3°A"
                  value={newG.name} onChange={v=>setNewG(g=>({...g,name:v}))}/>
                <Input label="Grado" placeholder="3"
                  value={newG.grade} onChange={v=>setNewG(g=>({...g,grade:v}))}/>
                <Input label="Sección" placeholder="A"
                  value={newG.section} onChange={v=>setNewG(g=>({...g,section:v}))}/>
                <Input label="Materia principal" placeholder="Matemáticas"
                  value={newG.subject} onChange={v=>setNewG(g=>({...g,subject:v}))}/>
                <div style={{background:C.fill4,borderRadius:12,padding:"10px 14px",marginBottom:10}}>
                  <div style={{fontSize:11,color:C.lbl2,fontWeight:600,textTransform:"uppercase",
                    letterSpacing:"0.05em",marginBottom:4,fontFamily:SF}}>Docente Principal</div>
                  <select value={newG.teacherId} onChange={e=>setNewG(g=>({...g,teacherId:e.target.value}))}
                    style={{width:"100%",background:"transparent",border:"none",fontSize:15,
                      color:C.lbl,fontFamily:SF,outline:"none"}}>
                    <option value="">Sin asignar</option>
                    {state.teachers.map(t=>(
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                {gErr&&(
                  <div style={{background:`${C.red}12`,borderRadius:10,padding:"10px 14px",
                    color:C.red,fontSize:13,marginBottom:10,fontFamily:SF}}>{gErr}</div>
                )}
                <Btn onPress={addGroup} full color={devColor}>Crear Grupo</Btn>
              </Card>
            )}

            <div style={{...fmt.footnote,color:C.lbl2,textTransform:"uppercase",letterSpacing:"0.05em",
              fontFamily:SF,marginBottom:8,paddingLeft:4}}>
              {state.groups.length} grupo{state.groups.length!==1?"s":""} — toca para gestionar materias
            </div>

            {state.groups.map(g=>{
              const isExp=expandedGroup===g.id;
              const studs=state.students.filter(s=>(g.students||[]).includes(s.id));
              const groupSubjects=g.subjects||[];
              return(
                <Card key={g.id} style={{marginBottom:10,overflow:"hidden"}}>
                  {/* Group header row */}
                  <div onClick={()=>setExpandedGroup(isExp?null:g.id)}
                    style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",cursor:"pointer"}}>
                    <div style={{width:44,height:44,borderRadius:12,background:`${devColor}15`,
                      display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <span style={{fontSize:13,fontWeight:800,color:devColor,fontFamily:SF}}>{g.name}</span>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{...fmt.callout,fontWeight:600,color:C.lbl,fontFamily:SF}}>{g.name}</div>
                      <div style={{fontSize:11,color:C.lbl2,fontFamily:SF,marginTop:2}}>
                        {studs.length} alumno{studs.length!==1?"s":""} ·{" "}
                        {groupSubjects.length>0
                          ? groupSubjects.map(s=>s.subject).join(", ")
                          : <span style={{color:C.orange}}>Sin materias — agrega aquí</span>}
                      </div>
                    </div>
                    <span style={{fontSize:16,color:C.lbl2,display:"inline-block",
                      transform:isExp?"rotate(90deg)":"rotate(0deg)",transition:"transform 0.2s"}}>›</span>
                    <button onClick={e=>{e.stopPropagation();deleteGroup(g);}}
                      style={{width:28,height:28,borderRadius:"50%",background:`${C.red}12`,
                        border:`1px solid ${C.red}20`,cursor:"pointer",color:C.red,fontSize:13,
                        display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginLeft:4}}>
                      🗑️
                    </button>
                  </div>

                  {/* Expanded: subjects list + add form */}
                  {isExp&&(
                    <div style={{borderTop:`0.5px solid ${C.sep}`,padding:"12px 16px"}}>
                      <div style={{fontSize:12,fontWeight:700,color:C.lbl2,textTransform:"uppercase",
                        letterSpacing:"0.05em",fontFamily:SF,marginBottom:10}}>
                        📚 Materias asignadas al grupo
                      </div>
                      {groupSubjects.length===0&&(
                        <div style={{textAlign:"center",padding:"10px 0 14px",color:C.lbl3,
                          fontSize:13,fontFamily:SF}}>
                          Sin materias. Agrégalas abajo.
                        </div>
                      )}
                      {groupSubjects.map((subj,si)=>{
                        const tch=state.teachers.find(t=>String(t.id)===String(subj.teacherId));
                        const MASCOT_EMOJIS={owl:"🦉",bear:"🐻",whale:"🐋",elephant:"🐘",giraffe:"🦒",lion:"🦁",fox:"🦊",rabbit:"🐰",dragon:"🐲",cat:"🐱"};
                        const mascotEmoji=subj.mascot?MASCOT_EMOJIS[subj.mascot]||"📖":"📖";
                        return(
                          <div key={si} style={{display:"flex",alignItems:"center",gap:10,
                            padding:"8px 12px",background:C.fill4,borderRadius:10,marginBottom:6}}>
                            <span style={{fontSize:20}}>{mascotEmoji}</span>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:13,fontWeight:600,color:C.lbl,fontFamily:SF}}>
                                {subj.subject}
                              </div>
                              <div style={{fontSize:11,color:C.lbl2,fontFamily:SF,marginTop:1}}>
                                {tch?tch.name:"Sin docente asignado"}
                                {subj.mascot?` · Mascota: ${mascotEmoji}`:""}
                              </div>
                            </div>
                            <button onClick={()=>removeSubjectFromGroup(g.id,subj.subject)}
                              style={{width:26,height:26,borderRadius:"50%",background:`${C.red}12`,
                                border:`1px solid ${C.red}20`,cursor:"pointer",color:C.red,fontSize:13,
                                display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                              ✕
                            </button>
                          </div>
                        );
                      })}

                      {/* Add subject form */}
                      <div style={{marginTop:12,padding:"12px",background:`${devColor}06`,
                        borderRadius:10,border:`1px dashed ${devColor}25`}}>
                        <div style={{fontSize:11,fontWeight:700,color:devColor,fontFamily:SF,
                          marginBottom:8,textTransform:"uppercase",letterSpacing:"0.04em"}}>
                          ➕ Agregar materia
                        </div>
                        <input value={newSubjInput} onChange={e=>setNewSubjInput(e.target.value)}
                          placeholder="Nombre de la materia (ej: Matemáticas)"
                          onKeyDown={e=>e.key==="Enter"&&addSubjectToGroup(g.id)}
                          style={{width:"100%",background:"#fff",border:`1px solid ${C.g4}`,
                            borderRadius:8,padding:"9px 12px",fontSize:13,color:C.lbl,
                            fontFamily:SF,outline:"none",marginBottom:8,boxSizing:"border-box"}}/>
                        {/* Mascot animal selector */}
                        <div style={{marginBottom:8}}>
                          <div style={{fontSize:11,color:C.lbl2,fontFamily:SF,marginBottom:6}}>
                            🐾 Mascota de la materia (la verán los alumnos)
                          </div>
                          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                            {[
                              {id:"owl",    emoji:"🦉", label:"Búho"},
                              {id:"bear",   emoji:"🐻", label:"Oso"},
                              {id:"whale",  emoji:"🐋", label:"Ballena"},
                              {id:"elephant",emoji:"🐘",label:"Elefante"},
                              {id:"giraffe",emoji:"🦒",label:"Jirafa"},
                              {id:"lion",   emoji:"🦁", label:"León"},
                              {id:"fox",    emoji:"🦊", label:"Zorro"},
                              {id:"rabbit", emoji:"🐰", label:"Conejo"},
                              {id:"dragon", emoji:"🐲", label:"Dragón"},
                              {id:"cat",    emoji:"🐱", label:"Gato"},
                            ].map(a=>(
                              <button key={a.id} onClick={()=>setNewSubjMascot(a.id===newSubjMascot?"":a.id)}
                                style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,
                                  padding:"6px 8px",borderRadius:8,border:`2px solid ${newSubjMascot===a.id?devColor:"transparent"}`,
                                  background:newSubjMascot===a.id?`${devColor}12`:"#fff",cursor:"pointer",
                                  transition:"all 0.15s",minWidth:46}}>
                                <span style={{fontSize:20}}>{a.emoji}</span>
                                <span style={{fontSize:9,color:newSubjMascot===a.id?devColor:C.lbl2,fontFamily:SF,fontWeight:600}}>{a.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                        <div style={{display:"flex",gap:8,alignItems:"center"}}>
                          <select value={newSubjTeacher} onChange={e=>setNewSubjTeacher(e.target.value)}
                            style={{flex:1,background:"#fff",border:`1px solid ${C.g4}`,borderRadius:8,
                              padding:"9px 10px",fontSize:13,color:C.lbl,fontFamily:SF,outline:"none"}}>
                            <option value="">Sin docente</option>
                            {state.teachers.map(t=>(
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                          <Btn onPress={()=>addSubjectToGroup(g.id)} color={devColor}
                            disabled={!newSubjInput.trim()}>Agregar</Btn>
                        </div>
                      </div>

                      {/* Students in this group */}
                      {studs.length>0&&(
                        <div style={{marginTop:12}}>
                          <div style={{fontSize:11,fontWeight:600,color:C.lbl2,textTransform:"uppercase",
                            letterSpacing:"0.05em",fontFamily:SF,marginBottom:6}}>Alumnos en el grupo</div>
                          {studs.map((st,i)=>(
                            <div key={st.id} style={{display:"flex",alignItems:"center",gap:10,
                              padding:"7px 0",borderBottom:i<studs.length-1?`0.5px solid ${C.sep}`:"none"}}>
                              <Ava initials={st.avatar} color={st.color} size={32}/>
                              <div style={{flex:1}}>
                                <div style={{fontSize:13,fontWeight:600,color:C.lbl,fontFamily:SF}}>{st.name}</div>
                                <div style={{fontSize:11,color:C.lbl2,fontFamily:SF}}>
                                  {Object.keys(st.subjects||{}).join(", ")||"Sin materias"}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </>
        )}

        {tab==="cycles"&&(
          <>
            <Card style={{padding:16,marginBottom:16,background:`${devColor}08`,border:`1px solid ${devColor}20`}}>
              <div style={{fontSize:13,fontWeight:700,color:devColor,fontFamily:SF,marginBottom:4}}>🔄 Gestión de Ciclos Escolares</div>
              <div style={{fontSize:12,color:C.lbl2,fontFamily:SF,lineHeight:1.5}}>Aquí puedes crear nuevos ciclos y cambiar el ciclo activo. El ciclo activo determina el contexto de toda la plataforma.</div>
            </Card>

            {/* Parciales config */}
            <Card style={{padding:16,marginBottom:16}}>
              <div style={{fontSize:13,fontWeight:700,color:devColor,fontFamily:SF,marginBottom:4}}>📊 Número de Parciales</div>
              <div style={{fontSize:12,color:C.lbl2,fontFamily:SF,lineHeight:1.5,marginBottom:12}}>
                Define cuántos parciales se evaluarán por materia (sin contar calificación final). Esto se verá reflejado en el panel de profesores y alumnos.
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                {[1,2,3,4,5].map(n=>(
                  <button key={n} onClick={()=>setState(s=>({...s,numParciales:n}))}
                    style={{width:44,height:44,borderRadius:12,border:`2px solid ${(state.numParciales||3)===n?devColor:C.g4}`,
                      background:(state.numParciales||3)===n?devColor:"#fff",
                      color:(state.numParciales||3)===n?"#fff":C.lbl,
                      fontSize:16,fontWeight:700,cursor:"pointer",fontFamily:SF,transition:"all 0.15s"}}>
                    {n}
                  </button>
                ))}
              </div>
              <div style={{fontSize:11,color:C.lbl3,fontFamily:SF,marginTop:8}}>
                Parciales activos: <strong>{state.numParciales||3}</strong> · Calificación final siempre visible
              </div>
            </Card>
            <Sec title={`Ciclos Registrados — ${state.cycles.length}`}>
              {state.cycles.map((c,i)=>(
                <div key={c.id}>
                  <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px"}}>
                    <div style={{width:40,height:40,borderRadius:10,background:`${devColor}10`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🎓</div>
                    <div style={{flex:1}}>
                      <div style={{...fmt.callout,fontWeight:600,color:C.lbl,fontFamily:SF}}>{c.name}</div>
                      {c.id===state.activeCycle&&<div style={{display:"flex",alignItems:"center",gap:5,marginTop:2}}><div style={{width:7,height:7,borderRadius:"50%",background:C.green}}/><span style={{fontSize:12,color:C.green,fontWeight:600,fontFamily:SF}}>Ciclo Activo</span></div>}
                    </div>
                    {c.id!==state.activeCycle&&(
                      <button onClick={()=>setActiveCycle(c.id)} style={{background:`${devColor}12`,border:`1px solid ${devColor}30`,borderRadius:8,padding:"5px 12px",color:devColor,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:SF}}>Activar</button>
                    )}
                  </div>
                  {i<state.cycles.length-1&&<Div indent={68}/>}
                </div>
              ))}
            </Sec>
            <Card style={{padding:14,marginBottom:16}}>
              <div style={{fontSize:13,fontWeight:600,color:C.lbl2,fontFamily:SF,marginBottom:10,textTransform:"uppercase",letterSpacing:"0.05em"}}>Nuevo Ciclo Escolar</div>
              <Input label="Nombre del ciclo" placeholder="2026–2027" value={newCycleName} onChange={setNewCycleName}/>
              {cErr&&<div style={{background:`${C.red}12`,borderRadius:10,padding:"10px 14px",color:C.red,fontSize:13,marginBottom:10,fontFamily:SF}}>{cErr}</div>}
              <Btn onPress={addCycle} full color={devColor}>+ Crear Ciclo Escolar</Btn>
            </Card>
          </>
        )}

        {/* ─── TEMAS FESTIVOS ─── */}
        {tab==="temas"&&(
          <div>
            <Card style={{padding:14,marginBottom:16,background:`linear-gradient(135deg,${devColor}15,${devColor}05)`}}>
              <div style={{fontSize:13,fontWeight:700,color:devColor,fontFamily:SF,marginBottom:4}}>🎨 Temas de Días Festivos</div>
              <div style={{fontSize:12,color:C.lbl2,fontFamily:SF,lineHeight:1.5}}>
                Selecciona un tema para cambiar la apariencia de toda la plataforma. Ideal para fechas especiales como Día de Muertos, Navidad, Independencia y más.
              </div>
            </Card>
            <HolidayGrid/>
            <Card style={{padding:14}}>
              <div style={{fontSize:12,color:C.lbl2,fontFamily:SF,lineHeight:1.6}}>
                💡 <strong>Tip:</strong> Los temas se aplican inmediatamente a toda la plataforma para todos los usuarios. El tema "Normal" restaura los colores estándar.
              </div>
            </Card>
          </div>
        )}

        {/* ─── ASIGNACIÓN DE GRUPOS ─── */}
        {tab==="assign"&&(()=>{
          const unassigned=state.students.filter(s=>
            !state.groups.find(g=>(g.students||[]).includes(s.id))
          );
          return(
            <div>
              <Card style={{padding:14,marginBottom:16,background:`${C.orange}10`,border:`1px solid ${C.orange}20`}}>
                <div style={{fontSize:13,fontWeight:700,color:C.orange,fontFamily:SF,marginBottom:4}}>
                  📋 Asignación de Grupos y Materias
                </div>
                <div style={{fontSize:12,color:C.lbl2,fontFamily:SF,lineHeight:1.5}}>
                  Al asignar un alumno a un grupo, se le asignarán automáticamente las materias
                  configuradas en ese grupo. Asegúrate de haber agregado las materias al grupo primero.
                </div>
              </Card>

              {unassigned.length===0?(
                <div style={{textAlign:"center",padding:"32px 16px"}}>
                  <div style={{fontSize:40,marginBottom:10}}>✅</div>
                  <div style={{fontSize:16,fontWeight:600,color:C.lbl,fontFamily:SF,marginBottom:4}}>
                    ¡Todos asignados!
                  </div>
                  <div style={{fontSize:13,color:C.lbl2,fontFamily:SF}}>
                    Todos los alumnos tienen grupo asignado.
                  </div>
                </div>
              ):(
                <>
                  <div style={{...fmt.footnote,color:C.red,textTransform:"uppercase",
                    letterSpacing:"0.05em",fontFamily:SF,marginBottom:8,paddingLeft:4}}>
                    {unassigned.length} alumno{unassigned.length!==1?"s":""} sin grupo
                  </div>
                  {unassigned.map(s=>{
                    const selGrpId=assignSelections[s.id]||"";
                    const previewGrp=state.groups.find(g=>String(g.id)===String(selGrpId));
                    const previewSubjects=previewGrp?.subjects||[];
                    return(
                      <Card key={s.id} style={{marginBottom:10,padding:14}}>
                        {/* Student header */}
                        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                          <Ava initials={s.avatar} color={s.color} size={44}/>
                          <div style={{flex:1}}>
                            <div style={{...fmt.callout,fontWeight:600,color:C.lbl,fontFamily:SF}}>
                              {s.name}
                            </div>
                            <div style={{fontSize:11,fontWeight:600,color:C.red,
                              background:`${C.red}12`,borderRadius:5,padding:"2px 8px",
                              display:"inline-block",fontFamily:SF,marginTop:3}}>
                              ⚠️ Sin grupo asignado
                            </div>
                          </div>
                        </div>

                        {/* Group selector */}
                        <div style={{marginBottom:previewSubjects.length>0?10:0}}>
                          <div style={{fontSize:11,fontWeight:600,color:C.lbl2,fontFamily:SF,
                            textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:6}}>
                            Seleccionar grupo
                          </div>
                          <div style={{display:"flex",gap:8,alignItems:"center"}}>
                            <select value={selGrpId}
                              onChange={e=>setAssignSelections(prev=>({...prev,[s.id]:e.target.value}))}
                              style={{flex:1,background:C.fill4,border:`1px solid ${C.g4}`,
                                borderRadius:10,padding:"9px 12px",fontSize:14,
                                color:C.lbl,fontFamily:SF,outline:"none"}}>
                              <option value="">Seleccionar grupo…</option>
                              {state.groups.map(g=>(
                                <option key={g.id} value={g.id}>
                                  {g.name}{(g.subjects||[]).length>0
                                    ? ` (${(g.subjects||[]).length} materias)`
                                    : " — sin materias"}
                                </option>
                              ))}
                            </select>
                            <Btn onPress={()=>assignStudentToGroup(s,selGrpId)}
                              color={C.green} disabled={!selGrpId}>
                              Asignar
                            </Btn>
                          </div>
                        </div>

                        {/* Preview of subjects that will be assigned */}
                        {previewSubjects.length>0&&(
                          <div style={{marginTop:10,padding:"10px 12px",background:`${C.green}08`,
                            borderRadius:10,border:`1px solid ${C.green}20`}}>
                            <div style={{fontSize:11,fontWeight:700,color:C.green,fontFamily:SF,
                              marginBottom:8,textTransform:"uppercase",letterSpacing:"0.04em"}}>
                              ✅ Materias que se asignarán automáticamente
                            </div>
                            {previewSubjects.map((subj,i)=>{
                              const tch=state.teachers.find(t=>String(t.id)===String(subj.teacherId));
                              return(
                                <div key={i} style={{display:"flex",alignItems:"center",gap:8,
                                  padding:"5px 0",borderBottom:i<previewSubjects.length-1?`0.5px solid ${C.sep}`:"none"}}>
                                  <span style={{fontSize:14}}>📖</span>
                                  <div style={{flex:1}}>
                                    <span style={{fontSize:13,fontWeight:600,color:C.lbl,fontFamily:SF}}>
                                      {subj.subject}
                                    </span>
                                    {tch&&(
                                      <span style={{fontSize:11,color:C.lbl2,fontFamily:SF,
                                        marginLeft:6}}>
                                        — {tch.name}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {selGrpId&&previewSubjects.length===0&&(
                          <div style={{marginTop:8,padding:"8px 12px",background:`${C.orange}10`,
                            borderRadius:8,border:`1px solid ${C.orange}20`}}>
                            <div style={{fontSize:12,color:C.orange,fontFamily:SF}}>
                              ⚠️ Este grupo no tiene materias configuradas. El alumno se asignará
                              sin materias. Ve a la pestaña <strong>Grupos</strong> para agregar materias.
                            </div>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </>
              )}

              {/* All students overview */}
              <div style={{...fmt.footnote,color:C.lbl2,textTransform:"uppercase",
                letterSpacing:"0.05em",fontFamily:SF,margin:"20px 0 8px",paddingLeft:4}}>
                Todos los alumnos
              </div>
              <Sec>
                {state.students.map((s,i)=>{
                  const grp=state.groups.find(g=>(g.students||[]).includes(s.id));
                  const subjCount=Object.keys(s.subjects||{}).length;
                  return(
                    <div key={s.id}>
                      <div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 16px"}}>
                        <Ava initials={s.avatar} color={s.color} size={38}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{...fmt.callout,fontWeight:600,color:C.lbl,fontFamily:SF}}>
                            {s.name}
                          </div>
                          <div style={{fontSize:11,color:C.lbl2,fontFamily:SF,marginTop:2}}>
                            {grp?`${grp.name} · ${subjCount} materia${subjCount!==1?"s":""}`:
                              s.group||"Sin grupo"}
                          </div>
                        </div>
                        <span style={{fontSize:11,fontWeight:600,borderRadius:6,padding:"3px 9px",
                          fontFamily:SF,color:grp?C.green:C.red,
                          background:grp?`${C.green}12`:`${C.red}12`}}>
                          {grp?"✓ Asignado":"Pendiente"}
                        </span>
                      </div>
                      {i<state.students.length-1&&<Div indent={66}/>}
                    </div>
                  );
                })}
              </Sec>
            </div>
          );
        })()}

      </div>
    </div>
  );
};


// ─── CHAT PANEL (WhatsApp-style) ──────────────────────────────────────────────
const ChatPanel=({state,setState,myUserId,myName,myAvatar,myColor,role,accent=C.blue})=>{
  // Fix for iOS/Android: keep real viewport height even when keyboard opens
  useEffect(()=>{
    const setVh=()=>{document.documentElement.style.setProperty("--vh",`${window.innerHeight*0.01}px`);};
    setVh();
    window.addEventListener("resize",setVh);
    window.addEventListener("orientationchange",setVh);
    // Also listen for visualViewport (keyboard awareness on modern mobile)
    if(window.visualViewport){
      window.visualViewport.addEventListener("resize",setVh);
      window.visualViewport.addEventListener("scroll",setVh);
    }
    return ()=>{
      window.removeEventListener("resize",setVh);
      window.removeEventListener("orientationchange",setVh);
      if(window.visualViewport){
        window.visualViewport.removeEventListener("resize",setVh);
        window.visualViewport.removeEventListener("scroll",setVh);
      }
    };
  },[]);
  const [view,setView]=useState("list"); // "list" | "chat" | "new"
  const [selectedChatId,setSelectedChatId]=useState(null);
  const [msgText,setMsgText]=useState("");
  const [attachImages,setAttachImages]=useState([]);
  const [attachFiles,setAttachFiles]=useState([]);
  const [showPoll,setShowPoll]=useState(false);
  const [pollQ,setPollQ]=useState("");
  const [pollOpts,setPollOpts]=useState(["",""]);
  const [newChatSearch,setNewChatSearch]=useState("");
  const [showGroupForm,setShowGroupForm]=useState(false);
  const [groupName,setGroupName]=useState("");
  const [selectedMembers,setSelectedMembers]=useState([]);
  const imgRef=useRef();
  const fileRef=useRef();
  const msgsEndRef=useRef();
  const SF_local="-apple-system,'SF Pro Text',system-ui,sans-serif";

  const chats=state.chats||[];
  const allMessages=state.chatMessages||{};
  const selectedChat=chats.find(c=>c.id===selectedChatId);
  const selectedMessages=selectedChatId?allMessages[selectedChatId]||[]:[];

  useEffect(()=>{ if(msgsEndRef.current) msgsEndRef.current.scrollIntoView({behavior:"smooth"}); },[selectedMessages.length,selectedChatId]);

  // Build accessible contact list based on role
  const getContacts=()=>{
    const contacts=[];
    if(role==="director"){
      state.teachers.forEach(t=>contacts.push({id:`t${t.id}`,name:t.name,avatar:t.avatar,color:t.color,role:"Docente"}));
      state.students.forEach(s=>contacts.push({id:`s${s.id}`,name:s.name,avatar:s.avatar,color:s.color,role:`Grupo ${s.group}`}));
      contacts.push({id:"dev",name:"Desarrollador",avatar:"DV",color:C.indigo,role:"Sistema"});
    } else if(role==="teacher"){
      const teacher=state.teachers.find(t=>`t${t.id}`===myUserId)||state.teachers[0];
      const myGroupIds=state.groups.filter(g=>(g.subjects||[]).some(s=>String(s.teacherId)===String(teacher?.id))||String(g.teacherId)===String(teacher?.id)).map(g=>g.id);
      const myStudents=state.students.filter(s=>myGroupIds.some(gid=>{const g=state.groups.find(x=>String(x.id)===String(gid));return(g?.students||[]).some(id=>String(id)===String(s.id))||s.group===g?.name;}));
      contacts.push({id:"dir",name:"Directora Gómez",avatar:"DG",color:C.indigo,role:"Directora"});
      state.teachers.filter(t=>`t${t.id}`!==myUserId).forEach(t=>contacts.push({id:`t${t.id}`,name:t.name,avatar:t.avatar,color:t.color,role:"Docente"}));
      myStudents.forEach(s=>contacts.push({id:`s${s.id}`,name:s.name,avatar:s.avatar,color:s.color,role:`Grupo ${s.group}`}));
    } else if(role==="student"){
      const student=state.students.find(s=>`s${s.id}`===myUserId)||state.students[0];
      const myGroup=state.groups.find(g=>g.name===student?.group);
      contacts.push({id:"dir",name:"Directora Gómez",avatar:"DG",color:C.indigo,role:"Directora"});
      (myGroup?.subjects||[]).forEach(subj=>{
        const t=state.teachers.find(x=>String(x.id)===String(subj.teacherId));
        if(t&&!contacts.find(c=>c.id===`t${t.id}`)) contacts.push({id:`t${t.id}`,name:t.name,avatar:t.avatar,color:t.color,role:`Prof. ${subj.subject}`});
      });
    }
    return contacts;
  };

  const contacts=getContacts();

  const getOrCreateChat=(contactId,contactName)=>{
    const participants=[myUserId,contactId].sort();
    const chatId=`chat_${participants.join("_")}`;
    if(!chats.find(c=>c.id===chatId)){
      const newChat={id:chatId,type:"direct",participants,name:contactName,lastMsg:"",lastTime:"",unread:{}};
      // Save to Firestore so both users can see the chat
      setDoc(doc(db,"chats",chatId),newChat,{merge:true}).catch(()=>{});
      setState(s=>({...s,chats:[newChat,...(s.chats||[])]}));
    }
    return chatId;
  };

  const openChat=(contactId,contactName)=>{
    const cid=getOrCreateChat(contactId,contactName);
    // Clear unread locally and in Firestore
    setState(s=>({...s,chats:(s.chats||[]).map(c=>c.id===cid?{...c,unread:{...c.unread,[myUserId]:0}}:c)}));
    const chat=state.chats?.find(c=>c.id===cid);
    if(chat) updateDoc(doc(db,"chats",cid),{[`unread.${myUserId}`]:0}).catch(()=>{});
    setSelectedChatId(cid);
    setView("chat");
  };

  const createGroup=()=>{
    if(!groupName.trim()||selectedMembers.length===0)return;
    const chatId=`grp_${Date.now()}`;
    const participants=[myUserId,...selectedMembers];
    const newChat={id:chatId,type:"group",participants,name:groupName.trim(),lastMsg:"",lastTime:"",unread:{},createdBy:myUserId};
    // Save group chat to Firestore
    setDoc(doc(db,"chats",chatId),newChat,{merge:true}).catch(()=>{});
    setState(s=>({...s,chats:[newChat,...(s.chats||[])]}));
    setGroupName("");setSelectedMembers([]);setShowGroupForm(false);setNewChatSearch("");
    setSelectedChatId(chatId);setView("chat");
  };

  const sendMessage=()=>{
    if(!msgText.trim()&&attachImages.length===0&&attachFiles.length===0)return;
    const now=new Date();
    const msg={from:myUserId,fromName:myName,
      text:msgText.trim()||null,
      images:attachImages.length>0?[...attachImages]:undefined,
      files:attachFiles.length>0?[...attachFiles]:undefined,
      type:"text",time:now.toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"}),
      date:now.toISOString().slice(0,10)};
    const previewText=msg.text||(msg.images?.length?"📷 Foto":"📎 Archivo");
    const unreadUpdate=Object.fromEntries(
      (selectedChat?.participants||[]).filter(p=>p!==myUserId).map(p=>[p,((selectedChat?.unread?.[p]||0)+1)])
    );
    const chatMeta={lastMsg:previewText,lastTime:now.toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"}),unread:{...(selectedChat?.unread||{}),...unreadUpdate,[myUserId]:0}};
    // Write to Firestore for real-time delivery
    addDoc(collection(db,"chatMsgs"),{...msg,chatId:selectedChatId,_createdAt:serverTimestamp()}).catch(()=>{});
    setDoc(doc(db,"chats",selectedChatId),{...(selectedChat||{}),id:selectedChatId,...chatMeta},{merge:true}).catch(()=>{});
    // Update local state immediately for snappy UI
    setState(s=>({...s,chats:(s.chats||[]).map(c=>c.id===selectedChatId?{...c,...chatMeta}:c)}));
    setMsgText("");setAttachImages([]);setAttachFiles([]);
    SFX.play("click");
  };

  const sendPoll=()=>{
    if(!pollQ.trim()||pollOpts.filter(o=>o.trim()).length<2)return;
    const msg={id:Date.now(),from:myUserId,fromName:myName,type:"poll",
      poll:{question:pollQ.trim(),options:pollOpts.filter(o=>o.trim()),votes:{}},
      time:new Date().toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"}),
      date:new Date().toISOString().slice(0,10)};
    const newMsgs=[...(allMessages[selectedChatId]||[]),msg];
    setState(s=>({...s,chatMessages:{...s.chatMessages,[selectedChatId]:newMsgs},
      chats:(s.chats||[]).map(c=>c.id===selectedChatId?{...c,lastMsg:"📊 Encuesta",lastTime:"Ahora"}:c)}));
    setPollQ("");setPollOpts(["",""]);setShowPoll(false);
  };

  const votePoll=(msgId,option)=>{
    setState(s=>{
      const msgs=(s.chatMessages?.[selectedChatId]||[]).map(m=>{
        if(m.id!==msgId||!m.poll)return m;
        const votes={...m.poll.votes};
        // Remove previous vote
        Object.keys(votes).forEach(opt=>{votes[opt]=(votes[opt]||[]).filter(v=>v!==myUserId);});
        votes[option]=[...(votes[option]||[]),myUserId];
        return {...m,poll:{...m.poll,votes}};
      });
      return {...s,chatMessages:{...s.chatMessages,[selectedChatId]:msgs}};
    });
  };

  const addImg=(e)=>{
    Array.from(e.target.files||[]).forEach(f=>{const r=new FileReader();r.onload=ev=>setAttachImages(a=>[...a,{id:Date.now()+Math.random(),src:ev.target.result,name:f.name}]);r.readAsDataURL(f);});
    e.target.value="";
  };
  const addFile=(e)=>{
    setAttachFiles(a=>[...a,...Array.from(e.target.files||[]).map(f=>({id:Date.now()+Math.random(),name:f.name,size:(f.size/1024).toFixed(0)+"KB",mime:f.type}))]);
    e.target.value="";
  };

  const myChats=chats.filter(c=>(c.participants||[]).includes(myUserId));
  const totalUnread=myChats.reduce((acc,c)=>acc+(c.unread?.[myUserId]||0),0);

  const getChatDisplayName=(c)=>{
    if(c.type==="group")return c.name;
    const otherId=c.participants.find(p=>p!==myUserId);
    const contact=contacts.find(x=>x.id===otherId);
    return contact?.name||c.name||"Chat";
  };
  const getChatColor=(c)=>{
    if(c.type==="group")return accent;
    const otherId=c.participants.find(p=>p!==myUserId);
    const contact=contacts.find(x=>x.id===otherId);
    return contact?.color||accent;
  };
  const getInitials=(name)=>{
    const p=name?.split(" ")||[];
    return((p[0]?.[0]||"")+(p[1]?.[0]||"")).toUpperCase()||"?";
  };

  // ── Poll message render
  const PollMsg=({msg,isMe})=>{
    const poll=msg.poll;
    const total=Object.values(poll.votes||{}).reduce((a,b)=>a+b.length,0);
    const myVote=Object.keys(poll.votes||{}).find(opt=>(poll.votes[opt]||[]).includes(myUserId));
    return(
      <div style={{background:isMe?`${accent}15`:`${C.g5}`,borderRadius:"10px",padding:"10px 12px",minWidth:200,maxWidth:280}}>
        <div style={{fontSize:12,fontWeight:700,color:C.lbl,fontFamily:SF_local,marginBottom:8}}>📊 {poll.question}</div>
        {poll.options.map((opt,i)=>{
          const count=(poll.votes?.[opt]||[]).length;
          const pct=total>0?Math.round(count/total*100):0;
          const voted=myVote===opt;
          return(
            <button key={i} onClick={()=>votePoll(msg.id,opt)}
              style={{width:"100%",marginBottom:5,padding:"7px 10px",borderRadius:8,border:`1.5px solid ${voted?accent:C.g4}`,
                background:voted?`${accent}15`:"#fff",cursor:"pointer",textAlign:"left",transition:"all 0.15s"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:myVote?3:0}}>
                <span style={{fontSize:12,color:C.lbl,fontFamily:SF_local,fontWeight:voted?600:400}}>{opt}</span>
                {myVote&&<span style={{fontSize:11,color:accent,fontFamily:SF_local,fontWeight:600}}>{pct}%</span>}
              </div>
              {myVote&&<div style={{height:3,background:C.g5,borderRadius:2,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${pct}%`,background:accent,borderRadius:2,transition:"width 0.4s ease"}}/>
              </div>}
            </button>
          );
        })}
        <div style={{fontSize:10,color:C.lbl3,fontFamily:SF_local,marginTop:4}}>{total} voto{total!==1?"s":""}{myVote?"":" · Toca para votar"}</div>
      </div>
    );
  };

  // ── Chat list view ─────────────────────────────────────────────────────────
  if(view==="list"||view==="new"){
    const filteredContacts=contacts.filter(c=>!newChatSearch||c.name.toLowerCase().includes(newChatSearch.toLowerCase()));
    return(
      <div style={{background:C.bg2,minHeight:"100vh",fontFamily:SF_local}}>
        <div style={{background:`linear-gradient(135deg,${accent},${accent}cc)`,padding:"0 0 1px"}}>
          <div style={{display:"flex",alignItems:"center",padding:"14px 16px",gap:12}}>
            {view==="new"&&<button onClick={()=>{setView("list");setNewChatSearch("");setShowGroupForm(false);setSelectedMembers([]);setGroupName("");}}
              style={{background:"rgba(255,255,255,0.2)",border:"none",borderRadius:"50%",width:34,height:34,cursor:"pointer",color:"#fff",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>←</button>}
            <div style={{flex:1}}>
              <div style={{fontSize:20,fontWeight:800,color:"#fff",fontFamily:"-apple-system,system-ui,sans-serif",letterSpacing:"-0.4px"}}>
                {view==="new"?showGroupForm?"Nuevo Grupo":"Nueva Conversación":"💬 Mensajes"}
              </div>
              {view==="list"&&totalUnread>0&&<div style={{fontSize:12,color:"rgba(255,255,255,0.75)",fontFamily:SF_local}}>{totalUnread} sin leer</div>}
            </div>
            {view==="list"&&(
              <button onClick={()=>{setView("new");setNewChatSearch("");setShowGroupForm(false);}}
                style={{background:"rgba(255,255,255,0.2)",border:"none",borderRadius:10,padding:"6px 12px",cursor:"pointer",color:"#fff",fontSize:13,fontWeight:600,fontFamily:SF_local}}>
                ✏️ Nuevo
              </button>
            )}
          </div>
          {view==="new"&&(
            <div style={{padding:"0 16px 12px",display:"flex",gap:8,alignItems:"center"}}>
              <input value={newChatSearch} onChange={e=>setNewChatSearch(e.target.value)}
                placeholder="Buscar contacto…"
                style={{flex:1,background:"rgba(255,255,255,0.2)",border:"none",borderRadius:20,padding:"8px 14px",fontSize:14,color:"#fff",fontFamily:SF_local,outline:"none"}}/>
              {!showGroupForm&&(
                <button onClick={()=>setShowGroupForm(true)}
                  style={{background:"rgba(255,255,255,0.2)",border:"none",borderRadius:10,padding:"8px 12px",cursor:"pointer",color:"#fff",fontSize:12,fontWeight:600,fontFamily:SF_local,whiteSpace:"nowrap"}}>
                  👥 Grupo
                </button>
              )}
            </div>
          )}
        </div>

        <div style={{padding:"0 0 100px"}}>
          {/* Chat list */}
          {view==="list"&&(
            <>
              {myChats.length===0&&(
                <div style={{textAlign:"center",padding:"48px 16px",color:C.lbl2,fontSize:15,fontFamily:SF_local}}>
                  <div style={{fontSize:48,marginBottom:12}}>💬</div>
                  <div style={{fontWeight:600,color:C.lbl,marginBottom:4}}>Sin conversaciones</div>
                  <div>Toca "Nuevo" para empezar a chatear</div>
                </div>
              )}
              <div style={{background:"#fff",marginTop:8,borderRadius:16,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
                {myChats.map((c,i)=>{
                  const unread=c.unread?.[myUserId]||0;
                  const displayName=getChatDisplayName(c);
                  const clr=getChatColor(c);
                  const initials=c.type==="group"?"👥":getInitials(displayName);
                  return(
                    <div key={c.id}>
                      <div onClick={()=>{
                        setState(s=>({...s,chats:(s.chats||[]).map(ch=>ch.id===c.id?{...ch,unread:{...ch.unread,[myUserId]:0}}:ch)}));
                        updateDoc(doc(db,"chats",c.id),{[`unread.${myUserId}`]:0}).catch(()=>{});
                        setSelectedChatId(c.id);setView("chat");
                      }} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",cursor:"pointer",transition:"background 0.1s"}}
                        onMouseEnter={e=>e.currentTarget.style.background=C.fill4}
                        onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                        <div style={{width:50,height:50,borderRadius:"50%",background:`${clr}20`,border:`1.5px solid ${clr}40`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:c.type==="group"?22:16,fontWeight:700,color:clr,fontFamily:SF_local}}>
                          {c.type==="group"?"👥":initials}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
                            <div style={{fontSize:15,fontWeight:600,color:C.lbl,fontFamily:SF_local,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{displayName}</div>
                            <div style={{fontSize:11,color:C.lbl3,fontFamily:SF_local,flexShrink:0,marginLeft:6}}>{c.lastTime||""}</div>
                          </div>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                            <div style={{fontSize:13,color:C.lbl2,fontFamily:SF_local,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{c.lastMsg||"Sin mensajes"}</div>
                            {unread>0&&<div style={{background:accent,color:"#fff",fontSize:11,fontWeight:800,borderRadius:"50%",minWidth:20,height:20,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:SF_local,flexShrink:0,marginLeft:6,padding:"0 4px"}}>{unread}</div>}
                          </div>
                        </div>
                      </div>
                      {i<myChats.length-1&&<div style={{height:"0.5px",background:C.sep,marginLeft:78}}/>}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* New chat / group form */}
          {view==="new"&&(
            <>
              {showGroupForm&&(
                <div style={{padding:"12px 16px",background:"#fff",margin:"8px 0",borderRadius:0}}>
                  <input value={groupName} onChange={e=>setGroupName(e.target.value)}
                    placeholder="Nombre del grupo…"
                    style={{width:"100%",background:C.fill4,border:"none",borderRadius:10,padding:"10px 13px",fontSize:15,fontWeight:600,color:C.lbl,fontFamily:SF_local,outline:"none",boxSizing:"border-box",marginBottom:10}}/>
                  {selectedMembers.length>0&&(
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
                      {selectedMembers.map(id=>{
                        const c=contacts.find(x=>x.id===id);
                        return c?(<div key={id} style={{display:"flex",alignItems:"center",gap:5,background:`${c.color}15`,borderRadius:20,padding:"4px 10px"}}>
                          <span style={{fontSize:12,fontWeight:600,color:c.color,fontFamily:SF_local}}>{c.name.split(" ")[0]}</span>
                          <button onClick={()=>setSelectedMembers(m=>m.filter(x=>x!==id))} style={{background:"none",border:"none",color:c.color,cursor:"pointer",fontSize:12,padding:0,lineHeight:1}}>✕</button>
                        </div>):null;
                      })}
                    </div>
                  )}
                  <button onClick={createGroup} disabled={!groupName.trim()||selectedMembers.length===0}
                    style={{width:"100%",background:selectedMembers.length>0&&groupName.trim()?accent:C.fill3,border:"none",borderRadius:12,padding:"11px",fontSize:14,fontWeight:700,cursor:"pointer",color:selectedMembers.length>0&&groupName.trim()?"#fff":C.lbl3,fontFamily:SF_local}}>
                    Crear Grupo ({selectedMembers.length} participantes)
                  </button>
                </div>
              )}
              <div style={{fontSize:11,fontWeight:700,color:C.lbl3,textTransform:"uppercase",letterSpacing:"0.06em",fontFamily:SF_local,padding:"10px 16px 4px"}}>
                {showGroupForm?"Selecciona participantes":"Contactos disponibles"}
              </div>
              <div style={{background:"#fff",borderRadius:16,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
                {filteredContacts.length===0&&<div style={{padding:"20px 16px",color:C.lbl2,fontSize:14,fontFamily:SF_local,textAlign:"center"}}>Sin resultados</div>}
                {filteredContacts.map((contact,i)=>{
                  const isSel=selectedMembers.includes(contact.id);
                  return(
                    <div key={contact.id}>
                      <div onClick={()=>{
                        if(showGroupForm){setSelectedMembers(m=>isSel?m.filter(x=>x!==contact.id):[...m,contact.id]);}
                        else{openChat(contact.id,contact.name);}
                      }} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 16px",cursor:"pointer",background:isSel?`${accent}08`:"transparent",transition:"background 0.1s"}}
                        onMouseEnter={e=>!isSel&&(e.currentTarget.style.background=C.fill4)}
                        onMouseLeave={e=>!isSel&&(e.currentTarget.style.background="transparent")}>
                        <div style={{width:44,height:44,borderRadius:"50%",background:`${contact.color}20`,border:`1.5px solid ${contact.color}40`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:14,fontWeight:700,color:contact.color,fontFamily:SF_local}}>
                          {contact.avatar||getInitials(contact.name)}
                        </div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:15,fontWeight:600,color:C.lbl,fontFamily:SF_local}}>{contact.name}</div>
                          <div style={{fontSize:12,color:C.lbl2,fontFamily:SF_local}}>{contact.role}</div>
                        </div>
                        {showGroupForm?(
                          <div style={{width:22,height:22,borderRadius:"50%",border:`2px solid ${isSel?accent:C.g4}`,background:isSel?accent:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                            {isSel&&<div style={{width:8,height:8,borderRadius:"50%",background:"#fff"}}/>}
                          </div>
                        ):(
                          <svg width="8" height="13" viewBox="0 0 8 13" fill="none"><path d="M1 1L7 6.5L1 12" stroke={C.g3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        )}
                      </div>
                      {i<filteredContacts.length-1&&<div style={{height:"0.5px",background:C.sep,marginLeft:72}}/>}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Chat view ──────────────────────────────────────────────────────────────
  if(view==="chat"&&selectedChat){
    const displayName=getChatDisplayName(selectedChat);
    const clr=getChatColor(selectedChat);
    const otherId=selectedChat.participants.find(p=>p!==myUserId);
    const otherContact=contacts.find(x=>x.id===otherId)||{name:displayName,color:clr};

    return(
      <div style={{background:"#f0f2f5",height:"calc(var(--vh,1vh)*100 - var(--tab-h,56px))",maxHeight:"calc(100dvh - var(--tab-h,56px))",fontFamily:SF_local,display:"flex",flexDirection:"column",overflow:"hidden",WebkitOverflowScrolling:"touch"}}>
        {/* Header */}
        <div style={{background:`linear-gradient(135deg,${accent},${accent}cc)`,flexShrink:0,zIndex:10}}>
          <div style={{display:"flex",alignItems:"center",padding:"12px 16px",gap:10}}>
            <button onClick={()=>setView("list")}
              style={{background:"rgba(255,255,255,0.2)",border:"none",borderRadius:"50%",width:34,height:34,cursor:"pointer",color:"#fff",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>←</button>
            <div style={{width:38,height:38,borderRadius:"50%",background:"rgba(255,255,255,0.25)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:selectedChat.type==="group"?20:13,fontWeight:700,color:"#fff",fontFamily:SF_local}}>
              {selectedChat.type==="group"?"👥":(otherContact.avatar||getInitials(displayName))}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:16,fontWeight:700,color:"#fff",fontFamily:"-apple-system,system-ui,sans-serif",letterSpacing:"-0.2px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{displayName}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.75)",fontFamily:SF_local}}>
                {selectedChat.type==="group"?`${selectedChat.participants.length} participantes`:otherContact.role||""}
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div style={{flex:1,overflowY:"auto",padding:"12px 16px",display:"flex",flexDirection:"column",gap:6}}>
          {selectedMessages.length===0&&(
            <div style={{textAlign:"center",padding:"40px 0",color:C.lbl2,fontSize:14,fontFamily:SF_local}}>
              <div style={{fontSize:36,marginBottom:8}}>👋</div>
              <div>¡Empieza la conversación!</div>
            </div>
          )}
          {selectedMessages.map((msg,i)=>{
            const isMe=msg.from===myUserId;
            const showName=selectedChat.type==="group"&&!isMe;
            const prevMsg=i>0?selectedMessages[i-1]:null;
            const showDate=!prevMsg||prevMsg.date!==msg.date;
            return(
              <React.Fragment key={msg.id}>
                {showDate&&<div style={{textAlign:"center",margin:"8px 0"}}>
                  <span style={{fontSize:11,color:C.lbl3,fontFamily:SF_local,background:"rgba(255,255,255,0.8)",borderRadius:10,padding:"3px 10px"}}>{msg.date===new Date().toISOString().slice(0,10)?"Hoy":msg.date}</span>
                </div>}
                <div style={{display:"flex",flexDirection:isMe?"row-reverse":"row",alignItems:"flex-end",gap:7}}>
                  {!isMe&&selectedChat.type==="group"&&(
                    <div style={{width:28,height:28,borderRadius:"50%",background:`${clr}20`,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:clr,fontFamily:SF_local,marginBottom:2}}>
                      {(msg.fromName||"?").split(" ").map(p=>p[0]).slice(0,2).join("").toUpperCase()}
                    </div>
                  )}
                  <div style={{maxWidth:"75%"}}>
                    {showName&&<div style={{fontSize:10,fontWeight:700,color:clr,fontFamily:SF_local,marginBottom:2,paddingLeft:4}}>{msg.fromName}</div>}
                    {msg.type==="poll"?(
                      <PollMsg msg={msg} isMe={isMe}/>
                    ):(
                      <div style={{background:isMe?`${accent}`:C.bg,borderRadius:isMe?"16px 4px 16px 16px":"4px 16px 16px 16px",padding:"9px 12px",boxShadow:"0 1px 2px rgba(0,0,0,0.08)"}}>
                        {msg.images?.length>0&&(
                          <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:msg.text?6:0}}>
                            {msg.images.map(img=>(<img key={img.id} src={img.src} style={{width:msg.images.length===1?"100%":80,height:msg.images.length===1?160:80,borderRadius:8,objectFit:"cover"}}/>))}
                          </div>
                        )}
                        {msg.files?.length>0&&msg.files.map(f=>(
                          <div key={f.id} style={{display:"flex",alignItems:"center",gap:8,background:isMe?"rgba(255,255,255,0.2)":"rgba(0,0,0,0.05)",borderRadius:8,padding:"7px 10px",marginBottom:msg.text?6:0}}>
                            <span style={{fontSize:20}}>📎</span>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:12,fontWeight:600,color:isMe?"#fff":C.lbl,fontFamily:SF_local,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</div>
                              {f.size&&<div style={{fontSize:10,color:isMe?"rgba(255,255,255,0.6)":C.lbl3,fontFamily:SF_local}}>{f.size}</div>}
                            </div>
                          </div>
                        ))}
                        {msg.text&&<div style={{fontSize:14,color:isMe?"#fff":C.lbl,fontFamily:SF_local,lineHeight:1.5,whiteSpace:"pre-wrap"}}>{msg.text}</div>}
                        <div style={{fontSize:10,color:isMe?"rgba(255,255,255,0.65)":C.lbl3,fontFamily:SF_local,textAlign:"right",marginTop:3}}>{msg.time}</div>
                      </div>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
          <div ref={msgsEndRef}/>
        </div>

        {/* Poll form */}
        {showPoll&&(
          <div style={{flexShrink:0,padding:"0 12px 4px",borderTop:`0.5px solid ${C.sep}`,background:"rgba(255,255,255,0.98)"}}>
            <div style={{background:"#fff",borderRadius:16,padding:14,boxShadow:"0 -2px 10px rgba(0,0,0,0.08)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{fontSize:14,fontWeight:700,color:C.lbl,fontFamily:SF_local}}>📊 Nueva Encuesta</div>
                <button onClick={()=>setShowPoll(false)} style={{background:C.fill3,border:"none",borderRadius:"50%",width:26,height:26,cursor:"pointer",color:C.lbl2,fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
              </div>
              <input value={pollQ} onChange={e=>setPollQ(e.target.value)} placeholder="Pregunta de la encuesta…"
                style={{width:"100%",background:C.fill4,border:"none",borderRadius:10,padding:"9px 12px",fontSize:14,fontFamily:SF_local,outline:"none",boxSizing:"border-box",marginBottom:8}}/>
              {pollOpts.map((opt,i)=>(
                <div key={i} style={{display:"flex",gap:6,marginBottom:6,alignItems:"center"}}>
                  <input value={opt} onChange={e=>setPollOpts(o=>{const n=[...o];n[i]=e.target.value;return n;})} placeholder={`Opción ${i+1}…`}
                    style={{flex:1,background:C.fill4,border:"none",borderRadius:10,padding:"8px 12px",fontSize:13,fontFamily:SF_local,outline:"none"}}/>
                  {i>=2&&<button onClick={()=>setPollOpts(o=>o.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:C.lbl3,cursor:"pointer",fontSize:16}}>✕</button>}
                </div>
              ))}
              {pollOpts.length<5&&<button onClick={()=>setPollOpts(o=>[...o,""])} style={{fontSize:12,color:accent,fontFamily:SF_local,background:"none",border:"none",cursor:"pointer",marginBottom:8}}>+ Agregar opción</button>}
              <button onClick={sendPoll} disabled={!pollQ.trim()||pollOpts.filter(o=>o.trim()).length<2}
                style={{width:"100%",background:pollQ.trim()&&pollOpts.filter(o=>o.trim()).length>=2?accent:C.fill3,border:"none",borderRadius:12,padding:"10px",fontSize:14,fontWeight:700,cursor:"pointer",color:pollQ.trim()&&pollOpts.filter(o=>o.trim()).length>=2?"#fff":C.lbl3,fontFamily:SF_local}}>
                Enviar Encuesta
              </button>
            </div>
          </div>
        )}

        {/* Attachment previews */}
        {(attachImages.length>0||attachFiles.length>0)&&(
          <div style={{flexShrink:0,padding:"6px 12px",background:"rgba(255,255,255,0.97)",borderTop:`0.5px solid ${C.sep}`}}>
            <div style={{display:"flex",gap:6,overflowX:"auto",scrollbarWidth:"none"}}>
              {attachImages.map(img=>(<div key={img.id} style={{position:"relative",flexShrink:0}}>
                <img src={img.src} style={{width:60,height:60,borderRadius:8,objectFit:"cover"}}/>
                <button onClick={()=>setAttachImages(a=>a.filter(x=>x.id!==img.id))} style={{position:"absolute",top:-4,right:-4,width:16,height:16,borderRadius:"50%",background:C.red,border:"2px solid #fff",cursor:"pointer",color:"#fff",fontSize:8,display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>✕</button>
              </div>))}
              {attachFiles.map(f=>(<div key={f.id} style={{display:"flex",alignItems:"center",gap:6,background:C.fill4,borderRadius:8,padding:"6px 10px",flexShrink:0}}>
                <span>📎</span><span style={{fontSize:11,fontFamily:SF_local,color:C.lbl,whiteSpace:"nowrap"}}>{f.name.length>12?f.name.slice(0,12)+"…":f.name}</span>
                <button onClick={()=>setAttachFiles(a=>a.filter(x=>x.id!==f.id))} style={{background:"none",border:"none",color:C.lbl3,cursor:"pointer",fontSize:12}}>✕</button>
              </div>))}
            </div>
          </div>
        )}

        {/* Input bar — safe area + mobile friendly */}
        <div style={{flexShrink:0,background:"rgba(255,255,255,0.98)",borderTop:`0.5px solid ${C.sep}`,
          padding:"10px 12px",paddingBottom:"max(10px,env(safe-area-inset-bottom,10px))",
          display:"flex",gap:8,alignItems:"flex-end",boxShadow:"0 -2px 12px rgba(0,0,0,0.06)",
          position:"relative",zIndex:10}}>
          <input ref={imgRef} type="file" accept="image/*" multiple style={{display:"none"}} onChange={addImg}/>
          <input ref={fileRef} type="file" multiple style={{display:"none"}} onChange={addFile}/>
          <button onClick={()=>imgRef.current?.click()}
            style={{width:40,height:40,borderRadius:"50%",background:`${accent}15`,border:"none",cursor:"pointer",fontSize:20,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent"}}>📷</button>
          <button onClick={()=>fileRef.current?.click()}
            style={{width:40,height:40,borderRadius:"50%",background:`${accent}15`,border:"none",cursor:"pointer",fontSize:20,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent"}}>📎</button>
          <button onClick={()=>setShowPoll(s=>!s)}
            style={{width:40,height:40,borderRadius:"50%",background:showPoll?accent:`${accent}15`,border:"none",cursor:"pointer",fontSize:20,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent"}}>📊</button>
          <div style={{flex:1,background:C.fill4,borderRadius:22,display:"flex",alignItems:"flex-end",padding:"0 6px 0 14px",minHeight:40,border:`1px solid ${C.g5}`}}>
            <textarea value={msgText} onChange={e=>setMsgText(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}}}
              placeholder="Mensaje…" rows={1}
              style={{flex:1,background:"transparent",border:"none",padding:"10px 0",fontSize:15,color:C.lbl,
                fontFamily:SF_local,outline:"none",resize:"none",lineHeight:"20px",maxHeight:100,
                overflowY:"auto",WebkitAppearance:"none",touchAction:"manipulation"}}/>
          </div>
          <button onClick={sendMessage} disabled={!msgText.trim()&&attachImages.length===0&&attachFiles.length===0}
            style={{width:40,height:40,borderRadius:"50%",
              background:(msgText.trim()||attachImages.length>0||attachFiles.length>0)?accent:C.fill3,
              border:"none",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
              transition:"all 0.15s",WebkitTapHighlightColor:"transparent"}}>
            <svg width="18" height="18" viewBox="0 0 14 14" fill="none"><path d="M12.5 1.5L7 7M12.5 1.5L8.5 12.5L7 7M12.5 1.5L1.5 5.5L7 7" stroke={(msgText.trim()||attachImages.length>0||attachFiles.length>0)?"#fff":C.g3} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>
    );
  }
  return null;
};

// ─── DIRECTOR APP ─────────────────────────────────────────────────────────────
// ─── QR CODE DISPLAY ─────────────────────────────────────────────────────────
const QRCode = ({ value, size = 180 }) => {
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&bgcolor=ffffff&color=000000&margin=10`;
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
      <img src={url} alt="QR" style={{ width:size, height:size, borderRadius:12, border:`2px solid ${C.g5}` }}/>
      <div style={{ fontFamily:"'SF Mono','Menlo',monospace", fontSize:11, color:C.lbl2, letterSpacing:"0.05em" }}>{value}</div>
    </div>
  );
};

// ─── QR SCANNER ───────────────────────────────────────────────────────────────
const QRScanner = ({ onScan, onClose, label = "Apunta la cámara al código QR" }) => {
  const idRef = useRef("qr-" + Math.random().toString(36).slice(2,8));
  const [err, setErr] = useState(null);
  const [ready, setReady] = useState(false);
  const scannerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      try {
        const mod = await import(/* @vite-ignore */ "html5-qrcode").catch(()=>null);
        if (!mod || cancelled) return;
        const scanner = new mod.Html5QrcodeScanner(
          idRef.current, { fps:8, qrbox:200, rememberLastUsedCamera:true }, false
        );
        scannerRef.current = scanner;
        scanner.render(
          (text) => { try { scanner.clear(); } catch {} onScan(text); },
          () => {}
        );
        if (!cancelled) setReady(true);
      } catch {
        if (!cancelled) setErr("No se pudo iniciar la cámara.");
      }
    };
    start();
    return () => {
      cancelled = true;
      try { scannerRef.current?.clear(); } catch {}
    };
  }, []);

  return (
    <div style={{ background:"#fff", borderRadius:16, padding:16, textAlign:"center" }}>
      <div style={{ fontSize:13, color:C.lbl2, fontFamily:SF, marginBottom:12 }}>{label}</div>
      {!ready && !err && <div style={{ color:C.lbl2, fontSize:13, fontFamily:SF, marginBottom:8 }}>⏳ Iniciando cámara…</div>}
      {err && <div style={{ color:C.red, fontSize:13, fontFamily:SF, marginBottom:8 }}>⚠️ {err}</div>}
      <div id={idRef.current} style={{ borderRadius:12, overflow:"hidden" }}/>
      <button onClick={()=>{ try { scannerRef.current?.clear(); } catch {} onClose(); }}
        style={{ marginTop:12, background:C.fill4, border:"none", borderRadius:10,
          padding:"8px 20px", color:C.lbl2, fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:SF }}>
        Cancelar
      </button>
    </div>
  );
};

// ─── ATTENDANCE MANUAL + QR PANEL ─────────────────────────────────────────────
const AttendancePanel = ({ people, attendanceMap, date, onMark, accentColor = C.blue }) => {
  const [showQR, setShowQR] = useState(false);
  const [lastScanned, setLastScanned] = useState(null);

  const handleScan = (text) => {
    setShowQR(false);
    const person = people.find(p => p.key === text);
    if (person) {
      onMark(person.id, date, "present");
      setLastScanned(person.name);
    } else {
      setLastScanned("⚠️ Código no reconocido");
    }
    setTimeout(() => setLastScanned(null), 3000);
  };

  const stats = {
    present: people.filter(p => attendanceMap[p.id] === "present").length,
    absent: people.filter(p => !attendanceMap[p.id] || attendanceMap[p.id] === "absent").length,
    justified: people.filter(p => attendanceMap[p.id] === "justified").length,
  };

  return (
    <div>
      <div style={{ display:"flex", gap:8, marginBottom:14 }}>
        {[["✅",stats.present,"Presentes",C.green],["❌",stats.absent,"Ausentes",C.red],["🟠",stats.justified,"Justificadas",C.orange]].map(([e,n,l,c]) => (
          <div key={l} style={{ flex:1, background:`${c}12`, borderRadius:10, padding:"8px", textAlign:"center" }}>
            <div style={{ fontSize:16 }}>{e}</div>
            <div style={{ fontSize:18, fontWeight:700, color:c, fontFamily:SF }}>{n}</div>
            <div style={{ fontSize:10, color:C.lbl2, fontFamily:SF }}>{l}</div>
          </div>
        ))}
      </div>
      <button onClick={() => setShowQR(true)}
        style={{ width:"100%", background:`linear-gradient(135deg,${accentColor},${accentColor}cc)`,
          border:"none", borderRadius:12, padding:"12px", color:"#fff", fontSize:15,
          fontWeight:700, cursor:"pointer", fontFamily:SF, marginBottom:12,
          display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
        📷 Escanear QR de Asistencia
      </button>
      {lastScanned && (
        <div style={{ background:`${C.green}15`, border:`1px solid ${C.green}30`, borderRadius:10,
          padding:"10px 14px", marginBottom:12, textAlign:"center", fontSize:14,
          color:C.green, fontFamily:SF, fontWeight:600 }}>
          ✅ Registrado: {lastScanned}
        </div>
      )}
      {showQR && (
        <div style={{ marginBottom:14 }}>
          <QRScanner onScan={handleScan} onClose={() => setShowQR(false)} label="Escanea el QR del alumno/docente"/>
        </div>
      )}
      <Card>
        {people.map((p, i) => {
          const status = attendanceMap[p.id] || "unknown";
          return (
            <div key={p.id}>
              <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px" }}>
                <Ava initials={p.avatar||p.name?.slice(0,2)||"?"} color={p.color||C.blue} size={36}/>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:C.lbl, fontFamily:SF }}>{p.name}</div>
                  {p.group && <div style={{ fontSize:11, color:C.lbl2, fontFamily:SF }}>Grupo {p.group}</div>}
                </div>
                <div style={{ display:"flex", gap:5 }}>
                  {[["✅","present",C.green],["❌","absent",C.red],["🟠","justified",C.orange]].map(([e,s,c]) => (
                    <button key={s} onClick={() => onMark(p.id, date, s)}
                      style={{ width:32, height:32, borderRadius:8, border:"none", cursor:"pointer",
                        background: status===s ? c : `${c}20`, fontSize:14, transition:"all 0.15s",
                        transform: status===s ? "scale(1.1)" : "scale(1)" }}>
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              {i < people.length-1 && <Div indent={60}/>}
            </div>
          );
        })}
        {people.length === 0 && (
          <div style={{ padding:"24px", textAlign:"center", color:C.lbl3, fontSize:14, fontFamily:SF }}>
            Sin personas registradas
          </div>
        )}
      </Card>
    </div>
  );
};

// ─── ATTENDANCE HISTORY ───────────────────────────────────────────────────────
const AttendanceHistory = ({ people, allAttendance, accentColor = C.blue }) => {
  const [selected, setSelected] = useState(null);

  const getPersonStats = (personId) => {
    const records = allAttendance.filter(a => a.studentId === personId || a.teacherId === personId);
    const present = records.filter(a => a.status === "present" || a.s === "present").length;
    const absent = records.filter(a => a.status === "absent" || a.s === "absent").length;
    const justified = records.filter(a => a.status === "justified" || a.s === "justified").length;
    const absentDates = records.filter(a => a.status === "absent" || a.s === "absent").map(a => a.date);
    return { present, absent, justified, absentDates, total: records.length };
  };

  return (
    <div>
      <Card>
        {people.map((p, i) => {
          const stats = getPersonStats(p.id);
          const pct = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;
          const col = pct >= 90 ? C.green : pct >= 75 ? C.orange : C.red;
          return (
            <div key={p.id}>
              <button onClick={() => setSelected(selected === p.id ? null : p.id)}
                style={{ width:"100%", background:"none", border:"none", textAlign:"left", cursor:"pointer", padding:"12px 14px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <Ava initials={p.avatar||p.name?.slice(0,2)||"?"} color={p.color||C.blue} size={36}/>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:600, color:C.lbl, fontFamily:SF }}>{p.name}</div>
                    <div style={{ display:"flex", gap:6, marginTop:4, alignItems:"center" }}>
                      <div style={{ height:4, width:80, background:C.fill3, borderRadius:2, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${pct}%`, background:col, borderRadius:2 }}/>
                      </div>
                      <span style={{ fontSize:11, fontWeight:700, color:col, fontFamily:SF }}>{pct}%</span>
                      <span style={{ fontSize:11, color:C.lbl3, fontFamily:SF }}>· {stats.absent} faltas</span>
                    </div>
                  </div>
                  <span style={{ fontSize:12, color:C.lbl3 }}>{selected === p.id ? "▲" : "▼"}</span>
                </div>
              </button>
              {selected === p.id && (
                <div style={{ padding:"0 14px 12px", background:C.fill4 }}>
                  <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                    {[["✅",stats.present,"Presentes",C.green],["❌",stats.absent,"Faltas",C.red],["🟠",stats.justified,"Justificadas",C.orange]].map(([e,n,l,c]) => (
                      <div key={l} style={{ flex:1, background:`${c}12`, borderRadius:8, padding:"6px", textAlign:"center" }}>
                        <div style={{ fontSize:14, fontWeight:700, color:c, fontFamily:SF }}>{n}</div>
                        <div style={{ fontSize:9, color:C.lbl2, fontFamily:SF }}>{l}</div>
                      </div>
                    ))}
                  </div>
                  {stats.absentDates.length > 0 && (
                    <div>
                      <div style={{ fontSize:11, color:C.lbl2, fontFamily:SF, marginBottom:4 }}>Fechas de faltas:</div>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                        {stats.absentDates.map(d => (
                          <span key={d} style={{ fontSize:10, background:`${C.red}15`, color:C.red,
                            padding:"2px 7px", borderRadius:20, fontFamily:SF, fontWeight:600 }}>{d}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {i < people.length-1 && <Div indent={60}/>}
            </div>
          );
        })}
      </Card>
    </div>
  );
};

// ─── DIRECTOR ATTENDANCE TAB ──────────────────────────────────────────────────
const DirectorAttendanceTab = ({ state, setState, todayStr }) => {
  const [attSubTab, setAttSubTab] = useState("staff");
  const [attDate, setAttDate] = useState(todayStr);
  const [attView, setAttView] = useState("tomar");

  const staffAtt = state.teacherAttendance?.[attDate] || {};
  const staffAttMap = {};
  state.teachers.forEach(t => { staffAttMap[t.id] = staffAtt[t.id]?.status || null; });

  const studentAttMap = {};
  state.students.forEach(s => {
    const rec = (s.attendance||[]).find(a=>a.date===attDate);
    studentAttMap[s.id] = rec?.s || null;
  });

  const markStaff = async (personId, date, status) => {
    const time = new Date().toTimeString().slice(0,5);
    const docId = `${date}_${personId}`;
    try { await setDoc(doc(db,"teacherAttendance",docId),{teacherId:personId,date,status,time}); } catch {}
    setState(s=>({...s,teacherAttendance:{...s.teacherAttendance,[date]:{...(s.teacherAttendance?.[date]||{}),[personId]:{status,time}}}}));
  };

  const markStudent = async (personId, date, status) => {
    try {
      const q = query(collection(db,"attendance"),where("studentId","==",personId),where("date","==",date));
      const snap = await getDocs(q);
      if(snap.empty) await addDoc(collection(db,"attendance"),{studentId:personId,date,status});
      else await updateDoc(snap.docs[0].ref,{status});
    } catch {}
    setState(s=>({...s,students:s.students.map(st=>st.id===personId?{...st,
      attendance:[...(st.attendance||[]).filter(a=>a.date!==date),{date,s:status}]}:st)}));
  };

  const allStudentAtt = state.students.flatMap(s=>(s.attendance||[]).map(a=>({...a,studentId:s.id})));
  const allStaffAtt = Object.entries(state.teacherAttendance||{}).flatMap(([d,map])=>
    map && typeof map === "object" ? Object.entries(map).map(([tid,val])=>({date:d,teacherId:tid,status:val?.status||"absent"})) : []);

  return (
    <div>
      <div style={{display:"flex",gap:6,marginBottom:14}}>
        {[["staff","👩‍🏫 Personal"],["students","🎒 Alumnos"]].map(([id,label])=>(
          <button key={id} onClick={()=>setAttSubTab(id)}
            style={{flex:1,padding:"8px",borderRadius:10,border:"none",cursor:"pointer",fontFamily:SF,
              fontSize:13,fontWeight:600,background:attSubTab===id?C.indigo:"#fff",
              color:attSubTab===id?"#fff":C.lbl2,transition:"all 0.15s"}}>
            {label}
          </button>
        ))}
      </div>
      <div style={{display:"flex",gap:6,marginBottom:14}}>
        {[["tomar","📋 Tomar Asistencia"],["historial","📊 Historial"]].map(([id,label])=>(
          <button key={id} onClick={()=>setAttView(id)}
            style={{flex:1,padding:"7px",borderRadius:10,border:`1px solid ${C.g4}`,cursor:"pointer",fontFamily:SF,
              fontSize:12,fontWeight:600,background:attView===id?`${C.indigo}15`:"#fff",
              color:attView===id?C.indigo:C.lbl2}}>
            {label}
          </button>
        ))}
      </div>
      {attView==="tomar"&&(
        <>
          <div style={{background:"#fff",borderRadius:12,padding:"10px 14px",marginBottom:14,
            display:"flex",alignItems:"center",gap:10,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
            <span style={{fontSize:18}}>📅</span>
            <div style={{flex:1}}>
              <div style={{fontSize:11,color:C.lbl2,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em",fontFamily:SF,marginBottom:2}}>Fecha</div>
              <input type="date" value={attDate} onChange={e=>setAttDate(e.target.value)}
                style={{border:"none",background:"transparent",fontSize:15,color:C.lbl,fontFamily:SF,outline:"none",width:"100%"}}/>
            </div>
          </div>
          <AttendancePanel
            people={attSubTab==="staff" ? state.teachers : state.students}
            attendanceMap={attSubTab==="staff" ? staffAttMap : studentAttMap}
            date={attDate}
            onMark={attSubTab==="staff" ? markStaff : markStudent}
            accentColor={C.indigo}
          />
        </>
      )}
      {attView==="historial"&&(
        <AttendanceHistory
          people={attSubTab==="staff" ? state.teachers : state.students}
          allAttendance={attSubTab==="staff" ? allStaffAtt : allStudentAtt}
          accentColor={C.indigo}
        />
      )}
    </div>
  );
};

// ─── TEACHER ATTENDANCE TAB ───────────────────────────────────────────────────
const TeacherAttendanceTab = ({ state, setState, selectedGroup, teacher, todayStr, COLOR }) => {
  const [attDate, setAttDate] = useState(todayStr);
  const [attView, setAttView] = useState("tomar");

  const groupStudents = state.students.filter(s =>
    selectedGroup?.students?.includes(s.id) || s.group === selectedGroup?.name);

  const studentAttMap = {};
  groupStudents.forEach(s => {
    const rec = (s.attendance||[]).find(a=>a.date===attDate);
    studentAttMap[s.id] = rec?.s || rec?.status || null;
  });

  const markStudent = async (personId, date, status) => {
    // 1. Update local state immediately (optimistic)
    setState(s=>({...s,students:s.students.map(st=>st.id===personId?{...st,
      attendance:[...(st.attendance||[]).filter(a=>a.date!==date),{date,s:status}]}:st)}));
    // 2. Persist to Firestore attendance collection (separate collection for history)
    try {
      const q = query(collection(db,"attendance"),where("studentId","==",personId),where("date","==",date));
      const snap = await getDocs(q);
      if(snap.empty) await addDoc(collection(db,"attendance"),{studentId:personId,date,status,teacherId:teacher?.id});
      else await updateDoc(snap.docs[0].ref,{status,teacherId:teacher?.id});
    } catch(e) { console.warn("Attendance Firestore error:",e); }
  };

  const allStudentAtt = groupStudents.flatMap(s=>(s.attendance||[]).map(a=>({...a,studentId:s.id})));

  return (
    <div>
      <div style={{display:"flex",gap:6,marginBottom:14}}>
        {[["tomar","📋 Tomar"],["historial","📊 Historial"]].map(([id,label])=>(
          <button key={id} onClick={()=>setAttView(id)}
            style={{flex:1,padding:"8px",borderRadius:10,border:`1px solid ${C.g4}`,cursor:"pointer",
              fontFamily:SF,fontSize:13,fontWeight:600,
              background:attView===id?`${COLOR}15`:"#fff",
              color:attView===id?COLOR:C.lbl2}}>
            {label}
          </button>
        ))}
      </div>
      {attView==="tomar"&&(
        <>
          <div style={{background:"#fff",borderRadius:12,padding:"10px 14px",marginBottom:14,
            display:"flex",alignItems:"center",gap:10,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
            <span style={{fontSize:18}}>📅</span>
            <div style={{flex:1}}>
              <div style={{fontSize:11,color:C.lbl2,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em",fontFamily:SF,marginBottom:2}}>Fecha</div>
              <input type="date" value={attDate} onChange={e=>setAttDate(e.target.value)}
                style={{border:"none",background:"transparent",fontSize:15,color:C.lbl,fontFamily:SF,outline:"none",width:"100%"}}/>
            </div>
          </div>
          {groupStudents.length===0 ? (
            <div style={{textAlign:"center",padding:32,color:C.lbl2,fontSize:15,fontFamily:SF}}>No hay alumnos en este grupo</div>
          ) : (
            <AttendancePanel people={groupStudents} attendanceMap={studentAttMap} date={attDate} onMark={markStudent} accentColor={COLOR}/>
          )}
        </>
      )}
      {attView==="historial"&&(
        groupStudents.length===0 ? (
          <div style={{textAlign:"center",padding:32,color:C.lbl2,fontSize:15,fontFamily:SF}}>No hay alumnos en este grupo</div>
        ) : (
          <AttendanceHistory people={groupStudents} allAttendance={allStudentAtt} accentColor={COLOR}/>
        )
      )}
    </div>
  );
};

const DirectorApp=({state,setState,onLogout})=>{
  const [tab,setTab]=useState(()=>localStorage.getItem("dir_tab")||"feed");
  const [sidebarOpen,setSidebarOpen]=useState(true);
  const [mgmtTab,setMgmtTab]=useState(()=>localStorage.getItem("dir_mgmtTab")||"resumen");
  const [selectedPerson,setSelectedPerson]=useState(null);
  const [selectedGroup,setSelectedGroup]=useState(null);
  const [cycleModal,setCycleModal]=useState(false);
  const [newCycleName,setNewCycleName]=useState("");
  const [selectedRoom,setSelectedRoom]=useState(null);
  const [gradeFilter,setGradeFilter]=useState("all");
  const [groupFilter,setGroupFilter]=useState("all");
  const [newAviso,setNewAviso]=useState({title:"",body:"",type:"general"});
  const [showAvisoForm,setShowAvisoForm]=useState(false);
  const [newAct,setNewAct]=useState({title:"",type:"trabajo",date:"",dueDate:"",teacherId:"all",description:""});
  const [showActForm,setShowActForm]=useState(false);
  const [obsText,setObsText]=useState("");
  const [aiChatOpen,setAiChatOpen]=useState(false);
  const [aiMessages,setAiMessages]=useState([{role:"assistant",text:"Hola, soy tu asistente escolar. ¿En qué puedo ayudarte hoy?"}]);
  const [aiInput,setAiInput]=useState("");
  const [aiThinking,setAiThinking]=useState(false);
  // Edit student modal
  const [editStudentModal,setEditStudentModal]=useState(null);
  const [editStudentForm,setEditStudentForm]=useState({name:"",parentEmail:"",parentContact:"",group:""});
  const [editStudentPhoto,setEditStudentPhoto]=useState(null);
  const editStudentPhotoRef=useRef();

  const activeCycle=state.cycles.find(c=>c.id===state.activeCycle);
  const todayStr=today();
  const todayTeacherAtt=state.teacherAttendance?.[todayStr]||{};
  const todayStudentAtt=state.students.map(s=>({...s,todayStatus:s.attendance.find(a=>a.date===todayStr)?.s||"unknown"}));
  const allGrades=[...new Set(state.students.map(s=>s.grade))].sort();
  const allGroups=[...new Set(state.students.map(s=>s.group))].sort();
  const filteredStudents=state.students.filter(s=>{
    if(gradeFilter!=="all"&&s.grade!==parseInt(gradeFilter))return false;
    if(groupFilter!=="all"&&s.group!==groupFilter)return false;
    return true;
  });

  const setActiveCycle=(id)=>setState(s=>({...s,activeCycle:id}));
  const addCycle=()=>{if(!newCycleName.trim())return;setState(s=>({...s,cycles:[...s.cycles,{id:Date.now(),name:newCycleName.trim(),active:false}]}));setNewCycleName("");setCycleModal(false);};
  const approveAll=()=>setState(s=>({...s,approvedContent:[...s.approvedContent,...s.pendingContent],pendingContent:[]}));
  const approveOne=(id)=>{const item=state.pendingContent.find(p=>p.id===id);if(!item)return;setState(s=>({...s,approvedContent:[...s.approvedContent,item],pendingContent:s.pendingContent.filter(p=>p.id!==id)}));};
  const sendAiMessage=async()=>{
    if(!aiInput.trim()||aiThinking)return;
    const userMsg={role:"user",text:aiInput};
    setAiMessages(m=>[...m,userMsg]);
    setAiInput("");setAiThinking(true);
    const context=`Eres un asistente escolar para la directora. Datos actuales: ${state.students.length} alumnos, ${state.teachers.length} docentes, ${state.groups.length} grupos, ${state.pendingContent.length} aprobaciones pendientes. Responde de forma concisa y profesional en español.`;
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:400,
          messages:[{role:"user",content:`${context}\n\nPregunta: ${aiInput}`}]})});
      const data=await res.json();
      const reply=data.content?.[0]?.text||"No pude generar una respuesta.";
      setAiMessages(m=>[...m,{role:"assistant",text:reply}]);
    }catch{setAiMessages(m=>[...m,{role:"assistant",text:"Error de conexión. Intenta de nuevo."}]);}
    finally{setAiThinking(false);}
  };

  const rejectOne=(id)=>setState(s=>({...s,pendingContent:s.pendingContent.filter(p=>p.id!==id)}));

  const addAviso=()=>{
    if(!newAviso.title.trim()||!newAviso.body.trim())return;
    const a={id:Date.now(),fromName:"Directora Gómez",fromRole:"Directora",type:newAviso.type,title:newAviso.title,body:newAviso.body,time:todayStr,read:false};
    setState(s=>({...s,avisos:[a,...(s.avisos||[])]}));
    setNewAviso({title:"",body:"",type:"general"});setShowAvisoForm(false);
  };

  const addActividad=()=>{
    if(!newAct.title.trim()||!newAct.date)return;
    const a={id:Date.now(),title:newAct.title,type:newAct.type,date:newAct.date,dueDate:newAct.dueDate||"",teacherId:newAct.teacherId,description:newAct.description,status:"pendiente"};
    setState(s=>({...s,actividades:[a,...(s.actividades||[])]}));
    SFX.play("success");
    pushNotification({title:"📅 Actividad creada",text:`"${newAct.title}" programada para ${newAct.date}`});
    setNewAct({title:"",type:"trabajo",date:"",dueDate:"",teacherId:"all",description:""});setShowActForm(false);
  };

  const totalChatUnreadDir=(state.chats||[]).filter(c=>(c.participants||[]).includes("dir")).reduce((a,c)=>a+(c.unread?.["dir"]||0),0);

  // Director newsItems for bell
  const dirNewsItems=[
    ...(state.avisos||[]).filter(a=>a.type==="accident").map(a=>({id:`av${a.id}`,title:a.title,body:a.body||"",icon:"🚨",color:C.red,badge:"Urgente",time:a.time,urgent:true,dest:"management"})),
    ...(state.pendingContent||[]).map(c=>({id:`pc${c.id}`,title:`Aprobación: ${c.title}`,body:`${c.teacherName} · ${c.groupName}`,icon:"✅",color:C.green,badge:"Aprobar",time:c.date||"",dest:"management"})),
    ...(state.avisos||[]).filter(a=>a.type!=="accident").slice(0,5).map(a=>({id:`gav${a.id}`,title:a.title,body:a.body||"",icon:"📢",color:C.indigo,badge:"Aviso",time:a.time})),
  ];
  const dirUrgentCount=dirNewsItems.filter(n=>n.urgent).length;

  const tabs=[
    {id:"feed",label:"Tablón",icon:"📋"},
    {id:"management",label:"Gestión",icon:"📊"},
    {id:"chat",label:"Mensajes",icon:"💬"},
    {id:"settings",label:"Ajustes",icon:"⚙️"},
  ];

  // ── Vista: perfil de persona ──────────────────────────────────────────────
  if(selectedPerson){
    const isTeacher=selectedPerson._type==="teacher";
    const att=isTeacher
      ?Object.entries(state.teacherAttendance||{}).map(([date,data])=>({date,s:data?.[selectedPerson.id]?.status||"absent"}))
      :selectedPerson.attendance||[];
    return(
      <div style={{background:C.bg2,minHeight:"100vh",fontFamily:SF}}>
        <NavBar title={selectedPerson.name.split(" ")[0]} back="Regresar" onBack={()=>setSelectedPerson(null)} accent={C.indigo}/>
        <div className="page-pad">
          <Card style={{padding:20,marginBottom:16,display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
            <Ava initials={selectedPerson.avatar} color={selectedPerson.color} size={72}/>
            <div style={{...fmt.title3,color:C.lbl,fontFamily:SFD,textAlign:"center"}}>{selectedPerson.name}</div>
            {isTeacher
              ?<div style={{...fmt.subhead,color:C.lbl2,fontFamily:SF}}>{selectedPerson.subjects?.join(", ")} — Grupos: {selectedPerson.groups?.join(", ")}</div>
              :<div style={{...fmt.subhead,color:C.lbl2,fontFamily:SF}}>Grupo {selectedPerson.group}</div>}
            <div style={{background:C.fill4,borderRadius:10,padding:"8px 14px",width:"100%"}}>
              <div style={{...fmt.caption,color:C.lbl2,fontFamily:SF,textAlign:"center",marginBottom:4}}>Clave de Acceso</div>
              <div style={{fontFamily:"'SF Mono','Menlo',monospace",fontSize:16,fontWeight:700,color:C.lbl,textAlign:"center"}}>{selectedPerson.key}</div>
            </div>
          </Card>
          <Sec title={isTeacher?"Datos de Contacto":"Datos del Tutor"}>
            {isTeacher?(
              <><Row label="Correo electrónico" detail={selectedPerson.email} icon="📧" iconBg={`${C.blue}15`}/>
              <Div indent={46}/><Row label="Teléfono" detail={selectedPerson.contact} icon="📞" iconBg={`${C.green}15`}/></>
            ):(
              <>
              <Row label="Correo del padre/tutor" detail={selectedPerson.parentEmail} icon="📧" iconBg={`${C.blue}15`}/>
              <Div indent={46}/><Row label="Contacto" detail={selectedPerson.parentContact} icon="📞" iconBg={`${C.green}15`}/>
              {selectedPerson.parentContact&&(
                <div style={{padding:"10px 16px",borderTop:`0.5px solid ${C.sep}`}}>
                  <WaNotify phone={selectedPerson.parentContact} message={`Hola, le contactamos del Instituto Educativo sobre ${selectedPerson.name}. Por favor comuníquese con nosotros.`} label="Contactar Tutor por WhatsApp"/>
                </div>
              )}
              </>
            )}
          </Sec>

          {!isTeacher&&(<>
            <Sec title="Rendimiento Académico">
              <div style={{padding:"14px 16px"}}>
                {Object.entries(selectedPerson.subjects||{}).map(([subj,data],i,arr)=>{
                  const pct=Math.round((data.grade/10)*100);
                  const col=data.grade>=9?C.green:data.grade>=7?C.blue:data.grade>=6?C.orange:C.red;
                  return(
                    <div key={subj} style={{marginBottom:i<arr.length-1?16:0}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                        <div style={{...fmt.subhead,color:C.lbl,fontFamily:SF,fontWeight:500}}>{subj}</div>
                        <div style={{fontSize:16,fontWeight:700,color:col,fontFamily:SF}}>{data.grade.toFixed(1)}</div>
                      </div>
                      <div style={{height:6,background:C.fill3,borderRadius:3,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${col},${col}bb)`,borderRadius:3,transition:"width 0.5s ease"}}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Sec>
            <Sec title="Asistencia">
              <div style={{padding:"14px 16px"}}><AttCalendar attendance={att}/></div>
            </Sec>
            <Sec title="Observaciones">
              <div style={{padding:"12px 16px"}}>
                {(selectedPerson.observations||[]).length===0&&<div style={{...fmt.subhead,color:C.lbl3,fontFamily:SF,marginBottom:10}}>Sin observaciones registradas.</div>}
                {(selectedPerson.observations||[]).map((obs,i)=>(
                  <div key={i} style={{background:C.fill4,borderRadius:10,padding:"10px 12px",marginBottom:8}}>
                    <div style={{...fmt.caption,fontWeight:600,color:C.lbl2,fontFamily:SF,marginBottom:2}}>{obs.date}</div>
                    <div style={{...fmt.subhead,color:C.lbl,fontFamily:SF}}>{obs.text}</div>
                  </div>
                ))}
                <div style={{display:"flex",gap:8,marginTop:4,alignItems:"center"}}>
                  <input value={obsText} onChange={e=>setObsText(e.target.value)} placeholder="Nueva observación…"
                    style={{flex:1,background:C.fill4,border:`0.5px solid ${C.sep}`,borderRadius:20,padding:"8px 14px",fontSize:15,color:C.lbl,fontFamily:SF,outline:"none"}}/>
                  <button onClick={()=>{
                    if(!obsText.trim())return;
                    setState(s=>({...s,students:s.students.map(st=>st.id===selectedPerson.id?{...st,observations:[...(st.observations||[]),{date:todayStr,text:obsText}]}:st)}));
                    setObsText("");
                  }} style={{background:C.indigo,border:"none",borderRadius:"50%",width:32,height:32,cursor:"pointer",color:"#fff",fontSize:18,flexShrink:0}}>+</button>
                </div>
              </div>
            </Sec>
          </>)}

          {isTeacher&&(
            <Sec title="Asistencia">
              <div style={{padding:"14px 16px"}}><AttCalendar attendance={att}/></div>
            </Sec>
          )}
        </div>
      </div>
    );
  }

  // ── Vista: detalle de grupo ───────────────────────────────────────────────
  if(selectedGroup){
    const teacher=state.teachers.find(t=>t.id===selectedGroup.teacherId);
    const studs=state.students.filter(s=>selectedGroup.students.includes(s.id));
    return(
      <div style={{background:C.bg2,minHeight:"100vh",fontFamily:SF}}>
        <NavBar title={selectedGroup.name} back="Grupos" onBack={()=>setSelectedGroup(null)} accent={C.indigo}/>
        <div className="page-pad">
          <Card style={{padding:16,marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:teacher?14:0}}>
              <div style={{width:56,height:56,borderRadius:16,background:`${C.indigo}12`,border:`1px solid ${C.indigo}20`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <span style={{fontSize:15,fontWeight:800,color:C.indigo,fontFamily:SF}}>{selectedGroup.name}</span>
              </div>
              <div style={{flex:1}}>
                <div style={{...fmt.title3,color:C.lbl,fontFamily:SFD}}>{selectedGroup.subject} — {selectedGroup.name}</div>
                <div style={{...fmt.caption,color:C.lbl3,fontFamily:SF,marginTop:4}}>{studs.length} alumno{studs.length!==1?"s":""} inscritos</div>
              </div>
            </div>
            {teacher&&(
              <div style={{borderTop:`0.5px solid ${C.sep}`,paddingTop:12}}>
                <div style={{fontSize:11,fontWeight:600,color:C.lbl2,textTransform:"uppercase",letterSpacing:"0.06em",fontFamily:SF,marginBottom:8}}>Docente</div>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{position:"relative",flexShrink:0}}>
                    <Ava initials={teacher.avatar} color={teacher.color} size={40}/>
                    <div style={{position:"absolute",bottom:0,right:0,width:12,height:12,borderRadius:"50%",background:C.green,border:"2px solid #fff",boxShadow:"0 1px 3px rgba(52,199,89,0.5)"}}/>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{...fmt.callout,fontWeight:600,color:C.lbl,fontFamily:SF}}>{teacher.name}</div>
                    <div style={{display:"flex",alignItems:"center",gap:5,marginTop:2}}>
                      <div style={{width:7,height:7,borderRadius:"50%",background:C.green}}/>
                      <span style={{fontSize:12,color:C.green,fontWeight:600,fontFamily:SF}}>Activo</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>

          <Sec title="Alumnos y Calificaciones">
            {studs.length===0&&<div style={{padding:"20px 16px",textAlign:"center",color:C.lbl2,fontSize:15,fontFamily:SF}}>Sin alumnos inscritos.</div>}
            {studs.map((s,i)=>{
              const vals=Object.values(s.subjects||{});
              const avg=vals.length>0?vals.reduce((a,b)=>a+(b.grade||0),0)/vals.length:null;
              const avgCol=avg===null?C.g2:avg>=9?C.green:avg>=7?C.blue:avg>=6?C.orange:C.red;
              return(
                <div key={s.id}>
                  <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px"}}>
                    <div style={{position:"relative",flexShrink:0,cursor:"pointer"}}
                      onClick={()=>{setSelectedGroup(null);setSelectedPerson({...s,_type:"student"});}}>
                      <Ava initials={s.avatar} color={s.color} size={40} img={s.photo}/>
                      <div style={{position:"absolute",bottom:0,right:0,width:12,height:12,borderRadius:"50%",background:C.green,border:"2px solid #fff",boxShadow:"0 1px 3px rgba(52,199,89,0.5)"}}/>
                    </div>
                    <div style={{flex:1,cursor:"pointer"}}
                      onClick={()=>{setSelectedGroup(null);setSelectedPerson({...s,_type:"student"});}}>
                      <div style={{...fmt.callout,fontWeight:600,color:C.lbl,fontFamily:SF}}>{s.name}</div>
                      <div style={{display:"flex",gap:6,marginTop:5,flexWrap:"wrap"}}>
                        {Object.entries(s.subjects||{}).map(([subj,data])=>{
                          const col=data.grade>=9?C.green:data.grade>=7?C.blue:data.grade>=6?C.orange:C.red;
                          return<span key={subj} style={{fontSize:10,fontWeight:600,color:col,background:`${col}12`,borderRadius:5,padding:"2px 7px",fontFamily:SF}}>{subj.substring(0,4)}: {data.grade.toFixed(1)}</span>;
                        })}
                      </div>
                    </div>
                    {avg!==null&&<div style={{textAlign:"center",minWidth:38}}>
                      <div style={{fontSize:18,fontWeight:700,color:avgCol,fontFamily:SF}}>{avg.toFixed(1)}</div>
                      <div style={{fontSize:10,color:C.lbl3,fontFamily:SF}}>prom.</div>
                    </div>}
                    <button onClick={()=>{
                      setEditStudentModal(s);
                      setEditStudentForm({name:s.name,parentEmail:s.parentEmail||"",parentContact:s.parentContact||"",group:s.group||""});
                      setEditStudentPhoto(s.photo||null);
                      SFX.play("click");
                    }} style={{background:`${C.blue}15`,border:"none",borderRadius:8,padding:"5px 10px",color:C.blue,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:SF,flexShrink:0}}>✏️</button>
                    <svg width="8" height="13" viewBox="0 0 8 13" fill="none"
                      onClick={()=>{setSelectedGroup(null);setSelectedPerson({...s,_type:"student"});}}
                      style={{cursor:"pointer"}}><path d="M1 1L7 6.5L1 12" stroke={C.g3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  {i<studs.length-1&&<Div indent={68}/>}
                </div>
              );
            })}
          </Sec>

          {/* Edit Student Modal */}
          <Modal open={!!editStudentModal} onClose={()=>setEditStudentModal(null)} title={`Editar: ${editStudentModal?.name?.split(" ")[0]}`}>
            <div style={{textAlign:"center",marginBottom:14}}>
              <div style={{position:"relative",display:"inline-block"}}>
                <Ava initials={editStudentModal?.avatar||"?"} color={editStudentModal?.color||C.blue} size={72} img={editStudentPhoto}/>
                <button onClick={()=>editStudentPhotoRef.current?.click()}
                  style={{position:"absolute",bottom:0,right:0,width:24,height:24,borderRadius:"50%",
                    background:C.indigo,border:"2px solid #fff",color:"#fff",fontSize:12,cursor:"pointer",
                    display:"flex",alignItems:"center",justifyContent:"center"}}>📷</button>
              </div>
              <input ref={editStudentPhotoRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{
                const f=e.target.files?.[0]; if(!f)return;
                const r=new FileReader(); r.onload=ev=>setEditStudentPhoto(ev.target.result); r.readAsDataURL(f);
              }}/>
              <div style={{fontSize:11,color:C.lbl2,fontFamily:SF,marginTop:6}}>Toca el ícono para cambiar foto</div>
            </div>
            <Input label="Nombre Completo" value={editStudentForm.name} onChange={v=>setEditStudentForm(f=>({...f,name:v}))}/>
            <Input label="Correo del Tutor" value={editStudentForm.parentEmail} onChange={v=>setEditStudentForm(f=>({...f,parentEmail:v}))} type="email"/>
            <Input label="Contacto del Tutor" value={editStudentForm.parentContact} onChange={v=>setEditStudentForm(f=>({...f,parentContact:v}))}/>
            <Input label="Grupo" value={editStudentForm.group} onChange={v=>setEditStudentForm(f=>({...f,group:v}))}/>
            <Btn onPress={()=>{
              if(!editStudentModal)return;
              const updated={...editStudentModal,...editStudentForm,photo:editStudentPhoto||editStudentModal.photo};
              setState(s=>({...s,students:s.students.map(st=>st.id===updated.id?updated:st)}));
              SFX.play("success");
              pushNotification({title:"✅ Perfil actualizado",text:`Información de ${updated.name} guardada.`});
              setEditStudentModal(null);
            }} full color={C.indigo}>Guardar Cambios</Btn>
          </Modal>

          <Sec title="Observaciones del Grupo">
            <div style={{padding:"12px 16px"}}>
              {(selectedGroup.observations||[]).length===0&&<div style={{...fmt.subhead,color:C.lbl3,fontFamily:SF,marginBottom:10}}>Sin observaciones registradas.</div>}
              {(selectedGroup.observations||[]).map((obs,i)=>(
                <div key={i} style={{background:C.fill4,borderRadius:10,padding:"10px 12px",marginBottom:8}}>
                  <div style={{...fmt.caption,fontWeight:600,color:C.lbl2,fontFamily:SF,marginBottom:2}}>{obs.date}</div>
                  <div style={{...fmt.subhead,color:C.lbl,fontFamily:SF}}>{obs.text}</div>
                </div>
              ))}
              <div style={{display:"flex",gap:8,marginTop:4,alignItems:"center"}}>
                <input value={obsText} onChange={e=>setObsText(e.target.value)} placeholder="Nueva observación al grupo…"
                  style={{flex:1,background:C.fill4,border:`0.5px solid ${C.sep}`,borderRadius:20,padding:"8px 14px",fontSize:15,color:C.lbl,fontFamily:SF,outline:"none"}}/>
                <button onClick={()=>{
                  if(!obsText.trim())return;
                  setState(s=>({...s,groups:s.groups.map(g=>g.id===selectedGroup.id?{...g,observations:[...(g.observations||[]),{date:todayStr,text:obsText}]}:g)}));
                  setObsText("");
                }} style={{background:C.indigo,border:"none",borderRadius:"50%",width:32,height:32,cursor:"pointer",color:"#fff",fontSize:18,flexShrink:0}}>+</button>
              </div>
            </div>
          </Sec>
        </div>
      </div>
    );
  }

  // ── Vista principal ───────────────────────────────────────────────────────
  return(
    <div className="app-layout" style={{background:C.bg2,minHeight:"100vh",fontFamily:SF}}>

      <AppSidebar
        open={sidebarOpen} onToggle={()=>setSidebarOpen(o=>!o)}
        gradient="linear-gradient(180deg,#3730a3 0%,#4f46e5 60%,#6366f1 100%)"
        logoEmoji="🏫" logoLine1="Instituto" logoLine2="Educativo"
        userEmoji="👩‍💼" userName="Directora Gómez" userSub={activeCycle?.name||"Ciclo activo"}
        onLogout={onLogout}
        navItems={[
          {id:"feed",icon:"📋",label:"Tablón",active:tab==="feed",onClick:()=>{setTab("feed");localStorage.setItem("dir_tab","feed");}},
          {id:"management",icon:"📊",label:"Gestión",active:tab==="management",onClick:()=>{setTab("management");localStorage.setItem("dir_tab","management");},
            subItems:[
              {id:"resumen",icon:"📈",label:"Resumen",active:mgmtTab==="resumen",onClick:()=>{setMgmtTab("resumen");localStorage.setItem("dir_mgmtTab","resumen");}},
              {id:"asistencia",icon:"📅",label:"Asistencia",active:mgmtTab==="asistencia",onClick:()=>{setMgmtTab("asistencia");localStorage.setItem("dir_mgmtTab","asistencia");}},
              {id:"personal",icon:"👩‍🏫",label:"Personal",active:mgmtTab==="personal",onClick:()=>{setMgmtTab("personal");localStorage.setItem("dir_mgmtTab","personal");}},
              {id:"alumnos",icon:"🎒",label:"Alumnos",active:mgmtTab==="alumnos",onClick:()=>{setMgmtTab("alumnos");localStorage.setItem("dir_mgmtTab","alumnos");}},
              {id:"grupos",icon:"👥",label:"Grupos",active:mgmtTab==="grupos",onClick:()=>{setMgmtTab("grupos");localStorage.setItem("dir_mgmtTab","grupos");}},
              {id:"avisos",icon:"📢",label:"Avisos",active:mgmtTab==="avisos",onClick:()=>{setMgmtTab("avisos");localStorage.setItem("dir_mgmtTab","avisos");},badge:(state.avisos||[]).filter(a=>!a.read).length},
              {id:"actividades",icon:"🗓️",label:"Actividades",active:mgmtTab==="actividades",onClick:()=>{setMgmtTab("actividades");localStorage.setItem("dir_mgmtTab","actividades");}},
              {id:"aprobaciones",icon:"✅",label:"Aprobaciones",active:mgmtTab==="aprobaciones",onClick:()=>{setMgmtTab("aprobaciones");localStorage.setItem("dir_mgmtTab","aprobaciones");},badge:state.pendingContent.length},
            ]},
          {id:"chat",icon:"💬",label:"Mensajes",active:tab==="chat",onClick:()=>{setTab("chat");localStorage.setItem("dir_tab","chat");},badge:totalChatUnreadDir||0},
          {id:"settings",icon:"⚙️",label:"Ajustes",active:tab==="settings",onClick:()=>{setTab("settings");localStorage.setItem("dir_tab","settings");}},
        ]}
      />

      {/* ── MAIN CONTENT PANEL ──────────────────────────────────────────────── */}
      <div style={{flex:1,minWidth:0,minHeight:"100vh",overflowX:"hidden"}}>
        {tab==="feed"&&<Feed state={state} setState={setState} userId="dir" userName="Directora Gómez" userAvatar="DG" userColor={C.indigo} userRole="director" accent={C.indigo} newsItems={dirNewsItems} urgentCount={dirUrgentCount}/>}

        {tab==="chat"&&(
          <ChatPanel state={state} setState={setState}
            myUserId="dir" myName="Directora Gómez"
            myAvatar="DG" myColor={C.indigo}
            role="director" accent={C.indigo}/>
        )}

        {tab==="management"&&(
          <div>
            <NavBar title="Gestión Escolar" large accent={C.indigo}
              right={<button onClick={()=>setCycleModal(true)} style={{background:`${C.indigo}10`,border:`1px solid ${C.indigo}25`,borderRadius:20,padding:"5px 14px",color:C.indigo,fontSize:13,fontWeight:600,fontFamily:SF,cursor:"pointer"}}>{activeCycle?.name}</button>}/>
            <div style={{padding:"0 16px 100px"}}>


            {mgmtTab==="resumen"&&(()=>{
              const recentAvisos=state.avisos||[];
              const hasAccident=recentAvisos.some(a=>a.type==="accident"&&!a.read);
              const hasBoardAlert=recentAvisos.some(a=>a.type==="board"&&!a.read);
              const hasGeneral=recentAvisos.some(a=>a.type==="general"&&!a.read);
              const hasAdmin=recentAvisos.some(a=>a.type==="administrative"&&!a.read);
              const AlertDot=({active,label,x,y,color=C.red})=>active?(
                <g>
                  <circle cx={x} cy={y} r="7" fill={color} opacity="0.15"/>
                  <circle cx={x} cy={y} r="4.5" fill={color}/>
                  <text x={x} y={y+1} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="5" fontWeight="bold">!!</text>
                </g>
              ):null;
              return(
                <>
                  {/* Croquis del Instituto */}
                  <Card style={{marginBottom:14,overflow:"hidden"}}>
                    <div style={{padding:"12px 14px 6px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div style={{...fmt.subhead,fontWeight:600,color:C.lbl,fontFamily:SF}}>Croquis del Instituto</div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        {recentAvisos.filter(a=>!a.read).length>0&&(
                          <span style={{fontSize:11,fontWeight:700,color:C.red,background:`${C.red}12`,borderRadius:6,padding:"3px 9px",fontFamily:SF}}>
                            {recentAvisos.filter(a=>!a.read).length} alerta{recentAvisos.filter(a=>!a.read).length>1?"s":""}
                          </span>
                        )}
                        <span style={{fontSize:10,color:C.lbl3,fontFamily:SF}}>Toca un salón</span>
                      </div>
                    </div>
                    {(()=>{
                      // map room label → group name
                      const roomToGroup={"Salón 1°A":"1°A","Salón 1°B":"1°B","Salón 2°A":"2°A","Salón 2°B":"2°B","Salón 3°A":"3°A","Salón 3°B":"3°B"};
                      const clickableA=[["Salón 1°A",28,32],["Salón 1°B",28,65],["Dirección",28,98],["Sala Doc.",28,131],["Biblioteca",28,164]];
                      const clickableB=[["Salón 2°A",243,32],["Salón 2°B",243,65],["Salón 3°A",243,98],["Salón 3°B",243,131],["Lab. Cien.",243,164]];
                      const hasGroup=(l)=>!!roomToGroup[l];
                      const RoomRect=({label,x,y,stroke,fill})=>{
                        const clickable=hasGroup(label);
                        const grpName=roomToGroup[label];
                        const grp=state.groups.find(g=>g.name===grpName);
                        const occupants=grp?state.students.filter(s=>grp.students.includes(s.id)):[];
                        const presentCount=occupants.filter(s=>s.attendance.find(a=>a.date===todayStr&&a.s==="present")).length;
                        return(
                          <g key={label} style={{cursor:clickable?"pointer":"default"}}
                            onClick={()=>clickable&&setSelectedRoom(label)}>
                            <rect x={x-10} y={y-10} width="68" height="24" rx="3"
                              fill={selectedRoom===label?`${C.indigo}30`:fill||"white"}
                              stroke={selectedRoom===label?C.indigo:stroke}
                              strokeWidth={selectedRoom===label?"1.5":"0.8"}/>
                            <text x={x+24} y={y+5} textAnchor="middle" fill={clickable?"#1a1a7e":"#444"} fontSize="6"
                              fontWeight={clickable?"700":"400"}>{label}</text>
                            {clickable&&grp&&(
                              <circle cx={x+54} cy={y-4} r="3.5" fill={presentCount>0?C.green:C.g3}/>
                            )}
                          </g>
                        );
                      };
                      return(
                        <svg width="100%" viewBox="0 0 320 280" style={{display:"block",background:"#F8F9FC",minHeight:220}}>
                          {/* Patio central */}
                          <rect x="100" y="90" width="120" height="95" rx="6" fill="#E8F4FD" stroke="#B8D4E8" strokeWidth="1.5"/>
                          <text x="160" y="138" textAnchor="middle" fill="#5A8FA8" fontSize="9" fontWeight="500">Patio Central</text>
                          {/* Edificio A */}
                          <rect x="8" y="22" width="88" height="210" rx="7" fill="#EEF2FF" stroke={C.indigo} strokeWidth="1.4" opacity="0.7"/>
                          <text x="52" y="16" textAnchor="middle" fill={C.indigo} fontSize="8" fontWeight="700">EDIFICIO A</text>
                          {clickableA.map(([l,x,y])=><RoomRect key={l} label={l} x={x} y={y} stroke="#C5CAE9"/>)}
                          {/* Edificio B */}
                          <rect x="224" y="22" width="88" height="210" rx="7" fill="#F0FFF4" stroke={C.green} strokeWidth="1.4" opacity="0.7"/>
                          <text x="268" y="16" textAnchor="middle" fill={C.green} fontSize="8" fontWeight="700">EDIFICIO B</text>
                          {clickableB.map(([l,x,y])=><RoomRect key={l} label={l} x={x} y={y} stroke="#C8E6C9"/>)}
                          {/* Area Servicios */}
                          <rect x="80" y="215" width="160" height="50" rx="7" fill="#FFF8E1" stroke={C.orange} strokeWidth="1.4" opacity="0.7"/>
                          <text x="160" y="210" textAnchor="middle" fill={C.orange} fontSize="8" fontWeight="700">ÁREA DE SERVICIOS</text>
                          {[["Enfermería",90,235],["Cooperativa",175,235]].map(([l,x,y])=>(
                            <g key={l}>
                              <rect x={x-5} y={y-10} width={l.length*5.5+10} height="24" rx="3" fill="white" stroke="#FFE0B2" strokeWidth="0.9"/>
                              <text x={x+(l.length*5.5+10)/2-5} y={y+4} textAnchor="middle" fill="#444" fontSize="7">{l}</text>
                            </g>
                          ))}
                          {/* Entrada Principal */}
                          <rect x="124" y="253" width="72" height="18" rx="4" fill="#E3F2FD" stroke="#90CAF9" strokeWidth="1.2"/>
                          <text x="160" y="264" textAnchor="middle" fill="#1565C0" fontSize="7" fontWeight="600">ENTRADA PRINCIPAL</text>
                          {/* Alert dots */}
                          <AlertDot active={hasAccident} label="!!" x={52} y={110} color={C.red}/>
                          <AlertDot active={hasBoardAlert} label="!!" x={268} y={110} color={C.purple}/>
                          <AlertDot active={hasGeneral} label="!!" x={160} y={130} color={C.orange}/>
                          <AlertDot active={hasAdmin} label="!!" x={52} y={145} color={C.blue}/>
                          {/* Legend */}
                          <circle cx="108" cy="276" r="3.5" fill={C.green}/>
                          <text x="115" y="279" fill="#666" fontSize="6.5">Alumnos presentes</text>
                          <circle cx="200" cy="276" r="3.5" fill={C.g3}/>
                          <text x="207" y="279" fill="#666" fontSize="6.5">Sin registro</text>
                        </svg>
                      );
                    })()}
                    {/* Room detail panel */}
                    {selectedRoom&&(()=>{
                      const roomToGroup={"Salón 1°A":"1°A","Salón 1°B":"1°B","Salón 2°A":"2°A","Salón 2°B":"2°B","Salón 3°A":"3°A","Salón 3°B":"3°B"};
                      const grpName=roomToGroup[selectedRoom];
                      const grp=state.groups.find(g=>g.name===grpName);
                      const teacher=grp?state.teachers.find(t=>t.id===grp.teacherId):null;
                      const studs=grp?state.students.filter(s=>grp.students.includes(s.id)):[];
                      const teacherAtt=teacher?todayTeacherAtt[teacher.id]:null;
                      const teacherPresent=teacherAtt?.status==="present";
                      return(
                        <div style={{borderTop:`0.5px solid ${C.sep}`,background:"#fff"}}>
                          {/* Header */}
                          <div style={{padding:"12px 14px 8px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                            <div>
                              <div style={{...fmt.callout,fontWeight:700,color:C.indigo,fontFamily:SF}}>{selectedRoom}</div>
                              <div style={{...fmt.caption,color:C.lbl2,fontFamily:SF}}>
                                {grp?`${grp.subject} — Grupo ${grpName}`:"Sin grupo asignado"}
                              </div>
                            </div>
                            <button onClick={()=>setSelectedRoom(null)}
                              style={{background:C.fill3,border:"none",borderRadius:"50%",width:26,height:26,
                                cursor:"pointer",color:C.lbl2,fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
                          </div>
                          {/* Teacher row */}
                          {teacher?(
                            <div style={{padding:"8px 14px",borderBottom:`0.5px solid ${C.sep}`}}>
                              <div style={{fontSize:10,fontWeight:700,color:C.lbl3,textTransform:"uppercase",letterSpacing:"0.06em",fontFamily:SF,marginBottom:6}}>Docente</div>
                              <div style={{display:"flex",alignItems:"center",gap:10}}>
                                <div style={{position:"relative",flexShrink:0}}>
                                  <Ava initials={teacher.avatar} color={teacher.color} size={36}/>
                                  <div style={{position:"absolute",bottom:-1,right:-1,width:11,height:11,borderRadius:"50%",
                                    background:teacherPresent?C.green:C.g3,border:"2px solid #fff"}}/>
                                </div>
                                <div style={{flex:1}}>
                                  <div style={{...fmt.callout,fontWeight:600,color:C.lbl,fontFamily:SF}}>{teacher.name}</div>
                                  <div style={{...fmt.caption,color:C.lbl2,fontFamily:SF}}>
                                    {[...new Set((state.groups||[]).flatMap(g=>(g.subjects||[]).filter(s=>String(s.teacherId)===String(teacher.id)).map(s=>s.subject)))].join(", ")||(teacher.subjects||[]).join(", ")||"Sin materias"}
                                  </div>
                                </div>
                                <span style={{fontSize:11,fontWeight:600,borderRadius:6,padding:"2px 8px",fontFamily:SF,
                                  color:teacherPresent?C.green:C.g1,background:teacherPresent?`${C.green}15`:C.fill4}}>
                                  {teacherPresent?`Presente ${teacherAtt.time}`:"Sin registro"}
                                </span>
                              </div>
                            </div>
                          ):(
                            <div style={{padding:"8px 14px",borderBottom:`0.5px solid ${C.sep}`,color:C.lbl3,fontSize:13,fontFamily:SF}}>
                              Sin docente asignado a este grupo.
                            </div>
                          )}
                          {/* Students list */}
                          <div style={{padding:"8px 0 4px"}}>
                            <div style={{fontSize:10,fontWeight:700,color:C.lbl3,textTransform:"uppercase",letterSpacing:"0.06em",fontFamily:SF,padding:"0 14px",marginBottom:5}}>
                              Alumnos — {studs.length} inscritos
                            </div>
                            {studs.length===0&&(
                              <div style={{padding:"12px 14px",color:C.lbl3,fontSize:13,fontFamily:SF}}>Sin alumnos inscritos.</div>
                            )}
                            {studs.map((s,i)=>{
                              const todayRec=s.attendance.find(a=>a.date===todayStr);
                              const present=todayRec?.s==="present";
                              const justified=todayRec?.s==="justified";
                              const absent=todayRec?.s==="absent";
                              const dotColor=present?C.green:justified?C.orange:absent?C.red:C.g3;
                              const statusLabel=present?"Presente":justified?"Justificada":absent?"Falta":"Sin registro";
                              return(
                                <div key={s.id}>
                                  <div style={{display:"flex",alignItems:"center",gap:10,padding:"7px 14px"}}>
                                    <div style={{position:"relative",flexShrink:0}}>
                                      <Ava initials={s.avatar} color={s.color} size={32}/>
                                      <div style={{position:"absolute",bottom:-1,right:-1,width:10,height:10,borderRadius:"50%",
                                        background:dotColor,border:"2px solid #fff"}}/>
                                    </div>
                                    <div style={{flex:1}}>
                                      <div style={{fontSize:13,fontWeight:600,color:C.lbl,fontFamily:SF}}>{s.name}</div>
                                    </div>
                                    <span style={{fontSize:10,fontWeight:600,borderRadius:5,padding:"2px 7px",fontFamily:SF,
                                      color:dotColor,background:`${dotColor}15`}}>
                                      {statusLabel}
                                    </span>
                                  </div>
                                  {i<studs.length-1&&<Div indent={56}/>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                    {recentAvisos.filter(a=>!a.read).length>0&&(
                      <div style={{padding:"8px 14px 12px",display:"flex",flexDirection:"column",gap:5,borderTop:`0.5px solid ${C.sep}`}}>
                        {recentAvisos.filter(a=>!a.read).map(a=>{
                          const col={accident:C.red,board:C.purple,general:C.orange,administrative:C.blue}[a.type]||C.g1;
                          const lbl={accident:"Accidente",board:"Tablón",general:"General",administrative:"Admin."}[a.type]||"Aviso";
                          return(
                            <div key={a.id} style={{display:"flex",alignItems:"center",gap:8,background:`${col}08`,borderRadius:8,padding:"7px 10px"}}>
                              <div style={{width:7,height:7,borderRadius:"50%",background:col,flexShrink:0}}/>
                              <div style={{flex:1,fontSize:12,color:C.lbl,fontFamily:SF,fontWeight:500}}>{a.title}</div>
                              <span style={{fontSize:10,fontWeight:600,color:col,fontFamily:SF}}>{lbl}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>

                  {/* Fin del resumen — asistencia detallada disponible en tab Asistencia */}
                </>
              );
            })()}


            {mgmtTab==="asistencia"&&(
              <DirectorAttendanceTab state={state} setState={setState} todayStr={todayStr}/>
            )}

            {mgmtTab==="personal"&&(
              <Sec title={`Docentes — ${state.teachers.length} registrados`}>
                {state.teachers.map((t,i)=>(
                  <div key={t.id}>
                    <div onClick={()=>setSelectedPerson({...t,_type:"teacher"})}
                      style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",cursor:"pointer"}}
                      onMouseEnter={e=>e.currentTarget.style.background=C.fill4}
                      onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <Ava initials={t.avatar} color={t.color} size={42}/>
                      <div style={{flex:1}}>
                        <div style={{...fmt.callout,fontWeight:600,color:C.lbl,fontFamily:SF}}>{t.name}</div>
                        <div style={{...fmt.caption,color:C.lbl2,fontFamily:SF,marginTop:1}}>{t.subjects.join(", ")} — {t.groups.join(", ")}</div>
                        <div style={{fontFamily:"'SF Mono','Menlo',monospace",fontSize:11,color:C.indigo,marginTop:2}}>{t.key}</div>
                      </div>
                      <svg width="8" height="13" viewBox="0 0 8 13" fill="none"><path d="M1 1L7 6.5L1 12" stroke={C.g3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                    {i<state.teachers.length-1&&<Div indent={70}/>}
                  </div>
                ))}
              </Sec>
            )}

            {mgmtTab==="alumnos"&&(
              <>
                <div style={{display:"flex",gap:8,marginBottom:12}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,color:C.lbl2,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4,fontFamily:SF}}>Grado</div>
                    <select value={gradeFilter} onChange={e=>{setGradeFilter(e.target.value);setGroupFilter("all");}}
                      style={{width:"100%",background:"#fff",border:`1px solid ${C.g4}`,borderRadius:10,padding:"9px 12px",fontSize:15,color:C.lbl,fontFamily:SF,outline:"none"}}>
                      <option value="all">Todos los grados</option>
                      {allGrades.map(g=><option key={g} value={g}>{g}° Grado</option>)}
                    </select>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,color:C.lbl2,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4,fontFamily:SF}}>Grupo</div>
                    <select value={groupFilter} onChange={e=>setGroupFilter(e.target.value)}
                      style={{width:"100%",background:"#fff",border:`1px solid ${C.g4}`,borderRadius:10,padding:"9px 12px",fontSize:15,color:C.lbl,fontFamily:SF,outline:"none"}}>
                      <option value="all">Todos los grupos</option>
                      {allGroups.filter(g=>gradeFilter==="all"||g.startsWith(gradeFilter)).map(g=><option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{...fmt.caption,color:C.lbl2,fontFamily:SF,marginBottom:8,paddingLeft:2}}>
                  {filteredStudents.length} alumno{filteredStudents.length!==1?"s":""} encontrado{filteredStudents.length!==1?"s":""}
                </div>
                <Sec>
                  {filteredStudents.length===0&&<div style={{padding:"20px 16px",textAlign:"center",color:C.lbl2,fontSize:15,fontFamily:SF}}>Sin resultados para los filtros aplicados.</div>}
                  {filteredStudents.map((s,i)=>{
                    const vals=Object.values(s.subjects||{});
                    const avg=vals.length>0?vals.reduce((a,b)=>a+(b.grade||0),0)/vals.length:null;
                    const avgCol=avg===null?C.g2:avg>=9?C.green:avg>=7?C.blue:avg>=6?C.orange:C.red;
                    return(
                      <div key={s.id}>
                        <div onClick={()=>setSelectedPerson({...s,_type:"student"})}
                          style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",cursor:"pointer"}}
                          onMouseEnter={e=>e.currentTarget.style.background=C.fill4}
                          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                          <Ava initials={s.avatar} color={s.color} size={42}/>
                          <div style={{flex:1}}>
                            <div style={{...fmt.callout,fontWeight:600,color:C.lbl,fontFamily:SF}}>{s.name}</div>
                            <div style={{...fmt.caption,color:C.lbl2,fontFamily:SF,marginTop:1}}>Grupo {s.group}</div>
                          </div>
                          {avg!==null&&<div style={{textAlign:"right",minWidth:42}}>
                            <div style={{fontSize:17,fontWeight:700,color:avgCol,fontFamily:SF}}>{avg.toFixed(1)}</div>
                            <div style={{fontSize:10,color:C.lbl3,fontFamily:SF}}>promedio</div>
                          </div>}
                          <svg width="8" height="13" viewBox="0 0 8 13" fill="none"><path d="M1 1L7 6.5L1 12" stroke={C.g3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                        {i<filteredStudents.length-1&&<Div indent={70}/>}
                      </div>
                    );
                  })}
                </Sec>
              </>
            )}

            {mgmtTab==="grupos"&&(
              <Sec title={`Grupos — ${state.groups.length}`}>
                {state.groups.map((g,i)=>{
                  const teacher=state.teachers.find(t=>t.id===g.teacherId);
                  const studs=state.students.filter(s=>g.students.includes(s.id));
                  return(
                    <div key={g.id}>
                      <div onClick={()=>setSelectedGroup(g)}
                        style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",cursor:"pointer"}}
                        onMouseEnter={e=>e.currentTarget.style.background=C.fill4}
                        onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                        <div style={{width:46,height:46,borderRadius:12,background:`${C.indigo}10`,border:`1px solid ${C.indigo}18`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                          <span style={{fontSize:13,fontWeight:800,color:C.indigo,fontFamily:SF}}>{g.name}</span>
                        </div>
                        <div style={{flex:1}}>
                          <div style={{...fmt.callout,fontWeight:600,color:C.lbl,fontFamily:SF}}>{g.subject} — {g.name}</div>
                          <div style={{...fmt.caption,color:C.lbl2,fontFamily:SF,marginTop:1}}>{teacher?.name||"Sin docente"} · {studs.length} alumnos</div>
                        </div>
                        <svg width="8" height="13" viewBox="0 0 8 13" fill="none"><path d="M1 1L7 6.5L1 12" stroke={C.g3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                      {i<state.groups.length-1&&<Div indent={74}/>}
                    </div>
                  );
                })}
              </Sec>
            )}

            {mgmtTab==="avisos"&&(
              <>
                <Btn onPress={()=>setShowAvisoForm(!showAvisoForm)} full color={C.indigo} variant={showAvisoForm?"ghost":"filled"} style={{marginBottom:12}}>
                  {showAvisoForm?"Cancelar":"+ Nuevo Aviso"}
                </Btn>
                {showAvisoForm&&(
                  <Card style={{padding:14,marginBottom:12}}>
                    <select value={newAviso.type} onChange={e=>setNewAviso(a=>({...a,type:e.target.value}))}
                      style={{width:"100%",background:C.fill4,border:`0.5px solid ${C.sep}`,borderRadius:10,padding:"8px 12px",fontSize:15,color:C.lbl,fontFamily:SF,marginBottom:10,outline:"none"}}>
                      <option value="general">Aviso General</option>
                      <option value="accident">Reporte de Accidente</option>
                      <option value="board">Publicación en Tablón</option>
                      <option value="administrative">Administrativo</option>
                    </select>
                    <Input placeholder="Título del aviso" value={newAviso.title} onChange={v=>setNewAviso(a=>({...a,title:v}))}/>
                    <textarea value={newAviso.body} onChange={e=>setNewAviso(a=>({...a,body:e.target.value}))}
                      placeholder="Descripción detallada…" rows={3}
                      style={{width:"100%",background:C.fill4,border:`0.5px solid ${C.sep}`,borderRadius:10,padding:"10px 12px",fontSize:15,color:C.lbl,fontFamily:SF,resize:"none",outline:"none",boxSizing:"border-box",marginBottom:10}}/>
                    <Btn onPress={addAviso} full disabled={!newAviso.title.trim()||!newAviso.body.trim()}>Publicar Aviso</Btn>
                  </Card>
                )}
                {(state.avisos||[]).length===0&&!showAvisoForm&&(
                  <div style={{textAlign:"center",padding:"40px 16px",color:C.lbl2,fontSize:15,fontFamily:SF}}>Sin avisos registrados.</div>
                )}
                {(state.avisos||[]).map((a)=>{
                  const typeColor={general:C.blue,accident:C.red,board:C.purple,administrative:C.orange}[a.type]||C.blue;
                  const typeLabel={general:"General",accident:"Accidente",board:"Tablón",administrative:"Administrativo"}[a.type]||"Aviso";
                  return(
                    <Card key={a.id} style={{marginBottom:10,padding:14,border:a.type==="accident"?`1.5px solid ${C.red}40`:"none",background:a.type==="accident"?`${C.red}04`:"#fff"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                        <div style={{flex:1,marginRight:10}}>
                          {a.type==="accident"&&<div style={{fontSize:9,fontWeight:800,color:C.red,background:`${C.red}15`,borderRadius:4,padding:"2px 7px",display:"inline-block",fontFamily:SF,letterSpacing:"0.06em",marginBottom:4}}>🚨 EMERGENCIA — SOLO DIRECTIVOS</div>}
                          <div style={{...fmt.callout,fontWeight:600,color:C.lbl,fontFamily:SF,marginBottom:2}}>{a.title}</div>
                          <div style={{...fmt.caption,color:C.lbl2,fontFamily:SF}}>{a.fromName} · {a.time}</div>
                        </div>
                        <span style={{fontSize:11,fontWeight:600,color:typeColor,background:`${typeColor}12`,borderRadius:6,padding:"3px 9px",fontFamily:SF,flexShrink:0}}>{typeLabel}</span>
                      </div>
                      <div style={{...fmt.subhead,color:C.lbl2,fontFamily:SF,lineHeight:1.55}}>{a.body}</div>
                      {/* WhatsApp notification for accidents */}
                      {a.type==="accident"&&(()=>{
                        const involvedStudent=state.students.find(s=>a.title?.includes(s.name.split(" ")[0])||a.body?.includes(s.name));
                        const parentPhone=involvedStudent?.parentContact;
                        const waMsg=`🚨 Aviso Escolar: ${a.title}\n\n${a.body}\n\nFecha: ${a.time}`;
                        return(
                          <div style={{marginTop:10,display:"flex",gap:8,flexWrap:"wrap"}}>
                            {parentPhone&&<WaNotify phone={parentPhone} message={waMsg} label="Notificar Tutor WhatsApp"/>}
                            <button onClick={()=>{SFX.play("alert");pushNotification({title:"🚨 "+a.title,text:a.body,urgent:true});}}
                              style={{background:`${C.red}15`,border:`1px solid ${C.red}30`,borderRadius:10,padding:"8px 14px",color:C.red,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:SF,display:"flex",alignItems:"center",gap:6}}>
                              🔔 Enviar Alerta In-App
                            </button>
                          </div>
                        );
                      })()}
                    </Card>
                  );
                })}
              </>
            )}

            {mgmtTab==="actividades"&&(()=>{
              const acts=state.actividades||[];
              const actDates=new Set(acts.map(a=>a.date));
              const firstDay=new Date(2026,2,1).getDay();
              return(
                <>
                  <Btn onPress={()=>setShowActForm(!showActForm)} full color={C.indigo} variant={showActForm?"ghost":"filled"} style={{marginBottom:12}}>
                    {showActForm?"Cancelar":"+ Nueva Actividad"}
                  </Btn>
                  {showActForm&&(
                    <Card style={{padding:14,marginBottom:12}}>
                      <Input placeholder="Título de la actividad" value={newAct.title} onChange={v=>setNewAct(a=>({...a,title:v}))}/>
                      <select value={newAct.type} onChange={e=>setNewAct(a=>({...a,type:e.target.value}))}
                        style={{width:"100%",background:C.fill4,border:`0.5px solid ${C.sep}`,borderRadius:10,padding:"8px 12px",fontSize:15,color:C.lbl,fontFamily:SF,marginBottom:10,outline:"none"}}>
                        <option value="trabajo">Trabajo</option>
                        <option value="exposicion">Exposición</option>
                        <option value="efemeride">Efeméride</option>
                        <option value="examen">Examen</option>
                        <option value="evento">Evento Escolar</option>
                        <option value="otro">Otro</option>
                      </select>
                      <select value={newAct.teacherId} onChange={e=>setNewAct(a=>({...a,teacherId:e.target.value}))}
                        style={{width:"100%",background:C.fill4,border:`0.5px solid ${C.sep}`,borderRadius:10,padding:"8px 12px",fontSize:15,color:C.lbl,fontFamily:SF,marginBottom:10,outline:"none"}}>
                        <option value="all">Todos los Docentes</option>
                        {state.teachers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      <div style={{background:C.fill4,borderRadius:12,padding:"10px 14px",marginBottom:10}}>
                        <div style={{fontSize:11,color:C.lbl2,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4,fontFamily:SF}}>Fecha del evento</div>
                        <input type="date" value={newAct.date} onChange={e=>setNewAct(a=>({...a,date:e.target.value}))}
                          style={{width:"100%",background:"transparent",border:"none",fontSize:16,color:C.lbl,outline:"none",fontFamily:SF}}/>
                      </div>
                      <div style={{background:C.fill4,borderRadius:12,padding:"10px 14px",marginBottom:10,border:`1px solid ${C.orange}30`}}>
                        <div style={{fontSize:11,color:C.orange,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4,fontFamily:SF}}>📅 Fecha de entrega</div>
                        <input type="date" value={newAct.dueDate||""} onChange={e=>setNewAct(a=>({...a,dueDate:e.target.value}))}
                          style={{width:"100%",background:"transparent",border:"none",fontSize:16,color:C.lbl,outline:"none",fontFamily:SF}}/>
                      </div>
                      <textarea value={newAct.description} onChange={e=>setNewAct(a=>({...a,description:e.target.value}))}
                        placeholder="Descripción o instrucciones…" rows={2}
                        style={{width:"100%",background:C.fill4,border:`0.5px solid ${C.sep}`,borderRadius:10,padding:"10px 12px",fontSize:15,color:C.lbl,fontFamily:SF,resize:"none",outline:"none",boxSizing:"border-box",marginBottom:10}}/>
                      <Btn onPress={addActividad} full disabled={!newAct.title.trim()||!newAct.date}>Asignar Actividad</Btn>
                    </Card>
                  )}
                  {acts.length>0&&(
                    <Card style={{padding:14,marginBottom:14}}>
                      <div style={{...fmt.subhead,fontWeight:600,color:C.lbl,fontFamily:SF,marginBottom:10}}>Calendario — Marzo 2026</div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:4}}>
                        {["D","L","M","X","J","V","S"].map(d=><div key={d} style={{textAlign:"center",fontSize:10,color:C.lbl2,fontFamily:SF,fontWeight:600}}>{d}</div>)}
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
                        {Array.from({length:firstDay}).map((_,i)=><div key={`e${i}`}/>)}
                        {Array.from({length:31}).map((_,i)=>{
                          const d=i+1;
                          const dateStr=`2026-03-${String(d).padStart(2,"0")}`;
                          const hasAct=actDates.has(dateStr);
                          const isTdy=dateStr===todayStr;
                          return(
                            <div key={d} style={{aspectRatio:"1",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",
                              background:hasAct?`${C.indigo}18`:isTdy?C.fill3:"transparent",
                              border:hasAct?`1.5px solid ${C.indigo}40`:isTdy?`1px solid ${C.g4}`:"none"}}>
                              <span style={{fontSize:10,fontWeight:hasAct||isTdy?700:400,color:hasAct?C.indigo:isTdy?C.lbl:C.lbl3,fontFamily:SF}}>{d}</span>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  )}
                  {acts.length===0&&!showActForm&&(
                    <div style={{textAlign:"center",padding:"40px 16px",color:C.lbl2,fontSize:15,fontFamily:SF}}>Sin actividades programadas.</div>
                  )}
                  {acts.map((a)=>{
                    const typeColor={trabajo:C.blue,exposicion:C.purple,efemeride:C.orange,examen:C.red,evento:C.green,otro:C.g1}[a.type]||C.blue;
                    const typeLabel={trabajo:"Trabajo",exposicion:"Exposición",efemeride:"Efeméride",examen:"Examen",evento:"Evento",otro:"Otro"}[a.type]||a.type;
                    const assignedTeacher=a.teacherId==="all"?"Todos los docentes":state.teachers.find(t=>t.id===parseInt(a.teacherId))?.name||"—";
                    return(
                      <Card key={a.id} style={{marginBottom:10,padding:14}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                          <div style={{flex:1,marginRight:10}}>
                            <div style={{...fmt.callout,fontWeight:600,color:C.lbl,fontFamily:SF,marginBottom:2}}>{a.title}</div>
                            <div style={{...fmt.caption,color:C.lbl2,fontFamily:SF,marginBottom:2}}>{assignedTeacher} · {a.date}</div>
                            {a.description&&<div style={{...fmt.caption,color:C.lbl2,fontFamily:SF,marginTop:4,lineHeight:1.5}}>{a.description}</div>}
                          </div>
                          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                            <span style={{fontSize:11,fontWeight:600,color:typeColor,background:`${typeColor}12`,borderRadius:6,padding:"3px 9px",fontFamily:SF}}>{typeLabel}</span>
                            <span style={{fontSize:11,fontWeight:600,color:a.status==="completado"?C.green:C.orange,fontFamily:SF}}>{a.status==="completado"?"Completado":"Pendiente"}</span>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </>
              );
            })()}

            {mgmtTab==="aprobaciones"&&(
              <>
                {state.pendingContent.length>0&&(
                  <Btn onPress={approveAll} full color={C.green} style={{marginBottom:12}}>Aprobar Todo ({state.pendingContent.length})</Btn>
                )}
                <Sec title={`Pendientes — ${state.pendingContent.length}`}>
                  {state.pendingContent.length===0&&<div style={{padding:"20px 16px",textAlign:"center",color:C.lbl2,fontSize:15,fontFamily:SF}}>Sin contenido pendiente de revisión.</div>}
                  {state.pendingContent.map((a,i)=>(
                    <div key={a.id}>
                      <div style={{padding:"12px 16px"}}>
                        <div style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:8}}>
                          <div style={{flex:1}}>
                            <div style={{...fmt.callout,fontWeight:600,color:C.lbl,fontFamily:SF}}>{a.title}</div>
                            <div style={{...fmt.caption,color:C.lbl2,fontFamily:SF,marginTop:1}}>{a.teacherName} · {a.groupName} · {a.date}</div>
                          </div>
                          <span style={{fontSize:11,fontWeight:600,color:C.orange,background:`${C.orange}12`,borderRadius:6,padding:"3px 9px",fontFamily:SF,flexShrink:0}}>{a.type}</span>
                        </div>
                        <div style={{display:"flex",gap:8}}>
                          <Btn onPress={()=>approveOne(a.id)} color={C.green} size="sm" style={{flex:1}}>Aprobar</Btn>
                          <Btn onPress={()=>rejectOne(a.id)} variant="danger" size="sm" style={{flex:1}}>Rechazar</Btn>
                        </div>
                      </div>
                      {i<state.pendingContent.length-1&&<Div indent={16}/>}
                    </div>
                  ))}
                </Sec>
                <Sec title="Aprobados Recientemente">
                  {state.approvedContent.length===0&&<div style={{padding:"16px",color:C.lbl2,fontSize:15,fontFamily:SF}}>Sin registros.</div>}
                  {state.approvedContent.map((a,i)=>(
                    <div key={a.id}>
                      <Row label={a.title} detail={`${a.teacherName} · ${a.date}`} right={<span style={{fontSize:11,fontWeight:600,color:C.green,fontFamily:SF}}>Aprobado</span>}/>
                      {i<state.approvedContent.length-1&&<Div indent={16}/>}
                    </div>
                  ))}
                </Sec>
              </>
            )}
          </div>
        </div>
      )}

        {tab==="settings"&&(
          <div>
            <NavBar title="Ajustes" large accent={C.indigo}/>
            <div className="page-pad">
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,marginBottom:24}}>
                <Ava initials="DG" color={C.indigo} size={80}/>
                <div style={{...fmt.title3,color:C.lbl,fontFamily:SFD}}>Directora Gómez</div>
                <div style={{...fmt.caption,color:C.lbl2,fontFamily:SF}}>Ciclo Escolar: {activeCycle?.name}</div>
              </div>
              <Sec title="Cuenta">
                <Row label="Editar Perfil" icon="✏️" iconBg={`${C.indigo}20`} chevron onPress={()=>{}}/>
                <Div indent={46}/>
                <Row label="Notificaciones" icon="🔔" iconBg={`${C.red}20`} chevron onPress={()=>{}}/>
              </Sec>
              <Sec>
                <Row label="Cerrar Sesión" icon="🚪" iconBg={`${C.red}15`} danger onPress={onLogout}/>
              </Sec>
            </div>
          </div>
        )}

        {/* ── Chat IA Flotante ── */}
        <div style={{position:"fixed",bottom:86,right:16,zIndex:400}}>
        {aiChatOpen&&(
          <div style={{position:"absolute",bottom:64,right:0,width:310,background:"#fff",
            borderRadius:20,boxShadow:"0 8px 40px rgba(0,0,0,0.18)",overflow:"hidden",
            border:`1px solid ${C.g5}`,animation:"fadeUp 0.25s ease"}}>
            {/* Header */}
            <div style={{background:`linear-gradient(135deg,${C.indigo},#7C3AED)`,padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:9}}>
                <div style={{width:32,height:32,borderRadius:"50%",background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🤖</div>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:"#fff",fontFamily:SF}}>Asistente Escolar</div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,0.7)",fontFamily:SF}}>Powered by Claude</div>
                </div>
              </div>
              <button onClick={()=>setAiChatOpen(false)} style={{background:"rgba(255,255,255,0.2)",border:"none",borderRadius:"50%",width:26,height:26,cursor:"pointer",color:"#fff",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
            </div>
            {/* Mensajes */}
            <div style={{maxHeight:240,overflowY:"auto",padding:"12px 12px 6px",display:"flex",flexDirection:"column",gap:8}}>
              {aiMessages.map((m,i)=>(
                <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
                  <div style={{maxWidth:"85%",padding:"8px 12px",borderRadius:m.role==="user"?"14px 14px 4px 14px":"14px 14px 14px 4px",
                    background:m.role==="user"?C.indigo:C.fill4,
                    color:m.role==="user"?"#fff":C.lbl,
                    fontSize:13,fontFamily:SF,lineHeight:1.5}}>
                    {m.text}
                  </div>
                </div>
              ))}
              {aiThinking&&(
                <div style={{display:"flex",justifyContent:"flex-start"}}>
                  <div style={{padding:"8px 14px",borderRadius:"14px 14px 14px 4px",background:C.fill4,display:"flex",gap:4,alignItems:"center"}}>
                    {[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:C.g2,animation:`mascotBob 1s ${i*0.2}s infinite`}}/>)}
                  </div>
                </div>
              )}
            </div>
            {/* Input */}
            <div style={{padding:"8px 10px 12px",borderTop:`0.5px solid ${C.sep}`,display:"flex",gap:8,alignItems:"center"}}>
              <input value={aiInput} onChange={e=>setAiInput(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&sendAiMessage()}
                placeholder="Escribe una pregunta…"
                style={{flex:1,background:C.fill4,border:"none",borderRadius:20,padding:"9px 14px",fontSize:13,color:C.lbl,fontFamily:SF,outline:"none"}}/>
              <button onClick={sendAiMessage} disabled={aiThinking||!aiInput.trim()}
                style={{width:34,height:34,borderRadius:"50%",background:C.indigo,border:"none",cursor:"pointer",
                  color:"#fff",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",
                  opacity:aiThinking||!aiInput.trim()?0.4:1,transition:"opacity 0.15s",flexShrink:0}}>↑</button>
            </div>
          </div>
        )}
        {/* Botón flotante */}
        <button onClick={()=>setAiChatOpen(o=>!o)}
          style={{width:52,height:52,borderRadius:"50%",
            background:aiChatOpen?C.g1:`linear-gradient(135deg,${C.indigo},#7C3AED)`,
            border:"none",cursor:"pointer",
            boxShadow:"0 4px 20px rgba(88,86,214,0.45)",
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:22,transition:"all 0.2s",
            transform:aiChatOpen?"rotate(0deg)":"rotate(0deg)"}}>
          {aiChatOpen?"✕":"🤖"}
        </button>
      </div>

      <Modal open={cycleModal} onClose={()=>setCycleModal(false)} title="Ciclos Escolares">
        <Sec title="Ciclos Registrados">
          {state.cycles.map((c,i)=>(
            <div key={c.id}>
              <Row label={c.name} right={c.id===state.activeCycle?<Pill color={C.green} size="xs">Activo</Pill>:undefined}
                onPress={()=>setActiveCycle(c.id)}/>
              {i<state.cycles.length-1&&<Div indent={16}/>}
            </div>
          ))}
        </Sec>
        <div style={{padding:"10px 16px 4px",borderTop:`0.5px solid ${C.sep}`}}>
          <div style={{fontSize:12,color:C.lbl3,fontFamily:SF,textAlign:"center"}}>La gestión de ciclos escolares se realiza desde el Panel de Desarrollador.</div>
        </div>
      </Modal>
      </div>
    </div>
  );
};


// ─── TEACHER APP ──────────────────────────────────────────────────────────────
// ─── GRADE MODAL ─────────────────────────────────────────────────────────────
const SubmissionRow = ({s, act, gradeDraft, publishedGrades, setGradeModal, isLast, setState, db}) => {
  const submittedIds=(act.submissions||[]).map(x=>String(x.studentId));
  const submitted=submittedIds.includes(String(s.id));
  const sub=(act.submissions||[]).find(x=>String(x.studentId)===String(s.id));
  const key=`${act.id}_${s.id}`;
  const savedGrade=gradeDraft[key]||{grade:sub?.teacherGrade,feedback:sub?.teacherFeedback};
  const pubGrade=publishedGrades[key];
  const [expanded,setExpanded]=useState(false);
  const [chatMsg,setChatMsg]=useState("");
  const chat=sub?.chat||[];

  const sendTeacherMsg=async()=>{
    if(!chatMsg.trim()||!sub)return;
    const msg={id:Date.now(),from:"teacher",name:"Maestro",text:chatMsg.trim(),
      date:new Date().toISOString().slice(0,10),time:new Date().toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"})};
    const newChat=[...chat,msg];
    const newSubs=(act.submissions||[]).map(ss=>String(ss.studentId)===String(s.id)?{...ss,chat:newChat}:ss);
    setState&&setState(prev=>({...prev,approvedContent:prev.approvedContent.map(c=>String(c.id)===String(act.id)?{...c,submissions:newSubs}:c)}));
    setChatMsg("");
    if(act.id&&typeof act.id==="string"&&db){
      try{const {updateDoc:u,doc:d}=await import("firebase/firestore");await u(d(db,"approvedContent",act.id),{submissions:newSubs});}catch(e){}
    }
  };

  return(
    <div>
      <div style={{padding:"11px 14px"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:submitted?4:0}}>
          <Ava initials={s.avatar} color={s.color} size={34}/>
          <div style={{flex:1,cursor:submitted?"pointer":"default"}} onClick={()=>submitted&&setExpanded(e=>!e)}>
            <div style={{fontSize:13,fontWeight:600,color:C.lbl,fontFamily:SF}}>{s.name}</div>
            <div style={{fontSize:11,color:submitted?C.green:C.lbl3,fontFamily:SF}}>
              {submitted?"✅ Entregó"+(sub?.date?` · ${sub.date}`:"")+(sub?.teacherGrade!=null?` · ${sub.teacherGrade}/10`:(sub?.score!=null?` · ${sub.score}/10`:"")):"⏳ Sin entrega"}
              {chat.length>0&&<span style={{marginLeft:6,color:C.blue}}>💬 {chat.length}</span>}
            </div>
          </div>
          {savedGrade?.grade&&(
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:18,fontWeight:800,color:C.blue,fontFamily:SF}}>{savedGrade.grade}</div>
              {pubGrade?.published&&<div style={{fontSize:9,color:C.green,fontFamily:SF}}>Publicado</div>}
            </div>
          )}
          {submitted&&(
            <button onClick={()=>setExpanded(e=>!e)}
              style={{background:expanded?`${C.blue}15`:C.fill4,border:"none",borderRadius:7,padding:"4px 9px",cursor:"pointer",fontSize:11,fontWeight:600,color:expanded?C.blue:C.lbl2,fontFamily:SF,marginRight:4}}>
              {expanded?"▲ Ocultar":"▼ Ver"}
            </button>
          )}
          <button onClick={()=>setGradeModal({studentId:s.id,actId:act.id,name:s.name})}
            style={{background:savedGrade?.grade?C.fill3:`${C.blue}15`,border:"none",borderRadius:8,
              padding:"5px 11px",cursor:"pointer",fontSize:12,fontWeight:600,
              color:savedGrade?.grade?C.lbl2:C.blue,fontFamily:SF}}>
            {savedGrade?.grade?"Editar":"Calificar"}
          </button>
        </div>
        {submitted&&expanded&&sub&&(
          <div style={{marginTop:8,padding:"10px 12px",background:`${C.blue}05`,borderRadius:10,border:`1px solid ${C.blue}12`}}>
            {sub.text&&<div style={{fontSize:13,color:C.lbl,fontFamily:SF,lineHeight:1.55,marginBottom:sub.files?.length||sub.link?8:0,whiteSpace:"pre-wrap"}}>{sub.text}</div>}
            {sub.files?.length>0&&(
              <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:sub.link?6:0}}>
                {sub.files.map((f,fi)=>(
                  f.src&&f.mime?.includes("image")
                    ?<img key={fi} src={f.src} style={{width:80,height:80,borderRadius:8,objectFit:"cover"}}/>
                    :<div key={fi} style={{display:"flex",alignItems:"center",gap:7,background:C.fill4,borderRadius:8,padding:"7px 10px"}}>
                      <span style={{fontSize:18}}>📎</span>
                      <span style={{fontSize:12,fontWeight:600,color:C.lbl,fontFamily:SF}}>{f.name}</span>
                      {f.size&&<span style={{fontSize:10,color:C.lbl3,fontFamily:SF}}>{f.size}</span>}
                    </div>
                ))}
              </div>
            )}
            {sub.link&&(
              <a href={sub.link} target="_blank" rel="noreferrer"
                style={{display:"flex",alignItems:"center",gap:7,padding:"7px 10px",background:`${C.blue}10`,borderRadius:8,border:`1px solid ${C.blue}20`,textDecoration:"none",marginTop:sub.text||sub.files?.length?6:0}}>
                <span style={{fontSize:15}}>🔗</span>
                <span style={{flex:1,fontSize:12,fontWeight:600,color:C.blue,fontFamily:SF,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sub.link}</span>
                <span style={{color:C.blue,fontSize:12}}>↗</span>
              </a>
            )}
            {sub.answers&&(
              <div style={{marginTop:4}}>
                <div style={{fontSize:12,fontWeight:700,color:sub.score>=7?C.green:C.orange,fontFamily:SF,marginBottom:6}}>
                  {sub.correct}/{sub.total} correctas · {sub.score?.toFixed(1)||"—"}/10
                </div>
                {(act.quiz||[]).map((q,qi)=>{
                  const chosen=sub.answers[qi];const isRight=chosen===q.correct;
                  return(<div key={qi} style={{fontSize:11,color:C.lbl2,fontFamily:SF,padding:"2px 0",display:"flex",alignItems:"flex-start",gap:5}}><span>{isRight?"✅":"❌"}</span><span style={{flex:1}}>{q.q} → {q.a?.[chosen]||"—"}</span></div>);
                })}
              </div>
            )}
            {!sub.text&&!sub.files?.length&&!sub.link&&!sub.answers&&(
              <div style={{fontSize:12,color:C.lbl3,fontFamily:SF}}>Sin contenido en la entrega</div>
            )}
            {/* Retroalimentación del maestro */}
            {sub.teacherFeedback&&<div style={{marginTop:8,padding:"8px 10px",background:`${C.green}08`,borderRadius:8,border:`1px solid ${C.green}20`}}>
              <div style={{fontSize:10,fontWeight:700,color:C.green,fontFamily:SF,marginBottom:3}}>Tu retroalimentación guardada:</div>
              <div style={{fontSize:12,color:C.lbl,fontFamily:SF,lineHeight:1.5}}>{sub.teacherFeedback}</div>
            </div>}
            {/* Chat */}
            {chat.length>0&&(
              <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:6}}>
                <div style={{fontSize:10,fontWeight:700,color:C.lbl3,fontFamily:SF,textTransform:"uppercase",letterSpacing:"0.05em"}}>Chat con alumno</div>
                {chat.map(msg=>(<div key={msg.id} style={{display:"flex",gap:6,alignItems:"flex-start",flexDirection:msg.from==="teacher"?"row-reverse":"row"}}>
                  <div style={{width:22,height:22,borderRadius:"50%",background:msg.from==="teacher"?C.blue:C.g3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#fff",flexShrink:0,fontWeight:700}}>{msg.from==="teacher"?"M":"A"}</div>
                  <div style={{maxWidth:"75%",background:msg.from==="teacher"?`${C.blue}10`:`${C.g4}`,borderRadius:"8px",padding:"5px 8px"}}>
                    <div style={{fontSize:12,color:C.lbl,fontFamily:SF}}>{msg.text}</div>
                    <div style={{fontSize:8,color:C.lbl3,fontFamily:SF,marginTop:1}}>{msg.time}</div>
                  </div>
                </div>))}
              </div>
            )}
            {/* Teacher reply input */}
            <div style={{display:"flex",gap:6,marginTop:8,alignItems:"center"}}>
              <input value={chatMsg} onChange={e=>setChatMsg(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendTeacherMsg();}}}
                placeholder="Responder al alumno…"
                style={{flex:1,background:C.fill4,border:`1px solid ${C.g5}`,borderRadius:18,padding:"6px 12px",fontSize:12,color:C.lbl,fontFamily:SF,outline:"none"}}/>
              <button onClick={sendTeacherMsg} disabled={!chatMsg.trim()}
                style={{width:30,height:30,borderRadius:"50%",background:chatMsg.trim()?C.blue:"transparent",border:`1.5px solid ${chatMsg.trim()?C.blue:C.g5}`,cursor:chatMsg.trim()?"pointer":"default",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M12.5 1.5L7 7M12.5 1.5L8.5 12.5L7 7M12.5 1.5L1.5 5.5L7 7" stroke={chatMsg.trim()?"#fff":C.g3} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          </div>
        )}
        {savedGrade?.feedback&&<div style={{fontSize:11,color:C.lbl2,fontFamily:SF,padding:"5px 10px",background:C.fill4,borderRadius:7,marginTop:4}}>💬 {savedGrade.feedback}</div>}
      </div>
      {!isLast&&<div style={{height:"0.5px",background:C.sep,marginLeft:58}}/>}
    </div>
  );
};


const GradeModal = ({ gradeModal, act, gradeDraft, saveGrade, onClose }) => {
  const k = `${gradeModal.actId}_${gradeModal.studentId}`;
  const existing = gradeDraft[k] || { grade:"", feedback:"" };
  const [localGrade, setLocalGrade] = useState(existing.grade);
  const [localFeedback, setLocalFeedback] = useState(existing.feedback || "");
  return (
    <div style={{position:"fixed",inset:0,zIndex:800,background:"rgba(0,0,0,0.45)",backdropFilter:"blur(4px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div style={{background:"#fff",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:600,padding:"20px 20px 40px",animation:"slideUp 0.28s cubic-bezier(0.34,1.56,0.64,1)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <div style={{...fmt.headline,fontWeight:700,color:C.lbl,fontFamily:SF}}>Calificar · {gradeModal.name}</div>
          <button onClick={onClose} style={{background:C.fill3,border:"none",borderRadius:"50%",width:28,height:28,cursor:"pointer",color:C.lbl2,fontSize:15,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>
        <div style={{marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:700,color:C.lbl3,textTransform:"uppercase",letterSpacing:"0.05em",fontFamily:SF,marginBottom:5}}>Calificación (0–{act.points})</div>
          <input type="number" min="0" max={act.points} value={localGrade} onChange={e=>setLocalGrade(e.target.value)}
            style={{width:"100%",background:C.fill4,border:`1.5px solid ${C.blue}30`,borderRadius:12,padding:"12px 16px",
              fontSize:28,fontWeight:800,color:C.blue,fontFamily:SF,outline:"none",textAlign:"center",boxSizing:"border-box"}}/>
        </div>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:700,color:C.lbl3,textTransform:"uppercase",letterSpacing:"0.05em",fontFamily:SF,marginBottom:5}}>Retroalimentación</div>
          <textarea value={localFeedback} onChange={e=>setLocalFeedback(e.target.value)}
            placeholder="Escribe comentarios para el alumno…" rows={3}
            style={{width:"100%",background:C.fill4,border:"none",borderRadius:12,padding:"12px 14px",
              fontSize:14,color:C.lbl,fontFamily:SF,resize:"none",outline:"none",boxSizing:"border-box",lineHeight:"1.4"}}/>
        </div>
        <Btn full onPress={()=>{ saveGrade(gradeModal.actId, gradeModal.studentId, localGrade, localFeedback); onClose(); }} color={C.green}>Guardar Calificación</Btn>
      </div>
    </div>
  );
};

// ─── TEACHER APP ──────────────────────────────────────────────────────────────
const TeacherApp=({state,setState,teacherId,onLogout})=>{
  const [tab,setTab]=useState(()=>localStorage.getItem("tea_tab")||"feed");
  const [sidebarOpen,setSidebarOpen]=useState(true);
  // Persist group/subject navigation so refresh doesn't kick teacher out
  const [selectedGroup,setSelectedGroup]=useState(()=>{
    try{const id=localStorage.getItem("tea_grp"); return id?{id:Number(id)||id}:null;}catch{return null;}
  });
  const [selectedGroupSubject,setSelectedGroupSubject]=useState(()=>localStorage.getItem("tea_gsubj")||null);
  const [classTab,setClassTab]=useState(()=>localStorage.getItem("tea_ctab")||"board");
  const [selectedStudent,setSelectedStudent]=useState(null);
  const [selectedActivity,setSelectedActivity]=useState(null);
  const [aiPrompt,setAiPrompt]=useState("");
  const [aiResult,setAiResult]=useState("");
  const [aiLoading,setAiLoading]=useState(false);
  const [aiAskDest,setAiAskDest]=useState(false);
  const [aiContent,setAiContent]=useState(null);
  const [showActivityForm,setShowActivityForm]=useState(false);
  const [showTaskForm,setShowTaskForm]=useState(false);
  const [actForm,setActForm]=useState({title:"",desc:"",type:"aviso",points:10,dueDate:"",link:"",quizQ:[]});
  const [actImages,setActImages]=useState([]);
  const [actFiles,setActFiles]=useState([]);
  const [actLink,setActLink]=useState("");
  const [showActLink,setShowActLink]=useState(false);
  const [gradeModal,setGradeModal]=useState(null); // {studentId, actId}
  const [gradeDraft,setGradeDraft]=useState({}); // {actId_studentId: {grade,feedback}}
  const [publishedGrades,setPublishedGrades]=useState({});
  const [selParcial,setSelParcial]=useState(1); // for grades tab — must be here (Rules of Hooks)
  const [bellOpen,setBellOpen]=useState(false);
  const [selBell,setSelBell]=useState(null);
  const bellDragTea=useDraggableBell(`lms_bell_pos_tea_${teacher?.id}`);
  const [addQuizQ,setAddQuizQ]=useState({q:"",a:["","","",""],correct:0});
  const [showQuizForm,setShowQuizForm]=useState(false);
  const actImgRef=useRef();
  const actFileRef=useRef();

  const teacher=state.teachers.find(t=>t.id===teacherId)||state.teachers[0];
  const todayStr=today();
  // Include groups where this teacher is assigned to ANY subject (string-safe comparison)
  // Match teacher by Firestore ID OR by the original numeric index (legacy auto-ID seed)
  // Finds the teacher's original numeric ID: if teacher.id is "1","2".. use it; otherwise find position in sorted array
  const teacherNumericId=isNaN(Number(teacher?.id))?null:Number(teacher?.id);
  const matchesTeacher=(tid)=>{
    if(!tid||!teacher) return false;
    if(String(tid)===String(teacher.id)) return true; // direct Firestore ID match
    if(teacherNumericId!==null&&Number(tid)===teacherNumericId) return true; // numeric "1"==="1"
    return false;
  };
  const myGroups=state.groups.filter(g=>
    matchesTeacher(g.teacherId) ||
    (g.subjects||[]).some(s=>matchesTeacher(s.teacherId))
  );
  const myGroupSubjects=(g)=>(g.subjects||[]).filter(s=>matchesTeacher(s.teacherId));
  const activeCycle=state.cycles?.find(c=>c.id===state.activeCycle)||state.cycles?.[0];

  // Hydrate selectedGroup from full state once groups load (needed after refresh restore)
  useEffect(()=>{
    if(selectedGroup&&typeof selectedGroup.subjects==="undefined"){
      const full=state.groups.find(g=>String(g.id)===String(selectedGroup.id));
      if(full) setSelectedGroup(full);
    }
  },[state.groups]);
  // Persist navigation state
  useEffect(()=>{ if(selectedGroup?.id!=null) localStorage.setItem("tea_grp",String(selectedGroup.id)); else localStorage.removeItem("tea_grp"); },[selectedGroup]);
  useEffect(()=>{ if(selectedGroupSubject) localStorage.setItem("tea_gsubj",selectedGroupSubject); else localStorage.removeItem("tea_gsubj"); },[selectedGroupSubject]);
  useEffect(()=>{ localStorage.setItem("tea_ctab",classTab); },[classTab]);

  // Build news items for bell
  const newsItems=(state.avisos||[]).map(a=>({
    id:a.id,title:a.title,body:a.body||"",
    icon:{accident:"🚨",board:"📋",general:"📢",administrative:"🏫"}[a.type]||"📣",
    color:{accident:C.red,board:C.purple,general:C.orange,administrative:C.blue}[a.type]||C.green,
    badge:{accident:"Accidente",board:"Tablón",general:"General",administrative:"Admin."}[a.type]||"Aviso",
    time:"Reciente",urgent:a.type==="accident"
  }));
  const urgentCount=newsItems.filter(n=>n.urgent).length;

  const genAI=async()=>{
    if(!aiPrompt.trim())return;
    setAiLoading(true);setAiResult("");
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1200,
          messages:[{role:"user",content:`Eres un experto pedagógico. Genera 5 preguntas de examen variadas (opción múltiple, V/F y respuesta corta) sobre: "${aiPrompt}". SIN incluir las respuestas. Formatea claramente cada pregunta numerada. Para opción múltiple incluye opciones A-D.`}]})});
      const data=await res.json();
      const text=data.content?.[0]?.text||"Error generando.";
      setAiResult(text);
      setAiContent({title:`Examen: ${aiPrompt}`,body:text,type:"examen"});
      setAiAskDest(true);
    }catch{setAiResult("Error de conexión.");}
    finally{setAiLoading(false);}
  };

  const publishToFeed=()=>{
    if(!aiContent)return;
    const p={id:Date.now(),authorId:`t${teacher.id}`,authorName:teacher.name,
      authorRole:(myGroups.flatMap(g=>myGroupSubjects(g))[0]?.subject)||(teacher.subjects?.[0])||"Docente",avatar:teacher.avatar,avatarColor:teacher.color,
      time:"Ahora",title:aiContent.title,body:"Nuevo examen disponible.",type:"notice",likes:[],comments:[]};
    setState(s=>({...s,posts:[p,...s.posts]}));
    setAiAskDest(false);
  };

  const publishToGroup=async(groupId)=>{
    if(!aiContent)return;
    const grp=state.groups.find(g=>g.id===groupId);
    const content={teacherId:teacher.id,teacherName:teacher.name,
      title:aiContent.title,type:aiContent.type,groupId,
      groupName:grp?.name||"",subject:"",
      date:today(),content:aiContent.body,points:10,submissions:[],
      _createdAt:serverTimestamp()};
    try{
      await addDoc(collection(db,"approvedContent"),content);
    }catch{
      setState(s=>({...s,approvedContent:[...s.approvedContent,{...content,id:Date.now()}]}));
    }
    addDoc(collection(db,"avisos"),{
      fromName:teacher.name,fromRole:"Docente",type:"board",
      title:`Nuevo contenido IA: ${content.title}`,
      body:`Publicado en ${grp?.name||"grupo"}`,
      groupId,time:today(),read:false,_createdAt:serverTimestamp(),
    }).catch(()=>{});
    setAiAskDest(false);
    SFX.play("success");
    pushNotification({title:"✅ Publicado con IA",text:`"${content.title}" enviado a ${grp?.name||"grupo"}`});
  };

  const addActImage=(e)=>{
    Array.from(e.target.files||[]).forEach(f=>{
      const r=new FileReader();
      r.onload=ev=>setActImages(a=>[...a,{id:Date.now()+Math.random(),src:ev.target.result,name:f.name}]);
      r.readAsDataURL(f);
    });
    e.target.value="";
  };
  const addActFile=(e)=>{
    setActFiles(a=>[...a,...Array.from(e.target.files||[]).map(f=>({id:Date.now()+Math.random(),name:f.name,size:(f.size/1024).toFixed(0)+"KB",mime:f.type}))]);
    e.target.value="";
  };

  const submitActivity=async()=>{
    if(!actForm.title.trim()||!selectedGroup)return;
    const content={
      teacherId:teacher.id,teacherName:teacher.name,
      title:actForm.title,type:actForm.type,groupId:selectedGroup.id,
      groupName:selectedGroup.name,date:today(),content:actForm.desc,
      subject:selectedGroupSubject||"",
      points:parseInt(actForm.points)||10,dueDate:actForm.dueDate,
      link:actLink||null,images:[...actImages],files:[...actFiles],
      quiz:actForm.quizQ.length>0?actForm.quizQ:[],
      submissions:[],_createdAt:serverTimestamp(),
    };
    // Save directly to approvedContent — Firebase listener propagates to all clients
    try{
      await addDoc(collection(db,"approvedContent"),content);
    }catch(e){
      // Fallback to local state if offline
      setState(s=>({...s,approvedContent:[...s.approvedContent,{...content,id:Date.now()}]}));
    }
    // Also post an aviso so students see it in the bell
    const avisoEntry={
      fromName:teacher.name,fromRole:"Docente",type:"board",
      title:`Nueva ${content.type==="tarea"?"Tarea":content.type==="examen"?"Examen":content.type==="actividad"?"Actividad":"Actividad"}: ${content.title}`,
      body:`${selectedGroup.name}${selectedGroupSubject?` · ${selectedGroupSubject}`:""}${content.dueDate?` · Entrega: ${content.dueDate}`:""}`,
      groupId:selectedGroup.id,groupName:selectedGroup.name,time:today(),read:false,_createdAt:serverTimestamp(),
    };
    addDoc(collection(db,"avisos"),avisoEntry).catch(()=>{});
    setActForm({title:"",desc:"",type:"tarea",points:10,dueDate:"",link:"",quizQ:[]});
    setActImages([]);setActFiles([]);setActLink("");setShowActLink(false);
    setShowActivityForm(false);
    SFX.play("success");
    pushNotification({title:"✅ Publicado",text:`"${content.title}" enviado al grupo ${selectedGroup.name}`});
  };

  const saveGrade=async(actId,studentId,grade,feedback)=>{
    const key=`${actId}_${studentId}`;
    setGradeDraft(d=>({...d,[key]:{grade,feedback,saved:true}}));
    // Persist grade+feedback into the submission object in Firestore
    if(actId && typeof actId==="string"){
      try{
        const act=[...state.approvedContent,...state.pendingContent].find(c=>String(c.id)===String(actId));
        if(act){
          const updatedSubs=(act.submissions||[]).map(s=>
            String(s.studentId)===String(studentId)
              ?{...s,teacherGrade:Number(grade)||null,teacherFeedback:feedback||"",teacherFeedbackDate:new Date().toISOString().slice(0,10),chat:s.chat||[]}
              :s
          );
          setState(prev=>({...prev,approvedContent:prev.approvedContent.map(c=>String(c.id)===String(actId)?{...c,submissions:updatedSubs}:c)}));
          const {updateDoc:upd,doc:fdoc}=await import("firebase/firestore");
          await upd(fdoc(db,"approvedContent",actId),{submissions:updatedSubs}).catch(()=>{});
        }
      }catch(e){}
    }
  };

  const publishGrades=(groupId)=>{
    const acts=[...state.pendingContent,...state.approvedContent].filter(c=>c.groupId===groupId);
    const newPub={...publishedGrades};
    acts.forEach(a=>{
      Object.entries(gradeDraft).forEach(([key,val])=>{
        if(key.startsWith(`${a.id}_`)) newPub[key]={...val,published:true};
      });
    });
    setPublishedGrades(newPub);
  };

  const addQuizQuestion=()=>{
    if(!addQuizQ.q.trim())return;
    setActForm(f=>({...f,quizQ:[...f.quizQ,{...addQuizQ,id:Date.now()}]}));
    setAddQuizQ({q:"",a:["","","",""],correct:0});
    setShowQuizForm(false);
  };

  const groupStudents=selectedGroup?state.students.filter(s=>(selectedGroup.students||[]).some(id=>String(id)===String(s.id))||s.group===selectedGroup.name):[];
  const groupContent=[...state.pendingContent,...state.approvedContent].filter(c=>{
    if(c.groupId!==selectedGroup?.id) return false;
    // When a specific subject is selected, only show content for that subject
    if(selectedGroupSubject && c.subject && c.subject!==selectedGroupSubject) return false;
    return true;
  });
  const fileIcon=(mime)=>mime?.includes("pdf")?"📄":mime?.includes("image")?"🖼️":mime?.includes("word")?"📝":"📎";

  const totalChatUnread=(state.chats||[]).filter(c=>(c.participants||[]).includes(`t${teacher?.id}`)).reduce((a,c)=>a+(c.unread?.[`t${teacher?.id}`]||0),0);

  const tabs=[
    {id:"feed",label:"Tablón",icon:"📋"},
    {id:"classes",label:"Clases",icon:"🏫"},
    {id:"chat",label:"Mensajes",icon:"💬"},
    {id:"ai",label:"IA",icon:"🤖"},
    {id:"settings",label:"Ajustes",icon:"⚙️"},
  ];

  // Bell: track read state per notification
  const [bellReadIds,setBellReadIds]=useState(()=>{ try{return JSON.parse(localStorage.getItem(`lms_bell_tea_${teacher?.id}`)||"[]");}catch{return[];} });
  const unreadBellCount=newsItems.filter(n=>!bellReadIds.includes(n.id)).length;
  const markAllBellRead=()=>{ const ids=newsItems.map(n=>n.id); setBellReadIds(ids); localStorage.setItem(`lms_bell_tea_${teacher?.id}`,JSON.stringify(ids)); };
  const markOneBellRead=(id)=>{ if(!bellReadIds.includes(id)){ const ids=[...bellReadIds,id]; setBellReadIds(ids); localStorage.setItem(`lms_bell_tea_${teacher?.id}`,JSON.stringify(ids)); } };

  // Bell panel
  const BellBtn=()=>{
    const bdStyle=bellDragTea.isMobile&&bellDragTea.style?.position?bellDragTea.style:{position:"relative"};
    return(
    <div style={bdStyle}{...(bellDragTea.isMobile?{onTouchStart:bellDragTea.onTouchStart,onTouchMove:bellDragTea.onTouchMove,onTouchEnd:bellDragTea.onTouchEnd}:{})}>
      <button onClick={()=>setBellOpen(o=>!o)}
        style={{width:34,height:34,borderRadius:"50%",
          background:bellOpen?C.fill3:`linear-gradient(135deg,${C.blue},${C.blue}cc)`,
          border:"none",cursor:"pointer",display:"flex",alignItems:"center",
          justifyContent:"center",fontSize:15,boxShadow:"0 2px 8px rgba(0,0,0,0.12)",
          transition:"all 0.15s",position:"relative"}}>
        🔔
        {unreadBellCount>0&&<span style={{position:"absolute",top:-4,right:-4,background:C.red,
          color:"#fff",fontSize:9,fontWeight:800,borderRadius:"50%",minWidth:16,height:16,
          display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid #f2f2f7",fontFamily:SF}}>
          {unreadBellCount}
        </span>}
      </button>
      {bellOpen&&(
        <>
          <div onClick={()=>setBellOpen(false)} style={{position:"fixed",inset:0,zIndex:650}}/>
          <div style={{position:"absolute",top:42,right:0,width:300,maxHeight:"70vh",
            background:"#fff",borderRadius:16,boxShadow:"0 10px 40px rgba(0,0,0,0.2)",
            border:`1px solid ${C.g5}`,overflow:"hidden",zIndex:700,animation:"fadeUp 0.18s ease"}}>
            <div style={{background:`linear-gradient(135deg,${C.blue},${C.blue}bb)`,padding:"11px 13px",
              display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{fontSize:13,fontWeight:700,color:"#fff",fontFamily:SF}}>📣 Avisos {unreadBellCount>0?`(${unreadBellCount} nuevas)`:""}</div>
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                {unreadBellCount>0&&<button onClick={(e)=>{e.stopPropagation();markAllBellRead();}} style={{background:"rgba(255,255,255,0.25)",border:"none",borderRadius:8,padding:"3px 8px",cursor:"pointer",color:"#fff",fontSize:11,fontWeight:600,fontFamily:SF}}>Leer todas</button>}
                <button onClick={()=>setBellOpen(false)} style={{background:"rgba(255,255,255,0.2)",border:"none",borderRadius:"50%",width:22,height:22,cursor:"pointer",color:"#fff",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
              </div>
            </div>
            <div style={{overflowY:"auto",maxHeight:"calc(70vh - 50px)"}}>
              {(()=>{const visibleBell=newsItems.filter(n=>!bellReadIds.includes(n.id));return(<>
              {visibleBell.length===0&&<div style={{padding:20,textAlign:"center",color:C.lbl2,fontSize:13,fontFamily:SF}}>¡Todo al día! 🎉</div>}
              {visibleBell.map((n,i)=>{
                const navDest=n.groupId?"classes":n.badge==="Tablón"?"feed":"feed";
                return(
                <div key={n.id}>
                  <div onClick={()=>{markOneBellRead(n.id);setSelBell(selBell===n.id?null:n.id);}}
                    style={{padding:"9px 12px",cursor:"pointer",borderLeft:`4px solid ${n.color}`,
                      background:`${n.color}08`,transition:"background 0.15s"}}>
                    <div style={{display:"flex",gap:7,alignItems:"flex-start"}}>
                      <span style={{fontSize:17,flexShrink:0}}>{n.icon}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:9,fontWeight:800,color:n.color,fontFamily:SF,marginBottom:2}}>● NUEVO</div>
                        {n.urgent&&<div style={{fontSize:9,fontWeight:800,color:C.red,fontFamily:SF}}>🚨 URGENTE</div>}
                        <div style={{fontSize:12,fontWeight:700,color:C.lbl,fontFamily:SF,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:selBell===n.id?"normal":"nowrap"}}>{n.title}</div>
                        <div style={{display:"flex",gap:5,marginTop:2,alignItems:"center"}}>
                          <span style={{fontSize:9,fontWeight:600,color:n.color,background:`${n.color}15`,borderRadius:4,padding:"1px 5px",fontFamily:SF}}>{n.badge}</span>
                          <span style={{fontSize:9,color:C.lbl3,fontFamily:SF}}>{n.time}</span>
                        </div>
                        {selBell===n.id&&n.body&&<div style={{fontSize:11,color:C.lbl2,fontFamily:SF,lineHeight:1.5,marginTop:5,padding:"5px 7px",background:C.fill4,borderRadius:6}}>{n.body}</div>}
                        {selBell===n.id&&(
                          <button onClick={(e)=>{e.stopPropagation();setBellOpen(false);setTab(navDest);if(n.groupId){const grp=state.groups.find(g=>String(g.id)===String(n.groupId));if(grp){setSelectedGroup(grp);setSelectedGroupSubject(null);}}}}
                            style={{marginTop:6,background:n.color,border:"none",borderRadius:8,padding:"4px 10px",cursor:"pointer",color:"#fff",fontSize:11,fontWeight:600,fontFamily:SF}}>
                            Ver →
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {i<visibleBell.length-1&&<div style={{height:"0.5px",background:C.sep,marginLeft:40}}/>}
                </div>
                );
              })}
              </>);})()}
            </div>
          </div>
        </>
      )}
    </div>
    );
  };

  // ── Activity detail view ───────────────────────────────────────────────────
  if(selectedActivity){
    // Derive from live state so teacher sees student messages/submissions in real time
    const act=[...state.approvedContent,...state.pendingContent].find(c=>String(c.id)===String(selectedActivity.id))||selectedActivity;
    const studs=groupStudents;
    const submittedIds=(act.submissions||[]).map(s=>s.studentId);
    return(
      <div style={{background:C.bg2,minHeight:"100vh",fontFamily:SF}}>
        <NavBar title={act.title} back="← Clase" onBack={()=>setSelectedActivity(null)} accent={C.blue}
          right={<BellBtn/>}/>
        <div style={{padding:"0 16px 100px"}}>
          {/* Activity header card */}
          <Card style={{padding:16,marginBottom:12,marginTop:12}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
              <span style={{fontSize:28}}>{act.type==="tarea"?"📝":act.type==="examen"?"📋":act.type==="cuestionario"?"❓":"⚡"}</span>
              <div style={{flex:1}}>
                <div style={{...fmt.headline,color:C.lbl,fontFamily:SF,fontWeight:700}}>{act.title}</div>
                <div style={{...fmt.caption,color:C.lbl2,fontFamily:SF,marginTop:2}}>{act.type} · {act.date}{act.dueDate&&` · Entrega: ${act.dueDate}`}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:22,fontWeight:800,color:C.blue,fontFamily:SF}}>{act.points}</div>
                <div style={{fontSize:9,color:C.lbl3,fontFamily:SF}}>puntos</div>
              </div>
            </div>
            {act.content&&<div style={{fontSize:14,color:C.lbl2,fontFamily:SF,lineHeight:1.55,marginBottom:10}}>{act.content}</div>}
            {act.images?.length>0&&(
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                {act.images.map(img=>(
                  <img key={img.id} src={img.src} style={{width:act.images.length===1?"100%":80,height:80,borderRadius:9,objectFit:"cover"}}/>
                ))}
              </div>
            )}
            {act.files?.length>0&&act.files.map(f=>(
              <div key={f.id} style={{display:"flex",alignItems:"center",gap:8,background:C.fill4,borderRadius:8,padding:"7px 10px",marginBottom:5}}>
                <span>{fileIcon(f.mime)}</span>
                <div style={{flex:1,fontSize:12,fontWeight:600,color:C.lbl,fontFamily:SF}}>{f.name}</div>
                <span style={{fontSize:10,color:C.lbl3,fontFamily:SF}}>{f.size}</span>
              </div>
            ))}
            {act.link&&(
              <a href={act.link} target="_blank" rel="noreferrer"
                style={{display:"flex",alignItems:"center",gap:7,padding:"8px 11px",background:`${C.blue}08`,
                  borderRadius:9,border:`1px solid ${C.blue}20`,textDecoration:"none",marginTop:4}}>
                <span>🔗</span>
                <span style={{flex:1,fontSize:12,fontWeight:600,color:C.blue,fontFamily:SF,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{act.link}</span>
                <span style={{color:C.blue,fontSize:13}}>↗</span>
              </a>
            )}
            {act.quiz?.length>0&&(
              <div style={{marginTop:8,padding:10,background:`${C.purple}08`,borderRadius:10,border:`1px solid ${C.purple}20`}}>
                <div style={{fontSize:11,fontWeight:700,color:C.purple,fontFamily:SF,marginBottom:6}}>Cuestionario · {act.quiz.length} preguntas · Calificación automática</div>
                {act.quiz.map((q,qi)=>(
                  <div key={q.id||qi} style={{marginBottom:8}}>
                    <div style={{fontSize:13,fontWeight:600,color:C.lbl,fontFamily:SF}}>{qi+1}. {q.q}</div>
                    {q.a.filter(Boolean).map((op,oi)=>(
                      <div key={oi} style={{fontSize:12,color:oi===q.correct?C.green:C.lbl2,fontFamily:SF,padding:"2px 0 2px 14px"}}>{String.fromCharCode(65+oi)}) {op}{oi===q.correct?" ✓":""}</div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Submissions */}
          <div style={{...fmt.footnote,color:C.lbl2,textTransform:"uppercase",letterSpacing:"0.05em",fontFamily:SF,marginBottom:6,paddingLeft:4}}>
            Entregas — {submittedIds.length}/{studs.length} alumnos
          </div>
          <Card style={{marginBottom:12}}>
            {studs.length===0&&<div style={{padding:"16px",color:C.lbl2,fontSize:14,fontFamily:SF}}>Sin alumnos en este grupo</div>}
            {studs.map((s,i)=>(
              <SubmissionRow key={s.id} s={s} act={act} gradeDraft={gradeDraft} publishedGrades={publishedGrades} setGradeModal={setGradeModal} isLast={i===studs.length-1} setState={setState} db={db}/>
            ))}
          </Card>

          {/* Publish grades */}
          <Btn onPress={()=>{
            const newPub={...publishedGrades};
            studs.forEach(s=>{const k=`${act.id}_${s.id}`;if(gradeDraft[k])newPub[k]={...gradeDraft[k],published:true};});
            setPublishedGrades(newPub);
          }} full color={C.green} style={{marginBottom:16}}>
            📤 Publicar Calificaciones de esta Actividad
          </Btn>
        </div>

        {/* Grade modal */}
        {gradeModal&&(
          <GradeModal gradeModal={gradeModal} act={act} gradeDraft={gradeDraft} saveGrade={saveGrade} onClose={()=>setGradeModal(null)}/>
        )}

        <TabBar tabs={tabs} active="classes" onChange={id=>{setSelectedActivity(null);setSelectedGroup(null);setSelectedGroupSubject(null);setTab(id);}} accent={C.blue}/>
      </div>
    );
  }

  // ── Student detail ─────────────────────────────────────────────────────────
  if(selectedStudent){
    return(
      <div style={{background:C.bg2,minHeight:"100vh",fontFamily:SF}}>
        <NavBar title={selectedStudent.name.split(" ")[0]} back="← Clase" onBack={()=>setSelectedStudent(null)} accent={C.blue} right={<BellBtn/>}/>
        <div className="page-pad">
          <Card style={{padding:20,marginBottom:16,display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
            <Ava initials={selectedStudent.avatar} color={selectedStudent.color} size={64}/>
            <div style={{...fmt.title3,color:C.lbl,fontFamily:SFD,textAlign:"center"}}>{selectedStudent.name}</div>
            <div style={{...fmt.subhead,color:C.lbl2,fontFamily:SF}}>Grupo {selectedStudent.group}</div>
          </Card>
          <Sec title="Tutor / Padre de Familia">
            <Row label="Contacto del tutor" detail={selectedStudent.parentContact} icon="📞" iconBg={`${C.green}15`}/>
            <Div indent={46}/><Row label={selectedStudent.parentEmail} icon="📧" iconBg={`${C.blue}15`}/>
          </Sec>
          <Sec title="Calificaciones">
            {Object.entries(selectedStudent.subjects||{}).map(([subj,data],i,arr)=>(
              <div key={subj}>
                <div style={{display:"flex",alignItems:"center",padding:"10px 16px",gap:12}}>
                  <div style={{flex:1,...fmt.body,color:C.lbl,fontFamily:SF}}>{subj}</div>
                  <input type="number" min="0" max="10" step="0.1" defaultValue={data.grade.toFixed(1)}
                    style={{width:56,background:C.fill4,border:`0.5px solid ${C.sep}`,borderRadius:8,padding:"5px 8px",fontSize:15,color:C.lbl,fontFamily:SF,textAlign:"center",outline:"none"}}/>
                </div>
                {i<arr.length-1&&<Div indent={16}/>}
              </div>
            ))}
          </Sec>
          <Sec title="Asistencia">
            <div style={{padding:"14px 16px"}}><AttCalendar attendance={selectedStudent.attendance}/></div>
          </Sec>
        </div>
        <TabBar tabs={tabs} active="classes" onChange={id=>{setSelectedStudent(null);setSelectedGroup(null);setSelectedGroupSubject(null);setTab(id);}} accent={C.blue}/>
      </div>
    );
  }

  // ── Subjects strip (intermediate screen: group selected, no subject yet) ──────
  if(selectedGroup && !selectedGroupSubject){
    const subjectsForTeacher = myGroupSubjects(selectedGroup);
    const allSubjects = (selectedGroup.subjects||[]);
    const studs = state.students.filter(s=>(selectedGroup.students||[]).some(id=>String(id)===String(s.id))||s.group===selectedGroup.name);
    return(
      <div style={{background:C.bg2,minHeight:"100vh",fontFamily:SF}}>
        {/* Header */}
        <div style={{background:`linear-gradient(135deg,${C.blue},${C.indigo})`,boxShadow:"0 2px 12px rgba(0,0,0,0.15)"}}>
          <div style={{display:"flex",alignItems:"center",padding:"14px 16px",gap:12}}>
            <button onClick={()=>{setSelectedGroup(null);setClassTab("board");}}
              style={{background:"rgba(255,255,255,0.2)",border:"none",borderRadius:"50%",
                width:36,height:36,cursor:"pointer",color:"#fff",fontSize:18,
                display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>←</button>
            <div style={{flex:1}}>
              <div style={{fontSize:20,fontWeight:800,color:"#fff",fontFamily:SFD,letterSpacing:"-0.4px"}}>Grupo {selectedGroup.name}</div>
              <div style={{fontSize:13,color:"rgba(255,255,255,0.75)",fontFamily:SF,marginTop:1}}>{studs.length} alumnos · {allSubjects.length} materia{allSubjects.length!==1?"s":""}</div>
            </div>
            <div style={{width:44,height:44,borderRadius:14,background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>🏫</div>
            <BellBtn/>
          </div>
        </div>

        <div style={{padding:"16px 16px 100px"}}>
          {/* Mis materias en este grupo */}
          {subjectsForTeacher.length>0&&(
            <>
              <div style={{fontSize:11,fontWeight:700,color:C.lbl3,textTransform:"uppercase",
                letterSpacing:"0.06em",fontFamily:SF,marginBottom:10,paddingLeft:4}}>
                Mis materias en este grupo
              </div>
              {subjectsForTeacher.map((s,i)=>{
                const m = resolveMascot(s.mascot||null, s.subject);
                const acts=[...state.pendingContent,...state.approvedContent]
                  .filter(c=>c.groupId===selectedGroup.id&&c.subject===s.subject&&["tarea","actividad","examen","cuestionario"].includes(c.type));
                return(
                  <div key={i} onClick={()=>{setSelectedGroupSubject(s.subject);setClassTab("board");}}
                    style={{background:"#fff",borderRadius:14,marginBottom:10,overflow:"hidden",
                      boxShadow:"0 2px 8px rgba(0,0,0,0.07)",cursor:"pointer",
                      border:`1.5px solid ${m.color}30`,transition:"transform 0.12s,box-shadow 0.12s"}}
                    onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow=`0 6px 20px ${m.color}25`;}}
                    onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,0.07)";}}>
                    <div style={{display:"flex",alignItems:"center",padding:"14px 16px",gap:12}}>
                      <div style={{width:44,height:44,borderRadius:12,background:`${m.color}15`,
                        display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                          <rect x="3" y="4" width="18" height="16" rx="3" fill={m.color} opacity="0.25"/>
                          <rect x="3" y="4" width="18" height="4" rx="2" fill={m.color} opacity="0.7"/>
                          <rect x="7" y="12" width="10" height="1.5" rx="1" fill={m.color}/>
                          <rect x="7" y="15" width="7" height="1.5" rx="1" fill={m.color}/>
                        </svg>
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:16,fontWeight:700,color:C.lbl,fontFamily:SFD,letterSpacing:"-0.2px"}}>{s.subject}</div>
                        <div style={{fontSize:12,color:C.lbl2,fontFamily:SF,marginTop:2}}>
                          {acts.length} actividad{acts.length!==1?"es":""} · {studs.length} alumnos
                        </div>
                      </div>
                      <div style={{width:28,height:28,borderRadius:8,background:`${m.color}12`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                        <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
                          <path d="M1 1L7 7L1 13" stroke={m.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* Otras materias del grupo (otros maestros) */}
          {allSubjects.filter(s=>!subjectsForTeacher.find(ms=>ms.subject===s.subject)).length>0&&(
            <>
              <div style={{fontSize:11,fontWeight:700,color:C.lbl3,textTransform:"uppercase",
                letterSpacing:"0.06em",fontFamily:SF,margin:"18px 0 10px",paddingLeft:4}}>
                Otras materias del grupo
              </div>
              <div style={{background:"#fff",borderRadius:14,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
                {allSubjects.filter(s=>!subjectsForTeacher.find(ms=>ms.subject===s.subject)).map((s,i,arr)=>{
                  const otherTeacher = state.teachers.find(t=>String(t.id)===String(s.teacherId));
                  const m = resolveMascot(s.mascot||null, s.subject);
                  return(
                    <div key={i}>
                      <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",opacity:0.65}}>
                        <div style={{width:36,height:36,borderRadius:10,background:`${m.color}15`,
                          display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <rect x="3" y="4" width="18" height="16" rx="3" fill={m.color} opacity="0.3"/>
                            <rect x="3" y="4" width="18" height="4" rx="2" fill={m.color} opacity="0.7"/>
                          </svg>
                        </div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:14,fontWeight:600,color:C.lbl,fontFamily:SF}}>{s.subject}</div>
                          <div style={{fontSize:11,color:C.lbl3,fontFamily:SF}}>{otherTeacher?.name||"Sin asignar"}</div>
                        </div>
                        <div style={{fontSize:11,color:C.lbl3,fontFamily:SF,background:C.fill4,borderRadius:8,padding:"3px 8px"}}>Solo lectura</div>
                      </div>
                      {i<arr.length-1&&<div style={{height:"0.5px",background:C.sep,marginLeft:64}}/>}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {allSubjects.length===0&&(
            <div style={{textAlign:"center",padding:"48px 16px",color:C.lbl2,fontSize:15,fontFamily:SF}}>
              <div style={{fontSize:44,marginBottom:12}}>📚</div>
              <div style={{fontWeight:600,color:C.lbl,marginBottom:4}}>Sin materias registradas</div>
              <div>El director aún no ha asignado materias a este grupo.</div>
            </div>
          )}
        </div>

        <TabBar tabs={tabs} active="classes" onChange={id=>{setSelectedGroup(null);setSelectedGroupSubject(null);setClassTab("board");setTab(id);}} accent={C.blue}/>
      </div>
    );
  }

  // ── Class (group) detail view ──────────────────────────────────────────────
  if(selectedGroup){
    const subjEntry=selectedGroupSubject?(selectedGroup.subjects||[]).find(s=>s.subject===selectedGroupSubject):null;
    const COLOR = selectedGroupSubject
      ? resolveMascot(subjEntry?.mascot||null, selectedGroupSubject).color
      : C.blue;
    const activities=groupContent.filter(c=>["tarea","actividad","examen","cuestionario"].includes(c.type));
    return(
      <div style={{background:C.bg2,minHeight:"100vh",fontFamily:SF}}>
        {/* Header */}
        <div style={{background:`linear-gradient(135deg,${COLOR},${COLOR}cc)`,padding:"0 0 0 0",
          boxShadow:"0 2px 12px rgba(0,0,0,0.15)"}}>
          <div style={{display:"flex",alignItems:"center",padding:"12px 16px 0",gap:10}}>
            <button onClick={()=>{setSelectedGroupSubject(null);setClassTab("board");}}
              style={{background:"rgba(255,255,255,0.2)",border:"none",borderRadius:"50%",
                width:34,height:34,cursor:"pointer",color:"#fff",fontSize:18,
                display:"flex",alignItems:"center",justifyContent:"center"}}>←</button>
            <div style={{flex:1}}>
              <div style={{fontSize:18,fontWeight:700,color:"#fff",fontFamily:SFD,lineHeight:1.2}}>
                {selectedGroupSubject||myGroupSubjects(selectedGroup).map(s=>s.subject).join(" · ")||(selectedGroup.subject||"Mi Clase")}
              </div>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.75)",fontFamily:SF}}>Grupo {selectedGroup.name} · {groupStudents.length} alumnos</div>
            </div>
            <BellBtn/>
          </div>
          {/* Tabs */}
          <div style={{display:"flex",padding:"10px 12px 0",gap:4,overflowX:"auto",scrollbarWidth:"none"}}>
            {[
              {id:"board",icon:"📋",label:"Tablón"},
              {id:"activities",icon:"📝",label:"Tareas"},
              {id:"attendance",icon:"📅",label:"Asistencia"},
              {id:"students",icon:"👥",label:"Alumnos"},
              {id:"grades",icon:"📊",label:"Calificaciones"},
            ].map(t=>(
              <button key={t.id} onClick={()=>setClassTab(t.id)}
                style={{flexShrink:0,padding:"7px 14px",borderRadius:"12px 12px 0 0",
                  border:"none",cursor:"pointer",fontFamily:SF,fontSize:13,fontWeight:600,
                  background:classTab===t.id?"#f2f2f7":"rgba(255,255,255,0.15)",
                  color:classTab===t.id?COLOR:"rgba(255,255,255,0.88)",
                  transition:"all 0.15s"}}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="page-pad">

          {/* ── TABLÓN ────────────────────────────────────────────────────── */}
          {classTab==="board"&&(
            <>
              {!showActivityForm?(
                <div onClick={()=>setShowActivityForm(true)}
                  style={{display:"flex",alignItems:"center",gap:10,background:C.bg,borderRadius:12,
                    padding:"12px 14px",marginBottom:12,boxShadow:"0 1px 3px rgba(0,0,0,0.07)",cursor:"pointer"}}>
                  <Ava initials={teacher?.avatar||"T"} color={COLOR} size={36}/>
                  <div style={{...fmt.body,color:C.lbl3,fontFamily:SF,flex:1}}>Publicar tarea, examen o anuncio…</div>
                  <div style={{background:COLOR,borderRadius:20,padding:"4px 14px",color:"#fff",fontSize:13,fontWeight:600,fontFamily:SF}}>+</div>
                </div>
              ):(
                <Card style={{marginBottom:12}}>
                  <div style={{padding:"14px 14px 10px",borderBottom:`0.5px solid ${C.sep}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <div style={{...fmt.headline,fontWeight:700,color:C.lbl,fontFamily:SF}}>Nueva Publicación</div>
                    <button onClick={()=>{setShowActivityForm(false);setActImages([]);setActFiles([]);setActLink("");setShowActLink(false);setActForm({title:"",desc:"",type:"aviso",points:10,dueDate:"",quizQ:[]});}}
                      style={{background:C.fill3,border:"none",borderRadius:"50%",width:28,height:28,cursor:"pointer",color:C.lbl2,fontSize:15,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
                  </div>
                  <div style={{padding:"12px 14px 0"}}>
                    {/* Type selector for board */}
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
                      {[{v:"aviso",label:"📢 Aviso"},{v:"dato_curioso",label:"🔎 Dato Curioso"},{v:"evento",label:"🎉 Evento"},{v:"general",label:"📌 General"}].map(t=>(
                        <button key={t.v} onClick={()=>setActForm(f=>({...f,type:t.v}))}
                          style={{padding:"5px 12px",borderRadius:20,border:"none",cursor:"pointer",fontFamily:SF,fontSize:12,fontWeight:600,transition:"all 0.15s",
                            background:actForm.type===t.v?COLOR:`${COLOR}15`,color:actForm.type===t.v?"#fff":COLOR}}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <input value={actForm.title} onChange={e=>setActForm(f=>({...f,title:e.target.value}))}
                      placeholder="Escribe un anuncio para el grupo…"
                      style={{width:"100%",background:C.fill4,border:"none",borderRadius:10,padding:"10px 13px",
                        fontSize:15,fontWeight:600,color:C.lbl,fontFamily:SF,outline:"none",boxSizing:"border-box",marginBottom:8}}/>
                    <textarea value={actForm.desc} onChange={e=>setActForm(f=>({...f,desc:e.target.value}))}
                      placeholder="Descripción o mensaje adicional…" rows={3}
                      style={{width:"100%",background:C.fill4,border:"none",borderRadius:10,padding:"10px 13px",
                        fontSize:14,color:C.lbl,fontFamily:SF,resize:"none",outline:"none",boxSizing:"border-box",lineHeight:1.5,marginBottom:8}}/>
                    {/* Attachment previews */}
                    {actImages.length>0&&(
                      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                        {actImages.map(img=>(
                          <div key={img.id} style={{position:"relative"}}>
                            <img src={img.src} style={{width:72,height:72,borderRadius:9,objectFit:"cover",border:`1px solid ${C.g5}`}}/>
                            <button onClick={()=>setActImages(a=>a.filter(x=>x.id!==img.id))}
                              style={{position:"absolute",top:-5,right:-5,width:18,height:18,borderRadius:"50%",background:C.red,border:"2px solid #fff",cursor:"pointer",color:"#fff",fontSize:9,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                    {actFiles.length>0&&(
                      <div style={{marginBottom:8,display:"flex",flexDirection:"column",gap:5}}>
                        {actFiles.map(f=>(
                          <div key={f.id} style={{display:"flex",alignItems:"center",gap:8,background:C.fill4,borderRadius:8,padding:"6px 10px"}}>
                            <span>{fileIcon(f.mime)}</span>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:12,fontWeight:600,color:C.lbl,fontFamily:SF,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</div>
                              <div style={{fontSize:10,color:C.lbl3,fontFamily:SF}}>{f.size}</div>
                            </div>
                            <button onClick={()=>setActFiles(a=>a.filter(x=>x.id!==f.id))} style={{background:"none",border:"none",color:C.lbl3,cursor:"pointer",fontSize:13}}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                    {showActLink&&(
                      <div style={{display:"flex",gap:7,marginBottom:8,alignItems:"center"}}>
                        <span>🔗</span>
                        <input value={actLink} onChange={e=>setActLink(e.target.value)}
                          placeholder="https://…"
                          style={{flex:1,background:C.fill4,border:`0.5px solid ${C.sep}`,borderRadius:9,padding:"8px 11px",fontSize:14,color:C.lbl,fontFamily:SF,outline:"none"}}/>
                        <button onClick={()=>{setShowActLink(false);setActLink("");}} style={{background:"none",border:"none",color:C.lbl3,cursor:"pointer",fontSize:14}}>✕</button>
                      </div>
                    )}
                    {/* Quiz builder */}
                    {actForm.type==="cuestionario"&&(
                      <div style={{background:`${C.purple}08`,borderRadius:12,padding:12,marginBottom:8,border:`1px solid ${C.purple}20`}}>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                          <div style={{fontSize:12,fontWeight:700,color:C.purple,fontFamily:SF}}>❓ Preguntas del Cuestionario</div>
                          <button onClick={()=>setShowQuizForm(true)}
                            style={{background:C.purple,border:"none",borderRadius:8,padding:"4px 10px",cursor:"pointer",color:"#fff",fontSize:12,fontWeight:600,fontFamily:SF}}>+ Agregar</button>
                        </div>
                        {actForm.quizQ.map((q,qi)=>(
                          <div key={q.id||qi} style={{background:"#fff",borderRadius:8,padding:"8px 10px",marginBottom:5}}>
                            <div style={{fontSize:12,fontWeight:600,color:C.lbl,fontFamily:SF}}>{qi+1}. {q.q}</div>
                            <div style={{fontSize:11,color:C.green,fontFamily:SF}}>✓ {q.a[q.correct]}</div>
                          </div>
                        ))}
                        {actForm.quizQ.length===0&&<div style={{fontSize:12,color:C.lbl3,fontFamily:SF,textAlign:"center",padding:"8px 0"}}>Sin preguntas aún</div>}
                        {showQuizForm&&(
                          <div style={{background:"#fff",borderRadius:10,padding:12,marginTop:8,border:`1px solid ${C.purple}25`}}>
                            <input value={addQuizQ.q} onChange={e=>setAddQuizQ(q=>({...q,q:e.target.value}))}
                              placeholder="Pregunta…"
                              style={{width:"100%",background:C.fill4,border:"none",borderRadius:8,padding:"8px 10px",fontSize:13,fontFamily:SF,outline:"none",boxSizing:"border-box",marginBottom:6}}/>
                            {[0,1,2,3].map(oi=>(
                              <div key={oi} style={{display:"flex",gap:6,alignItems:"center",marginBottom:5}}>
                                <button onClick={()=>setAddQuizQ(q=>({...q,correct:oi}))}
                                  style={{width:22,height:22,borderRadius:"50%",flexShrink:0,
                                    background:addQuizQ.correct===oi?C.green:C.fill4,
                                    border:`1.5px solid ${addQuizQ.correct===oi?C.green:C.g4}`,
                                    cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:addQuizQ.correct===oi?"#fff":C.g2}}>
                                  {String.fromCharCode(65+oi)}
                                </button>
                                <input value={addQuizQ.a[oi]} onChange={e=>{const na=[...addQuizQ.a];na[oi]=e.target.value;setAddQuizQ(q=>({...q,a:na}));}}
                                  placeholder={`Opción ${String.fromCharCode(65+oi)}`}
                                  style={{flex:1,background:C.fill4,border:"none",borderRadius:7,padding:"6px 9px",fontSize:12,fontFamily:SF,outline:"none"}}/>
                              </div>
                            ))}
                            <div style={{display:"flex",gap:6,marginTop:4}}>
                              <button onClick={()=>setShowQuizForm(false)} style={{flex:1,padding:"7px",borderRadius:8,border:"none",cursor:"pointer",background:C.fill3,color:C.lbl2,fontSize:13,fontFamily:SF}}>Cancelar</button>
                              <button onClick={addQuizQuestion} style={{flex:1,padding:"7px",borderRadius:8,border:"none",cursor:"pointer",background:C.purple,color:"#fff",fontSize:13,fontWeight:600,fontFamily:SF}}>Agregar</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Toolbar */}
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,padding:"10px 0",borderTop:`0.5px solid ${C.sep}`,marginTop:4}}>
                      <div style={{display:"flex",gap:4}}>
                        {[{icon:"🖼️",tip:"Imagen",action:()=>actImgRef.current?.click()},{icon:"📎",tip:"Archivo",action:()=>actFileRef.current?.click()},{icon:"🔗",tip:"Enlace",action:()=>setShowActLink(v=>!v)}].map(b=>(
                          <button key={b.tip} onClick={b.action} title={b.tip}
                            style={{width:34,height:34,borderRadius:10,background:C.fill4,border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17}}>
                            {b.icon}
                          </button>
                        ))}
                        <input ref={actImgRef} type="file" accept="image/*" multiple style={{display:"none"}} onChange={addActImage}/>
                        <input ref={actFileRef} type="file" multiple style={{display:"none"}} onChange={addActFile}/>
                      </div>
                      <Btn onPress={submitActivity} disabled={!actForm.title.trim()} color={COLOR} size="sm" style={{minWidth:110}}>Publicar</Btn>
                    </div>
                  </div>
                </Card>
              )}
              {/* Only show avisos in tablón — tareas/actividades go to Tareas tab */}
              {groupContent.filter(c=>!["tarea","actividad","examen","cuestionario"].includes(c.type)).length===0&&<div style={{textAlign:"center",padding:32,color:C.lbl2,fontSize:15,fontFamily:SF}}>Sin anuncios aún. Las tareas y actividades se ven en la pestaña "Tareas".</div>}
              {groupContent.filter(c=>!["tarea","actividad","examen","cuestionario"].includes(c.type)).map(c=>{
                const isAct=["tarea","actividad","examen","cuestionario"].includes(c.type);
                const typeColor={tarea:C.blue,actividad:C.orange,examen:C.red,cuestionario:C.purple,aviso:C.green}[c.type]||C.g1;
                const subCount=(c.submissions||[]).length;
                return(
                  <Card key={c.id} style={{marginBottom:10}} onPress={isAct?()=>setSelectedActivity(c):undefined}>
                    <div style={{padding:"13px 14px"}}>
                      <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                        <div style={{width:42,height:42,borderRadius:12,background:`${typeColor}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>
                          {c.type==="tarea"?"📝":c.type==="actividad"?"⚡":c.type==="examen"?"📋":c.type==="cuestionario"?"❓":"📢"}
                        </div>
                        <div style={{flex:1}}>
                          <div style={{...fmt.callout,fontWeight:700,color:C.lbl,fontFamily:SF,marginBottom:3}}>{c.title}</div>
                          <div style={{display:"flex",flexWrap:"wrap",gap:6,alignItems:"center"}}>
                            <span style={{fontSize:10,fontWeight:600,color:typeColor,background:`${typeColor}15`,borderRadius:5,padding:"2px 7px",fontFamily:SF}}>{c.type}</span>
                            <span style={{fontSize:10,color:C.lbl3,fontFamily:SF}}>{c.date}</span>
                            {c.dueDate&&<span style={{fontSize:10,color:C.lbl3,fontFamily:SF}}>· Entrega {c.dueDate}</span>}
                            {isAct&&<span style={{fontSize:10,fontWeight:700,color:C.blue,fontFamily:SF}}>{c.points||10} pts</span>}
                            {isAct&&<span style={{fontSize:10,color:C.lbl3,fontFamily:SF}}>{subCount}/{groupStudents.length} entregas</span>}
                          </div>
                          {c.content&&<div style={{fontSize:12,color:C.lbl2,fontFamily:SF,marginTop:5,lineHeight:1.45,overflow:"hidden",textOverflow:"ellipsis",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{c.content}</div>}
                        </div>
                        {isAct&&<svg width="8" height="13" viewBox="0 0 8 13" fill="none"><path d="M1 1L7 6.5L1 12" stroke={C.g3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      {(c.images?.length>0||c.files?.length>0||c.link)&&(
                        <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
                          {c.images?.slice(0,3).map(img=>(<img key={img.id} src={img.src} style={{width:56,height:56,borderRadius:8,objectFit:"cover"}}/>))}
                          {c.files?.slice(0,2).map(f=>(<div key={f.id} style={{background:C.fill4,borderRadius:8,padding:"6px 9px",display:"flex",alignItems:"center",gap:5}}><span style={{fontSize:14}}>{fileIcon(f.mime)}</span><span style={{fontSize:11,fontFamily:SF,color:C.lbl2}}>{f.name.length>12?f.name.substring(0,12)+"…":f.name}</span></div>))}
                          {c.link&&<div style={{background:`${C.blue}10`,borderRadius:8,padding:"6px 9px",display:"flex",alignItems:"center",gap:4}}><span style={{fontSize:13}}>🔗</span><span style={{fontSize:11,fontFamily:SF,color:C.blue}}>Enlace</span></div>}
                        </div>
                      )}
                    </div>
                    {isAct&&(
                      <div style={{borderTop:`0.5px solid ${C.sep}`,padding:"7px 14px",
                        background:subCount>0?`${C.green}05`:"transparent"}}>
                        <div style={{height:4,background:C.fill3,borderRadius:2,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${groupStudents.length>0?(subCount/groupStudents.length)*100:0}%`,background:C.green,borderRadius:2,transition:"width 0.5s ease"}}/>
                        </div>
                        <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}>
                          <span style={{fontSize:10,color:C.lbl3,fontFamily:SF}}>Entregas</span>
                          <span style={{fontSize:10,fontWeight:700,color:C.green,fontFamily:SF}}>{subCount}/{groupStudents.length}</span>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </>
          )}

          {/* ── ASISTENCIA ───────────────────────────────────────────────── */}
          {classTab==="attendance"&&(
            <TeacherAttendanceTab state={state} setState={setState} selectedGroup={selectedGroup} teacher={teacher} todayStr={todayStr} COLOR={COLOR}/>
          )}

          {/* ── TAREAS / ACTIVIDADES ─────────────────────────────────────── */}
          {classTab==="activities"&&(
            <>
              <div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}>
                <Btn onPress={()=>{setShowTaskForm(true);setActForm(f=>({...f,type:"tarea",title:"",desc:"",dueDate:"",points:10,quizQ:[]}));setActImages([]);setActFiles([]);setActLink("");setShowActLink(false);}} size="sm" color={COLOR}>+ Nueva Actividad</Btn>
              </div>
              {/* Inline task form for activities tab */}
              {showTaskForm&&(
                <Card style={{marginBottom:12}}>
                  <div style={{padding:"14px 14px 10px",borderBottom:`0.5px solid ${C.sep}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <div style={{...fmt.headline,fontWeight:700,color:C.lbl,fontFamily:SF}}>Nueva Actividad</div>
                    <button onClick={()=>{setShowTaskForm(false);setActImages([]);setActFiles([]);setActLink("");setShowActLink(false);setActForm(f=>({...f,type:"aviso",title:"",desc:"",dueDate:"",points:10,quizQ:[]}));}}
                      style={{background:C.fill3,border:"none",borderRadius:"50%",width:28,height:28,cursor:"pointer",color:C.lbl2,fontSize:15,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
                  </div>
                  <div style={{padding:"12px 14px 0"}}>
                    {/* Activity type selector */}
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
                      {[{v:"tarea",label:"📝 Tarea"},{v:"actividad",label:"⚡ Actividad"},{v:"examen",label:"📋 Examen"},{v:"cuestionario",label:"❓ Cuestionario"}].map(t=>(
                        <button key={t.v} onClick={()=>setActForm(f=>({...f,type:t.v}))}
                          style={{padding:"5px 12px",borderRadius:20,border:"none",cursor:"pointer",fontFamily:SF,fontSize:12,fontWeight:600,transition:"all 0.15s",
                            background:actForm.type===t.v?COLOR:`${COLOR}15`,color:actForm.type===t.v?"#fff":COLOR}}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <input value={actForm.title} onChange={e=>setActForm(f=>({...f,title:e.target.value}))}
                      placeholder="Título de la actividad…"
                      style={{width:"100%",background:C.fill4,border:"none",borderRadius:10,padding:"10px 13px",
                        fontSize:15,fontWeight:600,color:C.lbl,fontFamily:SF,outline:"none",boxSizing:"border-box",marginBottom:8}}/>
                    <textarea value={actForm.desc} onChange={e=>setActForm(f=>({...f,desc:e.target.value}))}
                      placeholder="Instrucciones o descripción…" rows={3}
                      style={{width:"100%",background:C.fill4,border:"none",borderRadius:10,padding:"10px 13px",
                        fontSize:14,color:C.lbl,fontFamily:SF,resize:"none",outline:"none",boxSizing:"border-box",lineHeight:1.5,marginBottom:8}}/>
                    <div style={{display:"flex",gap:8,marginBottom:8}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:11,color:C.lbl2,fontFamily:SF,marginBottom:4}}>Fecha de entrega</div>
                        <input type="date" value={actForm.dueDate} onChange={e=>setActForm(f=>({...f,dueDate:e.target.value}))}
                          style={{width:"100%",background:C.fill4,border:"none",borderRadius:10,padding:"9px 11px",fontSize:13,fontFamily:SF,outline:"none",color:C.lbl}}/>
                      </div>
                      <div style={{width:80}}>
                        <div style={{fontSize:11,color:C.lbl2,fontFamily:SF,marginBottom:4}}>Puntos</div>
                        <input type="number" value={actForm.points} onChange={e=>setActForm(f=>({...f,points:e.target.value}))} min="1" max="100"
                          style={{width:"100%",background:C.fill4,border:"none",borderRadius:10,padding:"9px 11px",fontSize:13,fontFamily:SF,outline:"none",color:C.lbl,textAlign:"center"}}/>
                      </div>
                    </div>
                    {/* Quiz builder for cuestionario */}
                    {actForm.type==="cuestionario"&&(
                      <div style={{background:`${C.purple}08`,borderRadius:12,padding:12,marginBottom:8,border:`1px solid ${C.purple}20`}}>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                          <div style={{fontSize:12,fontWeight:700,color:C.purple,fontFamily:SF}}>❓ Preguntas del Cuestionario</div>
                          <button onClick={()=>setShowQuizForm(true)}
                            style={{background:C.purple,border:"none",borderRadius:8,padding:"4px 10px",cursor:"pointer",color:"#fff",fontSize:12,fontWeight:600,fontFamily:SF}}>+ Agregar</button>
                        </div>
                        {actForm.quizQ.map((q,qi)=>(
                          <div key={q.id||qi} style={{background:"#fff",borderRadius:8,padding:"8px 10px",marginBottom:5}}>
                            <div style={{fontSize:12,fontWeight:600,color:C.lbl,fontFamily:SF}}>{qi+1}. {q.q}</div>
                            <div style={{fontSize:11,color:C.green,fontFamily:SF}}>✓ {q.a[q.correct]}</div>
                          </div>
                        ))}
                        {actForm.quizQ.length===0&&<div style={{fontSize:12,color:C.lbl3,fontFamily:SF,textAlign:"center",padding:"8px 0"}}>Sin preguntas aún</div>}
                        {showQuizForm&&(
                          <div style={{background:"#fff",borderRadius:10,padding:12,marginTop:8,border:`1px solid ${C.purple}25`}}>
                            <input value={addQuizQ.q} onChange={e=>setAddQuizQ(q=>({...q,q:e.target.value}))}
                              placeholder="Pregunta…"
                              style={{width:"100%",background:C.fill4,border:"none",borderRadius:8,padding:"8px 10px",fontSize:13,fontFamily:SF,outline:"none",boxSizing:"border-box",marginBottom:6}}/>
                            {[0,1,2,3].map(oi=>(
                              <div key={oi} style={{display:"flex",gap:6,alignItems:"center",marginBottom:5}}>
                                <button onClick={()=>setAddQuizQ(q=>({...q,correct:oi}))}
                                  style={{width:22,height:22,borderRadius:"50%",flexShrink:0,
                                    background:addQuizQ.correct===oi?C.green:C.fill4,
                                    border:`1.5px solid ${addQuizQ.correct===oi?C.green:C.g4}`,
                                    cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:addQuizQ.correct===oi?"#fff":C.g2}}>
                                  {String.fromCharCode(65+oi)}
                                </button>
                                <input value={addQuizQ.a[oi]} onChange={e=>{const na=[...addQuizQ.a];na[oi]=e.target.value;setAddQuizQ(q=>({...q,a:na}));}}
                                  placeholder={`Opción ${String.fromCharCode(65+oi)}`}
                                  style={{flex:1,background:C.fill4,border:"none",borderRadius:7,padding:"6px 9px",fontSize:12,fontFamily:SF,outline:"none"}}/>
                              </div>
                            ))}
                            <div style={{display:"flex",gap:6,marginTop:4}}>
                              <button onClick={()=>setShowQuizForm(false)} style={{flex:1,padding:"7px",borderRadius:8,border:"none",cursor:"pointer",background:C.fill3,color:C.lbl2,fontSize:13,fontFamily:SF}}>Cancelar</button>
                              <button onClick={addQuizQuestion} style={{flex:1,padding:"7px",borderRadius:8,border:"none",cursor:"pointer",background:C.purple,color:"#fff",fontSize:13,fontWeight:600,fontFamily:SF}}>Agregar</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,padding:"10px 0",borderTop:`0.5px solid ${C.sep}`,marginTop:4}}>
                      <div style={{display:"flex",gap:4}}>
                        {[{icon:"🖼️",tip:"Imagen",action:()=>actImgRef.current?.click()},{icon:"📎",tip:"Archivo",action:()=>actFileRef.current?.click()},{icon:"🔗",tip:"Enlace",action:()=>setShowActLink(v=>!v)}].map(b=>(
                          <button key={b.tip} onClick={b.action} title={b.tip}
                            style={{width:34,height:34,borderRadius:10,background:C.fill4,border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17}}>
                            {b.icon}
                          </button>
                        ))}
                      </div>
                      <Btn onPress={()=>{submitActivity();setShowTaskForm(false);}} disabled={!actForm.title.trim()} color={COLOR} size="sm" style={{minWidth:110}}>Publicar</Btn>
                    </div>
                  </div>
                </Card>
              )}
              {activities.length===0&&!showTaskForm&&<div style={{textAlign:"center",padding:32,color:C.lbl2,fontSize:15,fontFamily:SF}}>Sin actividades asignadas</div>}
              {activities.map(c=>{
                const typeColor={tarea:C.blue,actividad:C.orange,examen:C.red,cuestionario:C.purple}[c.type]||C.g1;
                const subCount=(c.submissions||[]).length;
                const graded=Object.keys(gradeDraft).filter(k=>k.startsWith(`${c.id}_`)).length;
                return(
                  <Card key={c.id} style={{marginBottom:10}} onPress={()=>setSelectedActivity(c)}>
                    <div style={{padding:"13px 14px",display:"flex",alignItems:"center",gap:12}}>
                      <div style={{width:46,height:46,borderRadius:13,background:`${typeColor}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>
                        {c.type==="tarea"?"📝":c.type==="actividad"?"⚡":c.type==="examen"?"📋":"❓"}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{...fmt.callout,fontWeight:700,color:C.lbl,fontFamily:SF,marginBottom:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.title}</div>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                          <Pill color={typeColor} size="xs">{c.type}</Pill>
                          <span style={{fontSize:10,color:C.lbl3,fontFamily:SF}}>{c.date}</span>
                          {c.dueDate&&<span style={{fontSize:10,color:C.orange,fontWeight:600,fontFamily:SF}}>📅 {c.dueDate}</span>}
                        </div>
                        <div style={{display:"flex",gap:10,marginTop:5}}>
                          <span style={{fontSize:11,fontWeight:700,color:C.blue,background:`${C.blue}12`,borderRadius:6,padding:"2px 7px",fontFamily:SF}}>{c.points||10} pts</span>
                          <span style={{fontSize:11,color:subCount>0?C.green:C.lbl3,fontFamily:SF}}>{subCount}/{groupStudents.length} entregaron</span>
                          {graded>0&&<span style={{fontSize:11,color:C.purple,fontFamily:SF}}>{graded} calificados</span>}
                        </div>
                      </div>
                      <svg width="8" height="13" viewBox="0 0 8 13" fill="none"><path d="M1 1L7 6.5L1 12" stroke={C.g3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                    <div style={{padding:"0 14px 10px"}}>
                      <div style={{height:5,background:C.fill3,borderRadius:3,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${groupStudents.length>0?(subCount/groupStudents.length)*100:0}%`,background:C.green,borderRadius:3}}/>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </>
          )}

          {/* ── ALUMNOS ──────────────────────────────────────────────────── */}
          {classTab==="students"&&(
            <Sec title={`${groupStudents.length} alumnos inscritos`}>
              {groupStudents.length===0&&<div style={{padding:"16px",color:C.lbl2,fontSize:15,fontFamily:SF}}>Sin alumnos asignados</div>}
              {groupStudents.map((s,i)=>(
                <div key={s.id}>
                  <div onClick={()=>setSelectedStudent(s)}
                    style={{display:"flex",alignItems:"center",gap:12,padding:"11px 16px",cursor:"pointer"}}
                    onMouseEnter={e=>e.currentTarget.style.background=C.fill4}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <Ava initials={s.avatar} color={s.color} size={38}/>
                    <div style={{flex:1}}>
                      <div style={{...fmt.callout,fontWeight:600,color:C.lbl,fontFamily:SF}}>{s.name}</div>
                      <div style={{...fmt.caption,color:C.lbl2,fontFamily:SF}}>📞 {s.parentContact||"Sin contacto"}</div>
                    </div>
                    <svg width="8" height="13" viewBox="0 0 8 13" fill="none"><path d="M1 1L7 6.5L1 12" stroke={C.g3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  {i<groupStudents.length-1&&<Div indent={66}/>}
                </div>
              ))}
            </Sec>
          )}

          {/* ── CALIFICACIONES ───────────────────────────────────────────── */}
          {classTab==="grades"&&(()=>{
            const np=state.numParciales||3;
            const ordinal=(n)=>["1er","2do","3er","4to","5to"][n-1]||`${n}°`;
            return(
              <>
                {/* Parcial selector */}
                <Card style={{padding:14,marginBottom:12}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.lbl2,textTransform:"uppercase",letterSpacing:"0.05em",fontFamily:SF,marginBottom:10}}>
                    Selecciona el parcial a evaluar
                  </div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {Array.from({length:np},(_,i)=>i+1).map(n=>(
                      <button key={n} onClick={()=>setSelParcial(n)}
                        style={{padding:"8px 18px",borderRadius:20,border:"none",cursor:"pointer",
                          fontFamily:SF,fontSize:13,fontWeight:600,transition:"all 0.15s",
                          background:selParcial===n?COLOR:`${COLOR}12`,
                          color:selParcial===n?"#fff":COLOR}}>
                        {ordinal(n)} Parcial
                      </button>
                    ))}
                  </div>
                </Card>

                {/* Upload / publish panel */}
                <Card style={{padding:14,marginBottom:14,background:`linear-gradient(135deg,${COLOR}10,${COLOR}04)`}}>
                  <div style={{...fmt.headline,fontWeight:700,color:C.lbl,fontFamily:SF,marginBottom:4}}>
                    📊 {ordinal(selParcial)} Parcial — {selectedGroupSubject||selectedGroup.name}
                  </div>
                  <div style={{fontSize:13,color:C.lbl2,fontFamily:SF,lineHeight:1.5,marginBottom:12}}>
                    Captura las calificaciones. Al publicar se verán reflejadas en el panel de cada alumno y en avisos.
                  </div>
                  <div style={{marginBottom:12}}>
                    {groupStudents.map((s,i)=>{
                      const gradeKey=`p${selParcial}_${selectedGroupSubject||selectedGroup.id}_${s.id}`;
                      const current=gradeDraft[gradeKey];
                      const pub=publishedGrades[gradeKey];
                      return(
                        <div key={s.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:i<groupStudents.length-1?`0.5px solid ${C.sep}`:"none"}}>
                          <Ava initials={s.avatar} color={s.color} size={32}/>
                          <div style={{flex:1,...fmt.callout,color:C.lbl,fontFamily:SF}}>{s.name}</div>
                          <div style={{display:"flex",alignItems:"center",gap:6}}>
                            <input type="number" min="0" max="10" step="0.1"
                              defaultValue={current?.grade||""}
                              placeholder="—"
                              onChange={e=>setGradeDraft(d=>({...d,[gradeKey]:{grade:e.target.value,parcial:selParcial,subject:selectedGroupSubject||"",saved:true}}))}
                              style={{width:52,background:C.fill4,border:`1px solid ${pub?.published?C.green:C.g5}`,
                                borderRadius:8,padding:"5px 0",fontSize:16,fontWeight:700,
                                color:pub?.published?C.green:C.lbl,fontFamily:SF,textAlign:"center",outline:"none"}}/>
                            {pub?.published&&<span style={{fontSize:16}}>✅</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <Btn onPress={async()=>{
                    const newPub={...publishedGrades};
                    groupStudents.forEach(s=>{
                      const key=`p${selParcial}_${selectedGroupSubject||selectedGroup.id}_${s.id}`;
                      if(gradeDraft[key]) newPub[key]={...gradeDraft[key],published:true};
                    });
                    setPublishedGrades(newPub);
                    const savePromises=groupStudents.map(async s=>{
                      const key=`p${selParcial}_${selectedGroupSubject||selectedGroup.id}_${s.id}`;
                      const val=gradeDraft[key];
                      if(!val||!val.grade)return;
                      const subj=selectedGroupSubject||"";
                      if(typeof s.id==="string"){
                        const parcialData={[`parcial_${selParcial}_${subj}`]:Number(val.grade)};
                        await updateDoc(doc(db,"students",s.id),parcialData).catch(()=>{});
                        setState(prev=>({...prev,students:prev.students.map(st=>st.id===s.id?{...st,[`parcial_${selParcial}_${subj}`]:Number(val.grade)}:st)}));
                      }
                    });
                    await Promise.all(savePromises);
                    const subjLabel=selectedGroupSubject||selectedGroup.name;
                    const avisoEntry={
                      fromName:teacher.name,fromRole:"Docente",type:"board",
                      title:`Calificaciones ${ordinal(selParcial)} Parcial — ${subjLabel}`,
                      body:`Se publicaron las calificaciones del ${ordinal(selParcial)} Parcial de ${subjLabel} para el grupo ${selectedGroup.name}.`,
                      groupId:selectedGroup.id,groupName:selectedGroup.name,
                      time:today(),read:false,_createdAt:serverTimestamp(),
                    };
                    addDoc(collection(db,"avisos"),avisoEntry).catch(()=>{});
                    setState(s=>({...s,avisos:[{id:Date.now(),...avisoEntry},...s.avisos]}));
                    SFX.play("success");
                    pushNotification({title:"✅ Calificaciones publicadas",text:`${ordinal(selParcial)} Parcial de ${subjLabel} notificado a alumnos.`});
                  }} full color={C.green}>
                    📤 Publicar {ordinal(selParcial)} Parcial
                  </Btn>
                </Card>

                {/* Calificación Final Manual */}
                <Card style={{padding:14,marginBottom:14,background:`${C.orange}08`,border:`1px solid ${C.orange}20`}}>
                  <div style={{...fmt.headline,fontWeight:700,color:C.lbl,fontFamily:SF,marginBottom:4}}>
                    🏁 Calificación Final — {selectedGroupSubject||selectedGroup.name}
                  </div>
                  <div style={{fontSize:12,color:C.lbl2,fontFamily:SF,marginBottom:12}}>
                    Captura la calificación final de cada alumno (promedio u otra fórmula). Se guarda en el perfil del alumno.
                  </div>
                  <div style={{marginBottom:12}}>
                    {groupStudents.map((s,i)=>{
                      const finalKey=`final_${selectedGroupSubject||selectedGroup.id}_${s.id}`;
                      const current=gradeDraft[finalKey];
                      const pub=publishedGrades[finalKey];
                      // Auto-compute average of parciales
                      const np2=state.numParciales||3;
                      const vals=Array.from({length:np2},(_,pi)=>{
                        const k=`p${pi+1}_${selectedGroupSubject||selectedGroup.id}_${s.id}`;
                        return gradeDraft[k]?.grade?Number(gradeDraft[k].grade):null;
                      }).filter(v=>v!=null);
                      const autoAvg=vals.length===np2?vals.reduce((a,b)=>a+b,0)/np2:null;
                      return(
                        <div key={s.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:i<groupStudents.length-1?`0.5px solid ${C.sep}`:"none"}}>
                          <Ava initials={s.avatar} color={s.color} size={32}/>
                          <div style={{flex:1,...fmt.callout,color:C.lbl,fontFamily:SF}}>{s.name}</div>
                          {autoAvg!=null&&!current?.grade&&<span style={{fontSize:10,color:C.lbl3,fontFamily:SF}}>≈{autoAvg.toFixed(1)}</span>}
                          <div style={{display:"flex",alignItems:"center",gap:6}}>
                            <input type="number" min="0" max="10" step="0.1"
                              defaultValue={current?.grade||(s[`final_${selectedGroupSubject||""}`])||""}
                              placeholder={autoAvg!=null?autoAvg.toFixed(1):"—"}
                              onChange={e=>setGradeDraft(d=>({...d,[finalKey]:{grade:e.target.value,saved:true}}))}
                              style={{width:52,background:C.fill4,border:`1px solid ${pub?.published?C.orange:C.g5}`,
                                borderRadius:8,padding:"5px 0",fontSize:16,fontWeight:700,
                                color:pub?.published?C.orange:C.lbl,fontFamily:SF,textAlign:"center",outline:"none"}}/>
                            {pub?.published&&<span style={{fontSize:16}}>✅</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <Btn onPress={async()=>{
                    const newPub={...publishedGrades};
                    const subj=selectedGroupSubject||"";
                    const savePromises=groupStudents.map(async s=>{
                      const finalKey=`final_${selectedGroupSubject||selectedGroup.id}_${s.id}`;
                      const val=gradeDraft[finalKey];
                      if(!val?.grade)return;
                      newPub[finalKey]={...val,published:true};
                      if(typeof s.id==="string"){
                        const finalData={[`final_${subj}`]:Number(val.grade)};
                        await updateDoc(doc(db,"students",s.id),finalData).catch(()=>{});
                        setState(prev=>({...prev,students:prev.students.map(st=>st.id===s.id?{...st,[`final_${subj}`]:Number(val.grade)}:st)}));
                      }
                    });
                    await Promise.all(savePromises);
                    setPublishedGrades(newPub);
                    SFX.play("success");
                    pushNotification({title:"✅ Calificaciones finales guardadas",text:`${selectedGroupSubject||selectedGroup.name} finalizado.`});
                  }} full color={C.orange}>
                    💾 Guardar Calificaciones Finales
                  </Btn>
                </Card>

                <div style={{...fmt.footnote,color:C.lbl2,textTransform:"uppercase",letterSpacing:"0.05em",fontFamily:SF,marginBottom:8,paddingLeft:4}}>
                  Resumen por actividad
                </div>
                {activities.map(act=>{
                  const graded=groupStudents.filter(s=>gradeDraft[`${act.id}_${s.id}`]).length;
                  return(
                    <Card key={act.id} style={{marginBottom:8}} onPress={()=>setSelectedActivity(act)}>
                      <div style={{padding:"11px 14px",display:"flex",alignItems:"center",gap:10}}>
                        <div style={{flex:1}}>
                          <div style={{...fmt.callout,fontWeight:600,color:C.lbl,fontFamily:SF}}>{act.title}</div>
                          <div style={{fontSize:11,color:C.lbl3,fontFamily:SF,marginTop:2}}>{act.date} · {act.points||10} pts</div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontSize:13,fontWeight:700,color:graded===groupStudents.length?C.green:C.orange,fontFamily:SF}}>{graded}/{groupStudents.length}</div>
                          <div style={{fontSize:10,color:C.lbl3,fontFamily:SF}}>calificados</div>
                        </div>
                        <svg width="8" height="13" viewBox="0 0 8 13" fill="none"><path d="M1 1L7 6.5L1 12" stroke={C.g3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                    </Card>
                  );
                })}
                {activities.length===0&&<div style={{textAlign:"center",padding:28,color:C.lbl2,fontSize:14,fontFamily:SF}}>Sin actividades para calificar</div>}
              </>
            );
          })()}
        </div>

        <TabBar tabs={tabs} active="classes" onChange={id=>{setSelectedGroup(null);setSelectedGroupSubject(null);setClassTab("board");setTab(id);}} accent={C.blue}/>
      </div>
    );
  }

  // ── Main tabs ──────────────────────────────────────────────────────────────
  return(
    <div className="app-layout" style={{background:C.bg2,minHeight:"100vh",fontFamily:SF}}>
      <AppSidebar
        open={sidebarOpen} onToggle={()=>setSidebarOpen(o=>!o)}
        gradient="linear-gradient(180deg,#1e40af 0%,#2563eb 60%,#3b82f6 100%)"
        logoEmoji="👩‍🏫" logoLine1="Portal" logoLine2="Docente"
        userEmoji={teacher?.avatar?"":"👨‍🏫"} userName={teacher?.name||"Docente"} userSub={`Grupos: ${teacher?.groups?.join(", ")||"-"}`}
        onLogout={onLogout}
        navItems={[
          {id:"feed",icon:"📋",label:"Tablón",active:tab==="feed",onClick:()=>{setTab("feed");localStorage.setItem("tea_tab","feed");}},
          {id:"classes",icon:"🏫",label:"Mis Clases",active:tab==="classes",onClick:()=>{setTab("classes");localStorage.setItem("tea_tab","classes");},badge:urgentCount||0},
          {id:"chat",icon:"💬",label:"Mensajes",active:tab==="chat",onClick:()=>{setTab("chat");localStorage.setItem("tea_tab","chat");},badge:totalChatUnread||0},
          {id:"ai",icon:"🤖",label:"Asistente IA",active:tab==="ai",onClick:()=>{setTab("ai");localStorage.setItem("tea_tab","ai");}},
          {id:"settings",icon:"⚙️",label:"Ajustes",active:tab==="settings",onClick:()=>{setTab("settings");localStorage.setItem("tea_tab","settings");}},
        ]}
      />
      <div style={{flex:1,minWidth:0,minHeight:"100vh",overflowX:"hidden"}}>
      {tab==="feed"&&<Feed state={state} setState={setState}
        userId={`t${teacher?.id}`} userName={teacher?.name||"Maestro"}
        userAvatar={teacher?.avatar||"T"} userColor={teacher?.color||C.blue}
        userRole="teacher" accent={C.blue}
        newsItems={newsItems} urgentCount={urgentCount}/>}

      {tab==="chat"&&(
        <ChatPanel state={state} setState={setState}
          myUserId={`t${teacher?.id}`} myName={teacher?.name||"Maestro"}
          myAvatar={teacher?.avatar||"T"} myColor={teacher?.color||C.blue}
          role="teacher" accent={C.blue}/>
      )}

      {tab==="classes"&&(
        <div>
          <NavBar title="Mis Clases" large accent={C.blue} right={<BellBtn/>}/>
          <div style={{padding:"0 16px 100px"}}>
            {myGroups.length===0&&(
              <div style={{textAlign:"center",padding:"48px 20px",color:C.lbl2,fontSize:15,fontFamily:SF}}>
                <div style={{fontSize:48,marginBottom:12}}>🏫</div>
                <div style={{fontWeight:700,color:C.lbl,marginBottom:6,fontSize:17}}>Sin grupos asignados</div>
                <div style={{fontSize:13,lineHeight:1.6,marginBottom:16}}>Tu cuenta aún no tiene grupos vinculados.<br/>Pide a la directora que te asigne materias y grupos.</div>
                <div style={{fontFamily:"monospace",fontSize:12,color:C.lbl3,background:C.fill4,borderRadius:8,padding:"6px 14px",display:"inline-block",marginBottom:20}}>Clave: {teacher?.key||"—"}</div>
                <div>
                  <button onClick={onLogout} style={{background:C.red,color:"#fff",border:"none",borderRadius:12,padding:"10px 28px",fontSize:15,fontWeight:700,fontFamily:SF,cursor:"pointer"}}>
                    Cerrar sesión
                  </button>
                </div>
              </div>
            )}
            {myGroups.map(g=>{
              const studs=state.students.filter(s=>(g.students||[]).some(id=>String(id)===String(s.id))||s.group===g.name);
              const acts=[...state.pendingContent,...state.approvedContent].filter(c=>c.groupId===g.id&&["tarea","actividad","examen","cuestionario"].includes(c.type));
              const ungraded=acts.reduce((acc,act)=>acc+(act.submissions||[]).length,0);
              return(
                <Card key={g.id} style={{marginBottom:12,overflow:"hidden"}} onPress={()=>{setSelectedGroup(g);setSelectedGroupSubject(null);}}>
                  <div style={{background:`linear-gradient(135deg,${C.blue},${C.indigo})`,padding:"14px 16px"}}>
                    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:22,fontWeight:800,color:"#fff",fontFamily:SFD,letterSpacing:"-0.5px"}}>
                          Grupo {g.name}
                        </div>
                        <div style={{fontSize:13,color:"rgba(255,255,255,0.8)",fontFamily:SF,marginTop:2}}>{studs.length} alumnos inscritos</div>
                        {/* Subject chips */}
                        {myGroupSubjects(g).length>0&&(
                          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:10}}>
                            {myGroupSubjects(g).map((s,i)=>{
                                      const _m=MASCOTS[s.subject]||MASCOTS["Matemáticas"];
                              return(
                                <div key={i} style={{background:"rgba(255,255,255,0.22)",borderRadius:20,
                                  padding:"4px 10px",display:"flex",alignItems:"center",gap:5}}>
                                  <span style={{fontSize:12,fontWeight:600,color:"#fff",fontFamily:SF}}>{s.subject}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div style={{width:46,height:46,borderRadius:14,background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0,marginLeft:8}}>🏫</div>
                    </div>
                  </div>
                  <div style={{padding:"12px 16px",display:"flex",gap:16}}>
                    <div style={{textAlign:"center",flex:1}}>
                      <div style={{fontSize:22,fontWeight:800,color:C.blue,fontFamily:SF}}>{studs.length}</div>
                      <div style={{fontSize:10,color:C.lbl3,fontFamily:SF}}>Alumnos</div>
                    </div>
                    <div style={{width:"0.5px",background:C.sep}}/>
                    <div style={{textAlign:"center",flex:1}}>
                      <div style={{fontSize:22,fontWeight:800,color:C.orange,fontFamily:SF}}>{acts.length}</div>
                      <div style={{fontSize:10,color:C.lbl3,fontFamily:SF}}>Actividades</div>
                    </div>
                    <div style={{width:"0.5px",background:C.sep}}/>
                    <div style={{textAlign:"center",flex:1}}>
                      <div style={{fontSize:22,fontWeight:800,color:ungraded>0?C.red:C.green,fontFamily:SF}}>{ungraded}</div>
                      <div style={{fontSize:10,color:C.lbl3,fontFamily:SF}}>Entregas</div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {tab==="ai"&&(
        <div>
          <NavBar title="Generador IA" large sub="Powered by Claude" accent={C.purple} right={<BellBtn/>}/>
          <div className="page-pad">
            <Card style={{padding:16,marginBottom:14}}>
              <div style={{...fmt.headline,color:C.lbl,fontFamily:SF,marginBottom:4}}>🤖 Crear Examen o Actividad</div>
              <div style={{...fmt.subhead,color:C.lbl2,fontFamily:SF,marginBottom:14,lineHeight:1.5}}>Describe el tema y Claude generará preguntas listas para aplicar</div>
              <textarea value={aiPrompt} onChange={e=>setAiPrompt(e.target.value)}
                placeholder="Ej: Fracciones, Revolución Mexicana, Fotosíntesis…" rows={3}
                style={{width:"100%",background:C.fill4,border:`0.5px solid ${C.sep}`,borderRadius:10,padding:"10px 12px",fontSize:15,color:C.lbl,fontFamily:SF,resize:"none",outline:"none",boxSizing:"border-box",marginBottom:12}}/>
              <Btn onPress={genAI} disabled={aiLoading||!aiPrompt.trim()} color={C.purple} full>
                {aiLoading?"Generando…":"✨ Generar Preguntas"}
              </Btn>
              {aiResult&&(
                <div style={{marginTop:14,background:`${C.purple}08`,border:`0.5px solid ${C.purple}30`,borderRadius:10,padding:14,maxHeight:320,overflowY:"auto"}}>
                  <pre style={{color:C.lbl,fontSize:13,lineHeight:1.7,whiteSpace:"pre-wrap",margin:0,fontFamily:"'SF Mono','Menlo',monospace"}}>{aiResult}</pre>
                </div>
              )}
            </Card>
            {aiAskDest&&(
              <Card style={{padding:16}}>
                <div style={{...fmt.headline,color:C.lbl,fontFamily:SF,marginBottom:6}}>¿Dónde publicar?</div>
                <Btn onPress={publishToFeed} variant="tinted" color={C.indigo} full style={{marginBottom:10}}>📋 Anunciar en Tablón General</Btn>
                {myGroups.map(g=>(
                  <Btn key={g.id} onPress={()=>publishToGroup(g.id)} variant="tinted" color={C.blue} full style={{marginBottom:8}}>
                    📚 Subir a {g.name}
                  </Btn>
                ))}
                <Btn onPress={()=>setAiAskDest(false)} variant="ghost" full>Cancelar</Btn>
              </Card>
            )}
          </div>
        </div>
      )}

      {tab==="settings"&&(
        <div>
          <NavBar title="Ajustes" large accent={C.blue} right={<BellBtn/>}/>
          <div className="page-pad">
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,marginBottom:24}}>
              <Ava initials={teacher?.avatar||"T"} color={teacher?.color||C.blue} size={80}/>
              <div style={{...fmt.title3,color:C.lbl,fontFamily:SFD}}>{teacher?.name}</div>
              <div style={{fontFamily:"'SF Mono','Menlo',monospace",fontSize:14,color:C.blue}}>{teacher?.key}</div>
              <div style={{fontSize:12,color:C.lbl2,fontFamily:SF,marginTop:4,textAlign:"center"}}>
                {[...new Set(myGroups.flatMap(g=>myGroupSubjects(g).map(s=>s.subject)))].join(" · ")||"Sin materias"}
              </div>
            </div>
            <Sec title="Cuenta">
              <Row label="Editar Perfil" icon="✏️" iconBg={`${C.blue}20`} chevron onPress={()=>{}}/>
              <Div indent={46}/>
              <Row label="Cambiar Código" icon="🔐" iconBg={`${C.orange}20`} chevron onPress={()=>{}}/>
            </Sec>
            <Sec><Row label="Cerrar Sesión" icon="🚪" iconBg={`${C.red}15`} danger onPress={onLogout}/></Sec>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

// ─── MASCOT SHOP CATALOG ──────────────────────────────────────────────────────
const MASCOT_SHOP={
  "Matemáticas":[
    {id:"m1",name:"Birrete",emoji:"🎓",cost:5,desc:"El Búho más estudioso"},
    {id:"m2",name:"Gafas Nerd",emoji:"🤓",cost:3,desc:"Para ver mejor los números"},
    {id:"m3",name:"Capa Héroe",emoji:"🦸",cost:10,desc:"¡Súper Euler al rescate!"},
    {id:"m4",name:"Corona Real",emoji:"👑",cost:15,desc:"Rey de las Matemáticas"},
  ],
  "Ciencias":[
    {id:"c1",name:"Gafas Lab",emoji:"🥽",cost:4,desc:"Seguridad primero"},
    {id:"c2",name:"Bata Blanca",emoji:"🥼",cost:7,desc:"Científica oficial"},
    {id:"c3",name:"Sombrero Explorador",emoji:"👒",cost:5,desc:"Explorador de naturaleza"},
    {id:"c4",name:"Traje Espacial",emoji:"👨‍🚀",cost:12,desc:"Darwin en el cosmos"},
  ],
  "Historia":[
    {id:"h1",name:"Sombrero Vaquero",emoji:"🤠",cost:5,desc:"El Zorro del pasado"},
    {id:"h2",name:"Casco Antiguo",emoji:"⛑️",cost:6,desc:"¡Ave César!"},
    {id:"h3",name:"Lupa Arqueólogo",emoji:"🔍",cost:4,desc:"Descubriendo la historia"},
    {id:"h4",name:"Pergamino",emoji:"📜",cost:8,desc:"Escrituras antiguas"},
  ],
  "Español":[
    {id:"e1",name:"Pluma Escritor",emoji:"🪶",cost:3,desc:"La mariposa literaria"},
    {id:"e2",name:"Sombrero Teatro",emoji:"🎭",cost:5,desc:"Dramaturga de corazón"},
    {id:"e3",name:"Libro Mágico",emoji:"📖",cost:7,desc:"Devoradora de palabras"},
    {id:"e4",name:"Estrella Autor",emoji:"⭐",cost:10,desc:"¡La mejor escritora!"},
  ],
  _default:[
    {id:"d1",name:"Birrete",emoji:"🎓",cost:5,desc:"¡El más dedicado!"},
    {id:"d2",name:"Estrella",emoji:"⭐",cost:8,desc:"Brilla en clase"},
    {id:"d3",name:"Corona",emoji:"👑",cost:12,desc:"Rey de la materia"},
    {id:"d4",name:"Capa Héroe",emoji:"🦸",cost:10,desc:"¡Súper estudiante!"},
  ],
};
// Returns shop items for any subject (fallback to _default)
const getShopItems=(subject)=>MASCOT_SHOP[subject]||MASCOT_SHOP._default;

// ─── BIG ANIMAL SVG DECORATIONS ───────────────────────────────────────────────
const AnimalDeco=({type,size=110,opacity=0.12})=>{
  const W=type==="giraffe"?size*0.55:type==="bear"?size*0.75:size;
  const H=type==="giraffe"?size:type==="whale"?size*0.55:type==="bear"?size*0.85:type==="hippo"?size*0.75:size*0.85;
  const animals={
    whale:(
      <svg width={W} height={H} viewBox="0 0 220 120" fill="none">
        <ellipse cx="92" cy="62" rx="85" ry="36" fill="#6CB8FF"/>
        <ellipse cx="95" cy="68" rx="88" ry="42" fill="#4A9EFF" opacity="0.7"/>
        <path d="M176 72 Q200 50 215 40 Q210 60 215 80 Q200 70 176 72Z" fill="#4A9EFF"/>
        <path d="M110 40 Q125 20 135 28 Q130 40 110 40Z" fill="#4A9EFF"/>
        <circle cx="30" cy="60" r="6" fill="white"/>
        <circle cx="31" cy="61" r="3.5" fill="#1a1a2e"/>
        <circle cx="32" cy="59" r="1" fill="white"/>
        <path d="M18 70 Q28 76 38 70" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round"/>
        <path d="M80 28 Q82 15 84 8 M84 28 Q88 14 91 6 M89 29 Q94 16 96 9" stroke="#A0D8FF" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.7"/>
        <ellipse cx="80" cy="82" rx="55" ry="16" fill="#E8F4FF" opacity="0.5"/>
      </svg>
    ),
    giraffe:(
      <svg width={W} height={H} viewBox="0 0 120 220" fill="none">
        <path d="M48 120 Q50 60 60 20 Q70 60 72 120Z" fill="#F5A623"/>
        <ellipse cx="60" cy="150" rx="38" ry="48" fill="#F5A623"/>
        <ellipse cx="60" cy="24" rx="18" ry="16" fill="#F5A623"/>
        <rect x="54" y="6" width="4" height="14" rx="2" fill="#8B6914"/>
        <rect x="62" y="8" width="4" height="12" rx="2" fill="#8B6914"/>
        <circle cx="56" cy="6" r="3" fill="#8B6914"/>
        <circle cx="64" cy="8" r="3" fill="#8B6914"/>
        <ellipse cx="44" cy="22" rx="7" ry="5" fill="#F5A623" transform="rotate(-20 44 22)"/>
        <ellipse cx="76" cy="22" rx="7" ry="5" fill="#F5A623" transform="rotate(20 76 22)"/>
        <circle cx="52" cy="22" r="5" fill="white"/>
        <circle cx="53" cy="22" r="3" fill="#1a1a2e"/>
        <circle cx="54" cy="21" r="1" fill="white"/>
        <ellipse cx="60" cy="34" rx="5" ry="3" fill="#E8943A"/>
        {[[55,90,8],[70,110,7],[48,135,9],[68,145,7],[50,160,8],[75,170,6]].map(([x,y,r],i)=>(
          <ellipse key={i} cx={x} cy={y} rx={r} ry={r*0.8} fill="#8B6914" opacity="0.45"/>
        ))}
        <rect x="34" y="188" width="10" height="28" rx="5" fill="#F5A623"/>
        <rect x="50" y="188" width="10" height="28" rx="5" fill="#E8943A"/>
        <rect x="62" y="188" width="10" height="28" rx="5" fill="#F5A623"/>
        <rect x="78" y="188" width="10" height="28" rx="5" fill="#E8943A"/>
        <path d="M96 155 Q108 165 105 180" stroke="#F5A623" strokeWidth="3" fill="none" strokeLinecap="round"/>
      </svg>
    ),
    elephant:(
      <svg width={W} height={H} viewBox="0 0 220 190" fill="none">
        <ellipse cx="120" cy="120" rx="75" ry="60" fill="#9E9E9E"/>
        <ellipse cx="50" cy="90" rx="45" ry="42" fill="#9E9E9E"/>
        <path d="M28 118 Q10 140 18 165 Q22 175 30 168 Q22 145 38 125Z" fill="#8E8E8E"/>
        <path d="M35 128 Q20 135 15 150 Q18 155 25 148 Q28 138 40 132Z" fill="#FFFDE7"/>
        <ellipse cx="20" cy="85" rx="22" ry="28" fill="#BDBDBD" transform="rotate(-10 20 85)"/>
        <ellipse cx="22" cy="85" rx="14" ry="20" fill="#F8BBD9" opacity="0.35" transform="rotate(-10 22 85)"/>
        <circle cx="42" cy="75" r="7" fill="white"/>
        <circle cx="43" cy="76" r="4" fill="#1a1a2e"/>
        <circle cx="44" cy="75" r="1.5" fill="white"/>
        <rect x="65" y="168" width="24" height="22" rx="10" fill="#8E8E8E"/>
        <rect x="100" y="168" width="24" height="22" rx="10" fill="#8E8E8E"/>
        <rect x="140" y="168" width="24" height="22" rx="10" fill="#8E8E8E"/>
        <rect x="172" y="165" width="24" height="22" rx="10" fill="#8E8E8E"/>
        <path d="M192 130 Q210 120 205 145" stroke="#8E8E8E" strokeWidth="4" fill="none" strokeLinecap="round"/>
        <circle cx="205" cy="147" r="5" fill="#757575"/>
      </svg>
    ),
    hippo:(
      <svg width={W} height={H} viewBox="0 0 220 165" fill="none">
        <ellipse cx="130" cy="110" rx="80" ry="52" fill="#78909C"/>
        <ellipse cx="42" cy="95" rx="46" ry="38" fill="#78909C"/>
        <ellipse cx="28" cy="72" rx="10" ry="7" fill="#607D8B"/>
        <circle cx="24" cy="72" r="3" fill="#455A64"/>
        <circle cx="32" cy="72" r="3" fill="#455A64"/>
        <circle cx="30" cy="83" r="8" fill="white"/>
        <circle cx="31" cy="84" r="4.5" fill="#78909C"/>
        <circle cx="32" cy="83" r="2" fill="#1a1a2e"/>
        <circle cx="60" cy="79" r="8" fill="white"/>
        <circle cx="61" cy="80" r="4.5" fill="#78909C"/>
        <circle cx="62" cy="79" r="2" fill="#1a1a2e"/>
        <ellipse cx="18" cy="68" rx="9" ry="7" fill="#607D8B"/>
        <ellipse cx="68" cy="65" rx="9" ry="7" fill="#607D8B"/>
        <ellipse cx="30" cy="110" rx="28" ry="18" fill="#607D8B"/>
        <rect x="68" y="150" width="22" height="16" rx="8" fill="#607D8B"/>
        <rect x="102" y="150" width="22" height="16" rx="8" fill="#607D8B"/>
        <rect x="148" y="150" width="22" height="16" rx="8" fill="#607D8B"/>
        <rect x="183" y="148" width="22" height="16" rx="8" fill="#607D8B"/>
        <path d="M208 110 Q222 105 218 120" stroke="#607D8B" strokeWidth="4" strokeLinecap="round" fill="none"/>
      </svg>
    ),
    bear:(
      <svg width={W} height={H} viewBox="0 0 165 185" fill="none">
        <ellipse cx="82" cy="130" rx="58" ry="52" fill="#ECEFF1"/>
        <ellipse cx="82" cy="140" rx="32" ry="28" fill="#CFD8DC"/>
        <circle cx="82" cy="65" r="45" fill="#ECEFF1"/>
        <circle cx="45" cy="30" r="16" fill="#CFD8DC"/>
        <circle cx="45" cy="30" r="10" fill="#FFCDD2" opacity="0.45"/>
        <circle cx="119" cy="30" r="16" fill="#CFD8DC"/>
        <circle cx="119" cy="30" r="10" fill="#FFCDD2" opacity="0.45"/>
        <circle cx="65" cy="60" r="9" fill="white"/>
        <circle cx="66" cy="61" r="5.5" fill="#1a1a2e"/>
        <circle cx="67" cy="59" r="2" fill="white"/>
        <circle cx="99" cy="60" r="9" fill="white"/>
        <circle cx="100" cy="61" r="5.5" fill="#1a1a2e"/>
        <circle cx="101" cy="59" r="2" fill="white"/>
        <ellipse cx="82" cy="76" rx="12" ry="9" fill="#90A4AE"/>
        <path d="M76 82 Q82 88 88 82" stroke="#607D8B" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        <ellipse cx="28" cy="130" rx="18" ry="30" fill="#ECEFF1" transform="rotate(-15 28 130)"/>
        <ellipse cx="136" cy="130" rx="18" ry="30" fill="#ECEFF1" transform="rotate(15 136 130)"/>
        <ellipse cx="58" cy="175" rx="20" ry="12" fill="#CFD8DC"/>
        <ellipse cx="106" cy="175" rx="20" ry="12" fill="#CFD8DC"/>
        <ellipse cx="22" cy="154" rx="14" ry="10" fill="#CFD8DC"/>
        <ellipse cx="142" cy="154" rx="14" ry="10" fill="#CFD8DC"/>
      </svg>
    ),
  };
  return(
    <div style={{opacity,pointerEvents:"none",userSelect:"none",display:"inline-block"}}>
      {animals[type]||null}
    </div>
  );
};

// ─── STUDENT APP ──────────────────────────────────────────────────────────────
// ─── ACTIVITY FEEDBACK CHAT ───────────────────────────────────────────────────
const ActivityFeedbackChat=({act,existingSub,student,typeColor,db,setState})=>{
  const [chatMsg,setChatMsg]=useState("");
  const [sending,setSending]=useState(false);
  const chat=existingSub.chat||[];

  const sendMsg=async()=>{
    if(!chatMsg.trim())return;
    setSending(true);
    const msg={id:Date.now(),from:"student",name:student?.name||"Alumno",
      text:chatMsg.trim(),date:new Date().toISOString().slice(0,10),time:new Date().toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"})};
    const newChat=[...chat,msg];
    const newSubs=(act.submissions||[]).map(s=>
      String(s.studentId)===String(student?.id)?{...s,chat:newChat}:s
    );
    setState(prev=>({...prev,approvedContent:prev.approvedContent.map(c=>String(c.id)===String(act.id)?{...c,submissions:newSubs}:c)}));
    setChatMsg("");
    if(act.id&&typeof act.id==="string"){
      try{const {updateDoc:u,doc:d}=await import("firebase/firestore");await u(d(db,"approvedContent",act.id),{submissions:newSubs});}catch(e){}
    }
    setSending(false);
  };

  return(
    <Card style={{padding:0,marginBottom:12,overflow:"hidden"}}>
      <div style={{background:`${typeColor}10`,padding:"10px 14px",borderBottom:`0.5px solid ${typeColor}20`,display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:16}}>💬</span>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:700,color:C.lbl,fontFamily:SF}}>Retroalimentación del Maestro</div>
          {existingSub.teacherGrade!=null&&(
            <div style={{fontSize:11,color:C.lbl2,fontFamily:SF}}>
              Calificación: <span style={{fontWeight:800,color:existingSub.teacherGrade>=7?C.green:C.orange,fontSize:13}}>{existingSub.teacherGrade}/10</span>
            </div>
          )}
        </div>
        {existingSub.teacherFeedbackDate&&<span style={{fontSize:10,color:C.lbl3,fontFamily:SF}}>{existingSub.teacherFeedbackDate}</span>}
      </div>
      {existingSub.teacherFeedback&&(
        <div style={{padding:"10px 14px",background:`${C.blue}05`,borderBottom:`0.5px solid ${C.sep}`}}>
          <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
            <div style={{width:28,height:28,borderRadius:"50%",background:C.blue,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0,color:"#fff"}}>M</div>
            <div style={{flex:1,background:`${C.blue}10`,borderRadius:"0 10px 10px 10px",padding:"8px 12px"}}>
              <div style={{fontSize:11,fontWeight:700,color:C.blue,fontFamily:SF,marginBottom:3}}>Maestro</div>
              <div style={{fontSize:13,color:C.lbl,fontFamily:SF,lineHeight:1.5,whiteSpace:"pre-wrap"}}>{existingSub.teacherFeedback}</div>
            </div>
          </div>
        </div>
      )}
      {/* Chat messages */}
      {chat.length>0&&(
        <div style={{padding:"8px 14px",display:"flex",flexDirection:"column",gap:8,maxHeight:200,overflowY:"auto"}}>
          {chat.map(msg=>{
            const isMe=msg.from==="student";
            return(
              <div key={msg.id} style={{display:"flex",gap:7,alignItems:"flex-end",flexDirection:isMe?"row-reverse":"row"}}>
                <div style={{width:26,height:26,borderRadius:"50%",background:isMe?typeColor:C.blue,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#fff",flexShrink:0,fontWeight:700}}>
                  {isMe?student?.avatar?.slice(0,1)||"A":"M"}
                </div>
                <div style={{maxWidth:"72%",background:isMe?`${typeColor}15`:`${C.blue}10`,borderRadius:isMe?"10px 0 10px 10px":"0 10px 10px 10px",padding:"7px 10px"}}>
                  <div style={{fontSize:13,color:C.lbl,fontFamily:SF,lineHeight:1.45}}>{msg.text}</div>
                  <div style={{fontSize:9,color:C.lbl3,fontFamily:SF,marginTop:2,textAlign:isMe?"right":"left"}}>{msg.time}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* Input */}
      <div style={{padding:"8px 10px",borderTop:`0.5px solid ${C.sep}`,display:"flex",gap:7,alignItems:"center"}}>
        <input value={chatMsg} onChange={e=>setChatMsg(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMsg();}}}
          placeholder="Escribe tu duda al maestro…"
          style={{flex:1,background:C.fill4,border:`1px solid ${C.g5}`,borderRadius:20,padding:"8px 14px",fontSize:13,color:C.lbl,fontFamily:SF,outline:"none"}}/>
        <button onClick={sendMsg} disabled={!chatMsg.trim()||sending}
          style={{width:34,height:34,borderRadius:"50%",background:chatMsg.trim()?`${typeColor}`:"transparent",
            border:`1.5px solid ${chatMsg.trim()?typeColor:C.g5}`,cursor:chatMsg.trim()?"pointer":"default",
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,transition:"all 0.15s"}}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M12.5 1.5L7 7M12.5 1.5L8.5 12.5L7 7M12.5 1.5L1.5 5.5L7 7" stroke={chatMsg.trim()?"#fff":C.g3} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </Card>
  );
};

const StudentApp=({state,setState,studentId,onLogout})=>{
  const [tab,setTab]=useState(()=>localStorage.getItem("stu_tab")||"feed");
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const [themeKey,setThemeKey]=useState(()=>{ try{return localStorage.getItem(`lms_theme_${studentId}`)||"default";}catch{return "default";} });
  const [selectedSubject,setSelectedSubject]=useState(null);
  const [subjTab,setSubjTab]=useState("tablon"); // must be top-level (React rules of hooks)
  // Reset sub-tab when subject changes
  const prevSubjectRef=useRef(null);
  useEffect(()=>{ if(selectedSubject!==prevSubjectRef.current){ setSubjTab("tablon"); prevSubjectRef.current=selectedSubject; } },[selectedSubject]);
  const [profilePic,setProfilePic]=useState(()=>{
    try{return localStorage.getItem(`lms_pic_${studentId}`)||null;}catch{return null;}
  });
  // Sync profilePic from Firestore student record if not in localStorage
  const student_raw=state.students.find(s=>s.id===studentId)||state.students[0];
  useEffect(()=>{
    if(!profilePic&&student_raw?.photo){
      setProfilePic(student_raw.photo);
      try{localStorage.setItem(`lms_pic_${studentId}`,student_raw.photo);}catch{}
    }
  },[student_raw?.photo]);
  const [shopSubject,setShopSubject]=useState(null);
  const [shopFrom,setShopFrom]=useState("subject"); // "subject" | "medals"
  const [ownedOutfits,setOwnedOutfits]=useState(()=>{
    try{return JSON.parse(localStorage.getItem(`lms_outfits_${studentId}`)||"{}");}catch{return {};}
  });
  const [equippedOutfit,setEquippedOutfit]=useState(()=>{
    try{return JSON.parse(localStorage.getItem(`lms_equipped_${studentId}`)||"{}");}catch{return {};}
  });
  const [tokens,setTokens]=useState(()=>{
    try{const v=localStorage.getItem(`lms_tokens_${studentId}`);return v!==null?Number(v):null;}catch{return null;}
  });
  const [completedTasks,setCompletedTasks]=useState(()=>{
    try{return JSON.parse(localStorage.getItem(`lms_tasks_${studentId}`)||"{}");}catch{return {};}
  });

  // Persist state to localStorage on change
  useEffect(()=>{
    if(profilePic){
      localStorage.setItem(`lms_pic_${studentId}`,profilePic);
      // Also save to Firestore student document
      if(student?.id && typeof student.id==="string"){
        updateDoc(doc(db,"students",student.id),{photo:profilePic}).catch(()=>{});
      }
    }
  },[profilePic,studentId]);
  useEffect(()=>{ localStorage.setItem(`lms_theme_${studentId}`,themeKey); },[themeKey,studentId]);
  useEffect(()=>{localStorage.setItem(`lms_outfits_${studentId}`,JSON.stringify(ownedOutfits));},[ownedOutfits,studentId]);
  useEffect(()=>{localStorage.setItem(`lms_equipped_${studentId}`,JSON.stringify(equippedOutfit));},[equippedOutfit,studentId]);
  useEffect(()=>{if(tokens!==null)localStorage.setItem(`lms_tokens_${studentId}`,String(tokens));},[tokens,studentId]);
  useEffect(()=>{localStorage.setItem(`lms_tasks_${studentId}`,JSON.stringify(completedTasks));},[completedTasks,studentId]);
  const [newsOpen,setNewsOpen]=useState(false);
  const bellDragStu=useDraggableBell(`lms_bell_pos_stu_${studentId}`);
  const [selectedNewsId,setSelectedNewsId]=useState(null);
  const [stuBellReadIds,setStuBellReadIds]=useState(()=>{ try{return JSON.parse(localStorage.getItem(`lms_bell_stu_${studentId}`)||"[]");}catch{return[];} });
  const [selectedActivity,setSelectedActivity]=useState(null);
  const [submissionText,setSubmissionText]=useState("");
  const [submissionFiles,setSubmissionFiles]=useState([]);
  const [submissionLink,setSubmissionLink]=useState("");
  const [quizAnswers,setQuizAnswers]=useState({}); // {qIdx: answerIdx}
  const [quizSubmitted,setQuizSubmitted]=useState(false);
  const subFileRef=useRef();
  const subImgRef=useRef();
  const fileRef=useRef();

  const THEMES={
    default:{accent:C.blue,name:"Azul",bg:C.bg2},
    pink:{accent:C.pink,name:"Rosa",bg:"#FFF0F5"},
    purple:{accent:C.purple,name:"Morado",bg:"#F5F0FF"},
    green:{accent:C.green,name:"Verde",bg:"#F0FFF4"},
    orange:{accent:C.orange,name:"Naranja",bg:"#FFF8F0"},
  };
  const T=THEMES[themeKey];

  const student=state.students.find(s=>s.id===studentId)||state.students[0];
  const myGroup=student?.group;
  const myGroupData=state.groups.find(g=>g.name===myGroup);
  // Derive subjects from group assignment; fall back to student.subjects keys
  const groupSubjectNames=(myGroupData?.subjects||[]).map(s=>s.subject);
  const mySubjects=groupSubjectNames.length>0
    ? groupSubjectNames
    : Object.keys(student?.subjects||{"Matemáticas":{},"Ciencias":{},"Historia":{},"Español":{}});
  const subjectData=student?.subjects||{"Matemáticas":{grade:7.8,tasks:[]},"Ciencias":{grade:8.5,tasks:[]},"Historia":{grade:9.1,tasks:[]},"Español":{grade:8.2,tasks:[]}};
  const myContent=[...state.approvedContent,...state.pendingContent].filter(c=>{
    if(!myGroupData&&!myGroup) return false;
    // Match by Firebase group ID (primary)
    if(myGroupData?.id && c.groupId && String(c.groupId)===String(myGroupData.id)) return true;
    // Fallback: match by group name string
    if(myGroup && c.groupName && c.groupName===myGroup) return true;
    return false;
  });
  // Map subjectName → animal id (set by developer in group panel)
  const subjectMascotMap=(myGroupData?.subjects||[]).reduce((acc,s)=>{
    if(s.mascot)acc[s.subject]=s.mascot; return acc;
  },{});

  const currentTokens=tokens!==null?tokens:(student?.participation||0);

  // Mascot size grows with completed tasks
  const getMascotProgress=(subject)=>{
    const base=Math.round(((subjectData[subject]?.grade||7)/10)*100);
    const extra=(completedTasks[subject]||0)*5;
    return Math.min(base+extra,100);
  };

  // Derive parciales from student Firebase fields (set by teacher publish)
  const numParciales=state.numParciales||3;
  const ordinalLabel=(n)=>["1er","2do","3er","4to","5to"][n-1]||`${n}°`;
  const getStudentParciales=(subj)=>{
    const result=[];
    for(let p=1;p<=numParciales;p++){
      const key=`parcial_${p}_${subj}`;
      const g=student?.[key];
      result.push({p:`${ordinalLabel(p)} Parcial`,g:g!=null?Number(g):null});
    }
    return result;
  };

  // Build news items — emergency notices (accident) only show for the involved student
  const myEmergencyAvisos=(state.avisos||[]).filter(a=>
    a.type==="accident" && (
      a.studentId===student?.id ||
      a.title?.includes(student?.name?.split(" ")[0]) ||
      a.body?.includes(student?.name)
    )
  );
  const newsItems=[
    ...myEmergencyAvisos.map(a=>({
      id:`av${a.id}`,type:"urgente",title:a.title,body:a.body,color:C.red,icon:"🚨",badge:"URGENTE",time:a.time})),
    // Parcial grade notifications (any parcial field set on this student)
    ...(()=>{
      const items=[];
      for(let p=1;p<=numParciales;p++){
        mySubjects.forEach(subj=>{
          const key=`parcial_${p}_${subj}`;
          if(student?.[key]!=null){
            items.push({id:`gr_${p}_${subj}`,type:"calificacion",title:`Calificación ${ordinalLabel(p)} Parcial — ${subj}`,
              body:`Tu calificación es ${Number(student[key]).toFixed(1)}`,color:C.green,icon:"📊",badge:"Calificación",time:"Reciente"});
          }
        });
      }
      return items;
    })(),
    ...myContent.filter(c=>c.type==="examen").map(c=>({
      id:`ex${c.id}`,type:"examen",title:c.title,body:`Examen programado para el ${c.date||"—"}`,color:C.orange,icon:"📋",badge:"Examen",time:c.date})),
    ...myContent.filter(c=>c.type==="tarea").map(c=>({
      id:`tk${c.id}`,type:"tarea",title:c.title,body:`Entrega: ${c.date||"—"}`,color:C.blue,icon:"📝",badge:"Tarea",time:c.date})),
    ...myContent.filter(c=>c.type==="actividad").map(c=>({
      id:`ac${c.id}`,type:"actividad",title:c.title,body:`Actividad: ${c.date||"—"}`,color:C.purple,icon:"⚡",badge:"Actividad",time:c.date})),
    ...myContent.filter(c=>c.type==="cuestionario").map(c=>({
      id:`cu${c.id}`,type:"cuestionario",title:c.title,body:`Cuestionario: ${c.date||"—"}`,color:C.teal,icon:"❓",badge:"Cuestionario",time:c.date})),
    ...state.posts.filter(p=>p.type==="notice"||p.type==="event").slice(0,2).map(p=>({
      id:`p${p.id}`,type:p.type,title:p.title,body:p.body,color:p.type==="event"?C.teal:C.indigo,icon:p.type==="event"?"📅":"📢",badge:p.type==="event"?"Evento":"Aviso",time:p.time})),
    // General avisos from state — only for this group or global ones
    ...(state.avisos||[]).filter(a=>{
      if(a.type==="accident") return false;
      if(!a.groupId && !a.groupName) return true; // global aviso
      if(myGroupData?.id && a.groupId && String(a.groupId)===String(myGroupData.id)) return true;
      if(myGroup && a.groupName && a.groupName===myGroup) return true;
      return false;
    }).map(a=>({
      id:`sav${a.id}`,type:"aviso",title:a.title||"Aviso",body:a.body||"",color:C.indigo,icon:"📣",badge:"Aviso",time:a.time||"Reciente"})),
  ];
  const urgentCount=newsItems.filter(n=>n.type==="urgente").length;

  const totalChatUnreadStu=(state.chats||[]).filter(c=>(c.participants||[]).includes(`s${studentId}`)).reduce((a,c)=>a+(c.unread?.[`s${studentId}`]||0),0);

  const tabs=[
    {id:"feed",label:"Tablón",icon:"📋"},
    {id:"subjects",label:"Materias",icon:"📚"},
    {id:"chat",label:"Mensajes",icon:"💬"},
    {id:"medals",label:"Logros",icon:"🏆"},
    {id:"settings",label:"Ajustes",icon:"⚙️"},
  ];

  // ── News Panel ─────────────────────────────────────────────────────────────
  const stuUnreadBellCount=newsItems.filter(n=>!stuBellReadIds.includes(n.id)).length;
  const markAllStuBellRead=()=>{ const ids=newsItems.map(n=>n.id); setStuBellReadIds(ids); localStorage.setItem(`lms_bell_stu_${studentId}`,JSON.stringify(ids)); };
  const markOneStuBellRead=(id)=>{ if(!stuBellReadIds.includes(id)){ const ids=[...stuBellReadIds,id]; setStuBellReadIds(ids); localStorage.setItem(`lms_bell_stu_${studentId}`,JSON.stringify(ids)); } };

  const NewsPanel=()=>(
    <div style={{position:"fixed",inset:0,zIndex:700,display:"flex",alignItems:"flex-start",justifyContent:"flex-end",paddingTop:52}}>
      <div onClick={()=>setNewsOpen(false)} style={{position:"absolute",inset:0}}/>
      <div style={{position:"relative",width:310,maxHeight:"80vh",background:"#fff",
        borderRadius:20,boxShadow:"0 12px 48px rgba(0,0,0,0.22)",border:`1px solid ${C.g5}`,
        overflow:"hidden",margin:"0 12px",animation:"fadeUp 0.22s ease"}}>
        <div style={{background:`linear-gradient(135deg,${T.accent},${T.accent}cc)`,padding:"14px 16px",
          display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:"#fff",fontFamily:SF}}>📣 Noticias y Avisos</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.75)",fontFamily:SF,marginTop:1}}>
              {stuUnreadBellCount} nueva{stuUnreadBellCount!==1?"s":""}{urgentCount>0&&` · ${urgentCount} urgente${urgentCount>1?"s":""}`}
            </div>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            {stuUnreadBellCount>0&&<button onClick={(e)=>{e.stopPropagation();markAllStuBellRead();}} style={{background:"rgba(255,255,255,0.25)",border:"none",borderRadius:8,padding:"3px 8px",cursor:"pointer",color:"#fff",fontSize:11,fontWeight:600,fontFamily:SF}}>Leer todas</button>}
            <button onClick={()=>setNewsOpen(false)} style={{background:"rgba(255,255,255,0.2)",border:"none",
              borderRadius:"50%",width:26,height:26,cursor:"pointer",color:"#fff",fontSize:13,
              display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
          </div>
        </div>
        <div style={{overflowY:"auto",maxHeight:"calc(80vh - 64px)"}}>
          {(()=>{const visibleStu=newsItems.filter(n=>!stuBellReadIds.includes(n.id));return(<>
          {visibleStu.length===0&&(
            <div style={{padding:"32px 16px",textAlign:"center",color:C.lbl2,fontSize:14,fontFamily:SF}}>
              ¡Todo al día! 🎉
            </div>
          )}
          {visibleStu.map((n,i)=>{
            const isUrgent=n.type==="urgente";
            const expanded=selectedNewsId===n.id;
            const navTarget=n.type==="tarea"||n.type==="examen"||n.type==="actividad"||n.type==="cuestionario"?"subjects":"feed";
            return(
              <div key={n.id}>
                <div onClick={()=>{markOneStuBellRead(n.id);setSelectedNewsId(expanded?null:n.id);}}
                  style={{padding:"12px 14px",cursor:"pointer",borderLeft:`4px solid ${n.color}`,
                    background:`${n.color}08`,transition:"background 0.15s"}}>
                  <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                    <span style={{fontSize:20,flexShrink:0,marginTop:1}}>{n.icon}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:9,fontWeight:800,color:n.color,fontFamily:SF,marginBottom:2}}>● NUEVO</div>
                      {isUrgent&&(
                        <div style={{fontSize:9,fontWeight:800,color:C.red,letterSpacing:"0.08em",
                          background:`${C.red}15`,borderRadius:4,padding:"1px 6px",
                          display:"inline-block",marginBottom:3,fontFamily:SF}}>🚨 URGENTE</div>
                      )}
                      <div style={{fontSize:13,fontWeight:700,color:C.lbl,fontFamily:SF,lineHeight:1.3,
                        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:expanded?"normal":"nowrap"}}>
                        {n.title}
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginTop:3}}>
                        <span style={{fontSize:10,fontWeight:600,color:n.color,background:`${n.color}15`,
                          borderRadius:4,padding:"1px 6px",fontFamily:SF}}>{n.badge}</span>
                        <span style={{fontSize:10,color:C.lbl3,fontFamily:SF}}>{n.time}</span>
                      </div>
                      {expanded&&(
                        <>
                          <div style={{fontSize:12,color:C.lbl2,fontFamily:SF,lineHeight:1.55,marginTop:6,
                            padding:"8px 10px",background:C.fill4,borderRadius:8}}>{n.body}</div>
                          <button onClick={(e)=>{e.stopPropagation();setNewsOpen(false);setTab(navTarget);}}
                            style={{marginTop:6,background:n.color,border:"none",borderRadius:8,padding:"4px 10px",cursor:"pointer",color:"#fff",fontSize:11,fontWeight:600,fontFamily:SF}}>
                            Ver →
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {i<visibleStu.length-1&&<div style={{height:"0.5px",background:C.sep,marginLeft:48}}/>}
              </div>
            );
          })}
          </>);})()}
        </div>
      </div>
    </div>
  );

  // ── News Bell Button ───────────────────────────────────────────────────────
  const NewsBell=()=>{
    const defaultStyle={position:"fixed",top:58,right:14,zIndex:650,touchAction:"none"};
    const dragStyle=bellDragStu.isMobile&&bellDragStu.style?.left!=null?{...bellDragStu.style,zIndex:650,touchAction:"none"}:defaultStyle;
    return(
    <div
      style={dragStyle}
      onTouchStart={bellDragStu.onTouchStart}
      onTouchMove={bellDragStu.onTouchMove}
      onTouchEnd={bellDragStu.onTouchEnd}
    >
      <button onClick={()=>setNewsOpen(o=>!o)}
        style={{width:38,height:38,borderRadius:"50%",
          background:newsOpen?"#fff":`linear-gradient(135deg,${T.accent},${T.accent}bb)`,
          border:newsOpen?`1.5px solid ${T.accent}`:"none",
          cursor:"pointer",boxShadow:"0 3px 14px rgba(0,0,0,0.18)",
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,
          transition:"all 0.2s",position:"relative"}}>
        <span style={{color:newsOpen?T.accent:"#fff"}}>🔔</span>
        {stuUnreadBellCount>0&&(
          <span style={{position:"absolute",top:-4,right:-4,background:urgentCount>0?C.red:T.accent,
            color:"#fff",fontSize:9,fontWeight:800,borderRadius:"50%",
            minWidth:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",
            fontFamily:SF,border:"2px solid #fff",padding:"0 3px",lineHeight:1}}>
            {stuUnreadBellCount}
          </span>
        )}
      </button>
    </div>
    );
  };

  // ── Shop View ──────────────────────────────────────────────────────────────
  if(shopSubject){
    const shopItems=getShopItems(shopSubject)||[];
    const m=resolveMascot(subjectMascotMap[shopSubject]||null,shopSubject);
    const owned=ownedOutfits[shopSubject]||[];
    const equipped=equippedOutfit[shopSubject];
    const equippedItem=shopItems.find(i=>i.id===equipped);
    const handleBack=()=>{
      setShopSubject(null);
      if(shopFrom==="medals"){ setTab("medals"); }
      // if shopFrom==="subject", selectedSubject is still set → subject detail renders naturally
    };
    return(
      <div style={{background:T.bg,minHeight:"100vh",fontFamily:SF}}>
        <NavBar title={`Tienda — ${m.name}`} back={shopFrom==="medals"?"← Logros":"← Materia"} onBack={handleBack} accent={m.color}/>
        <div style={{padding:"0 16px 100px"}}>
          {/* Mascot preview card */}
          <div style={{background:`linear-gradient(160deg,${m.color}22,${m.color}08)`,
            padding:"24px 20px",marginBottom:16,textAlign:"center",borderRadius:"0 0 24px 24px"}}>
            <div style={{display:"inline-block",marginBottom:12,
              filter:`drop-shadow(0 6px 16px ${m.color}40)`,
              animation:"mascotBob 2s ease-in-out infinite"}}>
              <MascotSVG subject={shopSubject} animal={subjectMascotMap[shopSubject]||null} outfit={equipped} size={100}/>
            </div>
            <div style={{...fmt.title3,color:m.color,fontFamily:SFD,marginBottom:4}}>{m.name}</div>
            <div style={{...fmt.caption,color:C.lbl2,fontFamily:SF,marginBottom:12}}>
              Nv.{Math.floor(getMascotProgress(shopSubject)/20)+1} · {equippedItem?`Equipado: ${equippedItem.name}`:"Sin accesorio"}
            </div>
            <div style={{display:"inline-flex",alignItems:"center",gap:6,
              background:`${C.yellow}25`,borderRadius:20,padding:"8px 18px",
              border:`1px solid ${C.yellow}50`}}>
              <span style={{fontSize:18}}>🪙</span>
              <span style={{fontWeight:800,color:"#9A7108",fontSize:17,fontFamily:SF}}>{currentTokens} tokens</span>
            </div>
          </div>

          <Sec title="Accesorios disponibles" footer="Gana tokens completando tareas y participando en clase.">
            {shopItems.map((item,i,arr)=>{
              const isOwned=owned.includes(item.id);
              const isEquipped=equipped===item.id;
              const canAfford=currentTokens>=item.cost;
              return(
                <div key={item.id}>
                  <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",
                    background:isEquipped?`${m.color}06`:"transparent"}}>
                    <div style={{width:62,height:62,borderRadius:16,
                      background:isOwned?`${m.color}18`:C.fill4,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      border:isEquipped?`2.5px solid ${m.color}`:`1px solid ${isOwned?m.color+"40":C.g5}`,
                      transition:"all 0.2s",overflow:"visible",flexShrink:0}}>
                      <MascotSVG subject={shopSubject} animal={subjectMascotMap[shopSubject]||null} outfit={item.id} size={54}/>
                    </div>
                    <div style={{flex:1}}>
                      <div style={{...fmt.callout,fontWeight:600,color:C.lbl,fontFamily:SF}}>{item.name}</div>
                      <div style={{...fmt.caption,color:C.lbl2,fontFamily:SF,marginTop:1}}>{item.desc}</div>
                      <div style={{display:"flex",alignItems:"center",gap:4,marginTop:4}}>
                        <span style={{fontSize:13}}>🪙</span>
                        <span style={{fontWeight:700,color:canAfford||isOwned?"#9A7108":C.g2,fontSize:13,fontFamily:SF}}>{item.cost} tokens</span>
                        {isEquipped&&<span style={{fontSize:11,fontWeight:700,color:m.color,background:`${m.color}15`,borderRadius:4,padding:"1px 6px",fontFamily:SF}}>Puesto</span>}
                      </div>
                    </div>
                    {isOwned?(
                      <button onClick={()=>setEquippedOutfit(e=>({...e,[shopSubject]:isEquipped?null:item.id}))}
                        style={{background:isEquipped?m.color:C.fill3,color:isEquipped?"#fff":C.lbl,
                          border:"none",borderRadius:12,padding:"8px 16px",fontSize:14,fontWeight:600,
                          cursor:"pointer",fontFamily:SF,transition:"all 0.15s",minWidth:80}}>
                        {isEquipped?"Quitar":"Equipar"}
                      </button>
                    ):(
                      <button
                        onClick={()=>{
                          if(!canAfford)return;
                          setTokens(currentTokens-item.cost);
                          setOwnedOutfits(o=>({...o,[shopSubject]:[...(o[shopSubject]||[]),item.id]}));
                          setEquippedOutfit(e=>({...e,[shopSubject]:item.id}));
                        }}
                        disabled={!canAfford}
                        style={{background:canAfford?`linear-gradient(135deg,${m.color},${m.color}cc)`:C.fill3,
                          color:canAfford?"#fff":C.g2,border:"none",borderRadius:12,
                          padding:"8px 16px",fontSize:14,fontWeight:600,cursor:canAfford?"pointer":"not-allowed",
                          fontFamily:SF,opacity:canAfford?1:0.55,minWidth:80,transition:"all 0.15s"}}>
                        Comprar
                      </button>
                    )}
                  </div>
                  {i<arr.length-1&&<Div indent={82}/>}
                </div>
              );
            })}
          </Sec>
        </div>
        <TabBar tabs={tabs} active={shopFrom==="medals"?"medals":"subjects"} onChange={id=>{setShopSubject(null);setSelectedSubject(null);setTab(id);}} accent={T.accent}/>
      </div>
    );
  }

  // ── Subject Detail ─────────────────────────────────────────────────────────
  // ── Student Activity Detail ────────────────────────────────────────────────
  if(selectedActivity){
    // Always derive from live state so student chat messages appear instantly
    const act=[...state.approvedContent,...state.pendingContent].find(c=>String(c.id)===String(selectedActivity.id))||selectedActivity;
    const m=resolveMascot(subjectMascotMap[act.subject]||null,act.subject||"");
    const typeColor={tarea:C.blue,examen:C.orange,actividad:C.purple,cuestionario:C.teal}[act.type]||T.accent;
    const typeLabel={tarea:"Tarea",examen:"Examen",actividad:"Actividad",cuestionario:"Cuestionario"}[act.type]||act.type;
    const typeIcon={tarea:"📝",examen:"📋",actividad:"⚡",cuestionario:"❓"}[act.type]||"📌";
    const existingSub=(act.submissions||[]).find(x=>String(x.studentId)===String(student?.id));
    const isQuiz=act.type==="cuestionario"||act.type==="examen";
    const hasQuiz=(act.quiz||[]).length>0;
    const allAnswered=hasQuiz&&(act.quiz||[]).every((_,i)=>quizAnswers[i]!==undefined);

    const saveSubmissionToFirestore = async (actId, newSub, allSubs) => {
      try {
        // Find the Firestore doc id for this activity
        const snap = await import("firebase/firestore").then(({collection:col,query,where,getDocs,updateDoc:upd,doc:fdoc})=>
          getDocs(query(col(db,"approvedContent"),where("__name__",">=",""),)).catch(()=>null)
        );
        // Simpler: updateDoc directly if id is a string (Firestore id)
        if (actId && typeof actId === "string") {
          const {updateDoc:upd, doc:fdoc} = await import("firebase/firestore");
          await upd(fdoc(db,"approvedContent",actId), {submissions: allSubs}).catch(()=>{});
        }
      } catch(e) {}
    };

    const submitTarea=async()=>{
      if(!submissionText.trim()&&submissionFiles.length===0&&!submissionLink.trim()) return;
      const sub={studentId:student?.id,studentName:student?.name,date:new Date().toISOString().slice(0,10),
        text:submissionText,files:[...submissionFiles],link:submissionLink.trim()||null};
      const prevSubs=(act.submissions||[]).filter(x=>String(x.studentId)!==String(student?.id));
      const newSubs=[...prevSubs,sub];
      const actId=String(act.id);
      // Determine which collection holds this activity
      const inApproved=state.approvedContent.some(c=>String(c.id)===actId);
      const colName=inApproved?"approvedContent":"pendingContent";
      // Update both local state collections so UI is always consistent
      setState(s=>({
        ...s,
        approvedContent:s.approvedContent.map(c=>String(c.id)===actId?{...c,submissions:newSubs}:c),
        pendingContent:s.pendingContent.map(c=>String(c.id)===actId?{...c,submissions:newSubs}:c),
      }));
      setSelectedActivity(prev=>({...(prev||act),submissions:newSubs}));
      setSubmissionText("");setSubmissionFiles([]);setSubmissionLink("");
      setTokens(p=>(p!==null?p:currentTokens)+2);
      pushNotification({title:"✅ Entregado",text:`"${act.title}" enviado +2🪙`});
      // Persist to Firestore (correct collection)
      if(act.id && typeof act.id==="string"){
        try{
          const {updateDoc:upd,doc:fdoc}=await import("firebase/firestore");
          await upd(fdoc(db,colName,act.id),{submissions:newSubs});
        }catch(e){}
      }
    };

    const submitQuiz=async()=>{
      if(!allAnswered) return;
      const correct=(act.quiz||[]).filter((q,i)=>quizAnswers[i]===q.correct).length;
      const score=Math.round((correct/(act.quiz||[]).length)*10*10)/10;
      const sub={studentId:student?.id,studentName:student?.name,date:new Date().toISOString().slice(0,10),
        answers:quizAnswers,correct,total:(act.quiz||[]).length,score};
      const prevSubs=(act.submissions||[]).filter(x=>String(x.studentId)!==String(student?.id));
      const newSubs=[...prevSubs,sub];
      const actId=String(act.id);
      const inApproved=state.approvedContent.some(c=>String(c.id)===actId);
      const colName=inApproved?"approvedContent":"pendingContent";
      setState(s=>({
        ...s,
        approvedContent:s.approvedContent.map(c=>String(c.id)===actId?{...c,submissions:newSubs}:c),
        pendingContent:s.pendingContent.map(c=>String(c.id)===actId?{...c,submissions:newSubs}:c),
      }));
      setSelectedActivity(prev=>({...(prev||act),submissions:newSubs}));
      setQuizSubmitted(true);
      setTokens(p=>(p!==null?p:currentTokens)+2);
      pushNotification({title:"✅ Enviado",text:`${correct}/${(act.quiz||[]).length} correctas · +2🪙`});
      if(act.id && typeof act.id==="string"){
        try{
          const {updateDoc:upd,doc:fdoc}=await import("firebase/firestore");
          await upd(fdoc(db,colName,act.id),{submissions:newSubs});
        }catch(e){}
      }
    };

    return(
      <div style={{background:T.bg,minHeight:"100vh",fontFamily:SF}}>
        <div style={{background:`linear-gradient(135deg,${typeColor},${typeColor}cc)`,padding:"14px 16px 18px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
            <button onClick={()=>{setSelectedActivity(null);setQuizAnswers({});setQuizSubmitted(false);setSubmissionText("");setSubmissionFiles([]);setSubmissionLink("");}}
              style={{background:"rgba(255,255,255,0.2)",border:"none",borderRadius:"50%",width:34,height:34,cursor:"pointer",color:"#fff",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>←</button>
            <div style={{flex:1}}>
              <div style={{fontSize:18,fontWeight:800,color:"#fff",fontFamily:SFD,letterSpacing:"-0.3px",lineHeight:1.2}}>{act.title}</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.8)",fontFamily:SF,marginTop:2}}>
                {typeIcon} {typeLabel}{act.subject?` · ${act.subject}`:""}{act.dueDate?` · Entrega: ${act.dueDate}`:""}
              </div>
            </div>
            <span style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.9)",background:"rgba(255,255,255,0.2)",borderRadius:8,padding:"4px 10px",fontFamily:SF}}>{act.points||10} pts</span>
          </div>
          {/* Status badge */}
          {existingSub&&<div style={{background:"rgba(255,255,255,0.95)",borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:16}}>✅</span>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:700,color:C.green,fontFamily:SF}}>Entregado{existingSub.date?` · ${existingSub.date}`:""}</div>
              {existingSub.teacherGrade!=null&&<div style={{fontSize:12,color:C.lbl,fontFamily:SF,fontWeight:600,marginTop:1}}>Calificación del maestro: <span style={{color:existingSub.teacherGrade>=7?C.green:C.orange,fontSize:15,fontWeight:800}}>{existingSub.teacherGrade}/10</span></div>}
              {!existingSub.teacherGrade&&existingSub.score!=null&&<div style={{fontSize:11,color:C.lbl2,fontFamily:SF}}>Puntaje automático: {existingSub.score}/10</div>}
            </div>
          </div>}
        </div>

        <div style={{padding:"16px 16px 100px"}}>
          {/* Description */}
          {act.content&&<Card style={{padding:14,marginBottom:12}}>
            <div style={{fontSize:13,color:C.lbl,fontFamily:SF,lineHeight:1.6}}>{act.content}</div>
          </Card>}
          {/* Attached images */}
          {act.images?.length>0&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
            {act.images.map(img=>(<img key={img.id} src={img.src} style={{width:"100%",maxHeight:200,borderRadius:12,objectFit:"cover",marginBottom:4}}/>))}
          </div>}
          {/* Attached files */}
          {act.files?.length>0&&<Card style={{padding:12,marginBottom:12}}>
            {act.files.map(f=>(<div key={f.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0"}}>
              <span style={{fontSize:22}}>📎</span>
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:C.lbl,fontFamily:SF}}>{f.name}</div><div style={{fontSize:11,color:C.lbl3,fontFamily:SF}}>{f.size}</div></div>
            </div>))}
          </Card>}
          {act.link&&<a href={act.link} target="_blank" rel="noreferrer"
            style={{display:"flex",alignItems:"center",gap:10,background:`${typeColor}10`,borderRadius:12,padding:"11px 14px",textDecoration:"none",marginBottom:12,border:`1px solid ${typeColor}25`}}>
            <span style={{fontSize:20}}>🔗</span>
            <div style={{flex:1,overflow:"hidden"}}><div style={{fontSize:13,fontWeight:600,color:typeColor,fontFamily:SF,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{act.link}</div></div>
            <span style={{fontSize:13,color:typeColor}}>↗</span>
          </a>}

          {/* ── QUIZ / EXAMEN ─────────────────────────────────── */}
          {isQuiz&&hasQuiz&&(
            <div>
              <div style={{fontSize:11,fontWeight:700,color:C.lbl3,textTransform:"uppercase",letterSpacing:"0.06em",fontFamily:SF,marginBottom:10}}>
                {typeIcon} {typeLabel} · {(act.quiz||[]).length} pregunta{(act.quiz||[]).length!==1?"s":""}
              </div>
              {existingSub&&quizSubmitted||existingSub?(
                /* Results view */
                <Card style={{padding:16,marginBottom:12}}>
                  <div style={{textAlign:"center",marginBottom:16}}>
                    <div style={{fontSize:40,marginBottom:6}}>
                      {existingSub.score>=9?"🏆":existingSub.score>=7?"⭐":existingSub.score>=6?"👍":"📚"}
                    </div>
                    <div style={{fontSize:28,fontWeight:900,color:existingSub.score>=7?C.green:C.orange,fontFamily:SFD}}>
                      {existingSub.correct}/{existingSub.total}
                    </div>
                    <div style={{fontSize:13,color:C.lbl2,fontFamily:SF}}>correctas · {existingSub.score?.toFixed(1)||"—"}/10</div>
                  </div>
                  {(act.quiz||[]).map((q,i)=>{
                    const chosen=existingSub.answers?.[i];
                    const correct=q.correct;
                    const isRight=chosen===correct;
                    return(
                      <div key={i} style={{marginBottom:12,padding:"10px 12px",borderRadius:10,background:isRight?`${C.green}08`:`${C.red}08`,border:`1px solid ${isRight?C.green:C.red}20`}}>
                        <div style={{fontSize:13,fontWeight:700,color:C.lbl,fontFamily:SF,marginBottom:8}}>{i+1}. {q.q}</div>
                        {(q.a||[]).map((opt,j)=>(
                          <div key={j} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 8px",borderRadius:7,marginBottom:3,
                            background:j===correct?`${C.green}15`:j===chosen&&!isRight?`${C.red}15`:"transparent"}}>
                            <span style={{fontSize:13}}>{j===correct?"✅":j===chosen&&!isRight?"❌":"○"}</span>
                            <span style={{fontSize:13,color:C.lbl,fontFamily:SF}}>{opt}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </Card>
              ):(
                /* Answer view */
                <>
                  {(act.quiz||[]).map((q,i)=>(
                    <Card key={i} style={{padding:14,marginBottom:10}}>
                      <div style={{fontSize:14,fontWeight:700,color:C.lbl,fontFamily:SF,marginBottom:12}}>
                        <span style={{fontSize:12,fontWeight:600,color:typeColor,background:`${typeColor}15`,borderRadius:6,padding:"2px 7px",marginRight:8,fontFamily:SF}}>{i+1}</span>
                        {q.q}
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:7}}>
                        {(q.a||[]).map((opt,j)=>(
                          <button key={j} onClick={()=>setQuizAnswers(a=>({...a,[i]:j}))}
                            style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,border:`2px solid ${quizAnswers[i]===j?typeColor:C.g5}`,
                              background:quizAnswers[i]===j?`${typeColor}10`:"#fff",cursor:"pointer",textAlign:"left",transition:"all 0.15s"}}>
                            <div style={{width:22,height:22,borderRadius:"50%",border:`2px solid ${quizAnswers[i]===j?typeColor:C.g4}`,
                              background:quizAnswers[i]===j?typeColor:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                              {quizAnswers[i]===j&&<div style={{width:8,height:8,borderRadius:"50%",background:"#fff"}}/>}
                            </div>
                            <span style={{fontSize:13,color:C.lbl,fontFamily:SF,lineHeight:1.4}}>{opt}</span>
                          </button>
                        ))}
                      </div>
                    </Card>
                  ))}
                  <div style={{fontSize:11,color:C.lbl3,fontFamily:SF,textAlign:"center",marginBottom:10}}>
                    {Object.keys(quizAnswers).length}/{(act.quiz||[]).length} respondidas
                  </div>
                  <button onClick={submitQuiz} disabled={!allAnswered}
                    style={{width:"100%",background:allAnswered?`linear-gradient(135deg,${typeColor},${typeColor}cc)`:C.fill3,
                      color:allAnswered?"#fff":C.lbl3,border:"none",borderRadius:13,padding:"14px",
                      fontSize:15,fontWeight:700,cursor:allAnswered?"pointer":"not-allowed",fontFamily:SF,
                      boxShadow:allAnswered?`0 4px 16px ${typeColor}40`:"none",transition:"all 0.2s"}}>
                    {allAnswered?"✅ Enviar Respuestas":`Responde las ${(act.quiz||[]).length} preguntas para continuar`}
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── TAREA / ACTIVIDAD SUBMISSION ──────────────────── */}
          {!isQuiz&&(
            existingSub?(
              <Card style={{padding:14,marginBottom:12,background:`${C.green}06`}}>
                <div style={{fontSize:13,fontWeight:700,color:C.green,fontFamily:SF,marginBottom:4}}>✅ Tu entrega</div>
                {existingSub.text&&<div style={{fontSize:13,color:C.lbl,fontFamily:SF,lineHeight:1.5,marginBottom:8}}>{existingSub.text}</div>}
                {existingSub.files?.length>0&&existingSub.files.map(f=>(
                  <div key={f.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0"}}><span>📎</span><span style={{fontSize:12,color:C.lbl2,fontFamily:SF}}>{f.name}</span></div>
                ))}
                {existingSub.link&&<a href={existingSub.link} target="_blank" rel="noreferrer" style={{fontSize:12,color:C.blue,fontFamily:SF}}>🔗 {existingSub.link}</a>}
              </Card>
            ):(
              <Card style={{padding:14,marginBottom:12}}>
                <div style={{fontSize:13,fontWeight:700,color:C.lbl,fontFamily:SF,marginBottom:10}}>📤 Tu entrega</div>
                <textarea value={submissionText} onChange={e=>setSubmissionText(e.target.value)}
                  placeholder="Escribe tu respuesta o comentario aquí…" rows={3}
                  style={{width:"100%",background:C.fill4,border:`1px solid ${C.g5}`,borderRadius:10,padding:"10px 12px",
                    fontSize:14,color:C.lbl,fontFamily:SF,resize:"none",outline:"none",boxSizing:"border-box",lineHeight:1.5,marginBottom:10}}/>
                {/* Attached files preview */}
                {submissionFiles.length>0&&(
                  <div style={{marginBottom:10,display:"flex",flexDirection:"column",gap:5}}>
                    {submissionFiles.map(f=>(
                      <div key={f.id} style={{display:"flex",alignItems:"center",gap:8,background:C.fill4,borderRadius:8,padding:"7px 10px"}}>
                        <span style={{fontSize:17}}>{f.mime?.includes("image")?"🖼️":"📎"}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12,fontWeight:600,color:C.lbl,fontFamily:SF,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</div>
                          {f.src&&<img src={f.src} style={{width:"100%",maxHeight:120,borderRadius:6,objectFit:"cover",marginTop:4}}/>}
                        </div>
                        <button onClick={()=>setSubmissionFiles(s=>s.filter(x=>x.id!==f.id))} style={{background:"none",border:"none",color:C.lbl3,cursor:"pointer",fontSize:16}}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
                {/* Link input */}
                <div style={{display:"flex",gap:7,marginBottom:10,alignItems:"center"}}>
                  <span style={{fontSize:17}}>🔗</span>
                  <input value={submissionLink} onChange={e=>setSubmissionLink(e.target.value)}
                    placeholder="Pega un enlace (opcional)…"
                    style={{flex:1,background:C.fill4,border:`1px solid ${C.g5}`,borderRadius:9,padding:"8px 11px",fontSize:13,color:C.lbl,fontFamily:SF,outline:"none"}}/>
                </div>
                {/* Toolbar */}
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",borderTop:`0.5px solid ${C.sep}`,paddingTop:10,gap:8}}>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>subImgRef.current?.click()} title="Foto"
                      style={{width:36,height:36,borderRadius:10,background:`${typeColor}10`,border:`1px solid ${typeColor}25`,cursor:"pointer",fontSize:17,display:"flex",alignItems:"center",justifyContent:"center"}}>📷</button>
                    <button onClick={()=>subFileRef.current?.click()} title="Archivo"
                      style={{width:36,height:36,borderRadius:10,background:`${typeColor}10`,border:`1px solid ${typeColor}25`,cursor:"pointer",fontSize:17,display:"flex",alignItems:"center",justifyContent:"center"}}>📎</button>
                    <input ref={subImgRef} type="file" accept="image/*" multiple style={{display:"none"}} onChange={e=>{
                      Array.from(e.target.files||[]).forEach(f=>{
                        const r=new FileReader();
                        r.onload=ev=>setSubmissionFiles(a=>[...a,{id:Date.now()+Math.random(),name:f.name,mime:f.type,src:ev.target.result}]);
                        r.readAsDataURL(f);
                      });e.target.value="";
                    }}/>
                    <input ref={subFileRef} type="file" multiple style={{display:"none"}} onChange={e=>{
                      setSubmissionFiles(a=>[...a,...Array.from(e.target.files||[]).map(f=>({id:Date.now()+Math.random(),name:f.name,size:(f.size/1024).toFixed(0)+"KB",mime:f.type}))]);
                      e.target.value="";
                    }}/>
                  </div>
                  <button onClick={submitTarea}
                    disabled={!submissionText.trim()&&submissionFiles.length===0&&!submissionLink.trim()}
                    style={{background:(!submissionText.trim()&&submissionFiles.length===0&&!submissionLink.trim())?C.fill3:`linear-gradient(135deg,${typeColor},${typeColor}cc)`,
                      color:(!submissionText.trim()&&submissionFiles.length===0&&!submissionLink.trim())?C.lbl3:"#fff",
                      border:"none",borderRadius:10,padding:"9px 18px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:SF}}>
                    Entregar ✓
                  </button>
                </div>
              </Card>
            )
          )}

          {/* ── RETROALIMENTACIÓN DEL MAESTRO + CHAT ─────────────── */}
          {existingSub&&(existingSub.teacherFeedback||existingSub.teacherGrade!=null)&&(
            <ActivityFeedbackChat
              act={act} existingSub={existingSub} student={student}
              typeColor={typeColor} db={db} setState={setState}/>
          )}
        </div>
        <TabBar tabs={tabs} active="subjects" onChange={id=>{setSelectedActivity(null);setSelectedSubject(null);setTab(id);}} accent={T.accent}/>
      </div>
    );
  }

  if(selectedSubject){

    const m=resolveMascot(subjectMascotMap[selectedSubject]||null,selectedSubject);
    const sData=subjectData[selectedSubject]||{grade:null,tasks:[]};
    const progress=getMascotProgress(selectedSubject);
    const tasksDone=completedTasks[selectedSubject]||0;
    const equipped=equippedOutfit[selectedSubject];
    const subjContent=myContent.filter(c=>!c.subject||c.subject===selectedSubject);
    const allActivities=subjContent;
    const groupMembers=myGroupData?state.students.filter(s=>(myGroupData.students||[]).includes(s.id)):[];
    const parciales=getStudentParciales(selectedSubject);

    return(
      <div style={{background:T.bg,minHeight:"100vh",fontFamily:SF}}>
        {/* Header with sub-tabs */}
        <div style={{background:`linear-gradient(135deg,${m.color},${m.color}bb)`}}>
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 16px 10px"}}>
            <button onClick={()=>setSelectedSubject(null)}
              style={{background:"rgba(255,255,255,0.2)",border:"none",borderRadius:"50%",width:34,height:34,cursor:"pointer",color:"#fff",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>←</button>
            <div style={{flex:1}}>
              <div style={{fontSize:19,fontWeight:800,color:"#fff",fontFamily:SFD,letterSpacing:"-0.4px"}}>{selectedSubject}</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.75)",fontFamily:SF}}>{m.name}</div>
            </div>
            <div style={{
              width:62,height:62,borderRadius:"50%",
              background:"rgba(255,255,255,0.25)",
              border:"2px solid rgba(255,255,255,0.4)",
              display:"flex",alignItems:"center",justifyContent:"center",
              animation:"mascotBob 2s ease-in-out infinite",
              boxShadow:"0 4px 14px rgba(0,0,0,0.15)"}}>
              <MascotSVG subject={selectedSubject} animal={subjectMascotMap[selectedSubject]||null} outfit={equipped} size={52}/>
            </div>
          </div>
          <div style={{display:"flex",padding:"0 12px",gap:2,overflowX:"auto",scrollbarWidth:"none"}}>
            {[{id:"tablon",label:"Tablón",icon:"📋"},{id:"tareas",label:"Tareas",icon:"📝"},{id:"participantes",label:"Grupo",icon:"👥"},{id:"calificaciones",label:"Calificaciones",icon:"📊"}].map(t=>(
              <button key={t.id} onClick={()=>setSubjTab(t.id)}
                style={{flexShrink:0,padding:"7px 14px",borderRadius:"10px 10px 0 0",border:"none",cursor:"pointer",fontFamily:SF,fontSize:13,fontWeight:600,transition:"all 0.15s",
                  background:subjTab===t.id?"rgba(255,255,255,1)":"rgba(255,255,255,0.15)",color:subjTab===t.id?m.color:"rgba(255,255,255,0.9)"}}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="page-pad">
          {subjTab==="tablon"&&(
            <>
              {allActivities.filter(c=>!["tarea","actividad","examen","cuestionario"].includes(c.type)).length===0&&<div style={{textAlign:"center",padding:"40px 16px",color:C.lbl2,fontSize:15,fontFamily:SF}}><div style={{fontSize:40,marginBottom:10}}>📣</div><div style={{fontWeight:600,color:C.lbl,marginBottom:4}}>Sin anuncios aún</div><div style={{fontSize:13}}>Los avisos y publicaciones del maestro aparecerán aquí</div></div>}
              {allActivities.filter(c=>!["tarea","actividad","examen","cuestionario"].includes(c.type)).map(c=>{
                const typeColor={aviso:C.orange,evento:C.blue,noticia:C.green}[c.type]||m.color;
                const typeIcon={aviso:"📢",evento:"📅",noticia:"📰"}[c.type]||"📣";
                return(
                  <div key={c.id}
                    style={{background:"#fff",borderRadius:14,marginBottom:10,padding:"14px",boxShadow:"0 1px 3px rgba(0,0,0,0.06)",border:`1px solid ${typeColor}15`}}>
                    <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                      <div style={{width:40,height:40,borderRadius:12,background:`${typeColor}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{typeIcon}</div>
                      <div style={{flex:1}}>
                        <div style={{...fmt.callout,fontWeight:700,fontFamily:SF,color:C.lbl,marginBottom:3}}>{c.title}</div>
                        {c.content&&<div style={{fontSize:13,color:C.lbl2,fontFamily:SF,lineHeight:1.5,marginBottom:6}}>{c.content}</div>}
                        <div style={{fontSize:11,color:C.lbl3,fontFamily:SF}}>{c.teacherName||"Docente"} · {c.date||"—"}</div>
                      </div>
                    </div>
                    {c.images?.length>0&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>{c.images.map(img=>(<img key={img.id} src={img.src} style={{width:c.images.length===1?"100%":72,height:72,borderRadius:8,objectFit:"cover"}}/>))}</div>}
                    {c.link&&<a href={c.link} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:7,marginTop:8,padding:"7px 10px",background:`${C.blue}08`,borderRadius:9,border:`1px solid ${C.blue}20`,textDecoration:"none"}}><span>🔗</span><span style={{flex:1,fontSize:12,color:C.blue,fontFamily:SF,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.link}</span></a>}
                  </div>
                );
              })}
            </>
          )}

          {subjTab==="tareas"&&(
            <>
              {allActivities.length===0&&<div style={{textAlign:"center",padding:"40px 16px",color:C.lbl2,fontSize:15,fontFamily:SF}}>Sin actividades en esta materia</div>}
              {["tarea","actividad","examen","cuestionario"].map(tipo=>{
                const items=subjContent.filter(c=>c.type===tipo);
                if(!items.length)return null;
                const label={tarea:"Tareas 📝",actividad:"Actividades ⚡",examen:"Exámenes 📋",cuestionario:"Cuestionarios ❓"}[tipo];
                return(
                  <div key={tipo} style={{marginBottom:16}}>
                    <div style={{fontSize:11,fontWeight:700,color:C.lbl3,textTransform:"uppercase",letterSpacing:"0.06em",fontFamily:SF,marginBottom:8,paddingLeft:4}}>{label}</div>
                    {items.map(c=>{
                      const sub=(c.submissions||[]).find(x=>x.studentId===student?.id);
                      return(
                        <Card key={c.id} style={{marginBottom:8}} onPress={()=>{setSelectedActivity(c);setQuizAnswers({});setQuizSubmitted(false);}}>
                          <div style={{padding:"12px 14px",display:"flex",alignItems:"center",gap:10}}>
                            <div style={{width:38,height:38,borderRadius:10,background:`${m.color}12`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{c.type==="tarea"?"📝":c.type==="examen"?"📋":c.type==="cuestionario"?"❓":"⚡"}</div>
                            <div style={{flex:1}}>
                              <div style={{fontSize:14,fontWeight:600,color:C.lbl,fontFamily:SF}}>{c.title}</div>
                              <div style={{fontSize:11,color:C.lbl2,fontFamily:SF,marginTop:2}}>{c.points||10} pts · {c.dueDate||c.date||"—"}</div>
                            </div>
                            <div style={{display:"flex",alignItems:"center",gap:6}}>
                              <span style={{fontSize:11,fontWeight:700,color:sub?C.green:C.orange,background:sub?`${C.green}12`:`${C.orange}12`,borderRadius:8,padding:"3px 8px",fontFamily:SF}}>{sub?"✅ Entregado":"Pendiente"}</span>
                              <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M1 1L6 6L1 11" stroke={C.g3} strokeWidth="2" strokeLinecap="round"/></svg>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}

          {subjTab==="participantes"&&(
            <Sec title={`${groupMembers.length} compañeros en el grupo`}>
              {groupMembers.length===0&&<div style={{padding:"20px 16px",color:C.lbl2,fontSize:14,fontFamily:SF}}>Sin compañeros asignados aún</div>}
              {groupMembers.map((s,i)=>(
                <div key={s.id}>
                  <div style={{display:"flex",alignItems:"center",gap:12,padding:"11px 16px"}}>
                    <Ava initials={s.avatar} color={s.color} size={38}/>
                    <div style={{flex:1}}>
                      <div style={{...fmt.callout,fontWeight:600,color:C.lbl,fontFamily:SF}}>{s.name}{s.id===student?.id?" (Tú)":""}</div>
                      <div style={{...fmt.caption,color:C.lbl2,fontFamily:SF}}>{s.group}</div>
                    </div>
                    {s.id===student?.id&&<span style={{fontSize:11,color:m.color,background:`${m.color}12`,borderRadius:8,padding:"2px 8px",fontFamily:SF,fontWeight:600}}>Tú</span>}
                  </div>
                  {i<groupMembers.length-1&&<Div indent={66}/>}
                </div>
              ))}
            </Sec>
          )}

          {subjTab==="calificaciones"&&(
            <Card style={{padding:16,marginBottom:14}}>
              <div style={{...fmt.headline,fontWeight:700,color:C.lbl,fontFamily:SF,marginBottom:14}}>📊 {selectedSubject}</div>
              {parciales.map(({p,g},i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:i<parciales.length-1?`0.5px solid ${C.sep}`:"none"}}>
                  <div style={{width:36,height:36,borderRadius:10,background:g!=null?`${m.color}15`:C.fill4,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:g!=null?m.color:C.lbl3,fontFamily:SF}}>{i+1}</div>
                  <div style={{flex:1,...fmt.callout,color:C.lbl,fontFamily:SF}}>{p}</div>
                  {g!=null?(<div style={{background:`${g>=9?C.green:g>=7?m.color:g>=6?C.orange:C.red}15`,borderRadius:10,padding:"4px 12px"}}><span style={{fontSize:18,fontWeight:800,color:g>=9?C.green:g>=7?m.color:g>=6?C.orange:C.red,fontFamily:SF}}>{g.toFixed(1)}</span></div>):(<span style={{fontSize:11,color:C.orange,fontWeight:700,background:`${C.orange}12`,borderRadius:8,padding:"4px 10px",fontFamily:SF}}>Pendiente</span>)}
                </div>
              ))}
              <div style={{marginTop:14,paddingTop:12,borderTop:`1px solid ${C.sep}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span style={{...fmt.callout,fontWeight:700,color:C.lbl,fontFamily:SF}}>Calificación Final</span>
                {(()=>{
                  const manualFinal=student?.[`final_${selectedSubject}`]!=null?Number(student[`final_${selectedSubject}`]):null;
                  const allParciales=parciales.every(({g})=>g!=null);
                  const avgFinal=allParciales?parciales.reduce((a,{g})=>a+(g||0),0)/parciales.length:null;
                  const finalG=manualFinal??avgFinal;
                  return finalG!=null
                    ?<div style={{background:`${finalG>=9?C.green:finalG>=7?m.color:C.orange}20`,borderRadius:12,padding:"6px 16px",textAlign:"center"}}>
                        <span style={{fontSize:22,fontWeight:900,color:finalG>=9?C.green:finalG>=7?m.color:C.orange,fontFamily:SFD}}>{finalG.toFixed(1)}</span>
                        {manualFinal!=null&&<div style={{fontSize:9,color:C.lbl3,fontFamily:SF}}>calificación final</div>}
                      </div>
                    :<span style={{fontSize:12,color:C.orange,fontWeight:700,background:`${C.orange}12`,borderRadius:8,padding:"5px 12px",fontFamily:SF}}>Pendiente</span>;
                })()}
              </div>
            </Card>
          )}
        </div>
        <TabBar tabs={tabs} active="subjects" onChange={id=>{setSelectedSubject(null);setTab(id);}} accent={T.accent}/>
      </div>
    );
  }

  // ── Main Views ─────────────────────────────────────────────────────────────
  // Sidebar accent uses theme color (persists across tabs)
  const sidebarGradients={
    default:"linear-gradient(180deg,#1e3a5f 0%,#1d4ed8 60%,#3b82f6 100%)",
    pink:"linear-gradient(180deg,#831843 0%,#be185d 60%,#ec4899 100%)",
    purple:"linear-gradient(180deg,#3b0764 0%,#7c3aed 60%,#a855f7 100%)",
    green:"linear-gradient(180deg,#14532d 0%,#15803d 60%,#22c55e 100%)",
    orange:"linear-gradient(180deg,#7c2d12 0%,#c2410c 60%,#f97316 100%)",
  };
  return(
    <div className="app-layout" style={{background:T.bg,minHeight:"100vh",fontFamily:SF}}>
      <AppSidebar
        open={sidebarOpen} onToggle={()=>setSidebarOpen(o=>!o)}
        gradient={sidebarGradients[themeKey]||sidebarGradients.default}
        logoEmoji="🎒" logoLine1="Portal" logoLine2="Alumno"
        userEmoji="👤" userName={student?.name?.split(" ")[0]||"Alumno"} userSub={`Grupo ${student?.group||"-"}`}
        onLogout={onLogout}
        navItems={[
          {id:"feed",icon:"📋",label:"Tablón",active:tab==="feed",onClick:()=>{setTab("feed");localStorage.setItem("stu_tab","feed");},badge:urgentCount||0},
          {id:"subjects",icon:"📚",label:"Materias",active:tab==="subjects",onClick:()=>{setSelectedSubject(null);setTab("subjects");localStorage.setItem("stu_tab","subjects");}},
          {id:"chat",icon:"💬",label:"Mensajes",active:tab==="chat",onClick:()=>{setTab("chat");localStorage.setItem("stu_tab","chat");},badge:totalChatUnreadStu||0},
          {id:"medals",icon:"🏆",label:"Logros",active:tab==="medals",onClick:()=>{setTab("medals");localStorage.setItem("stu_tab","medals");}},
          {id:"settings",icon:"⚙️",label:"Ajustes",active:tab==="settings",onClick:()=>{setTab("settings");localStorage.setItem("stu_tab","settings");}},
        ]}
      />
      <div style={{flex:1,minWidth:0,position:"relative",overflowX:"hidden"}}>

      {tab!=="feed"&&<NewsBell/>}
      {tab!=="feed"&&newsOpen&&<NewsPanel/>}

      {/* ── TABLÓN — uses student's chosen theme accent, not holiday theme ── */}
      {tab==="feed"&&(
        <div style={{position:"relative",overflow:"hidden"}}>
          {/* Decorative big animals — sides, don't interfere with content */}
          <div style={{position:"fixed",bottom:80,left:-14,zIndex:1,pointerEvents:"none"}}>
            <AnimalDeco type="giraffe" size={130} opacity={0.1}/>
          </div>
          <div style={{position:"fixed",bottom:76,right:-10,zIndex:1,pointerEvents:"none"}}>
            <AnimalDeco type="elephant" size={140} opacity={0.09}/>
          </div>
          <div style={{position:"fixed",top:180,right:-20,zIndex:1,pointerEvents:"none"}}>
            <AnimalDeco type="whale" size={160} opacity={0.07}/>
          </div>
          <div style={{position:"fixed",top:260,left:-12,zIndex:1,pointerEvents:"none"}}>
            <AnimalDeco type="bear" size={120} opacity={0.09}/>
          </div>
          <div style={{position:"relative",zIndex:2}}>
            {false&&myContent.length>0&&(
              <div style={{padding:"8px 16px 0"}}>
                <div style={{fontSize:11,fontWeight:700,color:C.lbl3,textTransform:"uppercase",
                  letterSpacing:"0.06em",fontFamily:SF,marginBottom:8,paddingTop:8}}>
                  📚 Actividades de mi Grupo
                </div>
                {myContent.slice().reverse().map(c=>{
                  const typeColor={tarea:C.blue,examen:C.orange,actividad:C.purple,cuestionario:C.teal}[c.type]||T.accent;
                  const typeLabel={tarea:"Tarea",examen:"Examen",actividad:"Actividad",cuestionario:"Cuestionario"}[c.type]||c.type;
                  const typeIcon={tarea:"📝",examen:"📋",actividad:"⚡",cuestionario:"❓"}[c.type]||"📌";
                  const doneKey=`done_${c.id}`;
                  const done=!!(completedTasks[doneKey]);
                  const sub=(c.submissions||[]).find(x=>String(x.studentId)===String(student?.id));
                  return(
                    <div key={c.id} onClick={()=>{setSelectedActivity(c);setQuizAnswers({});setQuizSubmitted(false);}}
                      style={{background:"#fff",borderRadius:14,marginBottom:10,cursor:"pointer",
                      boxShadow:"0 1px 4px rgba(0,0,0,0.07)",border:`1px solid ${typeColor}20`,overflow:"hidden"}}>
                      <div style={{background:`linear-gradient(135deg,${typeColor}15,${typeColor}05)`,
                        padding:"11px 14px",borderBottom:`0.5px solid ${typeColor}20`,
                        display:"flex",alignItems:"center",gap:10}}>
                        <div style={{width:36,height:36,borderRadius:10,background:`${typeColor}18`,
                          display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>
                          {typeIcon}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:14,fontWeight:700,color:C.lbl,fontFamily:SF,
                            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.title}</div>
                          <div style={{fontSize:11,color:C.lbl2,fontFamily:SF,marginTop:1}}>
                            {c.teacherName||"Docente"} · {c.subject||c.groupName||"Clase"}
                          </div>
                        </div>
                        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3}}>
                          <span style={{fontSize:10,fontWeight:700,color:typeColor,background:`${typeColor}15`,borderRadius:8,padding:"2px 8px",fontFamily:SF,flexShrink:0}}>{typeLabel}</span>
                          {sub&&<span style={{fontSize:9,fontWeight:700,color:C.green,background:`${C.green}12`,borderRadius:6,padding:"1px 6px",fontFamily:SF}}>✅ Entregado</span>}
                        </div>
                      </div>
                      {c.content&&<div style={{padding:"9px 14px",fontSize:13,color:C.lbl2,fontFamily:SF,lineHeight:1.5}}>{c.content}</div>}
                      <div style={{padding:"8px 14px 10px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                          {c.dueDate&&<span style={{fontSize:11,color:C.lbl3,fontFamily:SF}}>📅 Entrega: {c.dueDate}</span>}
                          {c.points&&<span style={{fontSize:11,color:C.lbl3,fontFamily:SF}}>⭐ {c.points} pts</span>}
                        </div>
                        <span style={{fontSize:11,color:typeColor,fontFamily:SF,fontWeight:600}}>Ver detalles →</span>
                      </div>
                    </div>
                  );
                })}
                <div style={{height:4}}/>
              </div>
            )}
            <Feed state={state} setState={setState} userId={`s${studentId}`} userName={student?.name||"Alumno"}
              userAvatar={student?.avatar||"A"} userColor={T.accent} userRole="student" accent={T.accent}
              newsItems={newsItems} urgentCount={urgentCount}/>
          </div>
        </div>
      )}

      {/* ── MATERIAS ── */}
      {tab==="subjects"&&(
        <div style={{position:"relative",zIndex:20,minHeight:"100vh"}}>
          {/* Floating mascot bubbles in background */}
          <div style={{position:"absolute",inset:0,overflow:"hidden",pointerEvents:"none",zIndex:0}}>
            {mySubjects.slice(0,4).map((subj,i)=>(
              <FloatingMascot key={subj} subject={subj}
                animal={subjectMascotMap[subj]||null}
                outfit={equippedOutfit[subj]||null}
                progress={getMascotProgress(subj)}
                style={{animationDelay:`${i*0.6}s`}}/>
            ))}
          </div>
          <NavBar title="Mis Materias" large accent={T.accent} bg={`${T.bg}ee`}/>
          <div className="page-pad" style={{position:"relative",zIndex:2}}>
            <Card style={{padding:16,marginBottom:14,display:"flex",alignItems:"center",gap:12}}>
              <div style={{position:"relative",cursor:"pointer"}} onClick={()=>fileRef.current?.click()}>
                <Ava initials={student?.avatar||"A"} color={T.accent} size={54} img={profilePic}/>
                <div style={{position:"absolute",bottom:0,right:0,width:18,height:18,borderRadius:"50%",
                  background:T.accent,border:"2px solid #fff",display:"flex",alignItems:"center",
                  justifyContent:"center",fontSize:9}}>📷</div>
                <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}}
                  onChange={e=>{const f=e.target.files?.[0];if(f){const r=new FileReader();r.onload=ev=>setProfilePic(ev.target.result);r.readAsDataURL(f);}}}/>
              </div>
              <div style={{flex:1}}>
                <div style={{...fmt.headline,color:C.lbl,fontFamily:SF}}>{student?.name}</div>
                <div style={{...fmt.caption,color:C.lbl2,fontFamily:SF}}>Grupo {student?.group}</div>
              </div>
              <div style={{display:"flex",gap:12}}>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:14}}>⭐</div>
                  <div style={{fontSize:13,fontWeight:700,color:T.accent,fontFamily:SF}}>
                    {(Object.values(subjectData).reduce((a,s)=>a+(s.grade||0),0)/Math.max(1,Object.values(subjectData).length)).toFixed(1)}
                  </div>
                </div>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:14}}>🪙</div>
                  <div style={{fontSize:13,fontWeight:700,color:"#9A7108",fontFamily:SF}}>{currentTokens}</div>
                </div>
              </div>
            </Card>
            {mySubjects.map(subj=>{
              const m=resolveMascot(subjectMascotMap[subj]||null,subj);
              const sData=subjectData[subj]||{grade:7,tasks:[]};
              const progress=getMascotProgress(subj);
              const level=Math.floor(progress/20)+1;
              const equipped=equippedOutfit[subj];
              const mascotPx=24+Math.floor(progress/20)*4;
              // New activity badge: any content for this subject not yet seen
              const newActKey=`lms_seen_${studentId}_${subj}`;
              const lastSeen=Number(localStorage.getItem(newActKey)||0);
              const newActs=myContent.filter(c=>(c.subject===subj||!c.subject)&&(c._createdAt?.seconds||0)>lastSeen);
              const hasNew=newActs.length>0;
              return(
                <Card key={subj} style={{marginBottom:10}} onPress={()=>{setSelectedSubject(subj);localStorage.setItem(newActKey,String(Math.floor(Date.now()/1000)));}}>
                  <div style={{padding:"14px 16px",display:"flex",alignItems:"center",gap:14}}>
                    <div style={{position:"relative",flexShrink:0}}>
                      <div style={{width:58,height:58,borderRadius:"50%",
                        background:`linear-gradient(135deg,${m.color}20,${m.color}08)`,
                        border:`2px solid ${m.color}30`,
                        display:"flex",alignItems:"center",justifyContent:"center",overflow:"visible",
                        boxShadow:`0 2px 10px ${m.color}20`,
                        animation:"mascotBob 2.5s ease-in-out infinite"}}>
                        <MascotSVG subject={subj} animal={subjectMascotMap[subj]||null} outfit={equipped} size={48}/>
                      </div>
                    </div>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <span style={{...fmt.callout,fontWeight:600,color:C.lbl,fontFamily:SF}}>{subj}</span>
                        {hasNew&&<span style={{fontSize:10,fontWeight:800,color:"#fff",background:C.red,borderRadius:8,padding:"1px 6px",fontFamily:SF,animation:"pulse 1.2s ease-in-out infinite"}}>¡Nueva!</span>}
                      </div>
                      <div style={{...fmt.caption,color:m.color,fontWeight:600,fontFamily:SF,marginBottom:5}}>{m.name}</div>
                      {(()=>{
                        const pList=getStudentParciales(subj);
                        const completedCount=pList.filter(({g})=>g!=null).length;
                        const totalP=pList.length||1;
                        const pct=Math.round((completedCount/totalP)*100);
                        return(
                          <div style={{height:5,background:C.fill3,borderRadius:3,overflow:"hidden"}}>
                            <div style={{height:"100%",width:`${pct}%`,borderRadius:3,
                              background:`linear-gradient(90deg,${m.color},${m.color}bb)`,transition:"width 0.6s ease"}}/>
                          </div>
                        );
                      })()}
                    </div>
                    <div style={{textAlign:"right"}}>
                      {(()=>{
                        const pList=getStudentParciales(subj);
                        // Last parcial with a grade
                        const lastParcial=[...pList].reverse().find(({g})=>g!=null);
                        const lastG=lastParcial?.g??null;
                        return lastG!=null
                          ?<><div style={{fontSize:20,fontWeight:700,color:C.blue,fontFamily:SF}}>{Number(lastG).toFixed(1)}</div><div style={{fontSize:10,color:C.lbl3,fontFamily:SF}}>último</div></>
                          :<span style={{fontSize:11,color:C.lbl3,fontWeight:600,fontFamily:SF}}>—</span>;
                      })()}
                    </div>
                    <svg width="8" height="13" viewBox="0 0 8 13" fill="none"><path d="M1 1L7 6.5L1 12" stroke={C.g3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ── LOGROS (Perfil académico completo) ── */}
      {tab==="chat"&&(
        <ChatPanel state={state} setState={setState}
          myUserId={`s${studentId}`} myName={student?.name||"Alumno"}
          myAvatar={student?.avatar||"A"} myColor={T.accent}
          role="student" accent={T.accent}/>
      )}

      {tab==="medals"&&(
        <div style={{position:"relative",zIndex:20}}>
          <NavBar title="Mis Logros" large accent={T.accent} bg={`${T.bg}ee`}/>
          <div className="page-pad">

            {/* Perfil del alumno */}
            <Card style={{marginBottom:16,overflow:"hidden"}}>
              <div style={{background:`linear-gradient(135deg,${T.accent}22,${T.accent}08)`,padding:"20px 20px 16px",display:"flex",alignItems:"center",gap:16}}>
                <div style={{position:"relative",cursor:"pointer"}} onClick={()=>fileRef.current?.click()}>
                  <Ava initials={student?.avatar||"A"} color={T.accent} size={72} img={profilePic}/>
                  <div style={{position:"absolute",bottom:0,right:0,width:22,height:22,borderRadius:"50%",
                    background:T.accent,border:"2.5px solid #fff",display:"flex",alignItems:"center",
                    justifyContent:"center",fontSize:11,boxShadow:`0 2px 8px ${T.accent}40`}}>📷</div>
                  <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}}
                    onChange={e=>{const f=e.target.files?.[0];if(f){const r=new FileReader();r.onload=ev=>setProfilePic(ev.target.result);r.readAsDataURL(f);}}}/>
                </div>
                <div style={{flex:1}}>
                  <div style={{...fmt.title3,color:C.lbl,fontFamily:SFD}}>{student?.name}</div>
                  <div style={{...fmt.subhead,color:C.lbl2,fontFamily:SF,marginTop:2}}>Grupo {student?.group}</div>
                  <div style={{display:"flex",gap:10,marginTop:10,flexWrap:"wrap"}}>
                    {[
                      {icon:"📅",val:`${student?.attendance?.filter(a=>a.s==="present").length||0} asist.`,col:C.green},
                      {icon:"⭐",val:(Object.values(subjectData).reduce((a,s)=>a+(s.grade||0),0)/Math.max(1,Object.values(subjectData).length)).toFixed(1)+" prom.",col:T.accent},
                      {icon:"🪙",val:`${currentTokens} tokens`,col:"#9A7108"},
                    ].map(({icon,val,col})=>(
                      <div key={val} style={{background:`${col}15`,borderRadius:10,padding:"4px 10px",display:"flex",alignItems:"center",gap:4}}>
                        <span style={{fontSize:12}}>{icon}</span>
                        <span style={{fontSize:11,fontWeight:600,color:col,fontFamily:SF}}>{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* Datos académicos rápidos */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0}}>
                <div style={{padding:"12px 16px",borderRight:`0.5px solid ${C.sep}`,borderTop:`0.5px solid ${C.sep}`}}>
                  <div style={{...fmt.caption,color:C.lbl2,fontFamily:SF,marginBottom:2}}>Clave de Acceso</div>
                  <div style={{fontFamily:"'SF Mono','Menlo',monospace",fontSize:12,color:T.accent,fontWeight:600}}>{student?.key}</div>
                </div>
                <div style={{padding:"12px 16px",borderTop:`0.5px solid ${C.sep}`}}>
                  <div style={{...fmt.caption,color:C.lbl2,fontFamily:SF,marginBottom:2}}>Participaciones</div>
                  <div style={{...fmt.callout,fontWeight:700,color:C.lbl,fontFamily:SF}}>{student?.participation||0} pts</div>
                </div>
              </div>
            </Card>

            {/* Tabla de calificaciones por parcial */}
            <Sec title="Calificaciones por Parcial">
              <div style={{padding:"14px 16px",overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontFamily:SF}}>
                  <thead>
                    <tr>
                      <td style={{fontSize:11,fontWeight:700,color:C.lbl2,textTransform:"uppercase",letterSpacing:"0.05em",paddingBottom:8,paddingRight:12}}>Materia</td>
                      {Array.from({length:numParciales},(_,i)=>(
                        <td key={i} style={{fontSize:11,fontWeight:700,color:C.lbl2,textTransform:"uppercase",letterSpacing:"0.05em",paddingBottom:8,textAlign:"center",minWidth:52}}>{ordinalLabel(i+1)}</td>
                      ))}
                      <td style={{fontSize:11,fontWeight:700,color:C.lbl2,textTransform:"uppercase",letterSpacing:"0.05em",paddingBottom:8,textAlign:"center",minWidth:52}}>Final</td>
                    </tr>
                  </thead>
                  <tbody>
                    {mySubjects.map((subj,i)=>{
                      const parciales=getStudentParciales(subj);
                      const allFilled=parciales.every(({g})=>g!=null);
                      const avgParciales=allFilled
                        ? parciales.reduce((sum,{g})=>sum+(g||0),0)/parciales.length
                        : null;
                      // Use teacher-set final grade if available, otherwise auto-average
                      const manualFinal=student?.[`final_${subj}`]!=null?Number(student[`final_${subj}`]):null;
                      const finalGrade=manualFinal??avgParciales;
                      const hasAny=parciales.some(({g})=>g!=null)||manualFinal!=null;
                      return(
                        <tr key={subj} style={{borderTop:i>0?`0.5px solid ${C.sep}`:"none"}}>
                          <td style={{padding:"10px 12px 10px 0",verticalAlign:"middle"}}>
                            <span style={{fontSize:13,fontWeight:600,color:C.lbl,fontFamily:SF}}>{subj}</span>
                          </td>
                          {parciales.map(({g},pi)=>{
                            if(g===null) return(
                              <td key={pi} style={{textAlign:"center",padding:"10px 4px",verticalAlign:"middle"}}>
                                <span style={{fontSize:10,color:C.lbl3,fontFamily:SF,background:C.fill4,borderRadius:6,padding:"2px 5px"}}>—</span>
                              </td>
                            );
                            const col=g>=9?C.green:g>=7?T.accent:g>=6?C.orange:C.red;
                            return(
                              <td key={pi} style={{textAlign:"center",padding:"10px 4px",verticalAlign:"middle"}}>
                                <span style={{fontSize:14,fontWeight:700,color:col,fontFamily:SF}}>{g.toFixed(1)}</span>
                              </td>
                            );
                          })}
                          <td style={{textAlign:"center",padding:"10px 4px",verticalAlign:"middle"}}>
                            <div style={{background:`${finalGrade!=null&&finalGrade>=9?C.green:finalGrade!=null&&finalGrade>=7?T.accent:finalGrade!=null?C.orange:C.fill3}18`,
                              borderRadius:8,padding:"3px 6px",display:"inline-block"}}>
                              <span style={{fontSize:14,fontWeight:800,
                                color:finalGrade!=null&&finalGrade>=9?C.green:finalGrade!=null&&finalGrade>=7?T.accent:finalGrade!=null?C.orange:C.lbl3,fontFamily:SF}}>
                                {finalGrade!=null?finalGrade.toFixed(1):"—"}
                              </span>
                              {manualFinal!=null&&<span style={{fontSize:8,color:C.lbl3,fontFamily:SF,display:"block"}}>final</span>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div style={{display:"flex",gap:12,marginTop:10,flexWrap:"wrap"}}>
                  {[[C.green,"9-10"],[T.accent,"7-8.9"],[C.orange,"6-6.9"],[C.red,"<6"]].map(([c,l])=>(
                    <div key={l} style={{display:"flex",alignItems:"center",gap:4}}>
                      <div style={{width:10,height:10,borderRadius:2,background:c}}/>
                      <span style={{fontSize:10,color:C.lbl2,fontFamily:SF}}>{l}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Sec>

            {/* Puntos y tokens */}
            <Card style={{padding:20,marginBottom:16,display:"flex",alignItems:"center",gap:16}}>
              <div style={{width:56,height:56,borderRadius:18,background:`${C.yellow}20`,
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:30}}>🪙</div>
              <div style={{flex:1}}>
                <div style={{...fmt.title2,color:"#9A7108",fontFamily:SFD}}>{currentTokens}</div>
                <div style={{...fmt.caption,color:C.lbl2,fontFamily:SF}}>tokens disponibles · {student?.participation||0} pts de participación</div>
              </div>
            </Card>

            {/* Logros obtenidos */}
            <Sec title="Logros Obtenidos">
              {[["⭐","Entrega Puntual","×8","Tareas entregadas a tiempo",C.yellow],
                ["🎯","Asistencia Perfecta","×3","Semanas sin faltas",C.green],
                ["🏆","Calificación Máxima","×2","10 en examen",C.orange],
                ["📚","Portafolio Completo","×2","Evidencias al día",C.purple],
              ].map(([e,n,c,d,col],i,arr)=>(
                <div key={n}>
                  <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px"}}>
                    <div style={{width:44,height:44,borderRadius:12,background:`${col}18`,
                      display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>{e}</div>
                    <div style={{flex:1}}>
                      <div style={{...fmt.callout,fontWeight:600,color:C.lbl,fontFamily:SF}}>{n}</div>
                      <div style={{...fmt.caption,color:C.lbl2,fontFamily:SF}}>{d}</div>
                    </div>
                    <span style={{fontSize:18,fontWeight:700,color:col,fontFamily:SF}}>{c}</span>
                  </div>
                  {i<arr.length-1&&<Div indent={72}/>}
                </div>
              ))}
            </Sec>

            {/* Mascotas con outfits */}
            <Sec title="Mis Mascotas" footer="Toca una mascota para ir a su tienda">
              <div style={{padding:"14px 12px",display:"flex",gap:10,justifyContent:"space-around",flexWrap:"wrap"}}>
                {mySubjects.map(subj=>{
                  const m=MASCOTS[subj]||MASCOTS["Matemáticas"];
                  const progress=getMascotProgress(subj);
                  const equipped=equippedOutfit[subj];
                  const equippedItem=getShopItems(subj)?.find(i=>i.id===equipped);
                  const mascotPx=24+Math.floor(progress/20)*5;
                  return(
                    <button key={subj} onClick={()=>{setShopFrom("medals");setShopSubject(subj);}}
                      style={{background:`${m.color}12`,border:`1px solid ${m.color}25`,borderRadius:16,
                        padding:"14px 12px",textAlign:"center",cursor:"pointer",
                        transition:"transform 0.15s",minWidth:80,position:"relative"}}
                      onMouseEnter={e=>e.currentTarget.style.transform="scale(1.05)"}
                      onMouseLeave={e=>e.currentTarget.style.transform=""}>
                      <div style={{display:"inline-block",marginBottom:4}}>
                        <MascotSVG subject={subj} animal={subjectMascotMap[subj]||null} outfit={equipped} size={48}/>
                      </div>
                      <div style={{fontSize:9,fontWeight:700,color:m.color,fontFamily:SF,marginTop:2}}>Nv.{Math.floor(progress/20)+1}</div>
                      <div style={{fontSize:8,color:C.lbl3,fontFamily:SF}}>👕 Tienda</div>
                    </button>
                  );
                })}
              </div>
            </Sec>
          </div>
        </div>
      )}

      {/* ── AJUSTES ── */}
      {tab==="settings"&&(
        <div>
          <NavBar title="Ajustes" large accent={T.accent} bg={`${T.bg}ee`}/>
          <div className="page-pad">
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:10,marginBottom:24}}>
              <div style={{position:"relative"}}>
                <Ava initials={student?.avatar||"A"} color={T.accent} size={86} img={profilePic}/>
                <button onClick={()=>fileRef.current?.click()} style={{position:"absolute",bottom:0,right:0,
                  width:30,height:30,borderRadius:"50%",background:T.accent,border:"2.5px solid white",
                  display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",
                  boxShadow:`0 2px 10px ${T.accent}50`,fontSize:13}}>
                  📷
                </button>
                <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}}
                  onChange={e=>{const f=e.target.files?.[0];if(f){const r=new FileReader();r.onload=ev=>setProfilePic(ev.target.result);r.readAsDataURL(f);}}}/>
              </div>
              <div style={{...fmt.title3,color:C.lbl,fontFamily:SFD}}>{student?.name}</div>
              <div style={{fontFamily:"'SF Mono','Menlo',monospace",fontSize:13,color:T.accent}}>{student?.key}</div>
            </div>
            <Sec title="Tema de Color" footer="Se aplica en toda tu experiencia.">
              <div style={{padding:"14px 16px"}}>
                <div style={{display:"flex",gap:16,justifyContent:"center",flexWrap:"wrap"}}>
                  {Object.entries(THEMES).map(([key,val])=>(
                    <button key={key} onClick={()=>setThemeKey(key)} style={{display:"flex",flexDirection:"column",
                      alignItems:"center",gap:5,background:"none",border:"none",cursor:"pointer",
                      transform:themeKey===key?"scale(1.15)":"scale(1)",transition:"transform 0.15s"}}>
                      <div style={{width:44,height:44,borderRadius:"50%",background:val.accent,
                        boxShadow:themeKey===key?`0 0 0 3px white,0 0 0 5px ${val.accent}`:"none",transition:"box-shadow 0.2s"}}/>
                      <span style={{fontSize:11,fontWeight:themeKey===key?700:400,
                        color:themeKey===key?val.accent:C.lbl2,fontFamily:SF}}>{val.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </Sec>
            <Sec title="Cuenta">
              <Row label="Editar Nombre" icon="✏️" iconBg={`${T.accent}20`} chevron onPress={()=>{}}/>
              <Div indent={46}/>
              <Row label="Notificaciones Push" icon="🔔" iconBg={`${C.red}20`} chevron onPress={()=>{
                if(Notification?.permission==="default"){
                  Notification.requestPermission().then(p=>{
                    if(p==="granted") pushNotification({title:"🔔 Notificaciones activadas",text:"Recibirás avisos importantes aquí."});
                  });
                } else if(Notification?.permission==="granted"){
                  pushNotification({title:"🔔 Notificaciones activas",text:"Las notificaciones ya están habilitadas."});
                }
              }}/>
            </Sec>
            <Sec><Row label="Cerrar Sesión" icon="🚪" iconBg={`${C.red}15`} danger onPress={onLogout}/></Sec>
          </div>
        </div>
      )}
      <TabBar tabs={tabs} active={tab} onChange={id=>{setTab(id);localStorage.setItem("stu_tab",id);if(id!=="subjects")setSelectedSubject(null);}} accent={T.accent}/>
      </div>
    </div>
  );
};


// ─── LOGIN ────────────────────────────────────────────────────────────────────
const Login=({state,onLogin})=>{
  const [step,setStep]=useState("welcome");
  const [role,setRole]=useState(null);
  const [mode,setMode]=useState("login");
  const [form,setForm]=useState({name:"",email:"",password:"",key:""});
  const [genKeyVal,setGenKeyVal]=useState("");
  const [newStudentData,setNewStudentData]=useState(null);
  const [copied,setCopied]=useState(false);
  const [err,setErr]=useState("");
  const [fade,setFade]=useState(true);
  // Direct navigation — no setTimeout delay
  const go=fn=>{ fn(); };

  const roles=[
    {id:"director",label:"Directivos",sub:"Dirección y Administración",icon:"🏫",color:C.indigo},
    {id:"teacher",label:"Maestros",sub:"Docentes y personal académico",icon:"👩‍🏫",color:C.blue},
    {id:"student",label:"Alumnos",sub:"Acceso con clave de estudiante",icon:"🎒",color:C.green},
    {id:"developer",label:"Desarrollador",sub:"Administración del sistema",icon:"⚙️",color:"#1a1a2e"},
  ];

  const submit=async()=>{
    setErr("");
    if(role==="developer"){
      if(form.password!=="dev2026"){setErr("Clave de acceso incorrecta.");return;}
      onLogin("developer",null);
    } else if(role==="director"){
      if(!form.email||!form.password){setErr("Completa todos los campos.");return;}
      try {
        await signInWithEmailAndPassword(auth, form.email, form.password);
        onLogin("director",null);
      } catch {
        setErr("Correo o contraseña incorrectos.");
      }
    } else if(role==="teacher"){
      const trimmedKey=form.key.trim();
      const t=state.teachers.find(t=>t.key&&t.key.trim()===trimmedKey);
      if(!t){setErr(`Clave incorrecta. Verifica el código generado por la directora.${state.teachers.length===0?" (Cargando datos…)":""}`);return;}
      const techEmail=`${trimmedKey.toLowerCase().replace(/[^a-z0-9]/g,"")}@school.app`;
      const techPass=`pwd_${trimmedKey}_secure`;
      try {
        await signInWithEmailAndPassword(auth,techEmail,techPass);
      } catch {
        try { await createUserWithEmailAndPassword(auth,techEmail,techPass); } catch {}
      }
      // Store Firestore ID — TeacherApp will find teacher by this ID
      onLogin("teacher",t.id);
    } else {
      if(mode==="login"){
        const s=state.students.find(s=>s.key===form.key);
        if(!s){setErr("Clave de acceso incorrecta.");return;}
        const techEmail=`${form.key.toLowerCase().replace(/[^a-z0-9]/g,"")}@school.app`;
        const techPass=`pwd_${form.key}_secure`;
        try {
          await signInWithEmailAndPassword(auth,techEmail,techPass);
        } catch {
          try { await createUserWithEmailAndPassword(auth,techEmail,techPass); } catch {}
        }
        onLogin("student",s.id);
      } else {
        const parts=form.name.trim().split(/\s+/);
        if(parts.length<3){setErr("Escribe nombre y ambos apellidos.");return;}
        if(!form.parentEmail){setErr("Correo del tutor requerido.");return;}
        if(!form.group?.trim()){setErr("El grupo es requerido.");return;}
        const k=genKey(form.name,form.group||"");
        const grp=form.group.match(/(\d+)[°]?([A-Z])/i);
        const newStudent={
          name:form.name.trim(),
          group:form.group.trim(),
          grade:grp?parseInt(grp[1]):0,
          section:grp?grp[2].toUpperCase():"A",
          parentEmail:form.parentEmail,
          parentContact:form.parentContact||"",
          key:k,
          avatar:parts.filter((_,i)=>i<2).map(p=>p[0].toUpperCase()).join(""),
          color:[C.blue,C.green,C.purple,C.orange][Math.floor(Math.random()*4)],
          attendance:[],subjects:{},participation:0,tabBoardLikes:0
        };
        try {
          const ref = await addDoc(collection(db,"students"),{...newStudent,_createdAt:serverTimestamp()});
          setNewStudentData({...newStudent,id:ref.id});
          // Send welcome email with QR
          sendWelcomeEmail({ toEmail:form.parentEmail, toName:newStudent.name, key:k, role:"student", group:form.group });
        } catch {
          const id=Date.now();
          setNewStudentData({...newStudent,id});
        }
        setGenKeyVal(k);
        go(()=>setStep("key"));
      }
    }
  };

  return(
    <div style={{minHeight:"100vh",background:"#FFFFFF",display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"center",padding:"24px 20px",fontFamily:SF}}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes scanLine{0%{top:0;opacity:1}100%{top:100%;opacity:0.2}}
        @keyframes mascotBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.75;transform:scale(0.92)}}
      `}</style>
      <div style={{maxWidth:390,width:"100%",opacity:fade?1:0,transition:"opacity 0.18s",animation:"fadeUp 0.4s ease"}}>
        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:step==="welcome"?52:32}}>
          <div style={{width:96,height:96,borderRadius:"50%",background:"linear-gradient(145deg,#1a3a6b,#2563eb,#3b82f6)",
            display:"flex",alignItems:"center",justifyContent:"center",
            boxShadow:"0 8px 32px rgba(37,99,235,0.3),0 0 0 6px #EFF6FF,0 0 0 9px #BFDBFE",
            margin:"0 auto 16px",fontSize:44}}>🏫</div>
          <div style={{fontSize:step==="welcome"?30:24,fontWeight:700,color:"#000",letterSpacing:"-0.8px",marginBottom:4,fontFamily:SFD}}>
            Instituto Educativo
          </div>
          <div style={{fontSize:15,color:C.g1,letterSpacing:"-0.2px",fontFamily:SF}}>
            {step==="welcome"?"Bienvenido al sistema":step==="roleSelect"?"Selecciona tu perfil":step==="key"?"¡Cuenta creada!":roles.find(r=>r.id===role)?.label}
          </div>
        </div>

        {step==="welcome"&&(
          <div style={{textAlign:"center"}}>
            <Btn onPress={()=>go(()=>setStep("roleSelect"))} size="lg" full>Ingresar al Sistema</Btn>
            <div style={{fontSize:13,color:C.g2,marginTop:16,fontFamily:SF}}>Ciclo Escolar 2025–2026</div>
          </div>
        )}

        {step==="roleSelect"&&(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {roles.map(r=>(
              <button key={r.id} onClick={()=>go(()=>{setRole(r.id);setStep("login");setMode("login");setErr("");})}
                style={{display:"flex",alignItems:"center",gap:14,padding:"16px 18px",
                  background:"#fff",border:`1px solid ${C.g5}`,borderRadius:16,cursor:"pointer",
                  textAlign:"left",boxShadow:"0 1px 6px rgba(0,0,0,0.06)",transition:"all 0.15s"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=r.color;e.currentTarget.style.transform="translateY(-1px)";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=C.g5;e.currentTarget.style.transform="";}}>
                <div style={{width:52,height:52,borderRadius:16,background:`${r.color}15`,
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:28}}>{r.icon}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:17,fontWeight:600,color:"#000",letterSpacing:"-0.3px",fontFamily:SF}}>{r.label}</div>
                  <div style={{fontSize:13,color:C.g1,marginTop:1,fontFamily:SF}}>{r.sub}</div>
                </div>
                <svg width="8" height="14" viewBox="0 0 8 14" fill="none"><path d="M1 1L7 7L1 13" stroke={C.g3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            ))}
            <button onClick={()=>go(()=>setStep("welcome"))} style={{background:"none",border:"none",color:C.blue,fontSize:17,cursor:"pointer",padding:"10px 0",textAlign:"center",fontFamily:SF}}>← Volver</button>
          </div>
        )}

        {step==="login"&&(
          <div>
            {role!=="developer"&&role!=="teacher"&&(
            <div style={{display:"flex",background:C.fill4,borderRadius:12,padding:3,marginBottom:16}}>
              {["login","register"].map(m=>(
                <button key={m} onClick={()=>{setMode(m);setErr("");}} style={{flex:1,padding:"8px 0",borderRadius:10,
                  border:"none",cursor:"pointer",fontSize:15,fontWeight:600,letterSpacing:"-0.2px",
                  transition:"all 0.18s",background:mode===m?"#fff":"transparent",
                  color:mode===m?C.lbl:C.g1,fontFamily:SF,
                  boxShadow:mode===m?"0 1px 4px rgba(0,0,0,0.12)":"none"}}>
                  {m==="login"?"Ingresar":"Crear Cuenta"}
                </button>
              ))}
            </div>
            )}
            <div style={{display:"flex",flexDirection:"column",gap:0}}>
              {role==="developer"&&(
                <Input label="Clave de Desarrollador" placeholder="••••••••" value={form.password} onChange={v=>setForm(f=>({...f,password:v}))} type="password"/>
              )}
              {role==="teacher"&&(
                <>
                  <div style={{background:`${C.blue}08`,border:`1px solid ${C.blue}20`,borderRadius:12,
                    padding:"12px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:20}}>👩‍🏫</span>
                    <div style={{fontSize:13,color:C.lbl2,fontFamily:SF,lineHeight:1.5}}>
                      Ingresa el <strong style={{color:C.blue}}>código generado</strong> cuando la directora creó tu cuenta.
                    </div>
                  </div>
                  <Input label="Código de Docente" placeholder="Ej: ana.R247" value={form.key} onChange={v=>setForm(f=>({...f,key:v}))} mono/>
                </>
              )}
              {role!=="developer"&&role!=="teacher"&&mode==="register"&&role==="student"&&(
                <>
                  <Input label="Nombre Completo (nombre + 2 apellidos) *" placeholder="María González Hernández" value={form.name} onChange={v=>setForm(f=>({...f,name:v}))}/>
                  <Input label="Correo del Padre/Tutor *" placeholder="padre@correo.com" value={form.parentEmail||""} onChange={v=>setForm(f=>({...f,parentEmail:v}))} type="email"/>
                  {/* Grupo — dropdown cerrado */}
                  <div style={{background:C.fill4,borderRadius:12,padding:"10px 14px",marginBottom:10}}>
                    <div style={{fontSize:11,color:C.lbl2,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4,fontFamily:SF}}>Grupo *</div>
                    {state.groups && state.groups.length > 0 ? (
                      <select value={form.group||""} onChange={e=>setForm(f=>({...f,group:e.target.value}))}
                        style={{width:"100%",background:"transparent",border:"none",fontSize:16,color:form.group?C.lbl:C.lbl3,fontFamily:SF,outline:"none"}}>
                        <option value="">Selecciona tu grupo…</option>
                        {[...new Set(state.groups.map(g=>g.name))].sort().map(g=>(
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    ) : (
                      <input type="text" value={form.group||""} onChange={e=>setForm(f=>({...f,group:e.target.value}))}
                        placeholder="Ej: 3°A"
                        style={{width:"100%",background:"transparent",border:"none",fontSize:16,color:C.lbl,fontFamily:SF,outline:"none"}}/>
                    )}
                  </div>
                </>
              )}
              {role!=="developer"&&role!=="teacher"&&(role!=="student"||(mode==="login"))&&(
                role==="student"?
                  <Input label="Clave de Acceso" placeholder="Ej: Maria.GH3A482" value={form.key} onChange={v=>setForm(f=>({...f,key:v}))} mono/>
                  :<><Input label="Correo Electrónico" placeholder="correo@ejemplo.com" value={form.email} onChange={v=>setForm(f=>({...f,email:v}))} type="email"/>
                  <Input label="Contraseña" placeholder="••••••••" value={form.password} onChange={v=>setForm(f=>({...f,password:v}))} type="password"/></>
              )}
              {err&&<div style={{background:`${C.red}12`,borderRadius:10,padding:"10px 14px",color:C.red,fontSize:14,marginBottom:10,fontFamily:SF}}>{err}</div>}
              <Btn onPress={submit} full size="lg" style={{marginTop:4}}>
                {mode==="login"||role==="developer"||role==="teacher"?"Ingresar":"Crear Cuenta"}
              </Btn>
            </div>
            <button onClick={()=>go(()=>setStep("roleSelect"))} style={{background:"none",border:"none",color:C.blue,fontSize:17,cursor:"pointer",padding:"14px 0 0",display:"block",width:"100%",textAlign:"center",fontFamily:SF}}>← Cambiar perfil</button>
          </div>
        )}

        {step==="key"&&(
          <div style={{textAlign:"center"}}>
            {/* Student info card */}
            {newStudentData&&(
              <div style={{background:`${C.blue}08`,border:`1.5px solid ${C.blue}20`,borderRadius:16,padding:20,marginBottom:16,textAlign:"left"}}>
                <div style={{fontSize:12,fontWeight:700,color:C.blue,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:12,fontFamily:SF}}>👤 Datos del Alumno</div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:13,color:C.lbl2,fontFamily:SF}}>Nombre</span>
                    <span style={{fontSize:14,fontWeight:600,color:C.lbl,fontFamily:SF}}>{newStudentData.name}</span>
                  </div>
                  <div style={{height:"0.5px",background:C.sep}}/>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:13,color:C.lbl2,fontFamily:SF}}>Grado</span>
                    <span style={{fontSize:14,fontWeight:600,color:C.lbl,fontFamily:SF}}>{newStudentData.grade}° grado</span>
                  </div>
                  <div style={{height:"0.5px",background:C.sep}}/>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:13,color:C.lbl2,fontFamily:SF}}>Grupo</span>
                    <span style={{fontSize:14,fontWeight:600,color:C.lbl,fontFamily:SF}}>{newStudentData.group}</span>
                  </div>
                </div>
              </div>
            )}
            <div style={{background:"#F0FFF4",border:`1.5px solid ${C.green}40`,borderRadius:16,padding:24,marginBottom:20}}>
              <div style={{fontSize:12,fontWeight:600,color:C.green,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:12,fontFamily:SF}}>🔑 Clave de Acceso</div>
              <div style={{fontFamily:"'SF Mono','Menlo',monospace",fontSize:22,fontWeight:700,color:"#14532D",letterSpacing:"0.04em",marginBottom:16}}>{genKeyVal}</div>
              <button onClick={()=>{navigator.clipboard?.writeText(genKeyVal);setCopied(true);setTimeout(()=>setCopied(false),2000);}}
                style={{display:"inline-flex",alignItems:"center",gap:6,padding:"8px 18px",borderRadius:20,
                  background:copied?C.green:"#fff",border:`1.5px solid ${C.green}50`,color:copied?"#fff":C.green,
                  fontSize:14,fontWeight:600,cursor:"pointer",transition:"all 0.2s",fontFamily:SF}}>
                {copied?"✓ Copiado":"Copiar Clave"}
              </button>
              <div style={{fontSize:12,color:C.green,marginTop:12,lineHeight:1.6,fontFamily:SF}}>
                ⚠️ Usa esta clave para ingresar.<br/>Guárdala en un lugar seguro.
              </div>
            </div>
            <Btn onPress={async()=>{
              if(!newStudentData)return;
              const techEmail=`${genKeyVal.toLowerCase().replace(/[^a-z0-9]/g,"")}@school.app`;
              const techPass=`pwd_${genKeyVal}_secure`;
              try { await signInWithEmailAndPassword(auth,techEmail,techPass); }
              catch { try { await createUserWithEmailAndPassword(auth,techEmail,techPass); } catch {} }
              onLogin("student",newStudentData.id);
            }} full size="lg">Entrar al Sistema →</Btn>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── FIREBASE DB HELPERS ──────────────────────────────────────────────────────
const fbAdd = (col, data) => addDoc(collection(db, col), { ...data, _createdAt: serverTimestamp() });
const fbUpdate = (col, id, data) => updateDoc(doc(db, col, String(id)), data);
const fbDelete = (col, id) => deleteDoc(doc(db, col, String(id)));
const fbListen = (col, cb, field=null) => {
  const q = field ? query(collection(db, col), orderBy(field, "desc")) : collection(db, col);
  return onSnapshot(q, snap => cb(snap.docs.map(d => ({ ...d.data(), id: d.id }))));
};

// ─── AI FLOATING BUTTON ───────────────────────────────────────────────────────
const AIButton = ({ role, state }) => {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([{ role:"assistant", text:"¡Hola! Soy tu asistente escolar con IA. ¿En qué puedo ayudarte?" }]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef();

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [msgs]);

  const send = async () => {
    if (!input.trim() || thinking) return;
    const userMsg = input.trim();
    setMsgs(m => [...m, { role:"user", text:userMsg }]);
    setInput(""); setThinking(true);
    const context = `Eres un asistente escolar inteligente. Contexto actual:
- Rol del usuario: ${role}
- Alumnos: ${state.students?.length || 0}
- Docentes: ${state.teachers?.length || 0}
- Grupos: ${state.groups?.length || 0}
- Publicaciones: ${state.posts?.length || 0}
- Contenido pendiente de aprobación: ${state.pendingContent?.length || 0}
Responde siempre en español, de forma concisa y útil para el contexto escolar.`;
    try {
      const GEMINI_KEY = import.meta.env.VITE_GEMINI_KEY;
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: context }] },
            contents: [{ role: "user", parts: [{ text: userMsg }] }]
          })
        }
      );
      const data = await res.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "No pude generar una respuesta.";
      setMsgs(m => [...m, { role:"assistant", text:reply }]);
    } catch {
      setMsgs(m => [...m, { role:"assistant", text:"Error de conexión. Verifica tu API Key de Gemini." }]);
    } finally { setThinking(false); }
  };

  const roleColor = { director:C.indigo, teacher:C.blue, student:C.green, developer:"#1a1a2e" }[role] || C.blue;

  return (
    <>
      {open && (
        <div style={{ position:"fixed", inset:0, zIndex:800, display:"flex", flexDirection:"column",
          background:"rgba(0,0,0,0.45)", backdropFilter:"blur(6px)" }}>
          <div style={{ flex:1 }} onClick={() => setOpen(false)} />
          <div style={{ background:"#fff", borderRadius:"20px 20px 0 0", maxHeight:"80vh",
            display:"flex", flexDirection:"column", animation:"slideUp 0.3s ease" }}>
            <div style={{ background:`linear-gradient(135deg,${roleColor},${roleColor}cc)`,
              padding:"16px 18px", borderRadius:"20px 20px 0 0",
              display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <div style={{ fontSize:16, fontWeight:700, color:"#fff", fontFamily:SF }}>✨ Asistente IA Escolar</div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,0.75)", fontFamily:SF }}>Powered by Gemini</div>
              </div>
              <button onClick={() => setOpen(false)}
                style={{ background:"rgba(255,255,255,0.2)", border:"none", borderRadius:"50%",
                  width:30, height:30, cursor:"pointer", color:"#fff", fontSize:16,
                  display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
            </div>
            <div style={{ flex:1, overflowY:"auto", padding:"14px 16px", display:"flex",
              flexDirection:"column", gap:10, maxHeight:"55vh" }}>
              {msgs.map((m, i) => (
                <div key={i} style={{ display:"flex", justifyContent:m.role==="user"?"flex-end":"flex-start" }}>
                  <div style={{
                    maxWidth:"82%", padding:"10px 14px", borderRadius:m.role==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px",
                    background:m.role==="user"?roleColor:C.fill4,
                    color:m.role==="user"?"#fff":C.lbl,
                    fontSize:14, fontFamily:SF, lineHeight:1.55
                  }}>{m.text}</div>
                </div>
              ))}
              {thinking && (
                <div style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 0" }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background:roleColor, animation:"mascotBob 0.8s ease infinite" }}/>
                  <div style={{ width:8, height:8, borderRadius:"50%", background:roleColor, animation:"mascotBob 0.8s 0.15s ease infinite" }}/>
                  <div style={{ width:8, height:8, borderRadius:"50%", background:roleColor, animation:"mascotBob 0.8s 0.3s ease infinite" }}/>
                </div>
              )}
              <div ref={bottomRef}/>
            </div>
            <div style={{ padding:"12px 16px 24px", borderTop:`0.5px solid ${C.sep}`,
              display:"flex", gap:10, alignItems:"center" }}>
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key==="Enter" && send()}
                placeholder="Pregunta algo…"
                style={{ flex:1, background:C.fill4, border:"none", borderRadius:22,
                  padding:"10px 16px", fontSize:15, fontFamily:SF, outline:"none", color:C.lbl }} />
              <button onClick={send} disabled={!input.trim() || thinking}
                style={{ width:38, height:38, borderRadius:"50%", background:roleColor,
                  border:"none", cursor:"pointer", color:"#fff", fontSize:18,
                  opacity:!input.trim()||thinking?0.4:1, flexShrink:0,
                  display:"flex", alignItems:"center", justifyContent:"center" }}>➤</button>
            </div>
          </div>
        </div>
      )}
      <button onClick={() => setOpen(true)}
        style={{ position:"fixed", bottom:88, right:18, zIndex:700,
          width:52, height:52, borderRadius:"50%",
          background:`linear-gradient(135deg,${roleColor},${roleColor}cc)`,
          border:"none", cursor:"pointer", boxShadow:"0 4px 20px rgba(0,0,0,0.25)",
          display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>
        ✨
      </button>
    </>
  );
};

// ─── HOLIDAY THEME INJECTOR ───────────────────────────────────────────────────
const HolidayThemeInjector = () => {
  const ht = useHolidayTheme();
  const floatingDecos = ht.decorations?.length > 0;
  return (
    <>
      <style>{`
        body { background: ${ht.bg} !important; transition: background 0.6s; }
        ${ht.css || ""}
      `}</style>
      {floatingDecos && (
        <div style={{position:"fixed",top:0,left:0,width:"100%",height:"100%",pointerEvents:"none",zIndex:0,overflow:"hidden"}}>
          {ht.decorations.map((d,i) => (
            <span key={i} style={{
              position:"absolute",
              left: `${8 + i * 20}%`,
              top: `${5 + (i%3)*25}%`,
              fontSize: `${24 + (i%3)*8}px`,
              opacity: 0.12,
              animation: `floatDecos ${3+i*0.5}s ease-in-out infinite`,
              animationDelay: `${i*0.4}s`,
              userSelect:"none"
            }}>{d}</span>
          ))}
        </div>
      )}
    </>
  );
};

// ─── SIDEBAR NAV (desktop only) ───────────────────────────────────────────────
const SidebarNav = ({ role, state, onLogout }) => {
  const ht = useHolidayTheme();
  const accentMap = { developer:"#1a1a2e", director:C.indigo, teacher:C.blue, student:C.green };
  const accent = accentMap[role] || C.blue;
  const roleLabel = { developer:"Desarrollador", director:"Directora Gómez", teacher:"Maestro(a)", student:"Alumno" }[role];
  const roleIcon = { developer:"⚙️", director:"🏫", teacher:"👩‍🏫", student:"🎒" }[role];
  const tabsByRole = {
    developer: [{id:"teachers",label:"Docentes",icon:"👩‍🏫"},{id:"students",label:"Alumnos",icon:"🎒"},{id:"groups",label:"Grupos",icon:"👥"},{id:"cycles",label:"Ciclos",icon:"🔄"},{id:"temas",label:"Temas",icon:"🎨"},{id:"assign",label:"Asignar",icon:"📋"}],
    director: [{id:"feed",label:"Tablón",icon:"📋"},{id:"management",label:"Gestión",icon:"📊"},{id:"settings",label:"Ajustes",icon:"⚙️"}],
    teacher: [{id:"feed",label:"Tablón",icon:"📋"},{id:"classes",label:"Clases",icon:"📚"},{id:"ai",label:"IA",icon:"🤖"},{id:"settings",label:"Ajustes",icon:"⚙️"}],
    student: [{id:"feed",label:"Tablón",icon:"📋"},{id:"subjects",label:"Materias",icon:"📚"},{id:"medals",label:"Logros",icon:"🏆"},{id:"settings",label:"Ajustes",icon:"⚙️"}],
  };
  const tabs = tabsByRole[role] || [];
  // We can't share tab state from here easily, so the sidebar is decorative + logout only on desktop
  // It shows the logo, user info and a logout button
  return (
    <div className="sidebar" style={{ background: ht.gradient ? undefined : "rgba(255,255,255,0.97)" }}>
      {ht.gradient && <div style={{position:"absolute",inset:0,background:ht.gradient,opacity:0.08,pointerEvents:"none"}}/>}
      {/* Logo */}
      <div style={{ padding:"28px 20px 20px", borderBottom:`1px solid rgba(60,60,67,0.08)` }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:48, height:48, borderRadius:14,
            background:`linear-gradient(145deg,#1a3a6b,#2563eb)`,
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:24, flexShrink:0, boxShadow:"0 4px 14px rgba(37,99,235,0.3)" }}>🏫</div>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:"#000", fontFamily:SFD, lineHeight:1.2 }}>Instituto</div>
            <div style={{ fontSize:15, fontWeight:700, color:"#000", fontFamily:SFD, lineHeight:1.2 }}>Educativo</div>
          </div>
        </div>
      </div>
      {/* User info */}
      <div style={{ padding:"16px 20px", borderBottom:`1px solid rgba(60,60,67,0.08)` }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:38, height:38, borderRadius:12, background:`${accent}18`,
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0 }}>{roleIcon}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:14, fontWeight:600, color:"#000", fontFamily:SF,
              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{roleLabel}</div>
            <div style={{ fontSize:12, color:C.lbl2, fontFamily:SF, marginTop:1 }}>
              {role==="developer"?"Sistema":"Ciclo 2025-2026"}
            </div>
          </div>
        </div>
      </div>
      {/* Nav items */}
      <div style={{ flex:1, padding:"12px 10px", overflowY:"auto" }}>
        {tabs.map(t => (
          <div key={t.id} style={{
            display:"flex", alignItems:"center", gap:12, padding:"10px 14px",
            borderRadius:12, marginBottom:2, cursor:"default",
            background:"transparent", transition:"background 0.15s"
          }}
          onMouseEnter={e=>e.currentTarget.style.background=C.fill4}
          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <span style={{fontSize:18,width:28,textAlign:"center"}}>{t.icon}</span>
            <span style={{fontSize:14,fontWeight:500,color:C.lbl,fontFamily:SF}}>{t.label}</span>
          </div>
        ))}
      </div>
      {/* Logout */}
      <div style={{ padding:"16px 20px", borderTop:`1px solid rgba(60,60,67,0.08)` }}>
        <button onClick={()=>{SFX.play("click");onLogout();}}
          style={{ width:"100%", background:`${C.red}12`, border:`1px solid ${C.red}20`,
            borderRadius:12, padding:"11px 16px", color:C.red, fontSize:14,
            fontWeight:600, cursor:"pointer", fontFamily:SF,
            display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
          🚪 Cerrar Sesión
        </button>
      </div>
    </div>
  );
};

// ─── NOTIFICATION TOAST LAYER ─────────────────────────────────────────────────
const NotifToast = ({ n, onDismiss }) => {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const startY = useRef(null);
  const ref = useRef();

  const dismiss = () => {
    setDismissed(true);
    setTimeout(onDismiss, 280);
  };

  const onTouchStart = (e) => { startY.current = e.touches[0].clientY; setDragging(true); };
  const onTouchMove = (e) => {
    if (startY.current == null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy < 0) setOffset(dy);
  };
  const onTouchEnd = () => {
    setDragging(false);
    if (offset < -40) { dismiss(); } else { setOffset(0); }
    startY.current = null;
  };

  return (
    <div ref={ref}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      onClick={dismiss}
      style={{
        background:n.urgent?"linear-gradient(135deg,#FF3B30,#FF6B35)":"linear-gradient(135deg,#1c1c1e,#2c2c2e)",
        color:"#fff",borderRadius:16,padding:"12px 16px",
        boxShadow:"0 8px 32px rgba(0,0,0,0.35)",
        display:"flex",alignItems:"flex-start",gap:10,
        backdropFilter:"blur(20px)",cursor:"pointer",
        transform:`translateY(${offset}px)`,
        opacity: dismissed ? 0 : offset < -20 ? 1 - Math.abs(offset+20)/60 : 1,
        transition: dragging ? "opacity 0.1s" : "transform 0.3s cubic-bezier(0.34,1.56,0.64,1), opacity 0.28s ease",
        animation: dismissed ? "notifSlideOut 0.28s ease forwards" : "notifSlideIn 0.35s cubic-bezier(0.34,1.56,0.64,1)",
      }}>
      <span style={{fontSize:20,flexShrink:0}}>{n.urgent?"🚨":n.icon||"🔔"}</span>
      <div style={{flex:1}}>
        {n.title&&<div style={{fontWeight:700,fontSize:13,fontFamily:"-apple-system,sans-serif",marginBottom:2}}>{n.title}</div>}
        <div style={{fontSize:12,fontFamily:"-apple-system,sans-serif",opacity:0.85,lineHeight:1.4}}>{n.text}</div>
      </div>
      <div style={{fontSize:11,color:"rgba(255,255,255,0.45)",fontFamily:"-apple-system,sans-serif",flexShrink:0,paddingTop:2}}>✕</div>
    </div>
  );
};
const NotifToastLayer = () => {
  const notifs = useNotifications();
  const [dismissed, setDismissed] = useState(new Set());
  const visible = notifs.filter(n => !dismissed.has(n.id));
  if (visible.length === 0) return null;
  return (
    <div className="notif-layer">
      {visible.map(n => (
        <NotifToast key={n.id} n={n} onDismiss={()=>setDismissed(s=>new Set([...s,n.id]))}/>
      ))}
    </div>
  );
};

// ─── WHATSAPP NOTIFICATION HELPER ─────────────────────────────────────────────
const WaNotify = ({ phone, message, label = "Notificar por WhatsApp" }) => {
  if (!phone) return null;
  const clean = phone.replace(/[^0-9]/g,"");
  const url = `https://wa.me/52${clean}?text=${encodeURIComponent(message)}`;
  return (
    <a href={url} target="_blank" rel="noreferrer"
      onClick={() => SFX.play("click")}
      style={{
        display:"inline-flex",alignItems:"center",gap:7,
        background:"linear-gradient(135deg,#25D366,#128C7E)",
        color:"#fff",borderRadius:10,padding:"8px 14px",
        fontSize:13,fontWeight:600,fontFamily:"-apple-system,sans-serif",
        textDecoration:"none",cursor:"pointer",flexShrink:0
      }}>
      <span style={{fontSize:16}}>📱</span> {label}
    </a>
  );
};

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App(){
  // Restore role/userId from localStorage so refresh keeps the user logged in
  const [screen,setScreen]=useState("loading");
  const [role,setRole]=useState(()=>localStorage.getItem("lms_role")||null);
  const [userId,setUserId]=useState(()=>{
    const v=localStorage.getItem("lms_userId");
    return v?isNaN(Number(v))?v:Number(v):null;
  });
  const [state,setState]=useState(initialState);
  const [dbReady,setDbReady]=useState(false);
  const unsubs = useRef([]);
  // Track how many critical collections have fired their first snapshot
  const loadedCols = useRef(new Set());
  const CRITICAL_COLS = ["students","teachers","groups","posts","cycles"];

  const markLoaded = (key) => {
    loadedCols.current.add(key);
    if(CRITICAL_COLS.every(k => loadedCols.current.has(k))) setDbReady(true);
  };

  // ── Load all Firebase collections ────────────────────────────────────────
  useEffect(() => {
    const loadAll = () => {
      const listen = (col, key, field=null) => {
        const q = field ? query(collection(db, col), orderBy(field,"desc")) : collection(db, col);
        let first = true;
        return onSnapshot(q, snap => {
          const incoming = snap.docs.map(d => ({ ...d.data(), id: d.id }));
          setState(prev => {
            // For content collections, preserve local submissions that Firestore hasn't committed yet
            // (avoids the race condition where snapshot fires before write confirms)
            const isContent = key === "approvedContent" || key === "pendingContent";
            if(isContent){
              const prevArr = prev[key] || [];
              const merged = incoming.map(item => {
                const prevItem = prevArr.find(p => String(p.id) === String(item.id));
                // Keep local submission array if it's LONGER (means local write is fresher)
                if(prevItem && (prevItem.submissions||[]).length > (item.submissions||[]).length){
                  return {...item, submissions: prevItem.submissions};
                }
                return item;
              });
              return { ...prev, [key]: merged };
            }
            return { ...prev, [key]: incoming };
          });
          if(first){ first=false; markLoaded(key); }
        });
      };

      unsubs.current = [
        listen("students",   "students",  "name"),
        listen("teachers",   "teachers",  "name"),
        listen("groups",     "groups"),
        listen("posts",      "posts",     "_createdAt"),
        listen("cycles",     "cycles"),
        listen("avisos",     "avisos",    "_createdAt"),
        listen("actividades","actividades"),
        listen("pendingContent","pendingContent"),
        listen("approvedContent","approvedContent"),
      ];

      // TeacherAttendance as map
      const q2 = collection(db, "teacherAttendance");
      const unsub2 = onSnapshot(q2, snap => {
        const map = {};
        snap.docs.forEach(d => {
          const data = d.data();
          if (!map[data.date]) map[data.date] = {};
          map[data.date][data.teacherId] = { status: data.status, time: data.time };
        });
        setState(prev => ({ ...prev, teacherAttendance: map }));
      });
      unsubs.current.push(unsub2);

      // ── Chats metadata listener ──────────────────────────────────────
      const unsubChats = onSnapshot(collection(db, "chats"), snap => {
        const chats = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        setState(prev => ({ ...prev, chats }));
      });
      unsubs.current.push(unsubChats);

      // ── Chat messages listener (flat collection, grouped by chatId) ──
      const chatMsgsQ = query(collection(db, "chatMsgs"), orderBy("_createdAt", "asc"));
      const unsubMsgs = onSnapshot(chatMsgsQ, snap => {
        const map = {};
        snap.docs.forEach(d => {
          const data = { ...d.data(), id: d.id };
          const cid = data.chatId;
          if (!cid) return;
          if (!map[cid]) map[cid] = [];
          map[cid].push(data);
        });
        setState(prev => ({ ...prev, chatMessages: map }));
      });
      unsubs.current.push(unsubMsgs);
    };

    // Check if Firebase has data, if not seed it
    getDocs(collection(db, "students")).then(snap => {
      if (snap.empty) {
        // Seed initial data
        const batch = writeBatch(db);
        // Use original numeric IDs as Firestore doc IDs so group.subjects[].teacherId matches teacher.id
        for (const s of initialState.students) {
          const ref = doc(db, "students", String(s.id));
          batch.set(ref, { name:s.name, group:s.group, grade:s.grade, section:s.section,
            parentEmail:s.parentEmail, parentContact:s.parentContact, key:s.key,
            avatar:s.avatar, color:s.color, participation:s.participation||0,
            tabBoardLikes:s.tabBoardLikes||0, attendance:s.attendance||[], subjects:s.subjects||{} });
        }
        for (const t of initialState.teachers) {
          const ref = doc(db, "teachers", String(t.id));
          batch.set(ref, { name:t.name, email:t.email, contact:t.contact,
            subjects:t.subjects||[], groups:t.groups||[], key:t.key, avatar:t.avatar, color:t.color });
        }
        for (const g of initialState.groups) {
          const ref = doc(db, "groups", String(g.id));
          batch.set(ref, { name:g.name, grade:g.grade, section:g.section,
            subject:g.subject||"", subjects:g.subjects||[], students:g.students||[] });
        }
        for (const p of initialState.posts) {
          const ref = doc(collection(db, "posts"));
          batch.set(ref, { authorName:p.authorName, authorRole:p.authorRole,
            avatar:p.avatar, avatarColor:p.avatarColor, title:p.title, body:p.body,
            type:p.type, likes:p.likes||[], comments:p.comments||[], time:p.time });
        }
        const cycRef = doc(collection(db, "cycles"));
        batch.set(cycRef, { name:"2025–2026", active:true });
        batch.commit().then(loadAll);
      } else {
        loadAll();
      }
    });

    return () => unsubs.current.forEach(u => u());
  }, []);

  // ── Auth state ────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      if(user){
        // Firebase auth active — stay in app if role is stored
        const storedRole=localStorage.getItem("lms_role");
        if(storedRole) setScreen("app");
        else setScreen("login");
      } else {
        // No Firebase auth — check if we have a stored role (key-based login)
        const storedRole=localStorage.getItem("lms_role");
        if(storedRole) setScreen("app");
        else setScreen("login");
      }
    });
    // Fallback timeout
    setTimeout(() => setScreen(prev => prev === "loading" ? "login" : prev), 1500);
    return () => unsub();
  }, []);

  // ── Firebase-aware setState ───────────────────────────────────────────────
  // Posts
  const fbSetState = useCallback((updater) => {
    setState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      // Sync posts to Firebase
      if (next.posts !== prev.posts) {
        const added = next.posts.filter(p => !prev.posts.find(pp => pp.id === p.id));
        const updated = next.posts.filter(p => {
          const old = prev.posts.find(pp => pp.id === p.id);
          return old && (old.likes !== p.likes || old.comments !== p.comments);
        });
        added.forEach(p => { if (!p._fbSynced) {
          addDoc(collection(db, "posts"), { ...p, _createdAt: serverTimestamp() });
        }});
        updated.forEach(p => { if (p.id && typeof p.id === "string") {
          updateDoc(doc(db, "posts", p.id), { likes: p.likes, comments: p.comments });
        }});
      }
      // Sync attendance and student subjects and all grade fields
      if (next.students !== prev.students) {
        next.students.forEach(s => {
          const old = prev.students.find(ps => ps.id === s.id);
          if (old && typeof s.id === "string") {
            const changed = JSON.stringify(s) !== JSON.stringify(old);
            if (changed) {
              // Collect all changed fields (parciales, finals, attendance, participation, etc.)
              const updates = {};
              if (s.attendance !== old.attendance) { updates.attendance = s.attendance; updates.subjects = s.subjects||{}; updates.participation = s.participation||0; }
              if (s.participation !== old.participation) updates.participation = s.participation||0;
              if (s.photo !== old.photo && s.photo) updates.photo = s.photo;
              if (s.name !== old.name) updates.name = s.name;
              if (s.group !== old.group) updates.group = s.group;
              // Sync any parcial_N_Subject or final_Subject fields
              Object.keys(s).forEach(k => {
                if ((k.startsWith('parcial_') || k.startsWith('final_')) && s[k] !== old[k]) {
                  updates[k] = s[k];
                }
              });
              if (Object.keys(updates).length > 0) {
                updateDoc(doc(db, "students", s.id), updates).catch(()=>{});
              }
            }
          }
        });
      }
      // Sync approvedContent: save newly approved items to Firestore, and sync submission updates
      if (next.approvedContent !== prev.approvedContent) {
        const added = next.approvedContent.filter(c => !prev.approvedContent.find(pc => String(pc.id)===String(c.id)));
        added.forEach(c => {
          if (c.id && typeof c.id === "string") return; // already a Firestore doc
          const {id:_id,...data} = c;
          addDoc(collection(db,"approvedContent"),{...data,_createdAt:serverTimestamp()}).catch(()=>{});
        });
        // Sync submission changes back to Firestore
        next.approvedContent.forEach(c => {
          const old = prev.approvedContent.find(pc => String(pc.id)===String(c.id));
          if (old && c.submissions !== old.submissions && c.id && typeof c.id === "string") {
            updateDoc(doc(db,"approvedContent",c.id), {submissions: c.submissions||[]}).catch(()=>{});
          }
        });
        // Remove items from pendingContent in Firestore when approved
        if (next.pendingContent !== prev.pendingContent) {
          const removed = prev.pendingContent.filter(c => !next.pendingContent.find(pc => String(pc.id)===String(c.id)));
          removed.forEach(c => {
            if (c.id && typeof c.id === "string") {
              import("firebase/firestore").then(({deleteDoc,doc:fdoc})=>deleteDoc(fdoc(db,"pendingContent",c.id))).catch(()=>{});
            }
          });
        }
      }
      // Sync groups subjects
      if (next.groups !== prev.groups) {
        next.groups.forEach(g => {
          const old = prev.groups.find(pg => pg.id === g.id);
          if (old && g.subjects !== old.subjects && typeof g.id === "string") {
            updateDoc(doc(db, "groups", g.id), { subjects: g.subjects||[], students: g.students||[] }).catch(()=>{});
          }
        });
      }
      return next;
    });
  }, []);

  const login=(r,id)=>{
    SFX.play("login");
    setRole(r);setUserId(id);setScreen("app");
    localStorage.setItem("lms_role",r);
    localStorage.setItem("lms_userId",id!=null?String(id):"");
  };
  const logout=()=>{
    setRole(null);setUserId(null);setScreen("login");
    localStorage.removeItem("lms_role");
    localStorage.removeItem("lms_userId");
    signOut(auth).catch(()=>{});
  };

  if (screen === "loading" || (screen === "app" && !dbReady)) return (
    <BpProvider>
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
        background:C.bg2, flexDirection:"column", gap:16 }}>
        <div style={{ fontSize:48 }}>🎓</div>
        <div style={{ fontSize:17, fontWeight:600, color:C.lbl2, fontFamily:SF }}>
          {screen==="app" && !dbReady ? "Sincronizando datos…" : "Cargando SchoolLMS…"}
        </div>
        <div style={{display:"flex",gap:6,marginTop:4}}>
          {["students","teachers","groups","posts","cycles"].map(k=>(
            <div key={k} style={{width:8,height:8,borderRadius:"50%",
              background:loadedCols.current.has(k)?C.green:C.g4,
              transition:"background 0.3s"}}/>
          ))}
        </div>
      </div>
    </BpProvider>
  );

  return(
    <BpProvider>
      <HolidayThemeInjector/>
      <NotifToastLayer/>
      <style>{`
        /* ── RESET ─────────────────────────────────────────── */
        *{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased;}
        html{font-size:16px;}
        body{background:#F2F2F7;-webkit-text-size-adjust:100%;overflow-x:hidden;}
        input,textarea,select{-webkit-appearance:none;appearance:none;font-family:inherit;}
        button{-webkit-tap-highlight-color:transparent;cursor:pointer;font-family:inherit;}
        img{max-width:100%;display:block;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.14);border-radius:4px;}

        /* ── CSS VARIABLES — mobile first ──────────────────── */
        :root{
          --sp:12px;
          --sp-sm:8px;
          --sp-xs:6px;
          --radius:12px;
          --radius-sm:8px;
          --fs-title:20px;
          --fs-head:16px;
          --fs-body:14px;
          --fs-sub:12px;
          --fs-cap:11px;
          --fs-xs:10px;
          --tab-h:56px;
          --nav-h:50px;
          --card-cols:1;
          --avatar-lg:56px;
          --avatar-md:38px;
          --avatar-sm:30px;
          --page-pb:calc(var(--tab-h) + 16px);
        }
        @media(min-width:480px){
          :root{
            --sp:16px;
            --sp-sm:10px;
            --fs-title:22px;
            --fs-head:17px;
            --fs-body:15px;
            --fs-sub:13px;
            --fs-cap:12px;
            --fs-xs:11px;
            --avatar-lg:64px;
            --avatar-md:42px;
          }
        }
        @media(min-width:640px){
          :root{
            --sp:20px;
            --sp-sm:12px;
            --fs-title:24px;
            --fs-head:18px;
            --fs-body:16px;
            --fs-sub:14px;
            --fs-cap:13px;
            --fs-xs:12px;
            --tab-h:62px;
            --card-cols:2;
            --avatar-lg:72px;
            --avatar-md:46px;
            --avatar-sm:36px;
          }
        }
        @media(min-width:1024px){
          :root{
            --sp:24px;
            --sp-sm:14px;
            --fs-title:28px;
            --fs-head:20px;
            --fs-body:16px;
            --fs-sub:14px;
            --fs-cap:13px;
            --fs-xs:12px;
            --tab-h:0px;
            --nav-h:60px;
            --card-cols:2;
            --avatar-lg:80px;
            --avatar-md:50px;
            --page-pb:var(--sp);
          }
        }

        /* ── LAYOUT SHELL ───────────────────────────────────── */
        .app-shell{ width:100%; min-height:100vh; }
        .main-area{ min-width:0; }

        /* ── BOTTOM TAB BAR ─────────────────────────────────── */
        .tab-bar-bottom{
          display:flex; position:fixed;
          bottom:0; left:0; right:0; z-index:300;
          background:rgba(249,249,249,0.95);
          backdrop-filter:blur(20px);
          -webkit-backdrop-filter:blur(20px);
          border-top:0.5px solid rgba(60,60,67,0.13);
          padding:6px 0 max(8px,env(safe-area-inset-bottom));
        }

        /* ── NAV BAR ─────────────────────────────────────────── */
        .navbar{
          position:sticky; top:0; z-index:200;
          padding:0 var(--sp);
          min-height:var(--nav-h);
          display:flex; flex-direction:column; justify-content:center;
        }

        /* ── CARDS GRID ─────────────────────────────────────── */
        .cards-grid{
          display:grid; grid-template-columns:1fr; gap:10px;
        }
        @media(min-width:480px){ .cards-grid{gap:12px;} }
        @media(min-width:640px){ .cards-grid{grid-template-columns:repeat(2,1fr);gap:14px;} }
        @media(min-width:1024px){ .cards-grid{grid-template-columns:repeat(3,1fr);gap:16px;} }

        /* ── STATS ROW ───────────────────────────────────────── */
        .stats-row{ display:grid; grid-template-columns:repeat(3,1fr); gap:6px; }
        @media(min-width:480px){ .stats-row{gap:8px;} }
        @media(min-width:640px){ .stats-row{gap:12px;} }
        @media(min-width:1024px){ .stats-row{grid-template-columns:repeat(6,1fr);gap:14px;} }

        /* ── FEED LAYOUT ─────────────────────────────────────── */
        @media(min-width:1024px){
          .feed-layout{ display:grid; grid-template-columns:1fr 320px; gap:20px; align-items:start; }
          .feed-sidebar-panel{ position:sticky; top:calc(var(--nav-h) + 16px); }
        }

        /* ── PAGE PADDING ────────────────────────────────────── */
        .page-pad{
          padding:var(--sp-sm) var(--sp) calc(24px + env(safe-area-inset-bottom,0px));
        }
        @media(min-width:640px){
          .page-pad{ padding:var(--sp) var(--sp) var(--sp); }
        }

        /* ── MODAL RESPONSIVE ────────────────────────────────── */
        .modal-sheet{
          position:fixed;inset:0;z-index:500;
          display:flex;align-items:flex-end;justify-content:center;
          background:rgba(0,0,0,0.45);backdrop-filter:blur(4px);
          padding:0 0 env(safe-area-inset-bottom);
        }
        .modal-body{
          background:#fff; border-radius:20px 20px 0 0;
          width:100%; max-height:92vh; overflow:auto;
          padding:0 0 24px;
          animation:slideUp 0.28s cubic-bezier(0.34,1.56,0.64,1);
        }
        @media(min-width:640px){
          .modal-sheet{ align-items:center; padding:16px; }
          .modal-body{ border-radius:20px; max-width:540px; max-height:86vh; animation:fadeUp 0.22s ease; }
        }
        @media(min-width:1024px){
          .modal-body{ max-width:620px; }
        }

        /* ── FONT SCALING ────────────────────────────────────── */
        .fs-title{ font-size:var(--fs-title) !important; }
        .fs-head{ font-size:var(--fs-head) !important; }
        .fs-body{ font-size:var(--fs-body) !important; }
        .fs-sub{ font-size:var(--fs-sub) !important; }
        .fs-cap{ font-size:var(--fs-cap) !important; }
        .fs-xs{ font-size:var(--fs-xs) !important; }

        /* ── LOGIN PAGE ──────────────────────────────────────── */
        .login-wrap{
          min-height:100vh; display:flex; flex-direction:column;
          align-items:center; justify-content:center;
          padding:20px var(--sp);
        }
        .login-card{ width:100%; max-width:400px; }
        @media(min-width:640px){ .login-card{ max-width:460px; } }
        @media(min-width:1024px){
          .login-wrap{ background:linear-gradient(135deg,#f0f4ff,#f5f0ff); }
          .login-card{
            background:#fff; border-radius:24px; padding:40px;
            box-shadow:0 20px 60px rgba(0,0,0,0.12); max-width:460px;
          }
        }

        /* ── NOTIF TOAST ─────────────────────────────────────── */
        .notif-layer{
          position:fixed; top:12px; right:12px; z-index:9999;
          display:flex; flex-direction:column; gap:8px;
          max-width:min(320px,calc(100vw - 24px));
        }
        @media(min-width:640px){ .notif-layer{ top:16px; right:16px; max-width:340px; } }

        /* ── DEVELOPER PANEL TABS ────────────────────────────── */
        .dev-tabs{
          display:flex; gap:0; padding:0 var(--sp);
          border-top:1px solid rgba(255,255,255,0.1);
          overflow-x:auto; scrollbar-width:none; -ms-overflow-style:none;
        }
        .dev-tabs::-webkit-scrollbar{ display:none; }

        /* ── SCHOOL MAP ──────────────────────────────────────── */
        .school-map-svg{ width:100%; display:block; background:#F8F9FC; }
        @media(min-width:640px){ .school-map-svg{ min-height:280px; } }
        @media(min-width:1024px){ .school-map-svg{ min-height:360px; } }

        /* ── SECTION HEADING ─────────────────────────────────── */
        .sec-title{
          font-size:var(--fs-xs); font-weight:600; text-transform:uppercase;
          letter-spacing:0.05em; color:rgba(60,60,67,0.6);
          padding-left:var(--sp); margin-bottom:6px;
        }

        /* ── SIDEBAR LAYOUT ──────────────────────────────────── */
        /* Mobile: column (top bar + content below) */
        .app-layout{ display:flex; flex-direction:column; min-height:100vh; }
        /* Tablet+: row (sidebar left + content right) */
        @media(min-width:640px){
          .app-layout{ flex-direction:row; }
        }
        /* Horizontal tab scroll (mobile nav) */
        .app-layout > div:first-child::-webkit-scrollbar{ display:none; }

        /* ── SAFE AREA PADDING ───────────────────────────────── */
        @supports(padding-bottom:env(safe-area-inset-bottom)){
          .page-pad{ padding-bottom:max(var(--page-pb),calc(env(safe-area-inset-bottom) + 16px)); }
        }

        /* ── ANIMATIONS ──────────────────────────────────────── */
        @keyframes mascotBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        @keyframes scanLine{0%{top:0;opacity:1}100%{top:100%;opacity:0.1}}
        @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes notifSlideIn{from{transform:translateX(120%);opacity:0}to{transform:translateX(0);opacity:1}}
        @keyframes notifSlideOut{from{transform:translateY(0);opacity:1}to{transform:translateY(-60px);opacity:0}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        @keyframes floatDecos{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-15px) rotate(10deg)}}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
      {screen==="login"&&<Login state={state} onLogin={login}/>}
      {screen==="app"&&(
        <>
          {role==="developer"&&<DeveloperApp state={state} setState={fbSetState} onLogout={logout}/>}
          {role==="director"&&<DirectorApp state={state} setState={fbSetState} onLogout={logout}/>}
          {role==="teacher"&&<TeacherApp state={state} setState={fbSetState} teacherId={userId||1} onLogout={logout}/>}
          {role==="student"&&<StudentApp state={state} setState={fbSetState} studentId={userId||1} onLogout={logout}/>}
          {role&&<AIButton role={role} state={state}/>}
        </>
      )}
    </BpProvider>
  );
}
