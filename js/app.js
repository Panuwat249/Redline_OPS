let performanceChart = null;

const startMonthSelect = document.getElementById("startMonth");
const endMonthSelect = document.getElementById("endMonth");
const applyBtn = document.getElementById("applyBtn");

init();

function init() {
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

    if (selectedData.length === 0) {
        alert("ไม่พบข้อมูลในช่วงเดือนที่เลือก");
        return;
    }

    const calculatedData = calculateAverageData(selectedData);

    updateTextSummary(selectedData);
    updateKpiCards(calculatedData, selectedData.length);
    updateChart(selectedData);
}

function getSelectedRangeData() {
    const startId = startMonthSelect.value;
    const endId = endMonthSelect.value;

    const startIndex = statistics.findIndex(item => item.id === startId);
    const endIndex = statistics.findIndex(item => item.id === endId);

    if (startIndex === -1 || endIndex === -1) {
        return [];
    }

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
    const total = items.reduce((sum, item) => {
        return sum + Number(item[group][key] || 0);
    }, 0);

    return total / items.length;
}

function updateTextSummary(items) {
    const first = items[0];
    const last = items[items.length - 1];

    if (items.length === 1) {
        document.getElementById("selectedRangeText").textContent = first.month;
        document.getElementById("summaryPeriod").textContent = first.month;
        document.getElementById("calculationMode").textContent = "แสดงค่าของเดือนที่เลือก";
    } else {
        document.getElementById("selectedRangeText").textContent =
            `${first.month} - ${last.month}`;

        document.getElementById("summaryPeriod").textContent =
            `${first.month} ถึง ${last.month}`;

        document.getElementById("calculationMode").textContent =
            `ค่าเฉลี่ยจาก ${items.length} เดือน`;
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
    document.getElementById(id).textContent = value;
}

function formatPercent(value) {
    const rounded = roundSmart(value);
    return `${rounded}%`;
}

function formatNumber(value, isSingleMonth) {
    const rounded = isSingleMonth
        ? Math.round(value)
        : roundSmart(value);

    return Number(rounded).toLocaleString("th-TH");
}

function roundSmart(value) {
    const rounded = Math.round(value * 100) / 100;

    if (Number.isInteger(rounded)) {
        return rounded;
    }

    return rounded.toFixed(2);
}

function updateChart(items) {
    const labels = items.map(item => item.month);

    const onTimeValues = items.map(item => item.onTime.total);
    const reliabilityValues = items.map(item => item.reliability.total);
    const availabilityValues = items.map(item => item.availability.total);

    const ctx = document.getElementById("performanceChart");

    if (performanceChart) {
        performanceChart.destroy();
    }

    performanceChart = new Chart(ctx, {
        type: "bar",

        data: {
            labels: labels,

            datasets: [
                {
                    label: "ความต่อต่อเวลา",
                    data: onTimeValues,
                    backgroundColor: "rgba(239, 35, 60, 0.88)",
                    borderColor: "rgba(181, 18, 27, 1)",
                    borderWidth: 1,
                    borderRadius: 14,
                    barPercentage: 0.7,
                    categoryPercentage: 0.72
                },
                {
                    label: "ความน่าเชื่อถือ",
                    data: reliabilityValues,
                    backgroundColor: "rgba(123, 44, 191, 0.88)",
                    borderColor: "rgba(91, 33, 182, 1)",
                    borderWidth: 1,
                    borderRadius: 14,
                    barPercentage: 0.7,
                    categoryPercentage: 0.72
                },
                {
                    label: "ความพร้อมของขบวนรถไฟ",
                    data: availabilityValues,
                    backgroundColor: "rgba(0, 119, 182, 0.88)",
                    borderColor: "rgba(3, 105, 161, 1)",
                    borderWidth: 1,
                    borderRadius: 14,
                    barPercentage: 0.7,
                    categoryPercentage: 0.72
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
                        font: {
                            family: "Sarabun",
                            size: 14,
                            weight: "bold"
                        }
                    }
                },

                tooltip: {
                    backgroundColor: "#111827",
                    titleColor: "#ffffff",
                    bodyColor: "#ffffff",
                    padding: 14,
                    cornerRadius: 14,
                    titleFont: {
                        family: "Sarabun",
                        size: 14,
                        weight: "bold"
                    },
                    bodyFont: {
                        family: "Sarabun",
                        size: 14
                    },
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.raw}%`;
                        }
                    }
                }
            },

            scales: {
                y: {
                    min: 90,
                    max: 100,
                    ticks: {
                        color: "#64748b",
                        callback: function(value) {
                            return value + "%";
                        },
                        font: {
                            family: "Sarabun",
                            weight: "bold"
                        }
                    },
                    grid: {
                        color: "rgba(148, 163, 184, 0.22)"
                    },
                    border: {
                        display: false
                    }
                },

                x: {
                    ticks: {
                        color: "#475569",
                        font: {
                            family: "Sarabun",
                            weight: "bold"
                        }
                    },
                    grid: {
                        display: false
                    },
                    border: {
                        display: false
                    }
                }
            }
        }
    });
}
