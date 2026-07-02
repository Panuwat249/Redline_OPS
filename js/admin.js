const ADMIN_PASSWORD = "123456";

function login(){

const password =
document.getElementById("password").value;

if(password===ADMIN_PASSWORD){

document
.getElementById("adminPanel")
.style.display="block";

}

else{

alert("รหัสผ่านไม่ถูกต้อง");

}

}

function saveMonth(){

alert(
"เชื่อม Firebase Firestore ได้เลย"
);

}
