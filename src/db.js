import { db, auth } from "./firebase";
import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  getDocs, getDoc, onSnapshot, query, orderBy, where,
  serverTimestamp, writeBatch
} from "firebase/firestore";
import {
  signInWithEmailAndPassword, signOut,
  createUserWithEmailAndPassword, onAuthStateChanged
} from "firebase/auth";

// ─── COLLECTIONS ──────────────────────────────────────────────────────────────
const COL = {
  students:   "students",
  teachers:   "teachers",
  groups:     "groups",
  posts:      "posts",
  attendance: "attendance",
  cycles:     "cycles",
  avisos:     "avisos",
  actividades:"actividades",
  pendingContent: "pendingContent",
  approvedContent: "approvedContent",
  teacherAttendance: "teacherAttendance",
  settings:   "settings",
};

// ─── AUTH ─────────────────────────────────────────────────────────────────────
export const loginDirector = (email, password) =>
  signInWithEmailAndPassword(auth, email, password);

export const loginByKey = async (collectionName, key) => {
  const q = query(collection(db, collectionName), where("key", "==", key));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docData = { id: snap.docs[0].id, ...snap.docs[0].data() };
  const techEmail = `${key.toLowerCase().replace(/[^a-z0-9]/g, "")}@school.app`;
  const techPass  = `pwd_${key}_secure`;
  try {
    await signInWithEmailAndPassword(auth, techEmail, techPass);
  } catch {
    try { await createUserWithEmailAndPassword(auth, techEmail, techPass); }
    catch {}
  }
  return docData;
};

export const logoutUser = () => signOut(auth);

export const onAuthChange = (cb) => onAuthStateChanged(auth, cb);

// ─── REAL-TIME LISTENERS ──────────────────────────────────────────────────────
export const listenCollection = (colName, cb, orderField = null) => {
  const q = orderField
    ? query(collection(db, colName), orderBy(orderField))
    : collection(db, colName);
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
};

export const listenDoc = (colName, docId, cb) =>
  onSnapshot(doc(db, colName, docId), (d) => {
    if (d.exists()) cb({ id: d.id, ...d.data() });
  });

// ─── STUDENTS ─────────────────────────────────────────────────────────────────
export const addStudent = async (data) => {
  const ref = await addDoc(collection(db, COL.students), {
    ...data,
    attendance: [],
    subjects: {},
    participation: 0,
    tabBoardLikes: 0,
    createdAt: serverTimestamp(),
  });
  return ref.id;
};

export const updateStudent = (id, data) =>
  updateDoc(doc(db, COL.students, id), data);

export const deleteStudent = (id) =>
  deleteDoc(doc(db, COL.students, id));

// ─── TEACHERS ─────────────────────────────────────────────────────────────────
export const addTeacher = async (data) => {
  const ref = await addDoc(collection(db, COL.teachers), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
};

export const updateTeacher = (id, data) =>
  updateDoc(doc(db, COL.teachers, id), data);

export const deleteTeacher = (id) =>
  deleteDoc(doc(db, COL.teachers, id));

// ─── GROUPS ───────────────────────────────────────────────────────────────────
export const addGroup = async (data) => {
  const ref = await addDoc(collection(db, COL.groups), {
    ...data,
    students: [],
    createdAt: serverTimestamp(),
  });
  return ref.id;
};

export const updateGroup = (id, data) =>
  updateDoc(doc(db, COL.groups, id), data);

export const deleteGroup = (id) =>
  deleteDoc(doc(db, COL.groups, id));

// ─── POSTS ────────────────────────────────────────────────────────────────────
export const addPost = async (data) => {
  const ref = await addDoc(collection(db, COL.posts), {
    ...data,
    likes: [],
    comments: [],
    createdAt: serverTimestamp(),
  });
  return ref.id;
};

export const updatePost = (id, data) =>
  updateDoc(doc(db, COL.posts, id), data);

export const deletePost = (id) =>
  deleteDoc(doc(db, COL.posts, id));

// ─── ATTENDANCE ───────────────────────────────────────────────────────────────
export const markAttendance = async (studentId, date, status) => {
  const q = query(
    collection(db, COL.attendance),
    where("studentId", "==", studentId),
    where("date", "==", date)
  );
  const snap = await getDocs(q);
  if (snap.empty) {
    await addDoc(collection(db, COL.attendance), { studentId, date, status });
  } else {
    await updateDoc(snap.docs[0].ref, { status });
  }
};

export const markTeacherAttendance = async (teacherId, date, status, time) => {
  const docId = `${date}_${teacherId}`;
  await setDoc(doc(db, COL.teacherAttendance, docId), {
    teacherId, date, status, time: time || null
  });
};

// ─── CYCLES ───────────────────────────────────────────────────────────────────
export const addCycle = async (name) => {
  const ref = await addDoc(collection(db, COL.cycles), { name, active: false });
  return ref.id;
};

export const setActiveCycle = async (id) => {
  const snap = await getDocs(collection(db, COL.cycles));
  const batch = writeBatch(db);
  snap.docs.forEach(d => {
    batch.update(d.ref, { active: d.id === id });
  });
  await batch.commit();
};

// ─── AVISOS ───────────────────────────────────────────────────────────────────
export const addAviso = async (data) => {
  await addDoc(collection(db, COL.avisos), {
    ...data,
    read: false,
    createdAt: serverTimestamp(),
  });
};

export const markAvisoRead = (id) =>
  updateDoc(doc(db, COL.avisos, id), { read: true });

// ─── ACTIVIDADES ──────────────────────────────────────────────────────────────
export const addActividad = async (data) => {
  await addDoc(collection(db, COL.actividades), {
    ...data,
    status: "pendiente",
    createdAt: serverTimestamp(),
  });
};

export const updateActividad = (id, data) =>
  updateDoc(doc(db, COL.actividades, id), data);

// ─── CONTENT APPROVAL ─────────────────────────────────────────────────────────
export const submitContent = async (data) => {
  await addDoc(collection(db, COL.pendingContent), {
    ...data,
    createdAt: serverTimestamp(),
  });
};

export const approveContent = async (id) => {
  const docRef = doc(db, COL.pendingContent, id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return;
  await addDoc(collection(db, COL.approvedContent), snap.data());
  await deleteDoc(docRef);
};

export const rejectContent = (id) =>
  deleteDoc(doc(db, COL.pendingContent, id));

// ─── SEED — corre UNA sola vez para subir datos iniciales ─────────────────────
export const seedInitialData = async (initialState) => {
  const batch = writeBatch(db);

  // Students
  for (const s of initialState.students) {
    const ref = doc(collection(db, COL.students));
    batch.set(ref, {
      name: s.name, group: s.group, grade: s.grade, section: s.section,
      parentEmail: s.parentEmail, parentContact: s.parentContact,
      key: s.key, avatar: s.avatar, color: s.color,
      participation: s.participation || 0, tabBoardLikes: s.tabBoardLikes || 0,
      attendance: s.attendance || [], subjects: s.subjects || {},
    });
  }

  // Teachers
  for (const t of initialState.teachers) {
    const ref = doc(collection(db, COL.teachers));
    batch.set(ref, {
      name: t.name, email: t.email, contact: t.contact,
      subjects: t.subjects || [], groups: t.groups || [],
      key: t.key, avatar: t.avatar, color: t.color,
    });
  }

  // Groups
  for (const g of initialState.groups) {
    const ref = doc(collection(db, COL.groups));
    batch.set(ref, {
      name: g.name, grade: g.grade, section: g.section,
      subject: g.subject, students: g.students || [],
    });
  }

  // Posts
  for (const p of initialState.posts) {
    const ref = doc(collection(db, COL.posts));
    batch.set(ref, {
      authorName: p.authorName, authorRole: p.authorRole,
      avatar: p.avatar, avatarColor: p.avatarColor,
      title: p.title, body: p.body, type: p.type,
      likes: p.likes || [], comments: p.comments || [],
      time: p.time,
    });
  }

  // Cycles
  const ref = doc(collection(db, COL.cycles));
  batch.set(ref, { name: "2025–2026", active: true });

  await batch.commit();
  console.log("✅ Seed completado");
};
