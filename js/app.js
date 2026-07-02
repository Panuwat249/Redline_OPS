const selector =
document.getElementById("monthSelector");

statistics.forEach(item=>{

const option =
document.createElement("option");

option.value=item.id;
option.textContent=item.month;

selector.appendChild(option);

});

showData(statistics[0]);

selector.addEventListener("change",()=>{

const found =
statistics.find(
s=>s.id===selector.value
);

showData(found);

});

function showData(data){

monthText.innerHTML=data.month;

ontimeNorth.innerHTML=data.onTime.north+"%";
ontimeWest.innerHTML=data.onTime.west+"%";
ontimeTotal.innerHTML=data.onTime.total+"%";

availNorth.innerHTML=data.availability.north+"%";
availWest.innerHTML=data.availability.west+"%";
availTotal.innerHTML=data.availability.total+"%";

reliNorth.innerHTML=data.reliability.north+"%";
reliWest.innerHTML=data.reliability.west+"%";
reliTotal.innerHTML=data.reliability.total+"%";

distanceNorth.innerHTML=data.distance.north.toLocaleString();
distanceWest.innerHTML=data.distance.west.toLocaleString();
distanceTotal.innerHTML=data.distance.total.toLocaleString();

tripNorth.innerHTML=data.trips.north.toLocaleString();
tripWest.innerHTML=data.trips.west.toLocaleString();
tripTotal.innerHTML=data.trips.total.toLocaleString();

cancelNorth.innerHTML=data.cancelled.north;
cancelWest.innerHTML=data.cancelled.west;
cancelTotal.innerHTML=data.cancelled.total;
}
