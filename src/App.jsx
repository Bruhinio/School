import { useState, useEffect, useRef, useCallback } from "react";
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
    {id:1,name:"3°A",grade:3,section:"A",teacherId:1,subject:"Matemáticas",students:[1,2]},
    {id:2,name:"3°B",grade:3,section:"B",teacherId:1,subject:"Matemáticas",students:[3]},
    {id:3,name:"2°A",grade:2,section:"A",teacherId:2,subject:"Ciencias",students:[]},
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
  "Matemáticas": { emoji:"🦉", name:"Búho Euler", color:C.blue,
    frames:["M10,20 Q12,14 14,20 Q16,14 18,20","M10,18 Q12,22 14,18 Q16,22 18,18"] },
  "Ciencias":    { emoji:"🐸", name:"Rana Darwin", color:C.green,
    frames:["M8,20 Q12,12 16,20","M8,16 Q12,24 16,16"] },
  "Historia":    { emoji:"🦊", name:"Zorro Clío", color:C.orange,
    frames:["M9,20 Q12,15 15,20","M9,17 Q12,21 15,17"] },
  "Español":     { emoji:"🦋", name:"Mariposa Sílaba", color:C.purple,
    frames:["M8,12 Q12,6 16,12 Q12,18 8,12","M8,14 Q12,8 16,14 Q12,20 8,14"] },
  "Arte":        { emoji:"🐙", name:"Pulpo Picasso", color:C.pink,
    frames:["M12,8 Q8,14 10,20","M12,8 Q16,14 14,20"] },
};

// ─── MASCOT SVG WITH INTEGRATED ACCESSORIES ───────────────────────────────────
// Each mascot is drawn as SVG (80×80 viewBox) with accessory slots fitted to anatomy
// Fixed 100×120 viewBox — all accessories use this coordinate space.
// Emoji anchor: cx=50, top of head ≈ y=15, eyes ≈ y=42, neck ≈ y=58, bottom ≈ y=90
const MascotSVG=({subject,outfit,size=80})=>{
  const m=MASCOTS[subject]||MASCOTS["Matemáticas"];

  // ── Accessories (all in 100×120 space, cx=50) ─────────────────────────────
  // BIRRETE: rests on top of head (y≈15)
  const Birrete=()=>(
    <g>
      <rect x="28" y="10" width="44" height="8" rx="3" fill="#1a1a2e"/>
      <rect x="34" y="2" width="32" height="9" rx="2" fill="#1a1a2e"/>
      <line x1="63" y1="4" x2="76" y2="14" stroke="#FFD700" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="77" cy="15" r="4" fill="#FFD700"/>
    </g>
  );
  // GAFAS NERD: across eye line (y≈42)
  const GafasNerd=()=>(
    <g>
      <circle cx="37" cy="42" r="9" fill="none" stroke="#222" strokeWidth="2.5"/>
      <circle cx="63" cy="42" r="9" fill="none" stroke="#222" strokeWidth="2.5"/>
      <line x1="46" y1="42" x2="54" y2="42" stroke="#222" strokeWidth="2.5"/>
      <line x1="28" y1="41" x2="22" y2="39" stroke="#222" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="72" y1="41" x2="78" y2="39" stroke="#222" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="37" cy="42" r="6" fill="#E3F2FD" opacity="0.4"/>
      <circle cx="63" cy="42" r="6" fill="#E3F2FD" opacity="0.4"/>
    </g>
  );
  // CAPA HÉROE: below neck (y≈58..90)
  const CapaHeroe=()=>(
    <g>
      <rect x="36" y="56" width="28" height="6" rx="2" fill="#FFD700"/>
      <path d="M36 62 Q30 72 32 90 L50 84 L68 90 Q70 72 64 62 Z" fill="#E53935"/>
      <path d="M36 62 Q43 68 50 65 Q57 68 64 62" fill="#B71C1C" opacity="0.7"/>
    </g>
  );
  // CORONA: on top of head (y≈6..18)
  const Corona=()=>(
    <g>
      <path d="M28 20 L28 8 L38 15 L50 4 L62 15 L72 8 L72 20 Z" fill="#FFD700"/>
      <line x1="28" y1="20" x2="72" y2="20" stroke="#F9A825" strokeWidth="2"/>
      <circle cx="50" cy="5" r="4" fill="#E53935"/>
      <circle cx="28" cy="9" r="3" fill="#4CAF50"/>
      <circle cx="72" cy="9" r="3" fill="#4CAF50"/>
      <circle cx="39" cy="13" r="2.5" fill="#2196F3"/>
      <circle cx="61" cy="13" r="2.5" fill="#2196F3"/>
    </g>
  );
  // GAFAS LAB: across eyes (y≈40), wider goggles
  const GafasLab=()=>(
    <g>
      <rect x="20" y="36" width="60" height="14" rx="6" fill="#4FC3F7" opacity="0.5" stroke="#0277BD" strokeWidth="2"/>
      <line x1="50" y1="36" x2="50" y2="50" stroke="#0277BD" strokeWidth="1.5"/>
      <line x1="20" y1="43" x2="12" y2="41" stroke="#0277BD" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="80" y1="43" x2="88" y2="41" stroke="#0277BD" strokeWidth="2.5" strokeLinecap="round"/>
    </g>
  );
  // BATA BLANCA: lab coat (y≈55..95)
  const BataBlanca=()=>(
    <g>
      <path d="M28 55 L20 95 L80 95 L72 55 Q60 62 50 60 Q40 62 28 55Z" fill="white" stroke="#B0BEC5" strokeWidth="1.5"/>
      <path d="M50 60 L50 95" stroke="#CFD8DC" strokeWidth="1"/>
      <path d="M38 57 L36 75" stroke="#CFD8DC" strokeWidth="1.2"/>
      <path d="M62 57 L64 75" stroke="#CFD8DC" strokeWidth="1.2"/>
      <circle cx="50" cy="70" r="2" fill="#90A4AE"/>
      <circle cx="50" cy="78" r="2" fill="#90A4AE"/>
      <circle cx="50" cy="86" r="2" fill="#90A4AE"/>
    </g>
  );
  // SOMBRERO DE PAJA: wide brim on head
  const SombreroPaja=()=>(
    <g>
      <ellipse cx="50" cy="20" rx="38" ry="7" fill="#F9A825"/>
      <path d="M26 20 Q28 4 50 2 Q72 4 74 20" fill="#F9A825"/>
      <ellipse cx="50" cy="19" rx="24" ry="4" fill="#F57F17" opacity="0.45"/>
      <path d="M30 18 Q50 24 70 18" stroke="#E65100" strokeWidth="1" fill="none" opacity="0.5"/>
    </g>
  );
  // TRAJE ESPACIAL: full helmet around head
  const TrajeEspacial=()=>(
    <g>
      <circle cx="50" cy="38" r="32" fill="#E3F2FD" stroke="#1565C0" strokeWidth="3" opacity="0.88"/>
      <ellipse cx="45" cy="28" rx="10" ry="7" fill="white" opacity="0.45"/>
      <circle cx="50" cy="38" r="32" fill="none" stroke="#90CAF9" strokeWidth="1.5" opacity="0.5"/>
      <rect x="34" y="68" width="32" height="6" rx="3" fill="#B0BEC5"/>
    </g>
  );
  // SOMBRERO VAQUERO
  const SombreroVaquero=()=>(
    <g>
      <ellipse cx="50" cy="22" rx="40" ry="8" fill="#6D4C41"/>
      <path d="M24 22 Q26 4 50 2 Q74 4 76 22" fill="#795548"/>
      <ellipse cx="50" cy="21" rx="22" ry="5" fill="#5D4037" opacity="0.5"/>
      <path d="M26 20 Q50 28 74 20" stroke="#4E342E" strokeWidth="1.5" fill="none"/>
    </g>
  );
  // CASCO ANTIGUO
  const CascoAntiguo=()=>(
    <g>
      <path d="M18 28 Q16 6 50 4 Q84 6 82 28 L82 32 L18 32 Z" fill="#B0BEC5"/>
      <rect x="44" y="4" width="12" height="22" rx="3" fill="#CFD8DC"/>
      <ellipse cx="50" cy="32" rx="32" ry="6" fill="#90A4AE"/>
      <path d="M18 32 L10 50 L20 50 L24 32" fill="#B0BEC5"/>
      <path d="M82 32 L90 50 L80 50 L76 32" fill="#B0BEC5"/>
    </g>
  );
  // LUPA ARQUEÓLOGO: held to side
  const LupaArqueologo=()=>(
    <g>
      <circle cx="68" cy="30" r="18" fill="none" stroke="#37474F" strokeWidth="3"/>
      <circle cx="68" cy="30" r="14" fill="#E3F2FD" opacity="0.55"/>
      <circle cx="63" cy="25" r="4" fill="white" opacity="0.4"/>
      <line x1="54" y1="44" x2="38" y2="62" stroke="#37474F" strokeWidth="4" strokeLinecap="round"/>
    </g>
  );
  // PERGAMINO: held/floating side
  const Pergamino=()=>(
    <g>
      <rect x="62" y="20" width="26" height="38" rx="4" fill="#FFF9C4" stroke="#F9A825" strokeWidth="1.5"/>
      <ellipse cx="75" cy="20" rx="13" ry="4" fill="#FFE082"/>
      <ellipse cx="75" cy="58" rx="13" ry="4" fill="#FFE082"/>
      <line x1="67" y1="29" x2="84" y2="29" stroke="#F9A825" strokeWidth="1.5"/>
      <line x1="67" y1="36" x2="84" y2="36" stroke="#F9A825" strokeWidth="1.5"/>
      <line x1="67" y1="43" x2="80" y2="43" stroke="#F9A825" strokeWidth="1.5"/>
      <line x1="67" y1="50" x2="78" y2="50" stroke="#F9A825" strokeWidth="1.2"/>
    </g>
  );
  // PLUMA ESCRITOR: quill held to side
  const Pluma=()=>(
    <g>
      <path d="M72 8 Q88 20 78 38 Q68 50 60 60" fill="#FFF8E1" stroke="#FFA000" strokeWidth="1.5"/>
      <path d="M72 8 Q62 22 60 60" fill="#FFE082" opacity="0.65"/>
      <path d="M60 60 L56 76" stroke="#5D4037" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M76 12 Q82 18 78 26" stroke="#FFE0B2" strokeWidth="1" fill="none"/>
    </g>
  );
  // SOMBRERO TEATRO: purple hat
  const SombreroTeatro=()=>(
    <g>
      <ellipse cx="50" cy="24" rx="36" ry="7" fill="#6A1B9A"/>
      <path d="M28 24 Q30 6 50 4 Q70 6 72 24" fill="#4A148C"/>
      <ellipse cx="50" cy="23" rx="20" ry="4.5" fill="#7B1FA2" opacity="0.5"/>
      <circle cx="40" cy="14" r="3" fill="#FFD700"/>
      <circle cx="60" cy="14" r="3" fill="#FFD700"/>
      <circle cx="50" cy="10" r="3.5" fill="#FF6F00"/>
    </g>
  );
  // LIBRO MÁGICO: glowing book floating
  const LibroMagico=()=>(
    <g>
      <rect x="60" y="18" width="30" height="38" rx="4" fill="#7B1FA2"/>
      <rect x="62" y="20" width="26" height="34" rx="2" fill="#CE93D8"/>
      <line x1="75" y1="20" x2="75" y2="54" stroke="#7B1FA2" strokeWidth="2"/>
      <path d="M64 29 Q75 23 86 29" stroke="#FFD700" strokeWidth="1.5" fill="none"/>
      <circle cx="75" cy="39" r="5" fill="#FFD700" opacity="0.85"/>
      <path d="M72 37 L75 34 L78 37 L77 41 L73 41 Z" fill="#FFF176"/>
    </g>
  );
  // ESTRELLA AUTOR: shining star above
  const EstrellaAutor=()=>(
    <g>
      <path d="M50 4 L55 16 L68 16 L58 24 L62 37 L50 29 L38 37 L42 24 L32 16 L45 16 Z"
        fill="#FFD700" stroke="#F9A825" strokeWidth="1"/>
      <path d="M50 4 L53 12 L60 12 L54 17 L57 25 L50 20 L43 25 L46 17 L40 12 L47 12 Z"
        fill="#FFF176" opacity="0.6"/>
    </g>
  );

  // Map outfit IDs → component (fixed 100×120 space)
  const outfitMap={
    m1:<Birrete/>, m2:<GafasNerd/>, m3:<CapaHeroe/>, m4:<Corona/>,
    c1:<GafasLab/>, c2:<BataBlanca/>, c3:<SombreroPaja/>, c4:<TrajeEspacial/>,
    h1:<SombreroVaquero/>, h2:<CascoAntiguo/>, h3:<LupaArqueologo/>, h4:<Pergamino/>,
    e1:<Pluma/>, e2:<SombreroTeatro/>, e3:<LibroMagico/>, e4:<EstrellaAutor/>,
  };

  return(
    <svg width={size} height={size} viewBox="0 0 100 100" style={{overflow:"visible",display:"block"}}>
      {/* Mascot emoji, always centered */}
      <text x="50" y="66" textAnchor="middle" fontSize="62" style={{userSelect:"none"}}>{m.emoji}</text>
      {/* Accessory drawn on top in fixed coordinate space */}
      {outfit&&outfitMap[outfit]}
    </svg>
  );
};

const FloatingMascot = ({ subject, progress, style={} }) => {
  const m = MASCOTS[subject] || MASCOTS["Matemáticas"];
  const [frame, setFrame] = useState(0);
  const [pos, setPos] = useState({ x: Math.random()*60+10, y: Math.random()*40+30, dx:0.3, dy:0.2 });
  const size = 28 + Math.floor(progress/20)*6;

  useEffect(() => {
    const t = setInterval(()=>setFrame(f=>1-f),800);
    return ()=>clearInterval(t);
  },[]);

  useEffect(()=>{
    const t = setInterval(()=>{
      setPos(p=>{
        let nx=p.x+p.dx, ny=p.y+p.dy;
        let ndx=p.dx, ndy=p.dy;
        if(nx>85||nx<5){ndx=-ndx;}
        if(ny>80||ny<10){ndy=-ndy;}
        return {x:Math.max(5,Math.min(85,nx)),y:Math.max(10,Math.min(80,ny)),dx:ndx,dy:ndy};
      });
    },60);
    return ()=>clearInterval(t);
  },[]);

  return (
    <div style={{
      position:"fixed", left:`${pos.x}%`, top:`${pos.y}%`,
      pointerEvents:"none", zIndex:10,
      transition:"left 0.06s linear,top 0.06s linear",
      ...style
    }}>
      <div style={{
        width:size+8, height:size+8, borderRadius:"50%",
        background:`${m.color}18`, border:`1.5px solid ${m.color}30`,
        display:"flex",alignItems:"center",justifyContent:"center",
        animation:`mascotBob 1.6s ease-in-out infinite`,
        boxShadow:`0 2px 8px ${m.color}20`,
      }}>
        <span style={{fontSize:size,lineHeight:1,transition:"all 0.4s ease"}}>{m.emoji}</span>
      </div>
    </div>
  );
};

// ─── iOS PRIMITIVES ───────────────────────────────────────────────────────────
const Btn = ({children,onPress,variant="filled",color,size="md",disabled,full,style:sx={}})=>{
  const [p,setP]=useState(false);
  const cl=color||C.blue;
  const v={
    filled:{background:cl,color:"#fff",border:"none"},
    tinted:{background:`${cl}18`,color:cl,border:"none"},
    outlined:{background:"transparent",color:cl,border:`1.5px solid ${cl}`},
    plain:{background:"transparent",color:cl,border:"none",padding:0},
    ghost:{background:C.fill3,color:C.lbl,border:"none"},
    danger:{background:`${C.red}15`,color:C.red,border:"none"},
  }[variant]||{background:cl,color:"#fff",border:"none"};
  const s={sm:{padding:"5px 12px",fontSize:13,fontWeight:600,borderRadius:8},
    md:{padding:"10px 20px",fontSize:17,fontWeight:600,borderRadius:12},
    lg:{padding:"14px 28px",fontSize:17,fontWeight:600,borderRadius:14}}[size];
  return(
    <button onClick={onPress} disabled={disabled}
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

const NavBar=({title,large,sub,right,back,onBack,accent=C.blue,bg="rgba(242,242,247,0.88)"})=>(
  <div style={{position:"sticky",top:0,zIndex:200,background:bg,
    backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",
    borderBottom:`0.5px solid ${C.sep}`}}>
    <div style={{display:"flex",alignItems:"center",padding:"10px 16px",minHeight:44}}>
      {back&&<button onClick={onBack} style={{background:"none",border:"none",color:accent,cursor:"pointer",
        display:"flex",alignItems:"center",gap:3,fontFamily:SF,fontSize:17,padding:"0 10px 0 0",letterSpacing:"-0.2px"}}>
        <svg width="10" height="17" viewBox="0 0 10 17" fill="none">
          <path d="M8 1L1 8.5L8 16" stroke={accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>{back}
      </button>}
      {!large&&<div style={{flex:1,textAlign:"center",...fmt.headline,color:C.lbl,fontFamily:SF}}>{title}</div>}
      {large&&<div style={{flex:1}}/>}
      {right&&<div style={{marginLeft:"auto"}}>{right}</div>}
    </div>
    {large&&<div style={{padding:"0 16px 12px"}}>
      <div style={{...fmt.title1,color:C.lbl,fontFamily:SFD}}>{title}</div>
      {sub&&<div style={{...fmt.subhead,color:C.lbl2,fontFamily:SF,marginTop:2}}>{sub}</div>}
    </div>}
  </div>
);

const TabBar=({tabs,active,onChange,accent=C.blue})=>(
  <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:300,
    background:"rgba(249,249,249,0.92)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",
    borderTop:`0.5px solid ${C.sep}`,display:"flex",
    padding:"6px 0 max(6px,env(safe-area-inset-bottom))"}}>
    {tabs.map(t=>(
      <button key={t.id} onClick={()=>onChange(t.id)} style={{flex:1,display:"flex",flexDirection:"column",
        alignItems:"center",gap:2,background:"none",border:"none",cursor:"pointer",padding:"2px 4px",
        transition:"transform 0.1s",transform:active===t.id?"scale(1.05)":"scale(1)"}}>
        <span style={{fontSize:22,lineHeight:1,filter:active===t.id?"none":"grayscale(0.6)",
          transition:"filter 0.15s",opacity:active===t.id?1:0.6}}>{t.icon}</span>
        <span style={{fontSize:10,fontWeight:active===t.id?600:400,
          color:active===t.id?accent:C.g1,fontFamily:SF,letterSpacing:"-0.1px"}}>{t.label}</span>
      </button>
    ))}
  </div>
);

const Card=({children,style:sx={},onPress,noPad})=>{
  const [p,setP]=useState(false);
  return(
    <div onClick={onPress} onMouseDown={()=>onPress&&setP(true)}
      onMouseUp={()=>setP(false)} onMouseLeave={()=>setP(false)}
      style={{background:C.bg,borderRadius:12,boxShadow:"0 1px 3px rgba(0,0,0,0.07)",
        overflow:"hidden",transform:p?"scale(0.985)":"scale(1)",
        transition:"transform 0.1s ease",cursor:onPress?"pointer":undefined,...sx}}>
      {children}
    </div>
  );
};

const Row=({label,detail,right,icon,iconBg,chevron,onPress,danger,badge})=>{
  const [p,setP]=useState(false);
  return(
    <div onClick={onPress} onMouseDown={()=>onPress&&setP(true)}
      onMouseUp={()=>setP(false)} onMouseLeave={()=>setP(false)}
      style={{display:"flex",alignItems:"center",gap:12,padding:"11px 16px",
        cursor:onPress?"pointer":undefined,background:p?C.fill4:"transparent",
        transition:"background 0.1s"}}>
      {icon&&<div style={{width:30,height:30,borderRadius:7,background:iconBg||C.fill3,
        display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:16}}>{icon}</div>}
      <div style={{flex:1,minWidth:0}}>
        <div style={{...fmt.body,color:danger?C.red:C.lbl,fontFamily:SF}}>{label}</div>
        {detail&&<div style={{...fmt.caption,color:C.lbl2,fontFamily:SF,marginTop:1}}>{detail}</div>}
      </div>
      {badge&&<div style={{background:C.red,color:"#fff",fontSize:11,fontWeight:700,
        borderRadius:10,padding:"1px 7px",fontFamily:SF}}>{badge}</div>}
      {right&&<div style={{color:C.lbl2,fontFamily:SF,...fmt.body}}>{right}</div>}
      {chevron&&<svg width="8" height="13" viewBox="0 0 8 13" fill="none">
        <path d="M1 1L7 6.5L1 12" stroke={C.g3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
    </div>
  );
};

const Div=({indent=0})=><div style={{height:"0.5px",background:C.sep,marginLeft:indent}}/>;

const Sec=({title,children,footer,style:sx={}})=>(
  <div style={{marginBottom:24,...sx}}>
    {title&&<div style={{...fmt.footnote,color:C.lbl2,textTransform:"uppercase",letterSpacing:"0.05em",
      fontFamily:SF,marginBottom:6,paddingLeft:16}}>{title}</div>}
    <Card>{children}</Card>
    {footer&&<div style={{...fmt.caption,color:C.lbl2,fontFamily:SF,padding:"5px 16px 0"}}>{footer}</div>}
  </div>
);

const Pill=({children,color=C.blue,size="sm"})=>(
  <span style={{display:"inline-flex",alignItems:"center",
    padding:size==="xs"?"1px 6px":"3px 10px",
    borderRadius:20,background:`${color}18`,color,
    fontSize:size==="xs"?10:12,fontWeight:600,fontFamily:SF,letterSpacing:"-0.1px"}}>
    {children}
  </span>
);

const Ava=({initials,color=C.blue,size=40,img})=>(
  <div style={{width:size,height:size,borderRadius:"50%",
    background:img?"transparent":`${color}20`,border:img?"none":`1.5px solid ${color}40`,
    display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden"}}>
    {img?<img src={img} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>
      :<span style={{color,fontWeight:700,fontSize:size*0.35,letterSpacing:"-0.5px",fontFamily:SF}}>{initials}</span>}
  </div>
);

const Input=({label,placeholder,value,onChange,type="text",mono})=>(
  <div style={{background:C.fill4,borderRadius:12,padding:"10px 14px",marginBottom:10}}>
    {label&&<div style={{fontSize:11,color:C.lbl2,fontWeight:600,textTransform:"uppercase",
      letterSpacing:"0.05em",marginBottom:4,fontFamily:SF}}>{label}</div>}
    <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      style={{width:"100%",background:"transparent",border:"none",fontSize:16,
        color:C.lbl,outline:"none",letterSpacing:"-0.2px",padding:0,
        fontFamily:mono?"'SF Mono','Menlo',monospace":SF,boxSizing:"border-box"}}/>
  </div>
);

const Modal=({open,onClose,title,children})=>{
  if(!open)return null;
  return(
    <div style={{position:"fixed",inset:0,zIndex:500,display:"flex",alignItems:"flex-end",
      justifyContent:"center",background:"rgba(0,0,0,0.4)",backdropFilter:"blur(4px)"}}>
      <div style={{background:C.bg,borderRadius:"20px 20px 0 0",width:"100%",maxWidth:600,
        maxHeight:"90vh",overflow:"auto",padding:"0 0 32px",
        animation:"slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)"}}>
        <div style={{display:"flex",alignItems:"center",padding:"16px 16px 0"}}>
          <div style={{flex:1,...fmt.headline,color:C.lbl,fontFamily:SF,fontWeight:600}}>{title}</div>
          <button onClick={onClose} style={{width:28,height:28,borderRadius:"50%",background:C.fill3,
            border:"none",cursor:"pointer",display:"flex",alignItems:"center",
            justifyContent:"center",color:C.lbl2,fontSize:16,fontFamily:SF}}>✕</button>
        </div>
        <div style={{padding:"12px 16px 0"}}>{children}</div>
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

  const BellPanel=()=>(
    <>
      <div onClick={()=>setBellOpen(false)} style={{position:"fixed",inset:0,zIndex:650}}/>
      <div style={{position:"fixed",top:58,right:10,width:300,maxHeight:"70vh",
        background:"#fff",borderRadius:18,boxShadow:"0 12px 48px rgba(0,0,0,0.22)",
        border:`1px solid ${C.g5}`,overflow:"hidden",zIndex:700,animation:"fadeUp 0.18s ease"}}>
        <div style={{background:`linear-gradient(135deg,${accent},${accent}bb)`,padding:"12px 14px 10px",
          display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:"#fff",fontFamily:SF}}>📣 Noticias y Avisos</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.75)",fontFamily:SF}}>
              {newsItems.length} novedad{newsItems.length!==1?"es":""}
              {urgentCount>0&&` · ${urgentCount} urgente${urgentCount>1?"s":""}`}
            </div>
          </div>
          <button onClick={()=>setBellOpen(false)} style={{background:"rgba(255,255,255,0.2)",border:"none",
            borderRadius:"50%",width:24,height:24,cursor:"pointer",color:"#fff",fontSize:13,
            display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>
        <div style={{overflowY:"auto",maxHeight:"calc(70vh - 58px)"}}>
          {newsItems.length===0&&<div style={{padding:"28px 16px",textAlign:"center",color:C.lbl2,fontSize:13,fontFamily:SF}}>¡Sin novedades! 🎉</div>}
          {newsItems.map((n,i)=>(
            <div key={n.id}>
              <div onClick={()=>setSelNews(selNews===n.id?null:n.id)}
                style={{padding:"9px 12px",cursor:"pointer",borderLeft:`4px solid ${n.color}`,
                  background:n.urgent?`${C.red}05`:selNews===n.id?C.fill4:"transparent",transition:"background 0.1s"}}>
                <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                  <span style={{fontSize:18,flexShrink:0,marginTop:1}}>{n.icon}</span>
                  <div style={{flex:1,minWidth:0}}>
                    {n.urgent&&<span style={{fontSize:9,fontWeight:800,color:C.red,background:`${C.red}15`,borderRadius:3,padding:"1px 5px",fontFamily:SF,letterSpacing:"0.05em"}}>🚨 URGENTE</span>}
                    <div style={{fontSize:12,fontWeight:700,color:C.lbl,fontFamily:SF,lineHeight:1.35,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:selNews===n.id?"normal":"nowrap",marginTop:n.urgent?2:0}}>{n.title}</div>
                    <div style={{display:"flex",gap:5,marginTop:3,alignItems:"center"}}>
                      <span style={{fontSize:9,fontWeight:600,color:n.color,background:`${n.color}15`,borderRadius:4,padding:"1px 6px",fontFamily:SF}}>{n.badge}</span>
                      <span style={{fontSize:9,color:C.lbl3,fontFamily:SF}}>{n.time}</span>
                    </div>
                    {selNews===n.id&&<div style={{fontSize:11,color:C.lbl2,fontFamily:SF,lineHeight:1.5,marginTop:6,padding:"6px 8px",background:C.fill4,borderRadius:7}}>{n.body}</div>}
                  </div>
                </div>
              </div>
              {i<newsItems.length-1&&<div style={{height:"0.5px",background:C.sep,marginLeft:44}}/>}
            </div>
          ))}
        </div>
      </div>
    </>
  );

  return(
    <div style={{background:C.bg2,minHeight:"100vh"}}>
      <NavBar title="Tablón Escolar" large sub="Instituto Educativo" accent={accent} bg="rgba(242,242,247,0.9)"
        right={
          <div style={{position:"relative"}}>
            <button onClick={()=>setBellOpen(o=>!o)}
              style={{width:36,height:36,borderRadius:"50%",
                background:bellOpen?C.fill3:`linear-gradient(135deg,${accent},${accent}bb)`,
                border:"none",cursor:"pointer",boxShadow:"0 2px 10px rgba(0,0,0,0.12)",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,transition:"all 0.18s"}}>
              <span>🔔</span>
              {newsItems.length>0&&<span style={{position:"absolute",top:-4,right:-4,
                background:urgentCount>0?C.red:accent,color:"#fff",fontSize:9,fontWeight:800,
                borderRadius:"50%",minWidth:16,height:16,display:"flex",alignItems:"center",
                justifyContent:"center",fontFamily:SF,border:"2px solid #f2f2f7",padding:"0 3px"}}>
                {newsItems.length}
              </span>}
            </button>
            {bellOpen&&<BellPanel/>}
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
    const data={name:newG.name,grade:parseInt(newG.grade)||0,
      section:newG.section,teacherId:newG.teacherId||null,
      subject:newG.subject,students:[]};
    try {
      await addDoc(collection(db,"groups"),{...data,_createdAt:serverTimestamp()});
    } catch { setState(s=>({...s,groups:[...s.groups,{id:Date.now(),...data}]})); }
    setNewG({name:"",grade:"",section:"",teacherId:"",subject:""});
    setShowGForm(false);setGErr("");
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
        <div style={{display:"flex",gap:0,padding:"0 16px",borderTop:"1px solid rgba(255,255,255,0.1)"}}>
          {[{id:"teachers",label:"Docentes"},{id:"students",label:"Alumnos"},{id:"groups",label:"Grupos"},{id:"cycles",label:"Ciclos"}].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"12px 18px",background:"none",border:"none",cursor:"pointer",fontFamily:SF,fontSize:14,fontWeight:600,color:tab===t.id?"#fff":"rgba(255,255,255,0.45)",borderBottom:tab===t.id?"2px solid #fff":"2px solid transparent",transition:"all 0.15s"}}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{padding:"16px 16px 60px",animation:"fadeUp 0.3s ease"}}>

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
            <Btn onPress={()=>setShowGForm(!showGForm)} full color={devColor} variant={showGForm?"ghost":"filled"} style={{marginBottom:12}}>
              {showGForm?"Cancelar":"+ Crear Grupo"}
            </Btn>
            {showGForm&&(
              <Card style={{padding:16,marginBottom:14}}>
                <div style={{...fmt.headline,color:C.lbl,fontFamily:SF,marginBottom:12}}>Nuevo Grupo</div>
                <Input label="Nombre del Grupo *" placeholder="3°A" value={newG.name} onChange={v=>setNewG(g=>({...g,name:v}))}/>
                <Input label="Grado" placeholder="3" value={newG.grade} onChange={v=>setNewG(g=>({...g,grade:v}))}/>
                <Input label="Sección" placeholder="A" value={newG.section} onChange={v=>setNewG(g=>({...g,section:v}))}/>
                <Input label="Materia" placeholder="Matemáticas" value={newG.subject} onChange={v=>setNewG(g=>({...g,subject:v}))}/>
                <div style={{background:C.fill4,borderRadius:12,padding:"10px 14px",marginBottom:10}}>
                  <div style={{fontSize:11,color:C.lbl2,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4,fontFamily:SF}}>Docente Asignado</div>
                  <select value={newG.teacherId} onChange={e=>setNewG(g=>({...g,teacherId:e.target.value}))}
                    style={{width:"100%",background:"transparent",border:"none",fontSize:16,color:C.lbl,fontFamily:SF,outline:"none"}}>
                    <option value="">Sin asignar</option>
                    {state.teachers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                {gErr&&<div style={{background:`${C.red}12`,borderRadius:10,padding:"10px 14px",color:C.red,fontSize:13,marginBottom:10,fontFamily:SF}}>{gErr}</div>}
                <Btn onPress={addGroup} full color={devColor}>Crear Grupo</Btn>
              </Card>
            )}
            <Sec title={`Grupos — ${state.groups.length}`}>
              {state.groups.map((g,i)=>{
                const teacher=state.teachers.find(t=>t.id===g.teacherId);
                const studs=state.students.filter(s=>g.students.includes(s.id));
                return(
                  <div key={g.id}>
                    <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px"}}>
                      <div style={{width:46,height:46,borderRadius:12,background:`${devColor}10`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                        <span style={{fontSize:13,fontWeight:800,color:devColor,fontFamily:SF}}>{g.name}</span>
                      </div>
                      <div style={{flex:1}}>
                        <div style={{...fmt.callout,fontWeight:600,color:C.lbl,fontFamily:SF}}>{g.subject||"Sin materia"} — {g.name}</div>
                        <div style={{...fmt.caption,color:C.lbl2,fontFamily:SF,marginTop:1}}>{teacher?.name||"Sin docente"} · {studs.length} alumnos</div>
                      </div>
                    </div>
                    {i<state.groups.length-1&&<Div indent={74}/>}
                  </div>
                );
              })}
            </Sec>
          </>
        )}

        {tab==="cycles"&&(
          <>
            <Card style={{padding:16,marginBottom:16,background:`${devColor}08`,border:`1px solid ${devColor}20`}}>
              <div style={{fontSize:13,fontWeight:700,color:devColor,fontFamily:SF,marginBottom:4}}>🔄 Gestión de Ciclos Escolares</div>
              <div style={{fontSize:12,color:C.lbl2,fontFamily:SF,lineHeight:1.5}}>Aquí puedes crear nuevos ciclos y cambiar el ciclo activo. El ciclo activo determina el contexto de toda la plataforma.</div>
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

      </div>
    </div>
  );
};

// ─── DIRECTOR APP ─────────────────────────────────────────────────────────────
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
  const allStaffAtt = Object.entries(state.teacherAttendance||{}).flatMap(([date,map])=>
    Object.entries(map).map(([tid,val])=>({date,teacherId:tid,status:val.status})));

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
    studentAttMap[s.id] = rec?.s || null;
  });

  const markStudent = async (personId, date, status) => {
    try {
      const q = query(collection(db,"attendance"),where("studentId","==",personId),where("date","==",date));
      const snap = await getDocs(q);
      if(snap.empty) await addDoc(collection(db,"attendance"),{studentId:personId,date,status,teacherId:teacher?.id});
      else await updateDoc(snap.docs[0].ref,{status});
    } catch {}
    setState(s=>({...s,students:s.students.map(st=>st.id===personId?{...st,
      attendance:[...(st.attendance||[]).filter(a=>a.date!==date),{date,s:status}]}:st)}));
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
  const [tab,setTab]=useState("feed");
  const [mgmtTab,setMgmtTab]=useState("resumen");
  const [selectedPerson,setSelectedPerson]=useState(null);
  const [selectedGroup,setSelectedGroup]=useState(null);
  const [cycleModal,setCycleModal]=useState(false);
  const [newCycleName,setNewCycleName]=useState("");
  const [selectedRoom,setSelectedRoom]=useState(null);
  const [gradeFilter,setGradeFilter]=useState("all");
  const [groupFilter,setGroupFilter]=useState("all");
  const [newAviso,setNewAviso]=useState({title:"",body:"",type:"general"});
  const [showAvisoForm,setShowAvisoForm]=useState(false);
  const [newAct,setNewAct]=useState({title:"",type:"trabajo",date:"",teacherId:"all",description:""});
  const [showActForm,setShowActForm]=useState(false);
  const [obsText,setObsText]=useState("");
  const [aiChatOpen,setAiChatOpen]=useState(false);
  const [aiMessages,setAiMessages]=useState([{role:"assistant",text:"Hola, soy tu asistente escolar. ¿En qué puedo ayudarte hoy?"}]);
  const [aiInput,setAiInput]=useState("");
  const [aiThinking,setAiThinking]=useState(false);

  const activeCycle=state.cycles.find(c=>c.id===state.activeCycle);
  const todayStr=today();
  const todayTeacherAtt=state.teacherAttendance[todayStr]||{};
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
    const a={id:Date.now(),title:newAct.title,type:newAct.type,date:newAct.date,teacherId:newAct.teacherId,description:newAct.description,status:"pendiente"};
    setState(s=>({...s,actividades:[a,...(s.actividades||[])]}));
    setNewAct({title:"",type:"trabajo",date:"",teacherId:"all",description:""});setShowActForm(false);
  };

  const tabs=[
    {id:"feed",label:"Tablón",icon:"📋"},
    {id:"management",label:"Gestión",icon:"📊"},
    {id:"settings",label:"Ajustes",icon:"⚙️"},
  ];

  // ── Vista: perfil de persona ──────────────────────────────────────────────
  if(selectedPerson){
    const isTeacher=selectedPerson._type==="teacher";
    const att=isTeacher
      ?Object.entries(state.teacherAttendance).map(([date,data])=>({date,s:data[selectedPerson.id]?.status||"absent"}))
      :selectedPerson.attendance||[];
    return(
      <div style={{background:C.bg2,minHeight:"100vh",fontFamily:SF}}>
        <NavBar title={selectedPerson.name.split(" ")[0]} back="Regresar" onBack={()=>setSelectedPerson(null)} accent={C.indigo}/>
        <div style={{padding:"16px 16px 100px"}}>
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
              <><Row label="Correo del padre/tutor" detail={selectedPerson.parentEmail} icon="📧" iconBg={`${C.blue}15`}/>
              <Div indent={46}/><Row label="Contacto" detail={selectedPerson.parentContact} icon="📞" iconBg={`${C.green}15`}/></>
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
        <div style={{padding:"16px 16px 100px"}}>
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
                  <div onClick={()=>{setSelectedGroup(null);setSelectedPerson({...s,_type:"student"});}}
                    style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",cursor:"pointer"}}
                    onMouseEnter={e=>e.currentTarget.style.background=C.fill4}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <div style={{position:"relative",flexShrink:0}}>
                      <Ava initials={s.avatar} color={s.color} size={40}/>
                      <div style={{position:"absolute",bottom:0,right:0,width:12,height:12,borderRadius:"50%",background:C.green,border:"2px solid #fff",boxShadow:"0 1px 3px rgba(52,199,89,0.5)"}}/>
                    </div>
                    <div style={{flex:1}}>
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
                    <svg width="8" height="13" viewBox="0 0 8 13" fill="none"><path d="M1 1L7 6.5L1 12" stroke={C.g3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  {i<studs.length-1&&<Div indent={68}/>}
                </div>
              );
            })}
          </Sec>

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
    <div style={{background:C.bg2,minHeight:"100vh",fontFamily:SF}}>
      {tab==="feed"&&<Feed state={state} setState={setState} userId="dir" userName="Directora Gómez" userAvatar="DG" userColor={C.indigo} userRole="director" accent={C.indigo}/>}

      {tab==="management"&&(
        <div>
          <NavBar title="Gestión Escolar" large accent={C.indigo}
            right={<button onClick={()=>setCycleModal(true)} style={{background:`${C.indigo}10`,border:`1px solid ${C.indigo}25`,borderRadius:20,padding:"5px 14px",color:C.indigo,fontSize:13,fontWeight:600,fontFamily:SF,cursor:"pointer"}}>{activeCycle?.name}</button>}/>
          <div style={{display:"flex",gap:6,padding:"0 16px 14px",overflowX:"auto",scrollbarWidth:"none"}}>
            {[
              {id:"resumen",label:"Resumen"},
              {id:"asistencia",label:"Asistencia 📋"},
              {id:"personal",label:"Personal"},
              {id:"alumnos",label:"Alumnos"},
              {id:"grupos",label:"Grupos"},
              {id:"avisos",label:"Avisos",badge:(state.avisos||[]).filter(a=>!a.read).length},
              {id:"actividades",label:"Actividades"},
              {id:"aprobaciones",label:"Aprobaciones",badge:state.pendingContent.length},
            ].map(t=>(
              <button key={t.id} onClick={()=>setMgmtTab(t.id)} style={{flexShrink:0,padding:"6px 16px",
                borderRadius:20,border:mgmtTab===t.id?`1.5px solid ${C.indigo}`:`1px solid ${C.g4}`,
                cursor:"pointer",fontFamily:SF,fontSize:13,fontWeight:600,
                background:mgmtTab===t.id?C.indigo:"#fff",
                color:mgmtTab===t.id?"#fff":C.lbl2,transition:"all 0.15s",position:"relative"}}>
                {t.label}
                {t.badge>0&&<span style={{position:"absolute",top:-5,right:-5,background:C.red,color:"#fff",fontSize:9,fontWeight:700,borderRadius:"50%",width:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:SF}}>{t.badge}</span>}
              </button>
            ))}
          </div>

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
                        <svg width="100%" viewBox="0 0 320 220" style={{display:"block",background:"#F8F9FC"}}>
                          <rect x="105" y="75" width="110" height="80" rx="4" fill="#E8F4FD" stroke="#B8D4E8" strokeWidth="1"/>
                          <text x="160" y="118" textAnchor="middle" fill="#5A8FA8" fontSize="8" fontWeight="500">Patio Central</text>
                          <rect x="10" y="20" width="85" height="170" rx="6" fill="#EEF2FF" stroke={C.indigo} strokeWidth="1.2" opacity="0.6"/>
                          <text x="52" y="14" textAnchor="middle" fill={C.indigo} fontSize="7" fontWeight="700">EDIFICIO A</text>
                          {clickableA.map(([l,x,y])=><RoomRect key={l} label={l} x={x} y={y} stroke="#C5CAE9"/>)}
                          <rect x="225" y="20" width="85" height="170" rx="6" fill="#F0FFF4" stroke={C.green} strokeWidth="1.2" opacity="0.6"/>
                          <text x="268" y="14" textAnchor="middle" fill={C.green} fontSize="7" fontWeight="700">EDIFICIO B</text>
                          {clickableB.map(([l,x,y])=><RoomRect key={l} label={l} x={x} y={y} stroke="#C8E6C9"/>)}
                          <rect x="85" y="168" width="150" height="42" rx="6" fill="#FFF8E1" stroke={C.orange} strokeWidth="1.2" opacity="0.6"/>
                          <text x="160" y="163" textAnchor="middle" fill={C.orange} fontSize="7" fontWeight="700">ÁREA DE SERVICIOS</text>
                          {[["Enfermería",95,183],["Coop.",175,183]].map(([l,x,y])=>(
                            <g key={l}>
                              <rect x={x-4} y={y-9} width={l.length*5+8} height="22" rx="3" fill="white" stroke="#FFE0B2" strokeWidth="0.8"/>
                              <text x={x+(l.length*5+8)/2-4} y={y+3} textAnchor="middle" fill="#444" fontSize="6.5">{l}</text>
                            </g>
                          ))}
                          <rect x="130" y="198" width="60" height="14" rx="3" fill="#E3F2FD" stroke="#90CAF9" strokeWidth="1"/>
                          <text x="160" y="207" textAnchor="middle" fill="#1565C0" fontSize="6" fontWeight="600">ENTRADA PRINCIPAL</text>
                          <AlertDot active={hasAccident} label="!!" x={52} y={98} color={C.red}/>
                          <AlertDot active={hasBoardAlert} label="!!" x={268} y={98} color={C.purple}/>
                          <AlertDot active={hasGeneral} label="!!" x={160} y={115} color={C.orange}/>
                          <AlertDot active={hasAdmin} label="!!" x={52} y={131} color={C.blue}/>
                          {/* Legend */}
                          <circle cx="112" cy="210" r="3" fill={C.green}/>
                          <text x="118" y="213" fill="#666" fontSize="5.5">Con alumnos presentes</text>
                          <circle cx="185" cy="210" r="3" fill={C.g3}/>
                          <text x="191" y="213" fill="#666" fontSize="5.5">Sin registro hoy</text>
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
                                  <div style={{...fmt.caption,color:C.lbl2,fontFamily:SF}}>{teacher.subjects.join(", ")}</div>
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

                  {/* Asistencia Docente */}
                  <Sec title={`Asistencia Docente — ${todayStr}`}>
                    {state.teachers.map((t,i)=>{
                      const att=todayTeacherAtt[t.id];
                      return(
                        <div key={t.id}>
                          <div onClick={()=>setSelectedPerson({...t,_type:"teacher"})}
                            style={{display:"flex",alignItems:"center",gap:12,padding:"10px 16px",cursor:"pointer"}}
                            onMouseEnter={e=>e.currentTarget.style.background=C.fill4}
                            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                            <Ava initials={t.avatar} color={att?.status==="present"?C.green:C.red} size={36}/>
                            <div style={{flex:1}}>
                              <div style={{...fmt.callout,fontWeight:600,color:C.lbl,fontFamily:SF}}>{t.name}</div>
                              <div style={{...fmt.caption,color:C.lbl2,fontFamily:SF}}>{t.subjects.join(", ")}</div>
                            </div>
                            {att?.status==="present"
                              ?<span style={{fontSize:12,fontWeight:600,color:C.green,background:`${C.green}12`,borderRadius:6,padding:"3px 9px",fontFamily:SF}}>Presente — {att.time}</span>
                              :<span style={{fontSize:12,fontWeight:600,color:C.red,background:`${C.red}12`,borderRadius:6,padding:"3px 9px",fontFamily:SF}}>Ausente</span>}
                            <svg width="8" height="13" viewBox="0 0 8 13" fill="none"><path d="M1 1L7 6.5L1 12" stroke={C.g3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </div>
                          {i<state.teachers.length-1&&<Div indent={64}/>}
                        </div>
                      );
                    })}
                  </Sec>

                  {/* Asistencia Alumnos */}
                  <Sec title={`Asistencia Alumnos — ${todayStr}`}>
                    {todayStudentAtt.map((s,i)=>{
                      const col={present:C.green,absent:C.red,justified:C.orange}[s.todayStatus]||C.g2;
                      const lbl={present:"Presente",absent:"Falta",justified:"Justificada"}[s.todayStatus]||"Sin registro";
                      return(
                        <div key={s.id}>
                          <div onClick={()=>setSelectedPerson({...s,_type:"student"})}
                            style={{display:"flex",alignItems:"center",gap:12,padding:"10px 16px",cursor:"pointer"}}
                            onMouseEnter={e=>e.currentTarget.style.background=C.fill4}
                            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                            <Ava initials={s.avatar} color={col} size={36}/>
                            <div style={{flex:1}}>
                              <div style={{...fmt.callout,fontWeight:600,color:C.lbl,fontFamily:SF}}>{s.name}</div>
                              <div style={{...fmt.caption,color:C.lbl2,fontFamily:SF}}>Grupo {s.group}</div>
                            </div>
                            <span style={{fontSize:12,fontWeight:600,color:col,background:`${col}12`,borderRadius:6,padding:"3px 9px",fontFamily:SF}}>{lbl}</span>
                            <svg width="8" height="13" viewBox="0 0 8 13" fill="none"><path d="M1 1L7 6.5L1 12" stroke={C.g3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </div>
                          {i<todayStudentAtt.length-1&&<Div indent={64}/>}
                        </div>
                      );
                    })}
                  </Sec>
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
                    <Card key={a.id} style={{marginBottom:10,padding:14}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                        <div style={{flex:1,marginRight:10}}>
                          <div style={{...fmt.callout,fontWeight:600,color:C.lbl,fontFamily:SF,marginBottom:2}}>{a.title}</div>
                          <div style={{...fmt.caption,color:C.lbl2,fontFamily:SF}}>{a.fromName} · {a.time}</div>
                        </div>
                        <span style={{fontSize:11,fontWeight:600,color:typeColor,background:`${typeColor}12`,borderRadius:6,padding:"3px 9px",fontFamily:SF,flexShrink:0}}>{typeLabel}</span>
                      </div>
                      <div style={{...fmt.subhead,color:C.lbl2,fontFamily:SF,lineHeight:1.55}}>{a.body}</div>
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
                        <div style={{fontSize:11,color:C.lbl2,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4,fontFamily:SF}}>Fecha de entrega</div>
                        <input type="date" value={newAct.date} onChange={e=>setNewAct(a=>({...a,date:e.target.value}))}
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
          <div style={{padding:"16px 16px 100px"}}>
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

      <TabBar tabs={tabs} active={tab} onChange={setTab} accent={C.indigo}/>

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
  );
};


// ─── TEACHER APP ──────────────────────────────────────────────────────────────
// ─── GRADE MODAL ─────────────────────────────────────────────────────────────
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
              fontSize:14,color:C.lbl,fontFamily:SF,resize:"none",outline:"none",boxSizing:"border-box",lineHeight:1.5}}/>
        </div>
        <Btn onPress={()=>{saveGrade(gradeModal.actId,gradeModal.studentId,localGrade,localFeedback);onClose();}} full color={C.blue}>
          Guardar Calificación
        </Btn>
      </div>
    </div>
  );
};

const TeacherApp=({state,setState,teacherId,onLogout})=>{
  const [tab,setTab]=useState("feed");
  const [selectedGroup,setSelectedGroup]=useState(null);
  const [classTab,setClassTab]=useState("board");
  const [selectedStudent,setSelectedStudent]=useState(null);
  const [selectedActivity,setSelectedActivity]=useState(null);
  const [aiPrompt,setAiPrompt]=useState("");
  const [aiResult,setAiResult]=useState("");
  const [aiLoading,setAiLoading]=useState(false);
  const [aiAskDest,setAiAskDest]=useState(false);
  const [aiContent,setAiContent]=useState(null);
  const [showActivityForm,setShowActivityForm]=useState(false);
  const [actForm,setActForm]=useState({title:"",desc:"",type:"tarea",points:10,dueDate:"",link:"",quizQ:[]});
  const [actImages,setActImages]=useState([]);
  const [actFiles,setActFiles]=useState([]);
  const [actLink,setActLink]=useState("");
  const [showActLink,setShowActLink]=useState(false);
  const [gradeModal,setGradeModal]=useState(null); // {studentId, actId}
  const [gradeDraft,setGradeDraft]=useState({}); // {actId_studentId: {grade,feedback}}
  const [publishedGrades,setPublishedGrades]=useState({});
  const [bellOpen,setBellOpen]=useState(false);
  const [selBell,setSelBell]=useState(null);
  const [addQuizQ,setAddQuizQ]=useState({q:"",a:["","","",""],correct:0});
  const [showQuizForm,setShowQuizForm]=useState(false);
  const actImgRef=useRef();
  const actFileRef=useRef();

  const teacher=state.teachers.find(t=>t.id===teacherId)||state.teachers[0];
  const myGroups=state.groups.filter(g=>g.teacherId===teacher?.id);
  const activeCycle=state.cycles?.find(c=>c.id===state.activeCycle)||state.cycles?.[0];

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
      authorRole:teacher.subjects[0],avatar:teacher.avatar,avatarColor:teacher.color,
      time:"Ahora",title:aiContent.title,body:"Nuevo examen disponible.",type:"notice",likes:[],comments:[]};
    setState(s=>({...s,posts:[p,...s.posts]}));
    setAiAskDest(false);
  };

  const publishToGroup=(groupId)=>{
    if(!aiContent)return;
    const content={id:Date.now(),teacherId:teacher.id,teacherName:teacher.name,
      title:aiContent.title,type:aiContent.type,groupId,
      groupName:state.groups.find(g=>g.id===groupId)?.name||"",
      date:today(),content:aiContent.body,points:10,submissions:[]};
    setState(s=>({...s,pendingContent:[...s.pendingContent,content]}));
    setAiAskDest(false);
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

  const submitActivity=()=>{
    if(!actForm.title.trim()||!selectedGroup)return;
    const content={
      id:Date.now(),teacherId:teacher.id,teacherName:teacher.name,
      title:actForm.title,type:actForm.type,groupId:selectedGroup.id,
      groupName:selectedGroup.name,date:today(),content:actForm.desc,
      points:parseInt(actForm.points)||10,dueDate:actForm.dueDate,
      link:actLink||null,images:[...actImages],files:[...actFiles],
      quiz:actForm.quizQ.length>0?actForm.quizQ:[],
      submissions:[]
    };
    setState(s=>({...s,pendingContent:[...s.pendingContent,content]}));
    setActForm({title:"",desc:"",type:"tarea",points:10,dueDate:"",link:"",quizQ:[]});
    setActImages([]);setActFiles([]);setActLink("");setShowActLink(false);
    setShowActivityForm(false);
  };

  const saveGrade=(actId,studentId,grade,feedback)=>{
    const key=`${actId}_${studentId}`;
    setGradeDraft(d=>({...d,[key]:{grade,feedback,saved:true}}));
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

  const groupStudents=selectedGroup?state.students.filter(s=>selectedGroup.students.includes(s.id)):[];
  const groupContent=[...state.pendingContent,...state.approvedContent].filter(c=>c.groupId===selectedGroup?.id);
  const fileIcon=(mime)=>mime?.includes("pdf")?"📄":mime?.includes("image")?"🖼️":mime?.includes("word")?"📝":"📎";

  const tabs=[
    {id:"feed",label:"Tablón",icon:"📋"},
    {id:"classes",label:"Clases",icon:"🏫"},
    {id:"ai",label:"IA",icon:"🤖"},
    {id:"settings",label:"Ajustes",icon:"⚙️"},
  ];

  // Bell panel
  const BellBtn=()=>(
    <div style={{position:"relative"}}>
      <button onClick={()=>setBellOpen(o=>!o)}
        style={{width:34,height:34,borderRadius:"50%",
          background:bellOpen?C.fill3:`linear-gradient(135deg,${C.blue},${C.blue}cc)`,
          border:"none",cursor:"pointer",display:"flex",alignItems:"center",
          justifyContent:"center",fontSize:15,boxShadow:"0 2px 8px rgba(0,0,0,0.12)",
          transition:"all 0.15s",position:"relative"}}>
        🔔
        {urgentCount>0&&<span style={{position:"absolute",top:-4,right:-4,background:C.red,
          color:"#fff",fontSize:9,fontWeight:800,borderRadius:"50%",minWidth:16,height:16,
          display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid #f2f2f7",fontFamily:SF}}>
          {urgentCount}
        </span>}
      </button>
      {bellOpen&&(
        <>
          <div onClick={()=>setBellOpen(false)} style={{position:"fixed",inset:0,zIndex:650}}/>
          <div style={{position:"absolute",top:42,right:0,width:280,maxHeight:"65vh",
            background:"#fff",borderRadius:16,boxShadow:"0 10px 40px rgba(0,0,0,0.2)",
            border:`1px solid ${C.g5}`,overflow:"hidden",zIndex:700,animation:"fadeUp 0.18s ease"}}>
            <div style={{background:`linear-gradient(135deg,${C.blue},${C.blue}bb)`,padding:"11px 13px",
              display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{fontSize:13,fontWeight:700,color:"#fff",fontFamily:SF}}>📣 Avisos</div>
              <button onClick={()=>setBellOpen(false)} style={{background:"rgba(255,255,255,0.2)",border:"none",borderRadius:"50%",width:22,height:22,cursor:"pointer",color:"#fff",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
            </div>
            <div style={{overflowY:"auto",maxHeight:"calc(65vh - 50px)"}}>
              {newsItems.length===0&&<div style={{padding:20,textAlign:"center",color:C.lbl2,fontSize:13,fontFamily:SF}}>Sin avisos</div>}
              {newsItems.map((n,i)=>(
                <div key={n.id}>
                  <div onClick={()=>setSelBell(selBell===n.id?null:n.id)}
                    style={{padding:"9px 12px",cursor:"pointer",borderLeft:`4px solid ${n.color}`,
                      background:n.urgent?`${C.red}05`:selBell===n.id?C.fill4:"transparent"}}>
                    <div style={{display:"flex",gap:7}}>
                      <span style={{fontSize:17,flexShrink:0}}>{n.icon}</span>
                      <div style={{flex:1,minWidth:0}}>
                        {n.urgent&&<div style={{fontSize:9,fontWeight:800,color:C.red,fontFamily:SF}}>🚨 URGENTE</div>}
                        <div style={{fontSize:12,fontWeight:700,color:C.lbl,fontFamily:SF,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:selBell===n.id?"normal":"nowrap"}}>{n.title}</div>
                        <div style={{display:"flex",gap:5,marginTop:2}}>
                          <span style={{fontSize:9,fontWeight:600,color:n.color,background:`${n.color}15`,borderRadius:4,padding:"1px 5px",fontFamily:SF}}>{n.badge}</span>
                        </div>
                        {selBell===n.id&&n.body&&<div style={{fontSize:11,color:C.lbl2,fontFamily:SF,lineHeight:1.5,marginTop:5,padding:"5px 7px",background:C.fill4,borderRadius:6}}>{n.body}</div>}
                      </div>
                    </div>
                  </div>
                  {i<newsItems.length-1&&<div style={{height:"0.5px",background:C.sep,marginLeft:40}}/>}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );

  // ── Activity detail view ───────────────────────────────────────────────────
  if(selectedActivity){
    const act=selectedActivity;
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
            {studs.map((s,i)=>{
              const submitted=submittedIds.includes(s.id);
              const sub=(act.submissions||[]).find(x=>x.studentId===s.id);
              const key=`${act.id}_${s.id}`;
              const savedGrade=gradeDraft[key];
              const pubGrade=publishedGrades[key];
              return(
                <div key={s.id}>
                  <div style={{padding:"11px 14px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:submitted&&!savedGrade?0:4}}>
                      <Ava initials={s.avatar} color={s.color} size={34}/>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:600,color:C.lbl,fontFamily:SF}}>{s.name}</div>
                        <div style={{fontSize:11,color:submitted?C.green:C.lbl3,fontFamily:SF}}>
                          {submitted?"✅ Entregó"+(sub?.date?` · ${sub.date}`:""):"⏳ Sin entrega"}
                        </div>
                      </div>
                      {savedGrade&&(
                        <div style={{textAlign:"right"}}>
                          <div style={{fontSize:18,fontWeight:800,color:C.blue,fontFamily:SF}}>{savedGrade.grade}</div>
                          {pubGrade?.published&&<div style={{fontSize:9,color:C.green,fontFamily:SF}}>Publicado</div>}
                        </div>
                      )}
                      <button onClick={()=>setGradeModal({studentId:s.id,actId:act.id,name:s.name})}
                        style={{background:savedGrade?C.fill3:`${C.blue}15`,border:"none",borderRadius:8,
                          padding:"5px 11px",cursor:"pointer",fontSize:12,fontWeight:600,
                          color:savedGrade?C.lbl2:C.blue,fontFamily:SF}}>
                        {savedGrade?"Editar":"Calificar"}
                      </button>
                    </div>
                    {savedGrade?.feedback&&<div style={{fontSize:11,color:C.lbl2,fontFamily:SF,padding:"5px 10px",background:C.fill4,borderRadius:7,marginTop:4}}>💬 {savedGrade.feedback}</div>}
                  </div>
                  {i<studs.length-1&&<div style={{height:"0.5px",background:C.sep,marginLeft:58}}/>}
                </div>
              );
            })}
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

        <TabBar tabs={tabs} active="classes" onChange={id=>{setSelectedActivity(null);setSelectedGroup(null);setTab(id);}} accent={C.blue}/>
      </div>
    );
  }

  // ── Student detail ─────────────────────────────────────────────────────────
  if(selectedStudent){
    return(
      <div style={{background:C.bg2,minHeight:"100vh",fontFamily:SF}}>
        <NavBar title={selectedStudent.name.split(" ")[0]} back="← Clase" onBack={()=>setSelectedStudent(null)} accent={C.blue} right={<BellBtn/>}/>
        <div style={{padding:"16px 16px 100px"}}>
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
        <TabBar tabs={tabs} active="classes" onChange={id=>{setSelectedStudent(null);setTab(id);}} accent={C.blue}/>
      </div>
    );
  }

  // ── Class (group) detail view ──────────────────────────────────────────────
  if(selectedGroup){
    const COLOR=C.blue;
    const activities=groupContent.filter(c=>["tarea","actividad","examen","cuestionario"].includes(c.type));
    return(
      <div style={{background:C.bg2,minHeight:"100vh",fontFamily:SF}}>
        {/* Header */}
        <div style={{background:`linear-gradient(135deg,${COLOR},${COLOR}cc)`,padding:"0 0 0 0",
          boxShadow:"0 2px 12px rgba(0,0,0,0.15)"}}>
          <div style={{display:"flex",alignItems:"center",padding:"12px 16px 0",gap:10}}>
            <button onClick={()=>{setSelectedGroup(null);setClassTab("board");}}
              style={{background:"rgba(255,255,255,0.2)",border:"none",borderRadius:"50%",
                width:34,height:34,cursor:"pointer",color:"#fff",fontSize:18,
                display:"flex",alignItems:"center",justifyContent:"center"}}>←</button>
            <div style={{flex:1}}>
              <div style={{fontSize:18,fontWeight:700,color:"#fff",fontFamily:SFD,lineHeight:1.2}}>{selectedGroup.subject}</div>
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

        <div style={{padding:"14px 16px 100px"}}>

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
                    <button onClick={()=>{setShowActivityForm(false);setActImages([]);setActFiles([]);setActLink("");setShowActLink(false);setActForm({title:"",desc:"",type:"tarea",points:10,dueDate:"",quizQ:[]});}}
                      style={{background:C.fill3,border:"none",borderRadius:"50%",width:28,height:28,cursor:"pointer",color:C.lbl2,fontSize:15,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
                  </div>
                  <div style={{padding:"12px 14px 0"}}>
                    {/* Type chips */}
                    <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
                      {[{v:"tarea",e:"📝",l:"Tarea"},{v:"actividad",e:"⚡",l:"Actividad"},{v:"examen",e:"📋",l:"Examen"},{v:"cuestionario",e:"❓",l:"Cuestionario"},{v:"aviso",e:"📢",l:"Aviso"}].map(t=>(
                        <button key={t.v} onClick={()=>setActForm(f=>({...f,type:t.v}))}
                          style={{padding:"5px 12px",borderRadius:20,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:SF,
                            background:actForm.type===t.v?COLOR:C.fill4,color:actForm.type===t.v?"#fff":C.lbl2,transition:"all 0.15s"}}>
                          {t.e} {t.l}
                        </button>
                      ))}
                    </div>
                    <input value={actForm.title} onChange={e=>setActForm(f=>({...f,title:e.target.value}))}
                      placeholder="Título…"
                      style={{width:"100%",background:C.fill4,border:"none",borderRadius:10,padding:"10px 13px",
                        fontSize:15,fontWeight:600,color:C.lbl,fontFamily:SF,outline:"none",boxSizing:"border-box",marginBottom:8}}/>
                    <textarea value={actForm.desc} onChange={e=>setActForm(f=>({...f,desc:e.target.value}))}
                      placeholder="Instrucciones o descripción…" rows={3}
                      style={{width:"100%",background:C.fill4,border:"none",borderRadius:10,padding:"10px 13px",
                        fontSize:14,color:C.lbl,fontFamily:SF,resize:"none",outline:"none",boxSizing:"border-box",lineHeight:1.5,marginBottom:8}}/>
                    {/* Points + Due date */}
                    <div style={{display:"flex",gap:8,marginBottom:10}}>
                      <div style={{flex:1,background:C.fill4,borderRadius:10,padding:"8px 12px"}}>
                        <div style={{fontSize:10,fontWeight:700,color:C.lbl3,textTransform:"uppercase",letterSpacing:"0.05em",fontFamily:SF,marginBottom:3}}>Puntos</div>
                        <input type="number" min="1" max="100" value={actForm.points} onChange={e=>setActForm(f=>({...f,points:e.target.value}))}
                          style={{width:"100%",background:"transparent",border:"none",fontSize:20,fontWeight:800,color:COLOR,fontFamily:SF,outline:"none",padding:0}}/>
                      </div>
                      <div style={{flex:2,background:C.fill4,borderRadius:10,padding:"8px 12px"}}>
                        <div style={{fontSize:10,fontWeight:700,color:C.lbl3,textTransform:"uppercase",letterSpacing:"0.05em",fontFamily:SF,marginBottom:3}}>Fecha de entrega</div>
                        <input type="date" value={actForm.dueDate} onChange={e=>setActForm(f=>({...f,dueDate:e.target.value}))}
                          style={{width:"100%",background:"transparent",border:"none",fontSize:14,color:C.lbl,fontFamily:SF,outline:"none",padding:0}}/>
                      </div>
                    </div>
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
              {groupContent.length===0&&<div style={{textAlign:"center",padding:32,color:C.lbl2,fontSize:15,fontFamily:SF}}>Sin publicaciones aún</div>}
              {groupContent.map(c=>{
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
                <Btn onPress={()=>{setClassTab("board");setShowActivityForm(true);}} size="sm" color={COLOR}>+ Nueva Actividad</Btn>
              </div>
              {activities.length===0&&<div style={{textAlign:"center",padding:32,color:C.lbl2,fontSize:15,fontFamily:SF}}>Sin actividades asignadas</div>}
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
          {classTab==="grades"&&(
            <>
              {/* Upload / publish panel */}
              <Card style={{padding:14,marginBottom:14,background:`linear-gradient(135deg,${COLOR}10,${COLOR}04)`}}>
                <div style={{...fmt.headline,fontWeight:700,color:C.lbl,fontFamily:SF,marginBottom:4}}>📊 Subir Calificaciones</div>
                <div style={{fontSize:13,color:C.lbl2,fontFamily:SF,lineHeight:1.5,marginBottom:12}}>
                  Captura las calificaciones finales de los alumnos. Al publicar, aparecerán en el panel de cada estudiante.
                </div>
                <div style={{marginBottom:12}}>
                  {groupStudents.map((s,i)=>{
                    const gradeKey=`final_${selectedGroup.id}_${s.id}`;
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
                            onChange={e=>setGradeDraft(d=>({...d,[gradeKey]:{grade:e.target.value,feedback:d[gradeKey]?.feedback||"",saved:true}}))}
                            style={{width:52,background:C.fill4,border:`1px solid ${pub?.published?C.green:C.g5}`,
                              borderRadius:8,padding:"5px 0",fontSize:16,fontWeight:700,
                              color:pub?.published?C.green:C.lbl,fontFamily:SF,textAlign:"center",outline:"none"}}/>
                          {pub?.published&&<span style={{fontSize:16}}>✅</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Btn onPress={()=>publishGrades(selectedGroup.id)} full color={C.green}>
                  📤 Publicar Calificaciones (visible para alumnos)
                </Btn>
              </Card>

              {/* Per-activity summary */}
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
          )}
        </div>

        <TabBar tabs={tabs} active="classes" onChange={id=>{setSelectedGroup(null);setClassTab("board");setTab(id);}} accent={C.blue}/>
      </div>
    );
  }

  // ── Main tabs ──────────────────────────────────────────────────────────────
  return(
    <div style={{background:C.bg2,minHeight:"100vh",fontFamily:SF}}>
      {tab==="feed"&&<Feed state={state} setState={setState}
        userId={`t${teacher?.id}`} userName={teacher?.name||"Maestro"}
        userAvatar={teacher?.avatar||"T"} userColor={teacher?.color||C.blue}
        userRole="teacher" accent={C.blue}
        newsItems={newsItems} urgentCount={urgentCount}/>}

      {tab==="classes"&&(
        <div>
          <NavBar title="Mis Clases" large accent={C.blue} right={<BellBtn/>}/>
          <div style={{padding:"0 16px 100px"}}>
            {myGroups.length===0&&(
              <div style={{textAlign:"center",padding:"40px 16px",color:C.lbl2,fontSize:15,fontFamily:SF}}>
                <div style={{fontSize:48,marginBottom:12}}>🏫</div>
                <div style={{fontWeight:600,color:C.lbl,marginBottom:4}}>Sin clases asignadas</div>
                <div>Contacta al administrador para que te asigne grupos.</div>
              </div>
            )}
            {myGroups.map(g=>{
              const studs=state.students.filter(s=>g.students.includes(s.id));
              const acts=[...state.pendingContent,...state.approvedContent].filter(c=>c.groupId===g.id&&["tarea","actividad","examen","cuestionario"].includes(c.type));
              const ungraded=acts.reduce((acc,act)=>acc+(act.submissions||[]).length,0);
              return(
                <Card key={g.id} style={{marginBottom:12,overflow:"hidden"}} onPress={()=>setSelectedGroup(g)}>
                  <div style={{background:`linear-gradient(135deg,${C.blue},${C.blue}bb)`,padding:"14px 16px"}}>
                    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
                      <div>
                        <div style={{fontSize:18,fontWeight:800,color:"#fff",fontFamily:SFD,letterSpacing:"-0.4px"}}>{g.subject||"Clase"}</div>
                        <div style={{fontSize:13,color:"rgba(255,255,255,0.8)",fontFamily:SF,marginTop:2}}>Grupo {g.name} · {studs.length} alumnos</div>
                      </div>
                      <div style={{width:46,height:46,borderRadius:14,background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>🏫</div>
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
          <div style={{padding:"16px 16px 100px"}}>
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
          <div style={{padding:"16px 16px 100px"}}>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,marginBottom:24}}>
              <Ava initials={teacher?.avatar||"T"} color={teacher?.color||C.blue} size={80}/>
              <div style={{...fmt.title3,color:C.lbl,fontFamily:SFD}}>{teacher?.name}</div>
              <div style={{fontFamily:"'SF Mono','Menlo',monospace",fontSize:14,color:C.blue}}>{teacher?.key}</div>
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

      <TabBar tabs={tabs} active={tab} onChange={setTab} accent={C.blue}/>
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
};

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
const StudentApp=({state,setState,studentId,onLogout})=>{
  const [tab,setTab]=useState("feed");
  const [themeKey,setThemeKey]=useState("default");
  const [selectedSubject,setSelectedSubject]=useState(null);
  const [profilePic,setProfilePic]=useState(null);
  const [shopSubject,setShopSubject]=useState(null);
  const [ownedOutfits,setOwnedOutfits]=useState({});
  const [equippedOutfit,setEquippedOutfit]=useState({});
  const [tokens,setTokens]=useState(null);
  const [completedTasks,setCompletedTasks]=useState({});
  const [newsOpen,setNewsOpen]=useState(false);
  const [selectedNewsId,setSelectedNewsId]=useState(null);
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
  const mySubjects=Object.keys(student?.subjects||{"Matemáticas":{grade:7.8,tasks:[]},"Ciencias":{grade:8.5,tasks:[]},"Historia":{grade:9.1,tasks:[]},"Español":{grade:8.2,tasks:[]}});
  const subjectData=student?.subjects||{"Matemáticas":{grade:7.8,tasks:[]},"Ciencias":{grade:8.5,tasks:[]},"Historia":{grade:9.1,tasks:[]},"Español":{grade:8.2,tasks:[]}};
  const myGroup=student?.group;
  const myGroupData=state.groups.find(g=>g.name===myGroup);
  const myContent=state.approvedContent.filter(c=>c.groupId===myGroupData?.id);

  const currentTokens=tokens!==null?tokens:(student?.participation||0);

  // Mascot size grows with completed tasks
  const getMascotProgress=(subject)=>{
    const base=Math.round(((subjectData[subject]?.grade||7)/10)*100);
    const extra=(completedTasks[subject]||0)*5;
    return Math.min(base+extra,100);
  };

  // Simulated parciales per subject
  const PARCIALES={
    "Matemáticas":[{p:"1er Parcial",g:7.5},{p:"2do Parcial",g:7.8},{p:"3er Parcial",g:8.2}],
    "Ciencias":[{p:"1er Parcial",g:8.0},{p:"2do Parcial",g:8.5},{p:"3er Parcial",g:8.8}],
    "Historia":[{p:"1er Parcial",g:8.8},{p:"2do Parcial",g:9.1},{p:"3er Parcial",g:9.4}],
    "Español":[{p:"1er Parcial",g:7.9},{p:"2do Parcial",g:8.2},{p:"3er Parcial",g:8.5}],
  };

  // Build news items
  const newsItems=[
    ...(state.avisos||[]).filter(a=>a.type==="accident").map(a=>({
      id:`av${a.id}`,type:"urgente",title:a.title,body:a.body,color:C.red,icon:"🚨",badge:"URGENTE",time:a.time})),
    ...myContent.filter(c=>c.type==="examen").map(c=>({
      id:`ex${c.id}`,type:"examen",title:c.title,body:`Examen programado para el ${c.date}`,color:C.orange,icon:"📋",badge:"Examen",time:c.date})),
    ...myContent.filter(c=>c.type==="tarea").map(c=>({
      id:`tk${c.id}`,type:"tarea",title:c.title,body:`Entrega: ${c.date}`,color:C.blue,icon:"📝",badge:"Tarea",time:c.date})),
    ...myContent.filter(c=>c.type==="actividad").map(c=>({
      id:`ac${c.id}`,type:"actividad",title:c.title,body:`Actividad: ${c.date}`,color:C.purple,icon:"⚡",badge:"Actividad",time:c.date})),
    ...state.posts.filter(p=>p.type==="notice"||p.type==="event").slice(0,2).map(p=>({
      id:`p${p.id}`,type:p.type,title:p.title,body:p.body,color:p.type==="event"?C.teal:C.indigo,icon:p.type==="event"?"📅":"📢",badge:p.type==="event"?"Evento":"Aviso",time:p.time})),
  ];
  const urgentCount=newsItems.filter(n=>n.type==="urgente").length;

  const tabs=[
    {id:"feed",label:"Tablón",icon:"📋"},
    {id:"subjects",label:"Materias",icon:"📚"},
    {id:"medals",label:"Logros",icon:"🏆"},
    {id:"settings",label:"Ajustes",icon:"⚙️"},
  ];

  // ── News Panel ─────────────────────────────────────────────────────────────
  const NewsPanel=()=>(
    <div style={{position:"fixed",inset:0,zIndex:700,display:"flex",alignItems:"flex-start",justifyContent:"flex-end",paddingTop:52}}>
      <div onClick={()=>setNewsOpen(false)} style={{position:"absolute",inset:0}}/>
      <div style={{position:"relative",width:300,maxHeight:"80vh",background:"#fff",
        borderRadius:20,boxShadow:"0 12px 48px rgba(0,0,0,0.22)",border:`1px solid ${C.g5}`,
        overflow:"hidden",margin:"0 12px",animation:"fadeUp 0.22s ease"}}>
        <div style={{background:`linear-gradient(135deg,${T.accent},${T.accent}cc)`,padding:"14px 16px",
          display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:"#fff",fontFamily:SF}}>📣 Noticias y Avisos</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.75)",fontFamily:SF,marginTop:1}}>
              {newsItems.length} novedades{urgentCount>0&&` · ${urgentCount} urgente${urgentCount>1?"s":""}`}
            </div>
          </div>
          <button onClick={()=>setNewsOpen(false)} style={{background:"rgba(255,255,255,0.2)",border:"none",
            borderRadius:"50%",width:26,height:26,cursor:"pointer",color:"#fff",fontSize:13,
            display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>
        <div style={{overflowY:"auto",maxHeight:"calc(80vh - 64px)"}}>
          {newsItems.length===0&&(
            <div style={{padding:"32px 16px",textAlign:"center",color:C.lbl2,fontSize:14,fontFamily:SF}}>
              ¡Sin novedades! 🎉
            </div>
          )}
          {newsItems.map((n,i)=>{
            const isUrgent=n.type==="urgente";
            const expanded=selectedNewsId===n.id;
            return(
              <div key={n.id}>
                <div onClick={()=>setSelectedNewsId(expanded?null:n.id)}
                  style={{padding:"12px 14px",cursor:"pointer",borderLeft:`4px solid ${n.color}`,
                    background:isUrgent?`${C.red}06`:expanded?C.fill4:"transparent",
                    transition:"background 0.15s"}}>
                  <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                    <span style={{fontSize:20,flexShrink:0,marginTop:1}}>{n.icon}</span>
                    <div style={{flex:1,minWidth:0}}>
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
                        <div style={{fontSize:12,color:C.lbl2,fontFamily:SF,lineHeight:1.55,marginTop:6,
                          padding:"8px 10px",background:C.fill4,borderRadius:8}}>{n.body}</div>
                      )}
                    </div>
                  </div>
                </div>
                {i<newsItems.length-1&&<div style={{height:"0.5px",background:C.sep,marginLeft:48}}/>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ── News Bell Button ───────────────────────────────────────────────────────
  const NewsBell=()=>(
    <div style={{position:"fixed",top:58,right:14,zIndex:650}}>
      <button onClick={()=>setNewsOpen(o=>!o)}
        style={{width:38,height:38,borderRadius:"50%",
          background:newsOpen?"#fff":`linear-gradient(135deg,${T.accent},${T.accent}bb)`,
          border:newsOpen?`1.5px solid ${T.accent}`:"none",
          cursor:"pointer",boxShadow:"0 3px 14px rgba(0,0,0,0.18)",
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,
          transition:"all 0.2s",position:"relative"}}>
        <span style={{color:newsOpen?T.accent:"#fff"}}>🔔</span>
        {(urgentCount>0||(newsItems.length>0&&!newsOpen))&&(
          <span style={{position:"absolute",top:-4,right:-4,background:urgentCount>0?C.red:T.accent,
            color:"#fff",fontSize:9,fontWeight:800,borderRadius:"50%",
            minWidth:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",
            fontFamily:SF,border:"2px solid #fff",padding:"0 3px",lineHeight:1}}>
            {newsItems.length}
          </span>
        )}
      </button>
    </div>
  );

  // ── Shop View ──────────────────────────────────────────────────────────────
  if(shopSubject){
    const shopItems=MASCOT_SHOP[shopSubject]||[];
    const m=MASCOTS[shopSubject]||MASCOTS["Matemáticas"];
    const owned=ownedOutfits[shopSubject]||[];
    const equipped=equippedOutfit[shopSubject];
    const equippedItem=shopItems.find(i=>i.id===equipped);
    return(
      <div style={{background:T.bg,minHeight:"100vh",fontFamily:SF}}>
        <NavBar title={`Tienda — ${m.name}`} back="← Materia" onBack={()=>setShopSubject(null)} accent={m.color}/>
        <div style={{padding:"0 16px 100px"}}>
          {/* Mascot preview card */}
          <div style={{background:`linear-gradient(160deg,${m.color}22,${m.color}08)`,
            padding:"24px 20px",marginBottom:16,textAlign:"center",borderRadius:"0 0 24px 24px"}}>
            <div style={{display:"inline-block",marginBottom:12,
              filter:`drop-shadow(0 6px 16px ${m.color}40)`,
              animation:"mascotBob 2s ease-in-out infinite"}}>
              <MascotSVG subject={shopSubject} outfit={equipped} size={100}/>
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
                      <MascotSVG subject={shopSubject} outfit={item.id} size={54}/>
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
        <TabBar tabs={tabs} active="subjects" onChange={id=>{setShopSubject(null);setSelectedSubject(null);setTab(id);}} accent={T.accent}/>
      </div>
    );
  }

  // ── Subject Detail ─────────────────────────────────────────────────────────
  if(selectedSubject){
    const m=MASCOTS[selectedSubject]||MASCOTS["Matemáticas"];
    const sData=subjectData[selectedSubject]||{grade:7,tasks:[]};
    const progress=getMascotProgress(selectedSubject);
    const tasksDone=completedTasks[selectedSubject]||0;
    const equipped=equippedOutfit[selectedSubject];
    const equippedItem=MASCOT_SHOP[selectedSubject]?.find(i=>i.id===equipped);
    const mascotPx=32+Math.floor(progress/20)*8;

    return(
      <div style={{background:T.bg,minHeight:"100vh",fontFamily:SF,position:"relative",overflow:"hidden"}}>
        <FloatingMascot subject={selectedSubject} progress={progress}/>
        <NavBar title={selectedSubject} back="Materias" onBack={()=>setSelectedSubject(null)} accent={T.accent} bg={`${T.bg}ee`}/>
        <div style={{padding:"16px 16px 100px"}}>
          <Card style={{padding:20,marginBottom:14,background:`linear-gradient(135deg,${m.color}12,${m.color}04)`}}>
            <div style={{display:"flex",alignItems:"center",gap:16}}>
              <div style={{position:"relative",flexShrink:0}}>
                <div style={{width:mascotPx+28,height:mascotPx+28,borderRadius:20,background:`${m.color}18`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  boxShadow:`0 4px 16px ${m.color}30`,
                  animation:"mascotBob 2s ease-in-out infinite",transition:"all 0.5s ease",overflow:"visible"}}>
                  <MascotSVG subject={selectedSubject} outfit={equipped} size={mascotPx+16}/>
                </div>
                <div style={{position:"absolute",bottom:-5,right:-5,background:m.color,borderRadius:10,
                  padding:"2px 8px",fontSize:10,fontWeight:800,color:"#fff",fontFamily:SF,
                  boxShadow:`0 2px 8px ${m.color}50`}}>
                  Nv.{Math.floor(progress/20)+1}
                </div>
              </div>
              <div style={{flex:1}}>
                <div style={{...fmt.title3,color:C.lbl,fontFamily:SFD,marginBottom:2}}>{selectedSubject}</div>
                <div style={{...fmt.caption,color:m.color,fontWeight:600,fontFamily:SF,marginBottom:8}}>
                  {m.name} · {tasksDone} tareas completadas
                </div>
                <div style={{height:10,background:C.fill3,borderRadius:5,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${progress}%`,borderRadius:5,
                    background:`linear-gradient(90deg,${m.color},${m.color}bb)`,transition:"width 0.6s ease"}}/>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}>
                  <div style={{...fmt.caption2,color:C.lbl2,fontFamily:SF}}>Cal: {sData.grade.toFixed(1)}/10</div>
                  <div style={{display:"flex",alignItems:"center",gap:4}}>
                    <span style={{fontSize:12}}>🪙</span>
                    <span style={{fontWeight:700,color:"#9A7108",fontSize:12,fontFamily:SF}}>{currentTokens}</span>
                  </div>
                </div>
              </div>
            </div>
            <button onClick={()=>setShopSubject(selectedSubject)}
              style={{marginTop:14,width:"100%",background:`linear-gradient(135deg,${m.color},${m.color}cc)`,
                color:"#fff",border:"none",borderRadius:12,padding:"11px",fontSize:15,fontWeight:600,
                cursor:"pointer",fontFamily:SF,display:"flex",alignItems:"center",justifyContent:"center",gap:7,
                boxShadow:`0 4px 14px ${m.color}35`}}>
              👕 Tienda de Accesorios · {currentTokens} 🪙
            </button>
          </Card>

          <Sec title="Tareas y Actividades">
            {myContent.length===0&&(
              <div style={{padding:"20px 16px",textAlign:"center",color:C.lbl2,fontSize:15,fontFamily:SF}}>
                Sin actividades por ahora 🎉
              </div>
            )}
            {myContent.slice(0,6).map((c,i,arr)=>{
              const doneKey=`done_${c.id}`;
              const done=!!(completedTasks[doneKey]);
              return(
                <div key={c.id}>
                  <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px"}}>
                    <div style={{width:40,height:40,borderRadius:12,
                      background:done?`${C.green}18`:`${m.color}18`,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      fontSize:20,transition:"all 0.3s"}}>
                      {done?"✅":c.type==="tarea"?"📝":c.type==="examen"?"📋":"⚡"}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{...fmt.callout,fontWeight:600,fontFamily:SF,
                        color:done?C.lbl2:C.lbl,textDecoration:done?"line-through":"none"}}>{c.title}</div>
                      <div style={{...fmt.caption,color:C.lbl2,fontFamily:SF}}>
                        {done?"¡Completado! +2 🪙":`Entrega: ${c.date}`}
                      </div>
                    </div>
                    {!done&&(
                      <button onClick={()=>{
                        setCompletedTasks(t=>({...t,[doneKey]:true,[selectedSubject]:(t[selectedSubject]||0)+1}));
                        setTokens(p=>(p!==null?p:currentTokens)+2);
                      }} style={{background:`${m.color}18`,color:m.color,border:`1px solid ${m.color}40`,
                        borderRadius:10,padding:"6px 12px",fontSize:12,fontWeight:700,
                        cursor:"pointer",fontFamily:SF,whiteSpace:"nowrap"}}>
                        ✓ +2🪙
                      </button>
                    )}
                  </div>
                  {i<arr.length-1&&<Div indent={68}/>}
                </div>
              );
            })}
          </Sec>
        </div>
        <TabBar tabs={tabs} active="subjects" onChange={id=>{setSelectedSubject(null);setTab(id);}} accent={T.accent}/>
      </div>
    );
  }

  // ── Main Views ─────────────────────────────────────────────────────────────
  return(
    <div style={{background:T.bg,minHeight:"100vh",fontFamily:SF,position:"relative"}}>
      {(tab==="subjects"||tab==="medals")&&mySubjects.map((subj,i)=>(
        <FloatingMascot key={subj} subject={subj} progress={getMascotProgress(subj)} style={{zIndex:10+(i*2)}}/>
      ))}

      <NewsBell/>
      {newsOpen&&<NewsPanel/>}

      {/* ── TABLÓN ── */}
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
            <Feed state={state} setState={setState} userId={`s${studentId}`} userName={student?.name||"Alumno"}
              userAvatar={student?.avatar||"A"} userColor={T.accent} userRole="student" accent={T.accent}/>
          </div>
        </div>
      )}

      {/* ── MATERIAS ── */}
      {tab==="subjects"&&(
        <div style={{position:"relative",zIndex:20}}>
          <NavBar title="Mis Materias" large accent={T.accent} bg={`${T.bg}ee`}/>
          <div style={{padding:"16px 16px 100px"}}>
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
              const m=MASCOTS[subj]||MASCOTS["Matemáticas"];
              const sData=subjectData[subj]||{grade:7,tasks:[]};
              const progress=getMascotProgress(subj);
              const level=Math.floor(progress/20)+1;
              const equipped=equippedOutfit[subj];
              const equippedItem=MASCOT_SHOP[subj]?.find(i=>i.id===equipped);
              const mascotPx=24+Math.floor(progress/20)*4;
              return(
                <Card key={subj} style={{marginBottom:10}} onPress={()=>setSelectedSubject(subj)}>
                  <div style={{padding:"14px 16px",display:"flex",alignItems:"center",gap:14}}>
                    <div style={{position:"relative",flexShrink:0}}>
                      <div style={{width:56,height:56,borderRadius:16,background:`${m.color}12`,
                        display:"flex",alignItems:"center",justifyContent:"center",overflow:"visible"}}>
                        <MascotSVG subject={subj} outfit={equipped} size={50}/>
                      </div>
                      <div style={{position:"absolute",bottom:-4,right:-4,background:m.color,
                        borderRadius:8,padding:"1px 5px",fontSize:9,fontWeight:800,color:"#fff",fontFamily:SF}}>
                        Nv.{level}
                      </div>
                    </div>
                    <div style={{flex:1}}>
                      <div style={{...fmt.callout,fontWeight:600,color:C.lbl,fontFamily:SF}}>{subj}</div>
                      <div style={{...fmt.caption,color:m.color,fontWeight:600,fontFamily:SF,marginBottom:5}}>{m.name}</div>
                      <div style={{height:5,background:C.fill3,borderRadius:3,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${progress}%`,borderRadius:3,
                          background:`linear-gradient(90deg,${m.color},${m.color}bb)`,transition:"width 0.6s ease"}}/>
                      </div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:20,fontWeight:700,color:sData.grade>=9?C.green:sData.grade>=7?T.accent:C.orange,fontFamily:SF}}>{sData.grade.toFixed(1)}</div>
                      <div style={{fontSize:10,color:C.lbl3,fontFamily:SF}}>/ 10</div>
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
      {tab==="medals"&&(
        <div style={{position:"relative",zIndex:20}}>
          <NavBar title="Mis Logros" large accent={T.accent} bg={`${T.bg}ee`}/>
          <div style={{padding:"16px 16px 100px"}}>

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
                      {["1er","2do","3er"].map(p=>(
                        <td key={p} style={{fontSize:11,fontWeight:700,color:C.lbl2,textTransform:"uppercase",letterSpacing:"0.05em",paddingBottom:8,textAlign:"center",minWidth:48}}>{p}</td>
                      ))}
                      <td style={{fontSize:11,fontWeight:700,color:C.lbl2,textTransform:"uppercase",letterSpacing:"0.05em",paddingBottom:8,textAlign:"center",minWidth:48}}>Final</td>
                    </tr>
                  </thead>
                  <tbody>
                    {mySubjects.map((subj,i)=>{
                      const m=MASCOTS[subj]||MASCOTS["Matemáticas"];
                      const parciales=PARCIALES[subj]||[{p:"1er",g:7},{p:"2do",g:7},{p:"3er",g:7}];
                      const finalGrade=subjectData[subj]?.grade||7;
                      return(
                        <tr key={subj} style={{borderTop:i>0?`0.5px solid ${C.sep}`:"none"}}>
                          <td style={{padding:"10px 12px 10px 0",verticalAlign:"middle"}}>
                            <div style={{display:"flex",alignItems:"center",gap:6}}>
                              <span style={{fontSize:16}}>{m.emoji}</span>
                              <span style={{fontSize:12,fontWeight:600,color:C.lbl,fontFamily:SF}}>{subj.substring(0,5)}.</span>
                            </div>
                          </td>
                          {parciales.map(({g},pi)=>{
                            const col=g>=9?C.green:g>=7?T.accent:g>=6?C.orange:C.red;
                            return(
                              <td key={pi} style={{textAlign:"center",padding:"10px 4px",verticalAlign:"middle"}}>
                                <span style={{fontSize:14,fontWeight:700,color:col,fontFamily:SF}}>{g.toFixed(1)}</span>
                              </td>
                            );
                          })}
                          <td style={{textAlign:"center",padding:"10px 4px",verticalAlign:"middle"}}>
                            <div style={{background:`${finalGrade>=9?C.green:finalGrade>=7?T.accent:C.orange}18`,
                              borderRadius:8,padding:"3px 6px",display:"inline-block"}}>
                              <span style={{fontSize:14,fontWeight:800,
                                color:finalGrade>=9?C.green:finalGrade>=7?T.accent:C.orange,fontFamily:SF}}>
                                {finalGrade.toFixed(1)}
                              </span>
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
                  const equippedItem=MASCOT_SHOP[subj]?.find(i=>i.id===equipped);
                  const mascotPx=24+Math.floor(progress/20)*5;
                  return(
                    <button key={subj} onClick={()=>{setSelectedSubject(subj);setShopSubject(subj);}}
                      style={{background:`${m.color}12`,border:`1px solid ${m.color}25`,borderRadius:16,
                        padding:"14px 12px",textAlign:"center",cursor:"pointer",
                        transition:"transform 0.15s",minWidth:80,position:"relative"}}
                      onMouseEnter={e=>e.currentTarget.style.transform="scale(1.05)"}
                      onMouseLeave={e=>e.currentTarget.style.transform=""}>
                      <div style={{display:"inline-block",marginBottom:4}}>
                        <MascotSVG subject={subj} outfit={equipped} size={48}/>
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
          <div style={{padding:"16px 16px 100px"}}>
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
              <Row label="Notificaciones" icon="🔔" iconBg={`${C.red}20`} chevron onPress={()=>{}}/>
            </Sec>
            <Sec><Row label="Cerrar Sesión" icon="🚪" iconBg={`${C.red}15`} danger onPress={onLogout}/></Sec>
          </div>
        </div>
      )}

      <TabBar tabs={tabs} active={tab} onChange={setTab} accent={T.accent}/>
    </div>
  );
};


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
  const divId = "qr-reader-" + Math.random().toString(36).slice(2);
  const scannerRef = useRef(null);
  const [err, setErr] = useState(null);
  const [scanning, setScanning] = useState(false);
  const idRef = useRef(divId);

  useEffect(() => {
    let html5QrCode;
    const startScanner = async () => {
      try {
        const { Html5QrcodeScanner } = await import("html5-qrcode");
        html5QrCode = new Html5QrcodeScanner(idRef.current, { fps:10, qrbox:220, rememberLastUsedCamera:true }, false);
        html5QrCode.render(
          (text) => { html5QrCode.clear(); onScan(text); },
          (error) => {}
        );
        setScanning(true);
      } catch (e) {
        setErr("No se pudo iniciar la cámara. Verifica los permisos.");
      }
    };
    startScanner();
    return () => { try { html5QrCode?.clear(); } catch {} };
  }, []);

  return (
    <div style={{ background:"#fff", borderRadius:16, padding:16, textAlign:"center" }}>
      <div style={{ fontSize:13, color:C.lbl2, fontFamily:SF, marginBottom:12 }}>{label}</div>
      {err && <div style={{ color:C.red, fontSize:13, fontFamily:SF, marginBottom:8 }}>{err}</div>}
      <div id={idRef.current} style={{ borderRadius:12, overflow:"hidden" }}/>
      <button onClick={onClose} style={{ marginTop:12, background:C.fill4, border:"none", borderRadius:10,
        padding:"8px 20px", color:C.lbl2, fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:SF }}>
        Cancelar
      </button>
    </div>
  );
};

// ─── EMAIL HELPER ─────────────────────────────────────────────────────────────
const sendWelcomeEmail = async ({ toEmail, toName, key, role, group }) => {
  try {
    const ejs = await import("@emailjs/browser");
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(key)}`;
    await ejs.default.send(
      import.meta.env.VITE_EMAILJS_SERVICE_ID || "service_schoollms",
      import.meta.env.VITE_EMAILJS_TEMPLATE_ID || "template_schoollms",
      { to_email: toEmail, to_name: toName, access_key: key,
        role_label: role === "student" ? "Alumno" : "Docente",
        group_info: group || "", qr_url: qrUrl },
      import.meta.env.VITE_EMAILJS_PUBLIC_KEY || ""
    );
  } catch (e) {
    console.warn("Email no enviado:", e);
  }
};

// ─── ATTENDANCE MANUAL + QR PANEL ─────────────────────────────────────────────
const AttendancePanel = ({ people, attendanceMap, date, onMark, title = "Asistencia", accentColor = C.blue }) => {
  const [showQR, setShowQR] = useState(false);
  const [lastScanned, setLastScanned] = useState(null);

  const handleScan = (text) => {
    setShowQR(false);
    const person = people.find(p => p.key === text);
    if (person) {
      onMark(person.id, date, "present");
      setLastScanned(person.name);
      setTimeout(() => setLastScanned(null), 3000);
    } else {
      setLastScanned("⚠️ Código no reconocido");
      setTimeout(() => setLastScanned(null), 2000);
    }
  };

  const stats = {
    present: people.filter(p => attendanceMap[p.id] === "present").length,
    absent: people.filter(p => !attendanceMap[p.id] || attendanceMap[p.id] === "absent").length,
    justified: people.filter(p => attendanceMap[p.id] === "justified").length,
  };

  return (
    <div>
      {/* Stats */}
      <div style={{ display:"flex", gap:8, marginBottom:14 }}>
        {[["✅", stats.present, "Presentes", C.green], ["❌", stats.absent, "Ausentes", C.red], ["🟠", stats.justified, "Justificadas", C.orange]].map(([e,n,l,c]) => (
          <div key={l} style={{ flex:1, background:`${c}12`, borderRadius:10, padding:"8px", textAlign:"center" }}>
            <div style={{ fontSize:16 }}>{e}</div>
            <div style={{ fontSize:18, fontWeight:700, color:c, fontFamily:SF }}>{n}</div>
            <div style={{ fontSize:10, color:C.lbl2, fontFamily:SF }}>{l}</div>
          </div>
        ))}
      </div>

      {/* QR scan button */}
      <button onClick={() => setShowQR(true)}
        style={{ width:"100%", background:`linear-gradient(135deg,${accentColor},${accentColor}cc)`,
          border:"none", borderRadius:12, padding:"12px", color:"#fff", fontSize:15,
          fontWeight:700, cursor:"pointer", fontFamily:SF, marginBottom:12,
          display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
        📷 Escanear QR de Asistencia
      </button>

      {lastScanned && (
        <div style={{ background:`${C.green}15`, border:`1px solid ${C.green}30`, borderRadius:10,
          padding:"10px 14px", marginBottom:12, textAlign:"center", fontSize:14, color:C.green,
          fontFamily:SF, fontWeight:600 }}>
          ✅ Registrado: {lastScanned}
        </div>
      )}

      {showQR && (
        <div style={{ marginBottom:14 }}>
          <QRScanner onScan={handleScan} onClose={() => setShowQR(false)} label="Escanea el QR del alumno/docente"/>
        </div>
      )}

      {/* Manual list */}
      <Card>
        {people.map((p, i) => {
          const status = attendanceMap[p.id] || "unknown";
          return (
            <div key={p.id}>
              <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px" }}>
                <Ava initials={p.avatar} color={p.color} size={36}/>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:C.lbl, fontFamily:SF }}>{p.name}</div>
                  {p.group && <div style={{ fontSize:11, color:C.lbl2, fontFamily:SF }}>Grupo {p.group}</div>}
                </div>
                <div style={{ display:"flex", gap:5 }}>
                  {[["✅","present",C.green],["❌","absent",C.red],["🟠","justified",C.orange]].map(([e,s,c]) => (
                    <button key={s} onClick={() => onMark(p.id, date, s)}
                      style={{ width:32, height:32, borderRadius:8, border:"none", cursor:"pointer",
                        background: status===s ? c : `${c}20`,
                        fontSize:14, transition:"all 0.15s",
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
                  <Ava initials={p.avatar} color={p.color} size={36}/>
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

  const go=fn=>{setFade(false);setTimeout(()=>{fn();setFade(true);},180);};

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
      const t=state.teachers.find(t=>t.key===form.key);
      if(!t){setErr("Clave de docente incorrecta. Verifica tu código generado.");return;}
      const techEmail=`${form.key.toLowerCase().replace(/[^a-z0-9]/g,"")}@school.app`;
      const techPass=`pwd_${form.key}_secure`;
      try {
        await signInWithEmailAndPassword(auth,techEmail,techPass);
      } catch {
        try { await createUserWithEmailAndPassword(auth,techEmail,techPass); } catch {}
      }
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

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App(){
  const [screen,setScreen]=useState("loading");
  const [role,setRole]=useState(null);
  const [userId,setUserId]=useState(null);
  const [state,setState]=useState(initialState);
  const unsubs = useRef([]);

  // ── Load all Firebase collections ────────────────────────────────────────
  useEffect(() => {
    const loadAll = () => {
      const listen = (col, key, field=null) => {
        const q = field ? query(collection(db, col), orderBy(field,"desc")) : collection(db, col);
        return onSnapshot(q, snap => {
          const data = snap.docs.map(d => ({ ...d.data(), id: d.id }));
          setState(prev => ({ ...prev, [key]: data }));
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
        listen("pendingContent","pendingContent","_createdAt"),
        listen("approvedContent","approvedContent","_createdAt"),
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
    };

    // Check if Firebase has data, if not seed it
    getDocs(collection(db, "students")).then(snap => {
      if (snap.empty) {
        // Seed initial data
        const batch = writeBatch(db);
        for (const s of initialState.students) {
          const ref = doc(collection(db, "students"));
          batch.set(ref, { name:s.name, group:s.group, grade:s.grade, section:s.section,
            parentEmail:s.parentEmail, parentContact:s.parentContact, key:s.key,
            avatar:s.avatar, color:s.color, participation:s.participation||0,
            tabBoardLikes:s.tabBoardLikes||0, attendance:s.attendance||[], subjects:s.subjects||{} });
        }
        for (const t of initialState.teachers) {
          const ref = doc(collection(db, "teachers"));
          batch.set(ref, { name:t.name, email:t.email, contact:t.contact,
            subjects:t.subjects||[], groups:t.groups||[], key:t.key, avatar:t.avatar, color:t.color });
        }
        for (const g of initialState.groups) {
          const ref = doc(collection(db, "groups"));
          batch.set(ref, { name:g.name, grade:g.grade, section:g.section,
            subject:g.subject||"", students:g.students||[] });
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
      setScreen(user ? "app" : "login");
    });
    // Short timeout for initial load
    setTimeout(() => setScreen(prev => prev === "loading" ? "login" : prev), 1200);
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
      // Sync attendance
      if (next.students !== prev.students) {
        next.students.forEach(s => {
          const old = prev.students.find(ps => ps.id === s.id);
          if (old && s.attendance !== old.attendance && typeof s.id === "string") {
            updateDoc(doc(db, "students", s.id), { attendance: s.attendance, subjects: s.subjects||{}, participation: s.participation||0 });
          }
        });
      }
      return next;
    });
  }, []);

  const login=(r,id)=>{setRole(r);setUserId(id);setScreen("app");};
  const logout=()=>{
    setRole(null);setUserId(null);setScreen("login");
    signOut(auth).catch(()=>{});
  };

  if (screen === "loading") return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
      background:C.bg2, flexDirection:"column", gap:16 }}>
      <div style={{ fontSize:48 }}>🎓</div>
      <div style={{ fontSize:17, fontWeight:600, color:C.lbl2, fontFamily:SF }}>Cargando SchoolLMS…</div>
    </div>
  );

  return(
    <>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased;}
        body{background:#F2F2F7;max-width:600px;margin:0 auto;}
        ::-webkit-scrollbar{width:3px;}
        ::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.12);border-radius:2px;}
        input,textarea,select{-webkit-appearance:none;appearance:none;}
        button{-webkit-tap-highlight-color:transparent;}
        @keyframes mascotBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        @keyframes scanLine{0%{top:0;opacity:1}100%{top:100%;opacity:0.1}}
        @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
      `}</style>
      {screen==="login"&&<Login state={state} onLogin={login}/>}
      {screen==="app"&&role==="developer"&&<DeveloperApp state={state} setState={fbSetState} onLogout={logout}/>}
      {screen==="app"&&role==="director"&&<DirectorApp state={state} setState={fbSetState} onLogout={logout}/>}
      {screen==="app"&&role==="teacher"&&<TeacherApp state={state} setState={fbSetState} teacherId={userId||1} onLogout={logout}/>}
      {screen==="app"&&role==="student"&&<StudentApp state={state} setState={fbSetState} studentId={userId||1} onLogout={logout}/>}
      {screen==="app"&&role&&<AIButton role={role} state={state}/>}
    </>
  );
}
