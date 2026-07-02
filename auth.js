const ADMIN_PASSWORD = "123456";

function login(){
    let pass = document.getElementById("password").value;
    if(pass === ADMIN_PASSWORD){
        sessionStorage.setItem("adminLogin", "true");
        document.getElementById("loginBox").style.display = "none";
        document.getElementById("adminPanel").style.display = "block";
        loadAdmin();
    }else{
        alert("Wrong Password");
    }
}

function logout(){
    sessionStorage.removeItem("adminLogin");
    location.reload();
}
