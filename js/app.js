let performanceChart = null;

const startMonthSelect = document.getElementById("startMonth");
const endMonthSelect = document.getElementById("endMonth");
const applyBtn = document.getElementById("applyBtn");

document.addEventListener("DOMContentLoaded", init);

function init() {
    if (!Array.isArray(statistics) || statistics.length === 0) {
        alert("ไม่พบข้อมูลใน js/data.js");
        return;
    }

    populateMonthOptions();

    const lastIndex = statistics.length - 1;
    startMonthSelect.value = statistics[lastIndex].id;
    endMonthSelect.value = statistics[lastIndex].id;

    renderDashboard();
    applyBtn.addEventListener("click", renderDashboard);
}

function populateMonthOptions() {
    startMonthSelect.innerHTML = "";
    endMonthSelect.innerHTML = "";

    statistics.forEach(item => {
        const startOption = document.createElement("option");
        startOption.value = item.id;
        startOption.textContent = item.month;

        const endOption = document.createElement("option");
        endOption.value = item.id;
        endOption.textContent = item.month;

        startMonthSelect.appendChild(startOption);
        endMonthSelect.appendChild(endOption);
    });
}

function renderDashboard() {
    const selectedData = getSelectedRangeData();
    if (selectedData.length === 0) return;

    const calculatedData = calculateAverageData(selectedData);
    updateTextSummary(selectedData);
    updateKpiCards(calculatedData, selectedData.length);
    updateChart(selectedData);
}

function getSelectedRangeData() {
    const startIndex = statistics.findIndex(item => item.id === startMonthSelect.value);
    const endIndex = statistics.findIndex(item => item.id === endMonthSelect.value);

    const from = Math.min(startIndex, endIndex);
    const to = Math.max(startIndex, endIndex);
    return statistics.slice(from, to + 1);
}

function calculateAverageData(items) {
    return {
        onTime: {
            north: average(items, "onTime", "north"),
            west: average(items, "onTime", "west"),
            total: average(items, "onTime", "total")
        },
        reliability: {
            north: average(items, "reliability", "north"),
            west: average(items, "reliability", "west"),
            total: average(items, "reliability", "total")
        },
        availability: {
            north: average(items, "availability", "north"),
            west: average(items, "availability", "west"),
            total: average(items, "availability", "total")
        },
        distance: {
            north: average(items, "distance", "north"),
            west: average(items, "distance", "west"),
            total: average(items, "distance", "total")
        },
        trips: {
            north: average(items, "trips", "north"),
            west: average(items, "trips", "west"),
            total: average(items, "trips", "total")
        },
        cancelled: {
            north: average(items, "cancelled", "north"),
            west: average(items, "cancelled", "west"),
            total: average(items, "cancelled", "total")
        }
    };
}

function average(items, group, key) {
    return items.reduce((sum, item) => sum + Number(item[group][key] || 0), 0) / items.length;
}

function updateTextSummary(items) {
    const first = items[0];
    const last = items[items.length - 1];

    if (items.length === 1) {
        setText("selectedRangeText", first.month);
        setText("summaryPeriod", first.month);
        setText("calculationMode", "แสดงค่าของเดือนที่เลือก");
    } else {
        setText("selectedRangeText", `${first.month} - ${last.month}`);
        setText("summaryPeriod", `${first.month} ถึง ${last.month}`);
        setText("calculationMode", `ค่าเฉลี่ยจาก ${items.length} เดือน`);
    }
}

function updateKpiCards(data, monthCount) {
    const isSingleMonth = monthCount === 1;

    setText("onTimeTotal", formatPercent(data.onTime.total));
    setText("onTimeNorth", formatPercent(data.onTime.north));
    setText("onTimeWest", formatPercent(data.onTime.west));

    setText("reliabilityTotal", formatPercent(data.reliability.total));
    setText("reliabilityNorth", formatPercent(data.reliability.north));
    setText("reliabilityWest", formatPercent(data.reliability.west));

    setText("availabilityTotal", formatPercent(data.availability.total));
    setText("availabilityNorth", formatPercent(data.availability.north));
    setText("availabilityWest", formatPercent(data.availability.west));

    setText("distanceTotal", formatNumber(data.distance.total, isSingleMonth));
    setText("distanceNorth", formatNumber(data.distance.north, isSingleMonth));
    setText("distanceWest", formatNumber(data.distance.west, isSingleMonth));

    setText("tripsTotal", formatNumber(data.trips.total, isSingleMonth));
    setText("tripsNorth", formatNumber(data.trips.north, isSingleMonth));
    setText("tripsWest", formatNumber(data.trips.west, isSingleMonth));

    setText("cancelledTotal", formatNumber(data.cancelled.total, isSingleMonth));
    setText("cancelledNorth", formatNumber(data.cancelled.north, isSingleMonth));
    setText("cancelledWest", formatNumber(data.cancelled.west, isSingleMonth));
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function formatPercent(value) {
    return `${roundSmart(value)}%`;
}

function formatNumber(value, isSingleMonth) {
    const rounded = isSingleMonth ? Math.round(value) : roundSmart(value);
    return Number(rounded).toLocaleString("th-TH");
}

function roundSmart(value) {
    const rounded = Math.round(value * 100) / 100;
    return Number.isInteger(rounded) ? rounded : rounded.toFixed(2);
}

function updateChart(items) {
    const labels = items.map(item => item.month);

    const ctx = document.getElementById("performanceChart");
    if (performanceChart) performanceChart.destroy();

    performanceChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [
                {
                    label: "ความต่อต่อเวลา",
                    data: items.map(item => item.onTime.total),
                    backgroundColor: "rgba(239, 35, 60, 0.88)",
                    borderColor: "rgba(181, 18, 27, 1)",
                    borderWidth: 1,
                    borderRadius: 14
                },
                {
                    label: "ความน่าเชื่อถือ",
                    data: items.map(item => item.reliability.total),
                    backgroundColor: "rgba(123, 44, 191, 0.88)",
                    borderColor: "rgba(91, 33, 182, 1)",
                    borderWidth: 1,
                    borderRadius: 14
                },
                {
                    label: "ความพร้อมของขบวนรถไฟ",
                    data: items.map(item => item.availability.total),
                    backgroundColor: "rgba(0, 119, 182, 0.88)",
                    borderColor: "rgba(3, 105, 161, 1)",
                    borderWidth: 1,
                    borderRadius: 14
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "bottom",
                    labels: {
                        color: "#334155",
                        usePointStyle: true,
                        pointStyle: "circle",
                        padding: 24,
                        font: { family: "Sarabun", size: 14, weight: "bold" }
                    }
                },
                tooltip: {
                    backgroundColor: "#111827",
                    padding: 14,
                    cornerRadius: 14,
                    callbacks: {
                        label: context => `${context.dataset.label}: ${context.raw}%`
                    }
                }
            },
            scales: {
                y: {
                    min: 90,
                    max: 100,
                    ticks: {
                        callback: value => value + "%",
                        font: { family: "Sarabun", weight: "bold" }
                    },
                    grid: { color: "rgba(148, 163, 184, 0.22)" },
                    border: { display: false }
                },
                x: {
                    ticks: { font: { family: "Sarabun", weight: "bold" } },
                    grid: { display: false },
                    border: { display: false }
                }
            }
        }
    });
}
