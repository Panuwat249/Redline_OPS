document.getElementById("date").innerText =
  new Date().toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
