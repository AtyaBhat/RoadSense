// public/js/home.js

// ==============================
// Scroll Reveal Animation
// ==============================

const observer = new IntersectionObserver(
    (entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add("show");
            }
        });
    },
    {
        threshold: 0.15
    }
);

document
    .querySelectorAll(
        ".feature-card, .category-card, .report-card, .why-card, .stat-card, .timeline-item"
    )
    .forEach((el) => observer.observe(el));


// ==============================
// Animated Counters
// ==============================

const counters = document.querySelectorAll(".counter");

const counterObserver = new IntersectionObserver(
    (entries) => {

        entries.forEach((entry) => {

            if (!entry.isIntersecting) return;

            const counter = entry.target;

            const target = parseInt(counter.dataset.target);

            let value = 0;

            const increment = Math.max(1, Math.ceil(target / 120));

            function update() {

                value += increment;

                if (value >= target) {

                    value = target;

                }

                counter.innerText = value.toLocaleString();

                if (value < target) {

                    requestAnimationFrame(update);

                }

            }

            update();

            counterObserver.unobserve(counter);

        });

    },
    {
        threshold: 0.4
    }
);

counters.forEach(counter => counterObserver.observe(counter));


// ==============================
// Smooth Scrolling
// ==============================

document.querySelectorAll('a[href^="#"]').forEach(anchor => {

    anchor.addEventListener("click", function (e) {

        const target = document.querySelector(this.getAttribute("href"));

        if (!target) return;

        e.preventDefault();

        target.scrollIntoView({

            behavior: "smooth"

        });

    });

});


// ==============================
// Floating Phone Animation
// ==============================

const phone = document.querySelector(".phone");

if (phone) {

    let angle = 0;

    function animatePhone() {

        angle += 0.02;

        phone.style.transform =
            `translateY(${Math.sin(angle) * 8}px) rotate(${Math.sin(angle) * 1.5}deg)`;

        requestAnimationFrame(animatePhone);

    }

    animatePhone();

}


// ==============================
// Parallax Background Blobs
// ==============================

window.addEventListener("mousemove", (e) => {

    const blobs = document.querySelectorAll(".blob");

    const x = e.clientX / window.innerWidth;

    const y = e.clientY / window.innerHeight;

    blobs.forEach((blob, index) => {

        const speed = (index + 1) * 15;

        blob.style.transform =
            `translate(${x * speed}px, ${y * speed}px)`;

    });

});


// ==============================
// Navbar Active Link
// ==============================

const current = window.location.pathname;

document.querySelectorAll(".nav-link").forEach(link => {

    if (link.getAttribute("href") === current) {

        link.classList.add("active");

    }

});


// ==============================
// Button Ripple Effect
// ==============================

document.querySelectorAll(".btn-primary,.btn-secondary").forEach(btn => {

    btn.addEventListener("click", function (e) {

        const ripple = document.createElement("span");

        ripple.className = "ripple";

        const rect = this.getBoundingClientRect();

        ripple.style.left = `${e.clientX - rect.left}px`;

        ripple.style.top = `${e.clientY - rect.top}px`;

        this.appendChild(ripple);

        setTimeout(() => ripple.remove(), 600);

    });

});