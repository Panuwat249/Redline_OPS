if(sessionStorage.getItem("adminAuth") !== "true"){
window.location.href = "admin-login.html";
}

let data = JSON.parse(localStorage.getItem("dashboardData")) || {};

for(let key in data){
if(document.getElementById(key)){
document.getElementById(key).value = data[key];
}
}

function saveData(){

let newData = {
month:document.getElementById("month").value,
punctuality:parseInt(document.getElementById("punctuality").value),
reliability:parseInt(document.getElementById("reliability").value),
readiness:parseInt(document.getElementById("readiness").value),
total_distance:parseInt(document.getElementById("total_distance").value),
total_trip:parseInt(document.getElementById("total_trip").value),
cancel_total:parseInt(document.getElementById("cancel_total").value)
};

localStorage.setItem("dashboardData", JSON.stringify(newData));

alert("บันทึกสำเร็จ");
window.location.href = "index.html";
}
