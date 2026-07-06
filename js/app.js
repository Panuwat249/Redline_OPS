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
        const exportPdfBtn = document.getElementById("exportPdfBtn");
        const exportExcelBtn = document.getElementById("exportExcelBtn");

        if (exportPdfBtn) {
            exportPdfBtn.addEventListener("click", exportDashboardToPdf);
        }

        if (exportExcelBtn) {
            exportExcelBtn.addEventListener("click", exportDashboardToExcel);
        }
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
    if (typeof updateSeparateCharts === "function") {
        updateSeparateCharts(selectedData);
    }
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
    const rounded = Math.round(Number(value) * 100) / 100;

    if (rounded === 100) {
        return 100;
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

async function exportDashboardToPdf() {
    if (typeof html2canvas === "undefined") {
        alert("ไม่พบ html2canvas กรุณาตรวจสอบ CDN ใน index.html");
        return;
    }

    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert("ไม่พบ jsPDF กรุณาตรวจสอบ CDN ใน index.html");
        return;
    }

    const selectedData = getSelectedRangeData();

    if (!selectedData || selectedData.length === 0) {
        alert("ไม่พบข้อมูลสำหรับนำออก PDF");
        return;
    }

    const calculatedData = calculateDisplayData(selectedData);

    // รอให้ Chart.js วาดกราฟบนหน้าเว็บให้เสร็จก่อน
    await waitForChartsReady();

    const root = buildPdfSlides(selectedData, calculatedData);
    document.body.appendChild(root);

    // รอให้รูปกราฟใน PDF slide โหลดครบก่อนจับภาพ
    await waitForPdfImages(root);

    await new Promise(resolve => setTimeout(resolve, 300));

    const { jsPDF } = window.jspdf;

    const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4"
    });

    const slides = root.querySelectorAll(".pdf-slide");

    for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];

        const canvas = await html2canvas(slide, {
            scale: 2,
            useCORS: true,
            backgroundColor: "#f8fafc",
            scrollX: 0,
            scrollY: 0,
            width: slide.offsetWidth,
            height: slide.offsetHeight
        });

        const imgData = canvas.toDataURL("image/jpeg", 0.95);

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        if (i > 0) {
            pdf.addPage();
        }

        pdf.addImage(imgData, "JPEG", 0, 0, pageWidth, pageHeight);
    }

    document.body.removeChild(root);

    pdf.save(getExportFileName("pdf"));
}

function exportDashboardToExcel() {
    if (typeof XLSX === "undefined") {
        alert("ไม่พบ XLSX กรุณาตรวจสอบ CDN xlsx-js-style ใน index.html");
        return;
    }

    const selectedData = getSelectedRangeData();

    if (!selectedData || selectedData.length === 0) {
        alert("ไม่พบข้อมูลสำหรับนำออก Excel");
        return;
    }

    const calculatedData = calculateDisplayData(selectedData);

    const wb = XLSX.utils.book_new();

    const rows = buildDashboardExcelRows(selectedData, calculatedData);

    const ws = XLSX.utils.aoa_to_sheet(rows);

    styleDashboardWorksheet(ws, rows);

    ws["!cols"] = [
        { wch: 28 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 }
    ];

    ws["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } }
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Dashboard Summary");

    const rawRows = buildRawDataRows(selectedData);
    const rawWs = XLSX.utils.aoa_to_sheet(rawRows);

    rawWs["!cols"] = [
        { wch: 18 },
        { wch: 16 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 }
    ];

    XLSX.utils.book_append_sheet(wb, rawWs, "Monthly Data");

    XLSX.writeFile(wb, getExportFileName("xlsx"));
}

function buildDashboardExcelRows(selectedData, calculatedData) {
    const first = selectedData[0];
    const last = selectedData[selectedData.length - 1];

    const periodText =
        selectedData.length === 1
            ? first.month
            : `${first.month} ถึง ${last.month}`;

    const kpiCalcText =
        selectedData.length === 1
            ? "แสดงค่าของเดือนที่เลือก"
            : `KPI เฉลี่ยจาก ${selectedData.length} เดือน`;

    const operationCalcText =
        selectedData.length === 1
            ? "แสดงค่าของเดือนที่เลือก"
            : `ข้อมูลการเดินรถเป็นผลรวมจาก ${selectedData.length} เดือน`;

    return [
        ["Red Line Service Performance Dashboard", "", "", ""],
        [`ช่วงข้อมูล: ${periodText}`, "", "", ""],
        [],
        ["หมวดข้อมูล", "รวมทั้ง 2 สาย", "สายเหนือ", "สายตะวันตก"],

        [
            "ความตรงต่อเวลา ไม่เกิน 5 นาที (%)",
            formatPercent(calculatedData.punctuality5.total),
            formatPercent(calculatedData.punctuality5.north),
            formatPercent(calculatedData.punctuality5.west)
        ],
        [
            "ความตรงต่อเวลา ไม่เกิน 10 นาที (%)",
            formatPercent(calculatedData.onTime.total),
            formatPercent(calculatedData.onTime.north),
            formatPercent(calculatedData.onTime.west)
        ],
        [
            "ความน่าเชื่อถือ (%)",
            formatPercent(calculatedData.reliability.total),
            formatPercent(calculatedData.reliability.north),
            formatPercent(calculatedData.reliability.west)
        ],
        [
            "ความพร้อมของขบวนรถไฟ (%)",
            formatPercent(calculatedData.availability.total),
            formatPercent(calculatedData.availability.north),
            formatPercent(calculatedData.availability.west)
        ],

        [],
        ["รูปแบบการคำนวณ KPI", kpiCalcText, "", ""],
        ["รูปแบบการคำนวณ Operation", operationCalcText, "", ""],

        [],
        ["ข้อมูลการเดินรถและการให้บริการ", "รวมทั้ง 2 สาย", "สายเหนือ", "สายตะวันตก"],
        [
            "ระยะทางที่วิ่งให้บริการ (กม.)",
            formatNumber(calculatedData.distance.total),
            formatNumber(calculatedData.distance.north),
            formatNumber(calculatedData.distance.west)
        ],
        [
            "จำนวนเที่ยววิ่งที่ให้บริการ (เที่ยว)",
            formatNumber(calculatedData.trips.total),
            formatNumber(calculatedData.trips.north),
            formatNumber(calculatedData.trips.west)
        ],
        [
            "การยกเลิกเที่ยววิ่ง (เที่ยว)",
            formatNumber(calculatedData.cancelled.total),
            formatNumber(calculatedData.cancelled.north),
            formatNumber(calculatedData.cancelled.west)
        ]
    ];
}

function buildRawDataRows(selectedData) {
    const rows = [
        [
            "เดือน",
            "TSP 5 รวม",
            "TSP 5 สายเหนือ",
            "TSP 5 สายตะวันตก",
            "TSP 10 รวม",
            "TSP 10 สายเหนือ",
            "TSP 10 สายตะวันตก",
            "TSA รวม",
            "TA รวม",
            "ระยะทางรวม",
            "เที่ยวจริงรวม",
            "ยกเลิกรวม"
        ]
    ];

    selectedData.forEach(item => {
        rows.push([
            item.month,
            formatPercent(item.punctuality5.total),
            formatPercent(item.punctuality5.north),
            formatPercent(item.punctuality5.west),
            formatPercent(item.onTime.total),
            formatPercent(item.onTime.north),
            formatPercent(item.onTime.west),
            formatPercent(item.reliability.total),
            formatPercent(item.availability.total),
            formatNumber(item.distance.total),
            formatNumber(item.trips.total),
            formatNumber(item.cancelled.total)
        ]);
    });

    return rows;
}

function styleDashboardWorksheet(ws, rows) {
    const range = XLSX.utils.decode_range(ws["!ref"]);

    for (let row = range.s.r; row <= range.e.r; row++) {
        for (let col = range.s.c; col <= range.e.c; col++) {
            const cellRef = XLSX.utils.encode_cell({ r: row, c: col });

            if (!ws[cellRef]) {
                continue;
            }

            ws[cellRef].s = {
                font: {
                    name: "Sarabun",
                    sz: 11,
                    color: { rgb: "111827" }
                },
                alignment: {
                    vertical: "center",
                    horizontal: col === 0 ? "left" : "center",
                    wrapText: true
                },
                border: {
                    top: { style: "thin", color: { rgb: "E2E8F0" } },
                    bottom: { style: "thin", color: { rgb: "E2E8F0" } },
                    left: { style: "thin", color: { rgb: "E2E8F0" } },
                    right: { style: "thin", color: { rgb: "E2E8F0" } }
                }
            };
        }
    }

    // Title row
    ws["A1"].s = {
        font: {
            name: "Sarabun",
            sz: 18,
            bold: true,
            color: { rgb: "FFFFFF" }
        },
        alignment: {
            horizontal: "center",
            vertical: "center"
        },
        fill: {
            patternType: "solid",
            fgColor: { rgb: "7F0B0B" }
        }
    };

    // Period row
    ws["A2"].s = {
        font: {
            name: "Sarabun",
            sz: 12,
            bold: true,
            color: { rgb: "7F0B0B" }
        },
        alignment: {
            horizontal: "center",
            vertical: "center"
        },
        fill: {
            patternType: "solid",
            fgColor: { rgb: "FEE2E2" }
        }
    };

    // Header rows
    [3, 12].forEach(rowIndexZeroBased => {
        for (let col = 0; col <= 3; col++) {
            const cellRef = XLSX.utils.encode_cell({
                r: rowIndexZeroBased,
                c: col
            });

            if (ws[cellRef]) {
                ws[cellRef].s = {
                    font: {
                        name: "Sarabun",
                        sz: 11,
                        bold: true,
                        color: { rgb: "FFFFFF" }
                    },
                    alignment: {
                        horizontal: "center",
                        vertical: "center",
                        wrapText: true
                    },
                    fill: {
                        patternType: "solid",
                        fgColor: { rgb: "A1121B" }
                    },
                    border: {
                        top: { style: "thin", color: { rgb: "FFFFFF" } },
                        bottom: { style: "thin", color: { rgb: "FFFFFF" } },
                        left: { style: "thin", color: { rgb: "FFFFFF" } },
                        right: { style: "thin", color: { rgb: "FFFFFF" } }
                    }
                };
            }
        }
    });
}

function getExportFileName(extension) {
    const selectedData = getSelectedRangeData();
    const first = selectedData[0];
    const last = selectedData[selectedData.length - 1];

    const rangeText =
        selectedData.length === 1
            ? first.id
            : `${first.id}_to_${last.id}`;

    return `redline-dashboard-${rangeText}.${extension}`;
}

function buildPdfSlides(selectedData, calculatedData) {
    const first = selectedData[0];
    const last = selectedData[selectedData.length - 1];

    const periodText =
        selectedData.length === 1
            ? first.month
            : `${first.month} ถึง ${last.month}`;

    const kpiCalcText =
        selectedData.length === 1
            ? "แสดงค่าของเดือนที่เลือก"
            : `KPI เฉลี่ยจาก ${selectedData.length} เดือน`;

    const operationCalcText =
        selectedData.length === 1
            ? "แสดงค่าของเดือนที่เลือก"
            : `ข้อมูลการเดินรถเป็นผลรวมจาก ${selectedData.length} เดือน`;

    const root = document.createElement("div");
    root.className = "pdf-export-root";

    root.appendChild(
        createPdfCoverSlide(periodText, kpiCalcText, operationCalcText)
    );

    root.appendChild(
        createPdfKpiSlide(calculatedData)
    );

    root.appendChild(
        createPdfOperationSlide(calculatedData, operationCalcText)
    );

    const chartSlides = createPdfChartSlides();

    chartSlides.forEach(slide => {
        root.appendChild(slide);
    });

    return root;
}

function createPdfCoverSlide(periodText, kpiCalcText, operationCalcText) {
    const slide = document.createElement("section");
    slide.className = "pdf-slide pdf-slide-cover";

    slide.innerHTML = `
        <div class="pdf-slide-header">
            <div>
                <div class="pdf-slide-kicker">RED LINE SERVICE DASHBOARD</div>

                <div class="pdf-slide-title">
                    รายงานระดับการให้บริการ<br>
                    ระบบรถไฟฟ้าชานเมืองสายสีแดง
                </div>

                <div class="pdf-slide-subtitle">
                    ${periodText}
                </div>
            </div>

            <div class="pdf-badge">
                Monthly Performance Report
            </div>
        </div>

        <div class="pdf-grid-2" style="margin-top: 80px;">
            <div class="pdf-card">
                <div class="pdf-card-title">ช่วงข้อมูลที่แสดง</div>
                <div class="pdf-card-name">${periodText}</div>
            </div>

            <div class="pdf-card">
                <div class="pdf-card-title">รูปแบบการคำนวณ</div>
                <div class="pdf-card-name">${kpiCalcText}</div>
                <div class="pdf-card-note">${operationCalcText}</div>
            </div>
        </div>

        <div
            class="pdf-footer-note"
            style="color: rgba(255,255,255,0.78); margin-top: 110px;"
        >
            บริษัท รถไฟฟ้า ร.ฟ.ท. จำกัด · ฝ่ายควบคุมการเดินรถ
        </div>
    `;

    return slide;
}

function createPdfKpiSlide(data) {
    const slide = document.createElement("section");
    slide.className = "pdf-slide";

    slide.innerHTML = `
        <div class="pdf-slide-header">
            <div>
                <div class="pdf-slide-kicker">KPI SUMMARY</div>
                <div class="pdf-slide-title">ภาพรวมประสิทธิภาพการเดินรถ</div>
                <div class="pdf-slide-subtitle">
                    สรุปค่าดัชนีหลัก แยกตามรวมทั้ง 2 สาย / สายเหนือ / สายตะวันตก
                </div>
            </div>

            <div class="pdf-badge">KPI</div>
        </div>

        <div class="pdf-grid-2">
            ${createPdfMetricCard({
                theme: "pdf-red",
                code: "TSP 5 MIN",
                title: "ความตรงต่อเวลา",
                note: "ความล่าช้าไม่เกิน 5 นาที",
                total: formatPercent(data.punctuality5.total),
                north: formatPercent(data.punctuality5.north),
                west: formatPercent(data.punctuality5.west)
            })}

            ${createPdfMetricCard({
                theme: "pdf-red",
                code: "TSP 10 MIN",
                title: "ความตรงต่อเวลา",
                note: "ความล่าช้าไม่เกิน 10 นาที",
                total: formatPercent(data.onTime.total),
                north: formatPercent(data.onTime.north),
                west: formatPercent(data.onTime.west)
            })}

            ${createPdfMetricCard({
                theme: "pdf-purple",
                code: "TSA",
                title: "ความน่าเชื่อถือ",
                note: "Train Service Availability",
                total: formatPercent(data.reliability.total),
                north: formatPercent(data.reliability.north),
                west: formatPercent(data.reliability.west)
            })}

            ${createPdfMetricCard({
                theme: "pdf-blue",
                code: "TA",
                title: "ความพร้อมของขบวนรถไฟ",
                note: "Train Availability",
                total: formatPercent(data.availability.total),
                north: formatPercent(data.availability.north),
                west: formatPercent(data.availability.west)
            })}
        </div>
    `;

    return slide;
}

function createPdfOperationSlide(data, operationCalcText) {
    const slide = document.createElement("section");
    slide.className = "pdf-slide";

    slide.innerHTML = `
        <div class="pdf-slide-header">
            <div>
                <div class="pdf-slide-kicker">OPERATION SUMMARY</div>
                <div class="pdf-slide-title">ข้อมูลการเดินรถและการให้บริการ</div>
                <div class="pdf-slide-subtitle">${operationCalcText}</div>
            </div>

            <div class="pdf-badge">Operation</div>
        </div>

        <div class="pdf-grid-3">
            ${createPdfMetricCard({
                theme: "pdf-orange",
                code: "OPR 01",
                title: "ระยะทางที่วิ่งให้บริการ",
                note: "หน่วย: กิโลเมตร",
                total: formatNumber(data.distance.total),
                north: formatNumber(data.distance.north),
                west: formatNumber(data.distance.west)
            })}

            ${createPdfMetricCard({
                theme: "pdf-green",
                code: "OPR 02",
                title: "จำนวนเที่ยววิ่งที่ให้บริการ",
                note: "หน่วย: เที่ยว",
                total: formatNumber(data.trips.total),
                north: formatNumber(data.trips.north),
                west: formatNumber(data.trips.west)
            })}

            ${createPdfMetricCard({
                theme: "pdf-red",
                code: "OPR 03",
                title: "การยกเลิกเที่ยววิ่ง",
                note: "หน่วย: เที่ยว",
                total: formatNumber(data.cancelled.total),
                north: formatNumber(data.cancelled.north),
                west: formatNumber(data.cancelled.west)
            })}
        </div>
    `;

    return slide;
}

function createPdfMetricCard(config) {
    return `
        <div class="pdf-card ${config.theme}">
            <div class="pdf-card-title">${config.code}</div>
            <div class="pdf-card-name">${config.title}</div>
            <div class="pdf-card-note">${config.note}</div>

            <div class="pdf-value-box">
                <div class="pdf-value-label">รวมทั้ง 2 สาย</div>
                <div class="pdf-value">${config.total}</div>
            </div>

            <div class="pdf-split">
                <div class="pdf-split-item">
                    <span>สายเหนือ</span>
                    <strong>${config.north}</strong>
                </div>

                <div class="pdf-split-item">
                    <span>สายตะวันตก</span>
                    <strong>${config.west}</strong>
                </div>
            </div>
        </div>
    `;
}

function createPdfChartSlides() {
    const chartConfigs = [
        {
            canvasId: "performanceChart",
            chartInstance: performanceChart,
            title: "กราฟเปรียบเทียบค่าดัชนีหลัก",
            subtitle: "กราฟรวม KPI ทั้งหมด",
            badge: "Overview Chart"
        },
        {
            canvasId: "punctuality5Chart",
            chartInstance: punctuality5Chart,
            title: "ความตรงต่อเวลา",
            subtitle: "ความล่าช้าไม่เกิน 5 นาที",
            badge: "TSP 5 Min"
        },
        {
            canvasId: "onTimeChart",
            chartInstance: onTimeChart,
            title: "ความตรงต่อเวลา",
            subtitle: "ความล่าช้าไม่เกิน 10 นาที",
            badge: "TSP 10 Min"
        },
        {
            canvasId: "reliabilityChart",
            chartInstance: reliabilityChart,
            title: "ความน่าเชื่อถือ",
            subtitle: "Train Service Availability (TSA)",
            badge: "Reliability"
        },
        {
            canvasId: "availabilityChart",
            chartInstance: availabilityChart,
            title: "ความพร้อมของขบวนรถไฟ",
            subtitle: "Train Availability (TA)",
            badge: "Availability"
        }
    ];

    const slides = [];

    chartConfigs.forEach(config => {
        const image = getChartImage(config.canvasId, config.chartInstance);

        if (!image) {
            console.warn(`ไม่สามารถสร้างรูปกราฟจาก ${config.canvasId}`);
            return;
        }

        const slide = document.createElement("section");
        slide.className = "pdf-slide";

        const header = document.createElement("div");
        header.className = "pdf-slide-header";

        const headerLeft = document.createElement("div");

        const kicker = document.createElement("div");
        kicker.className = "pdf-slide-kicker";
        kicker.textContent = "MONTHLY PERFORMANCE";

        const title = document.createElement("div");
        title.className = "pdf-slide-title";
        title.textContent = config.title;

        const subtitle = document.createElement("div");
        subtitle.className = "pdf-slide-subtitle";
        subtitle.textContent = config.subtitle;

        headerLeft.appendChild(kicker);
        headerLeft.appendChild(title);
        headerLeft.appendChild(subtitle);

        const badge = document.createElement("div");
        badge.className = "pdf-badge";
        badge.textContent = config.badge;

        header.appendChild(headerLeft);
        header.appendChild(badge);

        const img = document.createElement("img");
        img.className = "pdf-chart-image";
        img.src = image;
        img.alt = config.title;

        slide.appendChild(header);
        slide.appendChild(img);

        slides.push(slide);
    });

    return slides;
}

function getChartImage(canvasId, chartInstance) {
    if (chartInstance && typeof chartInstance.toBase64Image === "function") {
        const image = chartInstance.toBase64Image("image/png", 1);

        if (image && image !== "data:,") {
            return image;
        }
    }

    const canvas = document.getElementById(canvasId);

    if (!canvas) {
        console.warn(`ไม่พบ canvas id="${canvasId}"`);
        return "";
    }

    try {
        const image = canvas.toDataURL("image/png");

        if (!image || image === "data:,") {
            return "";
        }

        return image;
    } catch (error) {
        console.warn(`แปลง canvas ${canvasId} เป็นรูปไม่ได้`, error);
        return "";
    }
}

function waitForChartsReady() {
    return new Promise(resolve => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setTimeout(resolve, 500);
            });
        });
    });
}

function waitForPdfImages(root) {
    const images = Array.from(root.querySelectorAll("img"));

    if (images.length === 0) {
        return Promise.resolve();
    }

    const promises = images.map(img => {
        if (img.complete) {
            return Promise.resolve();
        }

        return new Promise(resolve => {
            img.onload = resolve;
            img.onerror = resolve;
        });
    });

    return Promise.all(promises);
}
