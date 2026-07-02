let currentData = {};

fetch("data.json")
.then(res => res.json())
.then(data => {
currentData = data;

for(let key in data){
if(document.getElementById(key)){
document.getElementById(key).value = data[key];
}
}
});

function saveData(){

currentData.month =
document.getElementById("month").value;

currentData.punctuality =
parseInt(document.getElementById("punctuality").value);

currentData.reliability =
parseInt(document.getElementById("reliability").value);

currentData.readiness =
parseInt(document.getElementById("readiness").value);

currentData.north_distance =
parseInt(document.getElementById("north_distance").value);

currentData.west_distance =
parseInt(document.getElementById("west_distance").value);

currentData.total_distance =
parseInt(document.getElementById("total_distance").value);

currentData.north_trip =
parseInt(document.getElementById("north_trip").value);

currentData.west_trip =
parseInt(document.getElementById("west_trip").value);

currentData.total_trip =
parseInt(document.getElementById("total_trip").value);

currentData.cancel_north =
parseInt(document.getElementById("cancel_north").value);

currentData.cancel_west =
parseInt(document.getElementById("cancel_west").value);

currentData.cancel_total =
parseInt(document.getElementById("cancel_total").value);

alert("พร้อมบันทึก (ต้องต่อ backend จริง เช่น PHP / Node.js)");
}
