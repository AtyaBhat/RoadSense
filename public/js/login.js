
const togglePassword = document.getElementById("togglePassword");
const password = document.getElementById("password");

togglePassword.addEventListener("click",()=>{

if(password.type==="password"){
    password.type="text";
    togglePassword.innerHTML="visibility_off";
}

else{
    password.type="password";
    togglePassword.innerHTML="visibility";
}

});