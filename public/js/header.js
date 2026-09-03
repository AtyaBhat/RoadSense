// public/js/header.js

document.addEventListener("DOMContentLoaded", () => {

    // ==========================================
    // Navbar scroll effect
    // ==========================================

    const header = document.querySelector(".header");
    const navbar = document.querySelector(".glass-navbar");

    function updateNavbar() {

        if (window.scrollY > 40) {

            header.classList.add("scrolled");
            navbar.classList.add("scrolled");

        } else {

            header.classList.remove("scrolled");
            navbar.classList.remove("scrolled");

        }

    }

    updateNavbar();

    window.addEventListener("scroll", updateNavbar);



    // ==========================================
    // Active Page Highlight
    // ==========================================

    const current = window.location.pathname;

    document.querySelectorAll(".nav-link").forEach(link => {

        const href = link.getAttribute("href");

        if (!href || href === "#") return;

        if (
            href === current ||
            (href !== "/" && current.startsWith(href))
        ) {

            link.classList.add("active");

        }

    });



    // ==========================================
    // Close mobile menu after clicking link
    // ==========================================

    if (window.innerWidth < 992) {

        const navbarCollapse = document.getElementById("mainNavbar");

        document.querySelectorAll(".nav-link").forEach(link => {

            link.addEventListener("click", () => {

                if (navbarCollapse.classList.contains("show")) {

                    $(".navbar-collapse").collapse("hide");

                }

            });

        });

    }



    // ==========================================
    // Logo glow effect
    // ==========================================

    const logo = document.querySelector(".logo-circle");

    if (logo) {

        setInterval(() => {

            logo.animate(
                [
                    {
                        boxShadow: "0 0 20px rgba(53,134,255,.35)"
                    },
                    {
                        boxShadow: "0 0 35px rgba(87,183,255,.85)"
                    },
                    {
                        boxShadow: "0 0 20px rgba(53,134,255,.35)"
                    }
                ],
                {
                    duration: 2500
                }
            );

        }, 2500);

    }



    // ==========================================
    // Navbar tilt effect (desktop only)
    // ==========================================

    if (window.innerWidth > 992 && navbar) {

        document.addEventListener("mousemove", (e) => {

            const x = (e.clientX / window.innerWidth - 0.5) * 6;
            const y = (e.clientY / window.innerHeight - 0.5) * 6;

            navbar.style.transform =
                `perspective(1200px) rotateX(${-y}deg) rotateY(${x}deg)`;

        });

        document.addEventListener("mouseleave", () => {

            navbar.style.transform =
                "perspective(1200px) rotateX(0deg) rotateY(0deg)";

        });

    }



    // ==========================================
    // Dropdown hover on desktop
    // ==========================================

    if (window.innerWidth > 991) {

        $(".dropdown").hover(

            function () {

                $(this)
                    .find(".dropdown-menu")
                    .stop(true, true)
                    .delay(100)
                    .fadeIn(180);

            },

            function () {

                $(this)
                    .find(".dropdown-menu")
                    .stop(true, true)
                    .delay(100)
                    .fadeOut(180);

            }

        );

    }

});