/* ==========================================
   IMPORTS
========================================== */

import { db } from "../firebase/firebase-config.js";

import {
    collection,
    addDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

/* ==========================================
   ADD STUDENT FUNCTION
========================================== */

export async function addStudent(){

    try{

        const student = {

            studentId : "STU001",

            name : "Ahmed Ali",

            fatherName : "Muhammad Ali",

            phone : "03001234567",

            courses : ["Mathematics","Physics"],

            monthlyFee : 3000,

            status : "Active",

            createdAt : new Date()

        };

        const docRef = await addDoc(

            collection(db,"students"),

            student

        );

        console.log("Student Added Successfully");

        console.log(docRef.id);

    }

    catch(error){

        console.error(error);

    }

}
