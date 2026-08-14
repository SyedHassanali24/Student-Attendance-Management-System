/* =========================================================
   STUDENT DATA SAFETY FIX
   This file MUST NEVER create a student automatically.

   The old version contained hard-coded demo data (Ahmed Ali / STU001)
   and could insert that record whenever addStudent() was triggered.
   Real student creation is now controlled only by the Admin form.
========================================================= */

import { db } from "../firebase/firebase-config.js";
import {
    collection,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

/*
 * Safe API for any legacy caller.
 * Calling addStudent() without real data does NOTHING.
 * No demo/random student is ever generated.
 */
export async function addStudent(data = null) {
    if (!data || typeof data !== "object") {
        console.warn("SSHACMS: automatic student creation blocked. Provide real student data from Admin.");
        return null;
    }

    const student = {
        name: String(data.name || "").trim(),
        fatherName: String(data.fatherName || "").trim(),
        phone: String(data.phone || "").trim(),
        course: String(data.course || "").trim(),
        batch: String(data.batch || "").trim(),
        admissionDate: String(data.admissionDate || "").trim(),
        studentId: String(data.studentId || "").trim(),
        createdAt: data.createdAt || serverTimestamp()
    };

    /* Never allow an incomplete/placeholder student to be created. */
    if (!student.name || !student.fatherName || !student.phone || !student.course || !student.batch) {
        throw new Error("Real student information is required. No student was created.");
    }

    if (!student.studentId) {
        throw new Error("Student ID is required. No student was created.");
    }

    const docRef = await addDoc(collection(db, "students"), student);
    console.log("Student added by explicit Admin action:", docRef.id);
    return docRef;
}
