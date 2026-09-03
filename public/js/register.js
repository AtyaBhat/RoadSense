const form = document.querySelector("form");

const password = document.getElementById("password");
const confirmPassword = document.getElementById("confirmPassword");
const passwordError = document.getElementById("passwordError");

function validatePasswords() {

    if (confirmPassword.value === "") {
        passwordError.textContent = "";
        confirmPassword.style.borderColor = "";
        return true;
    }

    if (password.value === confirmPassword.value) {
        passwordError.textContent = "";
        confirmPassword.style.borderColor = "";
        return true;
    }

    passwordError.textContent = "Passwords do not match.";
    confirmPassword.style.borderColor = "#ff6b6b";
    return false;
}

password.addEventListener("input", validatePasswords);
confirmPassword.addEventListener("input", validatePasswords);

form.addEventListener("submit", function (e) {

    if (!validatePasswords()) {
        e.preventDefault();
        confirmPassword.focus();
    }

});