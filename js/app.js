/* =========================================================
   Redline OPS - app.js
   ========================================================= */

let performanceChart   = null;
let punctuality5Chart  = null;
let onTimeChart        = null;
let reliabilityChart   = null;
let availabilityChart  = null;

let currentMode = "month";   // month | fy | all

/* load-data.js จะเรียกฟังก์ชันนี้หลังเตรียมข้อมูลเสร็จ */
window.initDashboard = init;

/* =========================================================
   INIT
========================================================= */

function init() {
    const data = window.statistics;

    if (!Array.isArray(data) || data.length === 0) {
        console.error("ไม่พบข้อมูล window.statistics");
        return;
    }

    populateMonthOptions(data);
    populateFiscalYearOptions(data);
    bindModeButtons();

    const lastItem = data[data.length - 1];

    document.getElementById("startMonth").value = lastItem.id;
    document.getElementById("endMonth").value   = lastItem.id;

    renderDashboard();

    document.getElementById("applyBtn")
        .addEventListener("click", renderDashboard);

    ["startMonth", "endMonth", "fiscalYear"].forEach(id => {
        const element = document.getElementById(id);

        if (element) {
            element.addEventListener("change", renderDashboard);
        }
    });

    const exportPdfBtn   = document.getElementById("exportPdfBtn");
    const exportExcelBtn = document.getElementById("exportExcelBtn");

    if (exportPdfBtn) {
        exportPdfBtn.addEventListener("click", exportDashboardToPdf);
    }

    if (exportExcelBtn) {
        exportExcelBtn.addEventListener("click", exportDashboardToExcel);
    }
}

/* =========================================================
   FISCAL YEAR (ต.ค. - ก.ย.)
========================================================= */

function getFiscalYear(id) {
    const parts = String(id).split("-");
    const year  = Number(parts[0]);
    const month = Number(parts[1]);

    const buddhistYear = year + 543;

    return month >= 10 ? buddhistYear + 1 : buddhistYear;
}

function getFiscalYearList(data) {
    const years = [...new Set(data.map(item => getFiscalYear(item.id)))];

    return years.sort((a, b) => a - b);
}

/* =========================================================
   FILTER UI
========================================================= */

function populateMonthOptions(data) {
    const startMonthSelect = document.getElementById("startMonth");
    const endMonthSelect   = document.getElementById("endMonth");

    startMonthSelect.innerHTML = "";
    endMonthSelect.innerHTML   = "";

    data.forEach(item => {
        startMonthSelect.appendChild(createOption(item.id, item.month));
        endMonthSelect.appendChild(createOption(item.id, item.month));
    });
}

function populateFiscalYearOptions(data) {
    const fiscalYearSelect = document.getElementById("fiscalYear");

    if (!fiscalYearSelect) {
        return;
    }

    const years = getFiscalYearList(data);

    fiscalYearSelect.innerHTML = "";

    years.forEach(year => {
        fiscalYearSelect.appendChild(
            createOption(String(year), `ปีงบประมาณ ${year}`)
        );
    });

    fiscalYearSelect.value = String(years[years.length - 1]);
}

function createOption(value, label) {
    const option = document.createElement("option");

    option.value = value;
    option.textContent = label;

    return option;
}

function bindModeButtons() {
    const buttons = document.querySelectorAll(".mode-btn");

    buttons.forEach(button => {
        button.addEventListener("click", () => {
            buttons.forEach(item => item.classList.remove("is-active"));
            button.classList.add("is-active");

            currentMode = button.dataset.mode;

            toggleFilterFields();
            renderDashboard();
        });
    });
}

function toggleFilterFields() {
    const monthFields = ["fieldStartMonth", "fieldEndMonth"];
    const fiscalField = document.getElementById("fieldFiscalYear");

    monthFields.forEach(id => {
        const element = document.getElementById(id);

        if (element) {
            element.hidden = currentMode !== "month";
        }
    });

    if (fiscalField) {
        fiscalField.hidden = currentMode !== "fy";
    }
}

/* =========================================================
   DATA SELECTION
========================================================= */

function getSelectedRangeData() {
    const data = window.statistics || [];

    if (currentMode === "all") {
        return data.slice();
    }

    if (currentMode === "fy") {
        const selectedYear = document.getElementById("fiscalYear").value;

        return data.filter(item =>
            String(getFiscalYear(item.id)) === String(selectedYear)
        );
    }

    const startIndex = data.findIndex(
        item => item.id === document.getElementById("startMonth").value
    );

    const endIndex = data.findIndex(
        item => item.id === document.getElementById("endMonth").value
    );

    if (startIndex === -1 || endIndex === -1) {
        return [];
    }

    return data.slice(
        Math.min(startIndex, endIndex),
        Math.max(startIndex, endIndex) + 1
    );
}

/* =========================================================
   RENDER
========================================================= */

function renderDashboard() {
    const selectedData = getSelectedRangeData();

    if (selectedData.length === 0) {
        alert("ไม่พบข้อมูลในช่วงที่เลือก");
        return;
    }

    const calculatedData = calculateDisplayData(selectedData);

    updateTextSummary(selectedData);
    updateKpiCards(calculatedData);
    updateChart(selectedData);
    updateSeparateCharts(selectedData);
    updateStatsTable(selectedData);
}

function calculateDisplayData(items) {
    const kpiKeys = ["onTime", "punctuality5", "reliability", "availability"];
    const opKeys  = ["distance", "trips", "cancelled"];

    const result = {};

    kpiKeys.forEach(key => {
        result[key] = {
            north: average(items, key, "north"),
            west:  average(items, key, "west"),
            total: average(items, key, "total")
        };
    });

    opKeys.forEach(key => {
        result[key] = {
            north: sum(items, key, "north"),
            west:  sum(items, key, "west"),
            total: sum(items, key, "total")
        };
    });

    return result;
}

function average(items, group, key) {
    return sum(items, group, key) / items.length;
}

function sum(items, group, key) {
    return items.reduce(
        (total, item) => total + Number(item[group][key] || 0),
        0
    );
}

function updateTextSummary(items) {
    const first = items[0];
    const last  = items[items.length - 1];

    let periodText;
    let kpiModeText;
    let operationModeText;

    if (currentMode === "all") {
        periodText        = `ทั้งหมด (${first.month} – ${last.month})`;
        kpiModeText       = `KPI เฉลี่ยจากทั้งหมด ${items.length} เดือน`;
        operationModeText = `ผลรวมทั้งหมด ${items.length} เดือน`;
    }
    else if (currentMode === "fy") {
        const year = getFiscalYear(first.id);

        periodText        = `ปีงบประมาณ ${year} (${first.month} – ${last.month})`;
        kpiModeText       = `KPI เฉลี่ยจาก ${items.length} เดือน`;
        operationModeText = `ผลรวมปีงบประมาณ ${year}`;
    }
    else if (items.length === 1) {
        periodText        = first.month;
        kpiModeText       = "แสดงค่าของเดือนที่เลือก";
        operationModeText = "แสดงค่าของเดือนที่เลือก";
    }
    else {
        periodText        = `${first.month} – ${last.month}`;
        kpiModeText       = `KPI เฉลี่ยจาก ${items.length} เดือน`;
        operationModeText = `ข้อมูลการเดินรถเป็นผลรวมจาก ${items.length} เดือน`;
    }

    setText("selectedRangeText", periodText);
    setText("summaryPeriod", periodText);
    setText("calculationMode", kpiModeText);
    setText("operationCalculationMode", operationModeText);
    setText("tableSummaryMode", `${items.length} เดือน`);
}

function updateKpiCards(data) {
    const percentMap = {
        onTime:       "onTime",
        punctuality5: "punctuality5",
        reliability:  "reliability",
        availability: "availability"
    };

    Object.keys(percentMap).forEach(key => {
        setText(`${key}Total`, formatPercent(data[key].total));
        setText(`${key}North`, formatPercent(data[key].north));
        setText(`${key}West`,  formatPercent(data[key].west));
    });

    ["distance", "trips", "cancelled"].forEach(key => {
        setText(`${key}Total`, formatNumber(data[key].total));
        setText(`${key}North`, formatNumber(data[key].north));
        setText(`${key}West`,  formatNumber(data[key].west));
    });
}

/* =========================================================
   STATS TABLE
========================================================= */

function updateStatsTable(items) {
    const tableBody   = document.getElementById("statsTableBody");
    const tableFooter = document.getElementById("statsTableFooter");

    if (!tableBody) {
        return;
    }

    tableBody.innerHTML = items.map(item => `
        <tr>
            <td>${item.month}</td>
            <td>${getFiscalYear(item.id)}</td>
            <td>${formatPercent(item.punctuality5.total)}</td>
            <td>${formatPercent(item.onTime.total)}</td>
            <td>${formatPercent(item.reliability.total)}</td>
            <td>${formatPercent(item.availability.total)}</td>
            <td>${formatNumber(item.distance.total)}</td>
            <td>${formatNumber(item.trips.total)}</td>
            <td>${formatNumber(item.cancelled.total)}</td>
        </tr>
    `).join("");

    if (!tableFooter) {
        return;
    }

    const percentPaths = [
        "punctuality5", "onTime", "reliability", "availability"
    ];

    const numberPaths = ["distance", "trips", "cancelled"];

    const buildRow = (label, percentFn, numberFn, className) => `
        <tr class="${className}">
            <td colspan="2">${label}</td>
            ${percentPaths.map(key =>
                `<td>${formatPercent(percentFn(key))}</td>`
            ).join("")}
            ${numberPaths.map(key =>
                `<td>${formatNumber(numberFn(key))}</td>`
            ).join("")}
        </tr>
    `;

    const pick   = key => items.map(item => Number(item[key].total || 0));
    const avgFn  = key => pick(key).reduce((a, b) => a + b, 0) / items.length;
    const maxFn  = key => Math.max(...pick(key));
    const minFn  = key => Math.min(...pick(key));
    const sumFn  = key => pick(key).reduce((a, b) => a + b, 0);

    tableFooter.innerHTML =
        buildRow("ค่าเฉลี่ย", avgFn, avgFn, "row-average") +
        buildRow("สูงสุด",   maxFn, maxFn, "row-max") +
        buildRow("ต่ำสุด",   minFn, minFn, "row-min") +
        `<tr class="row-total">
            <td colspan="2">ผลรวมทั้งช่วง</td>
            <td colspan="4">—</td>
            ${numberPaths.map(key =>
                `<td>${formatNumber(sumFn(key))}</td>`
            ).join("")}
        </tr>`;
}

/* =========================================================
   FORMAT
========================================================= */

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

    return rounded === 100 ? 100 : rounded.toFixed(2);
}

/* =========================================================
   CHART - แกน Y ปรับอัตโนมัติตามข้อมูล
========================================================= */

function calcYAxisRange(values) {
    const numbers = values
        .map(Number)
        .filter(value => !isNaN(value));

    if (numbers.length === 0) {
        return { min: 0, max: 100, step: 20 };
    }

    const minValue = Math.min(...numbers);
    const maxValue = Math.max(...numbers);
    const spread   = maxValue - minValue;

    // ทุกค่าเกาะกลุ่มใกล้ 100 -> ซูมละเอียด
    if (spread < 0.6 && minValue >= 99.3) {
        return { min: 99.4, max: 100, step: 0.1 };
    }

    const padding = Math.max(spread * 0.35, 0.2);

    let low  = Math.max(0, Math.floor((minValue - padding) * 10) / 10);
    let high = Math.min(100, Math.ceil((maxValue + padding) * 10) / 10);

    if (high - low < 0.5) {
        low = Math.max(0, high - 0.5);
    }

    const step = Math.max(Math.round(((high - low) / 6) * 100) / 100, 0.05);

    return { min: low, max: high, step: step };
}

function buildBaseChartOptions(range) {
    return {
        responsive: true,
        maintainAspectRatio: false,

        animation: { duration: 700, easing: "easeOutQuart" },

        layout: { padding: { top: 30 } },

        plugins: {
            datalabels: {
                anchor: "end",
                align: "top",
                offset: 4,
                clamp: true,
                color: "#111827",
                font: { family: "Sarabun", size: 14, weight: "bold" },
                formatter: value => {
                    const number = Number(value);

                    return Number.isInteger(number)
                        ? number + "%"
                        : number.toFixed(2) + "%";
                }
            },

            legend: {
                position: "bottom",
                labels: {
                    color: "#334155",
                    usePointStyle: true,
                    pointStyle: "circle",
                    padding: 22,
                    font: { family: "Sarabun", size: 14, weight: "bold" }
                }
            },

            tooltip: {
                backgroundColor: "#111827",
                titleColor: "#ffffff",
                bodyColor: "#ffffff",
                padding: 14,
                cornerRadius: 14,
                titleFont: { family: "Sarabun", weight: "bold" },
                bodyFont: { family: "Sarabun" },
                callbacks: {
                    label: context =>
                        `${context.dataset.label}: ${Number(context.raw).toFixed(2)}%`
                }
            }
        },

        scales: {
            y: {
                min: range.min,
                max: range.max,
                ticks: {
                    stepSize: range.step,
                    color: "#64748b",
                    callback: value => Number(value).toFixed(2) + "%",
                    font: { family: "Sarabun", weight: "bold" }
                },
                grid: { color: "rgba(148, 163, 184, 0.22)" },
                border: { display: false }
            },

            x: {
                ticks: {
                    color: "#475569",
                    maxRotation: 60,
                    minRotation: 0,
                    autoSkip: true,
                    maxTicksLimit: 18,
                    font: { family: "Sarabun", weight: "bold" }
                },
                grid: { display: false },
                border: { display: false }
            }
        }
    };
}

function updateChart(items) {
    const canvas = document.getElementById("performanceChart");

    if (!canvas) {
        return;
    }

    if (performanceChart) {
        performanceChart.destroy();
    }

    const datasets = [
        {
            label: "ความตรงต่อเวลา ไม่เกิน 5 นาที",
            data: items.map(item => item.punctuality5.total),
            backgroundColor: "rgba(244, 63, 94, 0.80)",
            borderColor: "rgba(190, 18, 60, 1)"
        },
        {
            label: "ความตรงต่อเวลา ไม่เกิน 10 นาที",
            data: items.map(item => item.onTime.total),
            backgroundColor: "rgba(239, 35, 60, 0.88)",
            borderColor: "rgba(181, 18, 27, 1)"
        },
        {
            label: "ความน่าเชื่อถือ",
            data: items.map(item => item.reliability.total),
            backgroundColor: "rgba(123, 44, 191, 0.88)",
            borderColor: "rgba(91, 33, 182, 1)"
        },
        {
            label: "ความพร้อมของขบวนรถไฟ",
            data: items.map(item => item.availability.total),
            backgroundColor: "rgba(0, 119, 182, 0.88)",
            borderColor: "rgba(3, 105, 161, 1)"
        }
    ].map(dataset => ({
        ...dataset,
        borderWidth: 1,
        borderRadius: 12,
        barPercentage: 0.72,
        categoryPercentage: 0.74
    }));

    const allValues = datasets.flatMap(dataset => dataset.data);
    const options   = buildBaseChartOptions(calcYAxisRange(allValues));

    // ข้อมูลเยอะ -> ซ่อน label บนแท่งเพื่อไม่ให้รก
    if (items.length > 8) {
        options.plugins.datalabels.display = false;
    }

    performanceChart = new Chart(canvas, {
        type: "bar",
        plugins: getChartPlugins(),
        data: { labels: items.map(item => item.month), datasets: datasets },
        options: options
    });
}

function updateSeparateCharts(items) {
    const labels = items.map(item => item.month);

    const configs = [
        {
            canvasId: "punctuality5Chart",
            instance: punctuality5Chart,
            label: "ความตรงต่อเวลา ไม่เกิน 5 นาที",
            data: items.map(item => item.punctuality5.total),
            backgroundColor: "rgba(244, 63, 94, 0.82)",
            borderColor: "rgba(190, 18, 60, 1)",
            assign: chart => (punctuality5Chart = chart)
        },
        {
            canvasId: "onTimeChart",
            instance: onTimeChart,
            label: "ความตรงต่อเวลา ไม่เกิน 10 นาที",
            data: items.map(item => item.onTime.total),
            backgroundColor: "rgba(239, 35, 60, 0.88)",
            borderColor: "rgba(181, 18, 27, 1)",
            assign: chart => (onTimeChart = chart)
        },
        {
            canvasId: "reliabilityChart",
            instance: reliabilityChart,
            label: "ความน่าเชื่อถือ",
            data: items.map(item => item.reliability.total),
            backgroundColor: "rgba(123, 44, 191, 0.88)",
            borderColor: "rgba(91, 33, 182, 1)",
            assign: chart => (reliabilityChart = chart)
        },
        {
            canvasId: "availabilityChart",
            instance: availabilityChart,
            label: "ความพร้อมของขบวนรถไฟ",
            data: items.map(item => item.availability.total),
            backgroundColor: "rgba(0, 119, 182, 0.88)",
            borderColor: "rgba(3, 105, 161, 1)",
            assign: chart => (availabilityChart = chart)
        }
    ];

    configs.forEach(config => {
        config.assign(createSingleBarChart({ ...config, labels: labels }));
    });
}

function createSingleBarChart(config) {
    const canvas = document.getElementById(config.canvasId);

    if (!canvas || typeof Chart === "undefined") {
        return null;
    }

    if (config.instance) {
        config.instance.destroy();
    }

    const averageValue =
        config.data.reduce((total, value) => total + Number(value), 0) /
        config.data.length;

    const options = buildBaseChartOptions(calcYAxisRange(config.data));

    if (config.labels.length > 10) {
        options.plugins.datalabels.display = false;
    }

    return new Chart(canvas, {
        type: "bar",
        plugins: getChartPlugins(),

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
                    barPercentage: 0.6,
                    categoryPercentage: 0.7,
                    order: 2
                },
                {
                    type: "line",
                    label: `ค่าเฉลี่ย ${averageValue.toFixed(2)}%`,
                    data: config.data.map(() => averageValue),
                    borderColor: "rgba(15, 23, 42, 0.65)",
                    borderWidth: 2,
                    borderDash: [7, 5],
                    pointRadius: 0,
                    fill: false,
                    order: 1,
                    datalabels: { display: false }
                }
            ]
        },

        options: options
    });
}

function getChartPlugins() {
    return typeof ChartDataLabels !== "undefined" ? [ChartDataLabels] : [];
}

/* =========================================================
   EXPORT: EXCEL
========================================================= */

function exportDashboardToExcel() {
    if (typeof XLSX === "undefined") {
        alert("ไม่พบไลบรารี XLSX");
        return;
    }

    const selectedData = getSelectedRangeData();

    if (selectedData.length === 0) {
        alert("ไม่พบข้อมูลสำหรับนำออก Excel");
        return;
    }

    const calculatedData = calculateDisplayData(selectedData);
    const workbook = XLSX.utils.book_new();

    const summaryRows = buildDashboardExcelRows(selectedData, calculatedData);
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);

    styleDashboardWorksheet(summarySheet);

    summarySheet["!cols"] = [{ wch: 34 }, { wch: 20 }, { wch: 20 }, { wch: 20 }];
    summarySheet["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } }
    ];

    XLSX.utils.book_append_sheet(workbook, summarySheet, "Dashboard Summary");

    const rawSheet = XLSX.utils.aoa_to_sheet(buildRawDataRows(selectedData));

    rawSheet["!cols"] = new Array(13).fill({ wch: 17 });

    XLSX.utils.book_append_sheet(workbook, rawSheet, "Monthly Data");

    XLSX.writeFile(workbook, getExportFileName("xlsx"));
}

function buildDashboardExcelRows(selectedData, data) {
    const first = selectedData[0];
    const last  = selectedData[selectedData.length - 1];

    const periodText = selectedData.length === 1
        ? first.month
        : `${first.month} ถึง ${last.month}`;

    return [
        ["Red Line Service Performance Dashboard", "", "", ""],
        [`ช่วงข้อมูล: ${periodText}  |  จำนวน ${selectedData.length} เดือน`, "", "", ""],
        [],
        ["ดัชนีประสิทธิภาพ (KPI)", "รวมทั้ง 2 สาย", "สายเหนือ", "สายตะวันตก"],
        ["ความตรงต่อเวลา ไม่เกิน 5 นาที (%)",
            formatPercent(data.punctuality5.total),
            formatPercent(data.punctuality5.north),
            formatPercent(data.punctuality5.west)],
        ["ความตรงต่อเวลา ไม่เกิน 10 นาที (%)",
            formatPercent(data.onTime.total),
            formatPercent(data.onTime.north),
            formatPercent(data.onTime.west)],
        ["ความน่าเชื่อถือ TSA (%)",
            formatPercent(data.reliability.total),
            formatPercent(data.reliability.north),
            formatPercent(data.reliability.west)],
        ["ความพร้อมของขบวนรถไฟ TA (%)",
            formatPercent(data.availability.total),
            formatPercent(data.availability.north),
            formatPercent(data.availability.west)],
        [],
        ["ข้อมูลการเดินรถ (ผลรวม)", "รวมทั้ง 2 สาย", "สายเหนือ", "สายตะวันตก"],
        ["ระยะทางที่วิ่งให้บริการ (กม.)",
            formatNumber(data.distance.total),
            formatNumber(data.distance.north),
            formatNumber(data.distance.west)],
        ["จำนวนเที่ยววิ่งที่ให้บริการ (เที่ยว)",
            formatNumber(data.trips.total),
            formatNumber(data.trips.north),
            formatNumber(data.trips.west)],
        ["การยกเลิกเที่ยววิ่ง (เที่ยว)",
            formatNumber(data.cancelled.total),
            formatNumber(data.cancelled.north),
            formatNumber(data.cancelled.west)]
    ];
}

function buildRawDataRows(selectedData) {
    const rows = [[
        "เดือน", "ปีงบประมาณ",
        "TSP5 รวม", "TSP5 เหนือ", "TSP5 ตะวันตก",
        "TSP10 รวม", "TSP10 เหนือ", "TSP10 ตะวันตก",
        "TSA รวม", "TA รวม",
        "ระยะทางรวม", "เที่ยววิ่งรวม", "ยกเลิกรวม"
    ]];

    selectedData.forEach(item => {
        rows.push([
            item.month,
            getFiscalYear(item.id),
            Number(item.punctuality5.total),
            Number(item.punctuality5.north),
            Number(item.punctuality5.west),
            Number(item.onTime.total),
            Number(item.onTime.north),
            Number(item.onTime.west),
            Number(item.reliability.total),
            Number(item.availability.total),
            Number(item.distance.total),
            Number(item.trips.total),
            Number(item.cancelled.total)
        ]);
    });

    return rows;
}

function styleDashboardWorksheet(worksheet) {
    const range = XLSX.utils.decode_range(worksheet["!ref"]);

    for (let row = range.s.r; row <= range.e.r; row++) {
        for (let col = range.s.c; col <= range.e.c; col++) {
            const cellRef = XLSX.utils.encode_cell({ r: row, c: col });

            if (!worksheet[cellRef]) {
                continue;
            }

            worksheet[cellRef].s = {
                font: { name: "Sarabun", sz: 11, color: { rgb: "111827" } },
                alignment: {
                    vertical: "center",
                    horizontal: col === 0 ? "left" : "center",
                    wrapText: true
                },
                border: {
                    top:    { style: "thin", color: { rgb: "E2E8F0" } },
                    bottom: { style: "thin", color: { rgb: "E2E8F0" } },
                    left:   { style: "thin", color: { rgb: "E2E8F0" } },
                    right:  { style: "thin", color: { rgb: "E2E8F0" } }
                }
            };
        }
    }

    if (worksheet["A1"]) {
        worksheet["A1"].s = {
            font: { name: "Sarabun", sz: 18, bold: true, color: { rgb: "FFFFFF" } },
            alignment: { horizontal: "center", vertical: "center" },
            fill: { patternType: "solid", fgColor: { rgb: "7F0B0B" } }
        };
    }

    if (worksheet["A2"]) {
        worksheet["A2"].s = {
            font: { name: "Sarabun", sz: 12, bold: true, color: { rgb: "7F0B0B" } },
            alignment: { horizontal: "center", vertical: "center" },
            fill: { patternType: "solid", fgColor: { rgb: "FEE2E2" } }
        };
    }

    [3, 9].forEach(rowIndex => {
        for (let col = 0; col <= 3; col++) {
            const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: col });

            if (worksheet[cellRef]) {
                worksheet[cellRef].s = {
                    font: { name: "Sarabun", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
                    alignment: { horizontal: "center", vertical: "center", wrapText: true },
                    fill: { patternType: "solid", fgColor: { rgb: "A1121B" } }
                };
            }
        }
    });
}

function getExportFileName(extension) {
    const selectedData = getSelectedRangeData();
    const first = selectedData[0];
    const last  = selectedData[selectedData.length - 1];

    const rangeText = selectedData.length === 1
        ? first.id
        : `${first.id}_to_${last.id}`;

    return `redline-dashboard-${rangeText}.${extension}`;
}

/* =========================================================
   EXPORT: PDF
========================================================= */

async function exportDashboardToPdf() {
    if (typeof html2canvas === "undefined") {
        alert("ไม่พบ html2canvas");
        return;
    }

    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert("ไม่พบ jsPDF");
        return;
    }

    const selectedData = getSelectedRangeData();

    if (selectedData.length === 0) {
        alert("ไม่พบข้อมูลสำหรับนำออก PDF");
        return;
    }

    const button = document.getElementById("exportPdfBtn");
    const originalLabel = button ? button.textContent : "";

    if (button) {
        button.disabled = true;
        button.textContent = "กำลังสร้าง PDF...";
    }

    try {
        const calculatedData = calculateDisplayData(selectedData);

        await waitForChartsReady();

        const root = buildPdfSlides(selectedData, calculatedData);
        document.body.appendChild(root);

        await waitForPdfImages(root);
        await new Promise(resolve => setTimeout(resolve, 300));

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

        const slides = root.querySelectorAll(".pdf-slide");

        for (let index = 0; index < slides.length; index++) {
            const canvas = await html2canvas(slides[index], {
                scale: 2,
                useCORS: true,
                backgroundColor: "#f8fafc",
                width: slides[index].offsetWidth,
                height: slides[index].offsetHeight
            });

            if (index > 0) {
                pdf.addPage();
            }

            pdf.addImage(
                canvas.toDataURL("image/jpeg", 0.95),
                "JPEG",
                0, 0,
                pdf.internal.pageSize.getWidth(),
                pdf.internal.pageSize.getHeight()
            );
        }

        document.body.removeChild(root);
        pdf.save(getExportFileName("pdf"));
    }
    catch (error) {
        console.error(error);
        alert("สร้าง PDF ไม่สำเร็จ");
    }
    finally {
        if (button) {
            button.disabled = false;
            button.textContent = originalLabel;
        }
    }
}

function buildPdfSlides(selectedData, calculatedData) {
    const first = selectedData[0];
    const last  = selectedData[selectedData.length - 1];

    const periodText = selectedData.length === 1
        ? first.month
        : `${first.month} ถึง ${last.month}`;

    const kpiCalcText = selectedData.length === 1
        ? "แสดงค่าของเดือนที่เลือก"
        : `KPI เฉลี่ยจาก ${selectedData.length} เดือน`;

    const operationCalcText = selectedData.length === 1
        ? "แสดงค่าของเดือนที่เลือก"
        : `ข้อมูลการเดินรถเป็นผลรวมจาก ${selectedData.length} เดือน`;

    const root = document.createElement("div");
    root.className = "pdf-export-root";

    root.appendChild(createPdfCoverSlide(periodText, kpiCalcText, operationCalcText));
    root.appendChild(createPdfKpiSlide(calculatedData));
    root.appendChild(createPdfOperationSlide(calculatedData, operationCalcText));

    createPdfChartSlides().forEach(slide => root.appendChild(slide));

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
                    รายงานระดับการให้บริการ<br>ระบบรถไฟฟ้าชานเมืองสายสีแดง
                </div>
                <div class="pdf-slide-subtitle">${periodText}</div>
            </div>
            <div class="pdf-badge">Monthly Performance Report</div>
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

        <div class="pdf-footer-note" style="color: rgba(255,255,255,0.78); margin-top: 110px;">
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
                    สรุปค่าดัชนีหลัก แยกรวมทั้ง 2 สาย / สายเหนือ / สายตะวันตก
                </div>
            </div>
            <div class="pdf-badge">KPI</div>
        </div>

        <div class="pdf-grid-2">
            ${createPdfMetricCard({ theme: "pdf-red", code: "TSP 5 MIN",
                title: "ความตรงต่อเวลา", note: "ความล่าช้าไม่เกิน 5 นาที",
                total: formatPercent(data.punctuality5.total),
                north: formatPercent(data.punctuality5.north),
                west:  formatPercent(data.punctuality5.west) })}

            ${createPdfMetricCard({ theme: "pdf-red", code: "TSP 10 MIN",
                title: "ความตรงต่อเวลา", note: "ความล่าช้าไม่เกิน 10 นาที",
                total: formatPercent(data.onTime.total),
                north: formatPercent(data.onTime.north),
                west:  formatPercent(data.onTime.west) })}

            ${createPdfMetricCard({ theme: "pdf-purple", code: "TSA",
                title: "ความน่าเชื่อถือ", note: "Train Service Availability",
                total: formatPercent(data.reliability.total),
                north: formatPercent(data.reliability.north),
                west:  formatPercent(data.reliability.west) })}

            ${createPdfMetricCard({ theme: "pdf-blue", code: "TA",
                title: "ความพร้อมของขบวนรถไฟ", note: "Train Availability",
                total: formatPercent(data.availability.total),
                north: formatPercent(data.availability.north),
                west:  formatPercent(data.availability.west) })}
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
            ${createPdfMetricCard({ theme: "pdf-orange", code: "OPR 01",
                title: "ระยะทางที่วิ่งให้บริการ", note: "หน่วย: กิโลเมตร",
                total: formatNumber(data.distance.total),
                north: formatNumber(data.distance.north),
                west:  formatNumber(data.distance.west) })}

            ${createPdfMetricCard({ theme: "pdf-green", code: "OPR 02",
                title: "จำนวนเที่ยววิ่งที่ให้บริการ", note: "หน่วย: เที่ยว",
                total: formatNumber(data.trips.total),
                north: formatNumber(data.trips.north),
                west:  formatNumber(data.trips.west) })}

            ${createPdfMetricCard({ theme: "pdf-red", code: "OPR 03",
                title: "การยกเลิกเที่ยววิ่ง", note: "หน่วย: เที่ยว",
                total: formatNumber(data.cancelled.total),
                north: formatNumber(data.cancelled.north),
                west:  formatNumber(data.cancelled.west) })}
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
                <div class="pdf-split-item"><span>สายเหนือ</span><strong>${config.north}</strong></div>
                <div class="pdf-split-item"><span>สายตะวันตก</span><strong>${config.west}</strong></div>
            </div>
        </div>
    `;
}

function createPdfChartSlides() {
    const chartConfigs = [
        { canvasId: "performanceChart",  instance: performanceChart,
          title: "กราฟเปรียบเทียบค่าดัชนีหลัก", subtitle: "กราฟรวม KPI ทั้งหมด", badge: "Overview" },
        { canvasId: "punctuality5Chart", instance: punctuality5Chart,
          title: "ความตรงต่อเวลา", subtitle: "ความล่าช้าไม่เกิน 5 นาที", badge: "TSP 5 Min" },
        { canvasId: "onTimeChart",       instance: onTimeChart,
          title: "ความตรงต่อเวลา", subtitle: "ความล่าช้าไม่เกิน 10 นาที", badge: "TSP 10 Min" },
        { canvasId: "reliabilityChart",  instance: reliabilityChart,
          title: "ความน่าเชื่อถือ", subtitle: "Train Service Availability (TSA)", badge: "Reliability" },
        { canvasId: "availabilityChart", instance: availabilityChart,
          title: "ความพร้อมของขบวนรถไฟ", subtitle: "Train Availability (TA)", badge: "Availability" }
    ];

    const slides = [];

    chartConfigs.forEach(config => {
        const image = getChartImage(config.canvasId, config.instance);

        if (!image) {
            return;
        }

        const slide = document.createElement("section");
        slide.className = "pdf-slide";

        slide.innerHTML = `
            <div class="pdf-slide-header">
                <div>
                    <div class="pdf-slide-kicker">MONTHLY PERFORMANCE</div>
                    <div class="pdf-slide-title">${config.title}</div>
                    <div class="pdf-slide-subtitle">${config.subtitle}</div>
                </div>
                <div class="pdf-badge">${config.badge}</div>
            </div>
        `;

        const image_el = document.createElement("img");
        image_el.className = "pdf-chart-image";
        image_el.src = image;
        image_el.alt = config.title;

        slide.appendChild(image_el);
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
        return "";
    }

    try {
        const image = canvas.toDataURL("image/png");

        return image && image !== "data:," ? image : "";
    }
    catch (error) {
        return "";
    }
}

function waitForChartsReady() {
    return new Promise(resolve => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => setTimeout(resolve, 500));
        });
    });
}

function waitForPdfImages(root) {
    const images = Array.from(root.querySelectorAll("img"));

    return Promise.all(images.map(image =>
        image.complete
            ? Promise.resolve()
            : new Promise(resolve => {
                image.onload = resolve;
                image.onerror = resolve;
            })
    ));
}
