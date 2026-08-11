import { db } from "../firebase/firebase-config.js";

import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

/* =========================================================
   SSHACMS - FEE MANAGEMENT
   JavaScript ONLY
   CSS is in ../css/fees.css
========================================================= */

(() => {

    /* Prevent accidental duplicate initialization */
    if (window.__SSHACMS_FEE_MODULE_STARTED__) {
        console.warn(
            "⚠️ Fee Management already initialized. Skipping duplicate start."
        );
        return;
    }

    window.__SSHACMS_FEE_MODULE_STARTED__ = true;

    const start = () => {

        const tableBody =
            document.getElementById("feesTableBody");

        if (!tableBody) {
            console.error(
                "❌ feesTableBody not found."
            );
            return;
        }

        const monthInput =
            document.getElementById("feeMonth");

        const searchInput =
            document.getElementById("feeStudentSearch");

        const statusFilter =
            document.getElementById("feeStatusFilter");

        const totalEl =
            document.getElementById("feeTotalStudents");

        const paidEl =
            document.getElementById("feePaidStudents");

        const pendingEl =
            document.getElementById("feePendingStudents");

        const collectedEl =
            document.getElementById("feeCollectedAmount");

        let students = [];
        let records = [];
        let month = currentMonth();


        /* =====================================================
           INITIAL MONTH
        ===================================================== */

        if (monthInput) {

            monthInput.value = month;

            monthInput.addEventListener(
                "change",
                () => {

                    month =
                        monthInput.value ||
                        currentMonth();

                    render();
                }
            );
        }


        /* =====================================================
           SEARCH
        ===================================================== */

        if (searchInput) {

            searchInput.addEventListener(
                "input",
                render
            );

        }


        /* =====================================================
           STATUS FILTER
        ===================================================== */

        if (statusFilter) {

            statusFilter.addEventListener(
                "change",
                render
            );

        }


        /* =====================================================
           LOAD STUDENTS
        ===================================================== */

        onSnapshot(

            collection(db, "students"),

            snapshot => {

                students =
                    snapshot.docs.map(item => ({
                        id: item.id,
                        ...item.data()
                    }));

                console.log(
                    "✅ Fee Management - Students loaded:",
                    students.length
                );

                render();

            },

            error => {

                console.error(
                    "❌ Students Firestore Error:",
                    error
                );

                tableBody.innerHTML = `
                    <tr>
                        <td colspan="9" class="empty">
                            Unable to load students.
                            Please check Firestore permissions.
                        </td>
                    </tr>
                `;
            }

        );


        /* =====================================================
           LOAD FEE RECORDS
        ===================================================== */

        onSnapshot(

            collection(db, "fees"),

            snapshot => {

                records =
                    snapshot.docs.map(item => ({
                        id: item.id,
                        ...item.data()
                    }));

                console.log(
                    "✅ Fee Management - Fee records loaded:",
                    records.length
                );

                render();

            },

            error => {

                console.error(
                    "❌ Fees Firestore Error:",
                    error
                );

                tableBody.innerHTML = `
                    <tr>
                        <td colspan="9" class="empty">
                            Unable to load fee records.
                            Please check Firestore rules.
                        </td>
                    </tr>
                `;
            }

        );


        /* =====================================================
           FIND CURRENT PAYMENT
        ===================================================== */

        function findPayment(
            studentId,
            selectedMonth
        ) {

            return records.find(
                record =>
                    record.studentDocId === studentId &&
                    record.month === selectedMonth &&
                    record.status === "paid"
            );
        }


        /* =====================================================
           RENDER
        ===================================================== */

        function render() {

            const search =
                searchInput
                    ? searchInput.value
                        .toLowerCase()
                        .trim()
                    : "";

            const filter =
                statusFilter
                    ? statusFilter.value
                    : "all";


            const rows =
                students

                    .map(student => {

                        const payment =
                            findPayment(
                                student.id,
                                month
                            );


                        const lastPaid =
                            records

                                .filter(
                                    record =>
                                        record.studentDocId ===
                                            student.id &&
                                        record.status ===
                                            "paid" &&
                                        record.month
                                )

                                .sort(
                                    (a, b) =>
                                        String(b.month)
                                            .localeCompare(
                                                String(a.month)
                                            )
                                )[0];


                        return {

                            student,

                            payment,

                            lastPaid,

                            status:
                                payment
                                    ? "paid"
                                    : "unpaid"

                        };

                    })


                    .filter(row => {

                        const student =
                            row.student;


                        const searchableText = [

                            student.name,

                            student.studentId,

                            student.phone,

                            student.course,

                            student.batch,

                            student.fatherName

                        ]

                            .filter(Boolean)

                            .join(" ")

                            .toLowerCase();


                        const matchesSearch =
                            !search ||
                            searchableText.includes(
                                search
                            );


                        const matchesStatus =
                            filter === "all" ||
                            filter === row.status;


                        return (
                            matchesSearch &&
                            matchesStatus
                        );

                    });


            /* =================================================
               SUMMARY
            ================================================= */

            const paidRecords =
                students

                    .map(student =>
                        findPayment(
                            student.id,
                            month
                        )
                    )

                    .filter(Boolean);


            const totalStudents =
                students.length;


            const paidStudents =
                paidRecords.length;


            const pendingStudents =
                Math.max(
                    totalStudents -
                    paidStudents,
                    0
                );


            const collectedAmount =
                paidRecords.reduce(
                    (sum, record) =>
                        sum +
                        Number(
                            record.amount || 0
                        ),
                    0
                );


            if (totalEl) {

                totalEl.textContent =
                    totalStudents;

            }


            if (paidEl) {

                paidEl.textContent =
                    paidStudents;

            }


            if (pendingEl) {

                pendingEl.textContent =
                    pendingStudents;

            }


            if (collectedEl) {

                collectedEl.textContent =
                    `₨ ${money(
                        collectedAmount
                    )}`;

            }


            /* =================================================
               TABLE
            ================================================= */

            tableBody.innerHTML =

                rows.length

                    ? rows
                        .map(buildRow)
                        .join("")

                    : `
                        <tr>
                            <td
                                colspan="9"
                                class="empty"
                            >
                                No students found.
                            </td>
                        </tr>
                    `;


            bindTableActions();

        }


        /* =====================================================
           BUILD ROW
        ===================================================== */

        function buildRow({
            student,
            payment,
            lastPaid
        }) {

            const amount =
                Number(
                    student.monthlyFee ??
                    payment?.amount ??
                    0
                );


            return `

                <tr>

                    <td>

                        <strong>
                            ${esc(
                                student.studentId ||
                                "—"
                            )}
                        </strong>

                    </td>


                    <td>

                        <div class="fee-student-name">

                            ${esc(
                                student.name ||
                                "—"
                            )}

                        </div>

                        <div class="fee-student-phone">

                            ${esc(
                                student.phone ||
                                ""
                            )}

                        </div>

                    </td>


                    <td>

                        ${esc(
                            student.course ||
                            "—"
                        )}

                    </td>


                    <td>

                        ${esc(
                            student.batch ||
                            "—"
                        )}

                    </td>


                    <td>

                        <div class="fee-amount">

                            ₨ ${money(
                                amount
                            )}

                        </div>


                        <button
                            type="button"
                            class="fee-link-btn"
                            data-fee-action="fee"
                            data-student-id="${escAttr(
                                student.id
                            )}"
                        >

                            Set Fee

                        </button>

                    </td>


                    <td>

                        ${
                            payment

                                ? `
                                    <span
                                        class="fee-badge paid"
                                    >
                                        ✓ Paid
                                    </span>
                                `

                                : `
                                    <span
                                        class="fee-badge unpaid"
                                    >
                                        ● Unpaid
                                    </span>
                                `
                        }

                    </td>


                    <td>

                        ${
                            lastPaid
                                ? formatMonth(
                                    lastPaid.month
                                )
                                : "—"
                        }

                    </td>


                    <td>

                        ${
                            payment?.paymentDate

                                ? formatDate(
                                    payment.paymentDate
                                )

                                : "—"
                        }

                    </td>


                    <td>

                        <div class="fee-actions">

                            ${
                                payment

                                    ? `
                                        <button
                                            type="button"
                                            class="fee-action danger"
                                            data-fee-action="undo"
                                            data-student-id="${escAttr(
                                                student.id
                                            )}"
                                        >
                                            Undo
                                        </button>
                                    `

                                    : `
                                        <button
                                            type="button"
                                            class="fee-action success"
                                            data-fee-action="paid"
                                            data-student-id="${escAttr(
                                                student.id
                                            )}"
                                        >
                                            ✓ Mark Paid
                                        </button>
                                    `
                            }


                            <button
                                type="button"
                                class="fee-action secondary"
                                data-fee-action="history"
                                data-student-id="${escAttr(
                                    student.id
                                )}"
                            >

                                History

                            </button>

                        </div>

                    </td>

                </tr>

            `;
        }


        /* =====================================================
           TABLE BUTTONS
        ===================================================== */

        function bindTableActions() {

            tableBody
                .querySelectorAll(
                    "[data-fee-action]"
                )
                .forEach(button => {

                    button.addEventListener(
                        "click",
                        async () => {

                            if (button.disabled) {
                                return;
                            }


                            const student =
                                students.find(
                                    item =>
                                        item.id ===
                                        button.dataset.studentId
                                );


                            if (!student) {

                                console.error(
                                    "Student not found:",
                                    button.dataset.studentId
                                );

                                return;
                            }


                            const action =
                                button.dataset.feeAction;


                            if (
                                action === "paid"
                            ) {

                                openPayment(
                                    student
                                );

                            }


                            else if (
                                action === "undo"
                            ) {

                                await undoPayment(
                                    student
                                );

                            }


                            else if (
                                action === "fee"
                            ) {

                                await setFee(
                                    student
                                );

                            }


                            else if (
                                action === "history"
                            ) {

                                history(
                                    student
                                );

                            }

                        }
                    );

                });

        }


        /* =====================================================
           SET MONTHLY FEE
        ===================================================== */

        async function setFee(student) {

            const value =
                prompt(
                    `Monthly fee for ${student.name}:`,
                    student.monthlyFee ?? ""
                );


            if (value === null) {
                return;
            }


            const amount =
                Number(
                    String(value)
                        .replace(/,/g, "")
                        .trim()
                );


            if (
                !Number.isFinite(amount) ||
                amount < 0
            ) {

                alert(
                    "Please enter a valid fee amount."
                );

                return;
            }


            try {

                await updateDoc(

                    doc(
                        db,
                        "students",
                        student.id
                    ),

                    {
                        monthlyFee:
                            amount,

                        feeUpdatedAt:
                            serverTimestamp()
                    }

                );


                toast(
                    "Monthly fee updated."
                );


            } catch (error) {

                console.error(
                    "Set Fee Error:",
                    error
                );


                alert(
                    "Unable to update fee:\n\n" +
                    error.message
                );

            }

        }


        /* =====================================================
           PAYMENT MODAL
        ===================================================== */

        function openPayment(student) {

            /*
             * Safety protection.
             * Only ONE Fee modal can exist.
             */

            const existingModal =
                document.querySelector(
                    ".fee-modal-overlay"
                );


            if (existingModal) {
                existingModal.remove();
            }


            const existing =
                findPayment(
                    student.id,
                    month
                );


            console.log(
                "Opening payment for:",
                student.name ||
                student.studentId ||
                student.id
            );


            const overlay =
                document.createElement(
                    "div"
                );


            overlay.className =
                "fee-modal-overlay";


            overlay.innerHTML = `

                <div
                    class="fee-modal"
                    role="dialog"
                    aria-modal="true"
                >

                    <div class="fee-modal-head">

                        <div>

                            <div class="fee-modal-title">

                                Mark Fee Paid

                            </div>


                            <div class="fee-modal-subtitle">

                                ${esc(
                                    student.name ||
                                    "Student"
                                )}

                                •

                                ${formatMonth(
                                    month
                                )}

                            </div>

                        </div>


                        <button
                            type="button"
                            class="fee-modal-close"
                            aria-label="Close"
                        >

                            ×

                        </button>

                    </div>


                    <form
                        class="fee-payment-form"
                    >

                        <div
                            class="fee-form-grid"
                        >

                            <label>

                                Student ID

                                <input
                                    value="${escAttr(
                                        student.studentId ||
                                        ""
                                    )}"
                                    disabled
                                >

                            </label>


                            <label>

                                Amount (PKR)

                                <input
                                    name="amount"
                                    type="number"
                                    min="1"
                                    step="1"
                                    value="${Number(
                                        student.monthlyFee ??
                                        existing?.amount ??
                                        0
                                    )}"
                                    required
                                >

                            </label>


                            <label>

                                Payment Date

                                <input
                                    name="paymentDate"
                                    type="date"
                                    value="${today()}"
                                    required
                                >

                            </label>


                            <label>

                                Month

                                <input
                                    value="${formatMonth(
                                        month
                                    )}"
                                    disabled
                                >

                            </label>

                        </div>


                        <label
                            class="fee-note-label"
                        >

                            Note (optional)

                            <textarea
                                name="note"
                                rows="3"
                                placeholder="e.g. Paid in cash"
                            ></textarea>

                        </label>


                        <div
                            class="fee-modal-actions"
                        >

                            <button
                                type="button"
                                class="fee-secondary-btn fee-cancel"
                            >

                                Cancel

                            </button>


                            <button
                                type="submit"
                                class="fee-primary-btn"
                            >

                                Save Payment

                            </button>

                        </div>

                    </form>

                </div>

            `;


            document.body.appendChild(
                overlay
            );


            const close = () => {

                if (
                    overlay.isConnected
                ) {

                    overlay.remove();

                }

            };


            overlay
                .querySelector(
                    ".fee-modal-close"
                )
                ?.addEventListener(
                    "click",
                    close
                );


            overlay
                .querySelector(
                    ".fee-cancel"
                )
                ?.addEventListener(
                    "click",
                    close
                );


            overlay.addEventListener(
                "click",
                event => {

                    if (
                        event.target ===
                        overlay
                    ) {

                        close();

                    }

                }
            );


            const form =
                overlay.querySelector(
                    ".fee-payment-form"
                );


            form.addEventListener(
                "submit",
                async event => {

                    event.preventDefault();


                    const amount =
                        Number(
                            form.elements
                                .amount
                                .value
                        );


                    const paymentDate =
                        form.elements
                            .paymentDate
                            .value;


                    const note =
                        form.elements
                            .note
                            .value
                            .trim();


                    if (
                        !Number.isFinite(
                            amount
                        ) ||
                        amount <= 0 ||
                        !paymentDate
                    ) {

                        alert(
                            "Please enter a valid amount and payment date."
                        );

                        return;
                    }


                    const submit =
                        form.querySelector(
                            'button[type="submit"]'
                        );


                    submit.disabled =
                        true;


                    submit.textContent =
                        "Saving...";


                    try {

                        const old =
                            findPayment(
                                student.id,
                                month
                            );


                        const data = {

                            studentDocId:
                                student.id,

                            studentId:
                                student.studentId ||
                                "",

                            studentName:
                                student.name ||
                                "",

                            course:
                                student.course ||
                                "",

                            batch:
                                student.batch ||
                                "",

                            month,

                            amount,

                            paymentDate,

                            note,

                            status:
                                "paid",

                            updatedAt:
                                serverTimestamp()

                        };


                        if (old) {

                            await updateDoc(

                                doc(
                                    db,
                                    "fees",
                                    old.id
                                ),

                                data

                            );

                        } else {

                            await addDoc(

                                collection(
                                    db,
                                    "fees"
                                ),

                                {
                                    ...data,

                                    createdAt:
                                        serverTimestamp()
                                }

                            );

                        }


                        /*
                         * Keep monthly fee synchronized.
                         */

                        if (
                            Number(
                                student.monthlyFee ||
                                0
                            ) !== amount
                        ) {

                            await updateDoc(

                                doc(
                                    db,
                                    "students",
                                    student.id
                                ),

                                {
                                    monthlyFee:
                                        amount
                                }

                            );

                        }


                        close();


                        toast(
                            "Fee payment saved successfully."
                        );


                    } catch (error) {

                        console.error(
                            "❌ PAYMENT SAVE ERROR:",
                            error
                        );


                        alert(
                            "Unable to save payment:\n\n" +
                            error.message
                        );


                        submit.disabled =
                            false;


                        submit.textContent =
                            "Save Payment";

                    }

                }
            );


            setTimeout(
                () => {

                    overlay
                        .querySelector(
                            'input[name="amount"]'
                        )
                        ?.focus();

                },
                0
            );

        }


        /* =====================================================
           UNDO PAYMENT
        ===================================================== */

        async function undoPayment(
            student
        ) {

            const record =
                findPayment(
                    student.id,
                    month
                );


            if (!record) {
                return;
            }


            const confirmed =
                confirm(
                    `Undo ${formatMonth(
                        record.month
                    )} fee payment for ${
                        student.name ||
                        "this student"
                    }?`
                );


            if (!confirmed) {
                return;
            }


            try {

                await deleteDoc(

                    doc(
                        db,
                        "fees",
                        record.id
                    )

                );


                toast(
                    "Payment marked as unpaid."
                );


            } catch (error) {

                console.error(
                    "Undo Payment Error:",
                    error
                );


                alert(
                    "Unable to undo payment:\n\n" +
                    error.message
                );

            }

        }


        /* =====================================================
           HISTORY
        ===================================================== */

        function history(student) {

            const list =
                records

                    .filter(
                        record =>
                            record.studentDocId ===
                                student.id &&
                            record.status ===
                                "paid"
                    )

                    .sort(
                        (a, b) =>
                            String(b.month)
                                .localeCompare(
                                    String(a.month)
                                )
                    );


            const existingModal =
                document.querySelector(
                    ".fee-modal-overlay"
                );


            if (existingModal) {
                existingModal.remove();
            }


            const overlay =
                document.createElement(
                    "div"
                );


            overlay.className =
                "fee-modal-overlay";


            overlay.innerHTML = `

                <div
                    class="fee-modal fee-history-modal"
                    role="dialog"
                    aria-modal="true"
                >

                    <div
                        class="fee-modal-head"
                    >

                        <div>

                            <div
                                class="fee-modal-title"
                            >

                                Payment History

                            </div>


                            <div
                                class="fee-modal-subtitle"
                            >

                                ${esc(
                                    student.name ||
                                    "Student"
                                )}

                                •

                                ${esc(
                                    student.studentId ||
                                    ""
                                )}

                            </div>

                        </div>


                        <button
                            type="button"
                            class="fee-modal-close"
                            aria-label="Close"
                        >

                            ×

                        </button>

                    </div>


                    <div
                        class="fee-history-body"
                    >

                        ${
                            list.length

                                ? list
                                    .map(
                                        record => `

                                            <div
                                                class="fee-history-item"
                                            >

                                                <div>

                                                    <strong>

                                                        ${formatMonth(
                                                            record.month
                                                        )}

                                                    </strong>


                                                    <span>

                                                        ${esc(
                                                            record.paymentDate ||
                                                            "—"
                                                        )}

                                                    </span>

                                                </div>


                                                <strong>

                                                    ₨ ${money(
                                                        record.amount
                                                    )}

                                                </strong>

                                            </div>

                                        `
                                    )
                                    .join("")

                                : `

                                    <div
                                        class="fee-history-empty"
                                    >

                                        No payment history found.

                                    </div>

                                `
                        }

                    </div>

                </div>

            `;


            document.body.appendChild(
                overlay
            );


            const close = () => {

                if (
                    overlay.isConnected
                ) {

                    overlay.remove();

                }

            };


            overlay
                .querySelector(
                    ".fee-modal-close"
                )
                ?.addEventListener(
                    "click",
                    close
                );


            overlay.addEventListener(
                "click",
                event => {

                    if (
                        event.target ===
                        overlay
                    ) {

                        close();

                    }

                }
            );

        }

    };


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            start,
            {
                once: true
            }
        );

    } else {

        start();

    }

})();


/* =========================================================
   HELPERS
========================================================= */

function currentMonth() {

    const date =
        new Date();

    return (
        date.getFullYear() +
        "-" +
        String(
            date.getMonth() + 1
        ).padStart(2, "0")
    );

}


function today() {

    const date =
        new Date();

    return (
        date.getFullYear() +
        "-" +
        String(
            date.getMonth() + 1
        ).padStart(2, "0") +
        "-" +
        String(
            date.getDate()
        ).padStart(2, "0")
    );

}


function formatMonth(value) {

    const [
        year,
        month
    ] =
        String(
            value || ""
        ).split("-");


    if (
        !year ||
        !month
    ) {

        return "—";

    }


    return new Date(
        Number(year),
        Number(month) - 1,
        1
    ).toLocaleDateString(
        "en-US",
        {
            month: "short",
            year: "numeric"
        }
    );

}


function formatDate(value) {

    const date =
        new Date(
            `${value}T00:00:00`
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return value;

    }


    return date.toLocaleDateString(
        "en-GB",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );

}


function money(value) {

    return Number(
        value || 0
    ).toLocaleString(
        "en-PK"
    );

}


function esc(value) {

    return String(
        value ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


function escAttr(value) {

    return esc(value)
        .replace(
            /`/g,
            "&#096;"
        );

}


function toast(message) {

    const old =
        document.querySelector(
            ".fee-toast"
        );


    if (old) {
        old.remove();
    }


    const notification =
        document.createElement(
            "div"
        );


    notification.className =
        "fee-toast";


    notification.textContent =
        message;


    document.body.appendChild(
        notification
    );


    requestAnimationFrame(
        () => {

            notification.classList.add(
                "show"
            );

        }
    );


    setTimeout(
        () => {

            notification.classList.remove(
                "show"
            );


            setTimeout(
                () => {

                    notification.remove();

                },
                180
            );

        },
        2500
    );

}
