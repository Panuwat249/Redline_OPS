fetch("data.json")
.then(res => res.json())
.then(data => {

document.getElementById("month").innerText = data.month;

document.getElementById("punctuality").innerText = data.punctuality + "%";
document.getElementById("reliability").innerText = data.reliability + "%";
document.getElementById("readiness").innerText = data.readiness + "%";

document.getElementById("north_distance").innerText =
data.north_distance.toLocaleString();

document.getElementById("west_distance").innerText =
data.west_distance.toLocaleString();

document.getElementById("total_distance").innerText =
data.total_distance.toLocaleString();

document.getElementById("north_trip").innerText =
data.north_trip.toLocaleString();

document.getElementById("west_trip").innerText =
data.west_trip.toLocaleString();

document.getElementById("total_trip").innerText =
data.total_trip.toLocaleString();

document.getElementById("cancel_north").innerText = data.cancel_north;
document.getElementById("cancel_west").innerText = data.cancel_west;
document.getElementById("cancel_total").innerText = data.cancel_total;

document.getElementById("graph").src = data.graph;

});
