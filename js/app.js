let performanceChart = null;

let punctuality5Chart = null;
let onTimeChart = null;
let reliabilityChart = null;
let availabilityChart = null;

document.addEventListener("DOMContentLoaded", init);

function init() {
    const data = window.statistics || statistics;

    if (!Array.isArray(data) || data.length === 0) {
        alert("ไม่พบข้อมูลใน js/data.js");
        console.error("ไม่พบข้อมูล statistics หรือ window.statistics");
        return;
    }

    populateMonthOptions(data);

    const lastIndex = data.length - 1;

    document.getElementById("startMonth").value = data[lastIndex].id;
    document.getElementById("endMonth").value = data[lastIndex].id;

    renderDashboard();

    document
        .getElementById("applyBtn")
        .addEventListener("click", renderDashboard);
}

function populateMonthOptions(data) {
    const startMonthSelect = document.getElementById("startMonth");
    const endMonthSelect = document.getElementById("endMonth");

    startMonthSelect.innerHTML = "";
    endMonthSelect.innerHTML = "";

    data.forEach(item => {
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

    const calculatedData = calculateDisplayData(selectedData);

    updateTextSummary(selectedData);
    updateKpiCards(calculatedData);
    
    // กราฟเดิมที่รวม KPI ทั้งหมดไว้ในกราฟเดียว
    updateChart(selectedData);

    // กราฟแยกรายตัว 4 กราฟด้านล่าง
    updateSeparateCharts(selectedData);

}

function getSelectedRangeData() {
    const data = window.statistics || statistics;

    const startMonthSelect = document.getElementById("startMonth");
    const endMonthSelect = document.getElementById("endMonth");

    const startIndex = data.findIndex(item => item.id === startMonthSelect.value);
    const endIndex = data.findIndex(item => item.id === endMonthSelect.value);

    if (startIndex === -1 || endIndex === -1) {
        return [];
    }

    const from = Math.min(startIndex, endIndex);
    const to = Math.max(startIndex, endIndex);

    return data.slice(from, to + 1);
}

function calculateDisplayData(items) {
    return {
        // KPI: ถ้าเลือกหลายเดือนให้ใช้ค่าเฉลี่ย
        onTime: {
            north: average(items, "onTime", "north"),
            west: average(items, "onTime", "west"),
            total: average(items, "onTime", "total")
        },

        
        punctuality5: {
            north: average(items, "punctuality5", "north"),
            west: average(items, "punctuality5", "west"),
            total: average(items, "punctuality5", "total")
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

        // Operation: ถ้าเลือกหลายเดือนให้ใช้ผลรวม
        // ถ้าเลือกเดือนเดียว ผลรวมจะเท่ากับค่าของเดือนนั้น
        distance: {
            north: sum(items, "distance", "north"),
            west: sum(items, "distance", "west"),
            total: sum(items, "distance", "total")
        },

        trips: {
            north: sum(items, "trips", "north"),
            west: sum(items, "trips", "west"),
            total: sum(items, "trips", "total")
        },

        cancelled: {
            north: sum(items, "cancelled", "north"),
            west: sum(items, "cancelled", "west"),
            total: sum(items, "cancelled", "total")
        }
    };
}

function average(items, group, key) {
    return sum(items, group, key) / items.length;
}

function sum(items, group, key) {
    return items.reduce((total, item) => {
        return total + Number(item[group][key] || 0);
    }, 0);
}

function updateTextSummary(items) {
    const first = items[0];
    const last = items[items.length - 1];

    if (items.length === 1) {
        setText("selectedRangeText", first.month);
        setText("summaryPeriod", first.month);
        setText("calculationMode", "แสดงค่าของเดือนที่เลือก");
        setText("operationCalculationMode", "แสดงค่าของเดือนที่เลือก");
    } else {
        setText("selectedRangeText", `${first.month} - ${last.month}`);
        setText("summaryPeriod", `${first.month} ถึง ${last.month}`);
        setText("calculationMode", `KPI เฉลี่ยจาก ${items.length} เดือน`);
        setText(
            "operationCalculationMode",
            `ข้อมูลการเดินรถเป็นผลรวมจาก ${items.length} เดือน`
        );
    }
}

function updateKpiCards(data) {
    setText("onTimeTotal", formatPercent(data.onTime.total));
    setText("onTimeNorth", formatPercent(data.onTime.north));
    setText("onTimeWest", formatPercent(data.onTime.west));

    setText("punctuality5Total", formatPercent(data.punctuality5.total));
    setText("punctuality5North", formatPercent(data.punctuality5.north));
    setText("punctuality5West", formatPercent(data.punctuality5.west));
    
    setText("reliabilityTotal", formatPercent(data.reliability.total));
    setText("reliabilityNorth", formatPercent(data.reliability.north));
    setText("reliabilityWest", formatPercent(data.reliability.west));

    setText("availabilityTotal", formatPercent(data.availability.total));
    setText("availabilityNorth", formatPercent(data.availability.north));
    setText("availabilityWest", formatPercent(data.availability.west));

    setText("distanceTotal", formatNumber(data.distance.total));
    setText("distanceNorth", formatNumber(data.distance.north));
    setText("distanceWest", formatNumber(data.distance.west));

    setText("tripsTotal", formatNumber(data.trips.total));
    setText("tripsNorth", formatNumber(data.trips.north));
    setText("tripsWest", formatNumber(data.trips.west));

    setText("cancelledTotal", formatNumber(data.cancelled.total));
    setText("cancelledNorth", formatNumber(data.cancelled.north));
    setText("cancelledWest", formatNumber(data.cancelled.west));
}

function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}

function formatPercent(value) {
    return `${roundSmart(value)}%`;
}

function formatNumber(value) {
    return Number(roundSmart(value)).toLocaleString("th-TH");
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
    const ctx = document.getElementById("performanceChart");

    if (!ctx) {
        return;
    }

    if (performanceChart) {
        performanceChart.destroy();
    }

    performanceChart = new Chart(ctx, {
        type: "bar",

        plugins: [ChartDataLabels],

        data: {
            labels: labels,

            datasets: [
                {
                    label: "ความต่อต่อเวลาล่าช้าไม่เกิน 10 นาที",
                    data: items.map(item => item.onTime.total),
                    backgroundColor: "rgba(239, 35, 60, 0.88)",
                    borderColor: "rgba(181, 18, 27, 1)",
                    borderWidth: 1,
                    borderRadius: 14,
                    barPercentage: 0.7,
                    categoryPercentage: 0.72
                },
                
                {
                    label: "ความตรงต่อเวลาล่าช้าไม่เกิน 5 นาที",
                    data: items.map(item => item.punctuality5.total),
                    backgroundColor: "rgba(244, 63, 94, 0.78)",
                    borderColor: "rgba(190, 18, 60, 1)",
                    borderWidth: 1,
                    borderRadius: 14,
                    barPercentage: 0.7,
                    categoryPercentage: 0.72
                },

                {
                    label: "ความน่าเชื่อถือ",
                    data: items.map(item => item.reliability.total),
                    backgroundColor: "rgba(123, 44, 191, 0.88)",
                    borderColor: "rgba(91, 33, 182, 1)",
                    borderWidth: 1,
                    borderRadius: 14,
                    barPercentage: 0.7,
                    categoryPercentage: 0.72
                },
                {
                    label: "ความพร้อมของขบวนรถไฟ",
                    data: items.map(item => item.availability.total),
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

            layout: {
                padding: {
                    top: 28
                }
            },

            plugins: {  
                datalabels: {
                    anchor: "end",
                    align: "top",
                    offset: 4,
                    color: "#111827",
                    font: {
                        family: "Sarabun",
                        size: 16,
                        weight: "bold"
                    },
                    formatter: function(value) {               
                        const num = Number(value);

                        if (Number.isInteger(num)) {
                            return num + "%";
                        }
                        return num.toFixed(2) + "%";
                    }
                },

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
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.raw}%`;
                        }
                    }
                }
            },

            scales: {
                y: {
                    min: 99.5,
                    max: 100,
                    ticks: {
                        stepSize: 0.1,
                        color: "#64748b",
                        callback: value => value + "%",
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

function updateSeparateCharts(items) {
    const labels = items.map(item => item.month);

    // 1. ความตรงต่อเวลา ล่าช้าไม่เกิน 5 นาที
    punctuality5Chart = createSingleBarChart({
        canvasId: "punctuality5Chart",
        chartInstance: punctuality5Chart,
        labels: labels,
        label: "ความตรงต่อเวลา ไม่เกิน 5 นาที",
        data: items.map(item => item.punctuality5.total),
        backgroundColor: "rgba(244, 63, 94, 0.82)",
        borderColor: "rgba(190, 18, 60, 1)"
    });

    // 2. ความตรงต่อเวลา ล่าช้าไม่เกิน 10 นาที
    onTimeChart = createSingleBarChart({
        canvasId: "onTimeChart",
        chartInstance: onTimeChart,
        labels: labels,
        label: "ความตรงต่อเวลา ไม่เกิน 10 นาที",
        data: items.map(item => item.onTime.total),
        backgroundColor: "rgba(239, 35, 60, 0.88)",
        borderColor: "rgba(181, 18, 27, 1)"
    });

    // 3. ความน่าเชื่อถือ
    reliabilityChart = createSingleBarChart({
        canvasId: "reliabilityChart",
        chartInstance: reliabilityChart,
        labels: labels,
        label: "ความน่าเชื่อถือ",
        data: items.map(item => item.reliability.total),
        backgroundColor: "rgba(123, 44, 191, 0.88)",
        borderColor: "rgba(91, 33, 182, 1)"
    });

    // 4. ความพร้อมของขบวนรถไฟ
    availabilityChart = createSingleBarChart({
        canvasId: "availabilityChart",
        chartInstance: availabilityChart,
        labels: labels,
        label: "ความพร้อมของขบวนรถไฟ",
        data: items.map(item => item.availability.total),
        backgroundColor: "rgba(0, 119, 182, 0.88)",
        borderColor: "rgba(3, 105, 161, 1)"
    });
}

function createSingleBarChart(config) {
    const canvas = document.getElementById(config.canvasId);

    if (!canvas) {
        console.warn(`ไม่พบ canvas id="${config.canvasId}"`);
        return null;
    }

    if (typeof Chart === "undefined") {
        console.warn("Chart.js ไม่ถูกโหลด");
        return null;
    }

    if (config.chartInstance) {
        config.chartInstance.destroy();
    }

    const chartPlugins =
        typeof ChartDataLabels !== "undefined"
            ? [ChartDataLabels]
            : [];

    return new Chart(canvas, {
        type: "bar",

        plugins: chartPlugins,

        data: {
            labels: config.labels,

            datasets: [
                {
                    label: config.label,
                    data: config.data,
                    backgroundColor: config.backgroundColor,
                    borderColor: config.borderColor,
                    borderWidth: 1,
                    borderRadius: 14,
                    barPercentage: 0.55,
                    categoryPercentage: 0.65
                }
            ]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            layout: {
                padding: {
                    top: 28
                }
            },

            plugins: {
                datalabels: {
                    anchor: "end",
                    align: "top",
                    offset: 4,
                    color: "#111827",
                    font: {
                        family: "Sarabun",
                        size: 16,
                        weight: "bold"
                    },
                    formatter: function(value) {
                        const num = Number(value);

                        if (Number.isInteger(num)) {
                            return num + "%";
                        }

                        return num.toFixed(2) + "%";
                    }
                },

                legend: {
                    display: true,
                    position: "bottom",
                    labels: {
                        color: "#334155",
                        usePointStyle: true,
                        pointStyle: "circle",
                        padding: 20,
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
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.raw}%`;
                        }
                    }
                }
            },

            scales: {
                y: {
                    min: 99.5,
                    max: 100,
                    ticks: {
                        stepSize: 0.1,
                        color: "#64748b",
                        callback: function(value) {
                            return Number(value).toFixed(2) + "%";
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
