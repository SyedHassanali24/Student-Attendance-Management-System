import { auth, db } from "../firebase/firebase-config.js";
import { collection, doc, addDoc, updateDoc, getDocs, query, where, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

/* SSHACMS — SAFE ATTENDANCE ENHANCER
   Important performance rule: this module NEVER observes or rewrites
   #attendanceTableBody. admin.js owns that table. This keeps Firestore
   live updates and the attendance controls independent, preventing the
   browser freeze that occurred after the responsive