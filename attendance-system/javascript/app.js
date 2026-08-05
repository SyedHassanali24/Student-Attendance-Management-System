/* ==========================================
   PROJECT STARTED
========================================== */

console.log("Sir Syed Hassan Ali Coaching Management System Loaded Successfully.");

/* ==========================================
   SIMPLE COUNTER ANIMATION
========================================== */

const counters = document.querySelectorAll(".stat-card h3");

counters.forEach(counter => {

    const targetText = counter.innerText;

    const target = parseInt(targetText);

    if (isNaN(target)) return;

    let current = 0;

    const increment = Math.ceil(target / 50);

    const updateCounter = () => {

        current += increment;

        if(current >= target){

            counter.innerText = targetText;

        }else{

            counter.innerText = current;

            requestAnimationFrame(updateCounter);

        }

    };

    updateCounter();

});
