let activeCostData = [];
let selectedGroup =
    "Staff";

function initCostDashboard() {
    const data = window.costData;
    setupCostCards();

    if (!Array.isArray(data) || data.length === 0) {
        alert("ไม่พบข้อมูลใน js/cost-data.js");
        console.error("window.costData =", window.costData);
        return;
    }

    activeCostData = [...data].sort((a, b) => {
        return Number(a.fiscalYear) - Number(b.fiscalYear);
    });

    const startFiscalYearSelect = document.getElementById("startFiscalYearSelect");
    const endFiscalYearSelect = document.getElementById("endFiscalYearSelect");
    const applyCostBtn = document.getElementById("applyCostBtn");

    if (!startFiscalYearSelect) {
        alert('ไม่พบ <select id="startFiscalYearSelect"> ใน cost.html');
        return;
    }

    if (!endFiscalYearSelect) {
        alert('ไม่พบ <select id="endFiscalYearSelect"> ใน cost.html');
        return;
    }

    if (!applyCostBtn) {
        alert('ไม่พบ <button id="applyCostBtn"> ใน cost.html');
        return;
    }

    populateFiscalYearOptions(activeCostData);

    const lastIndex = activeCostData.length - 1;

    startFiscalYearSelect.value = String(activeCostData[lastIndex].fiscalYear);
    endFiscalYearSelect.value = String(activeCostData[lastIndex].fiscalYear);

    renderCostDashboard();

    applyCostBtn.addEventListener("click", renderCostDashboard);
    const groupSelect =
    document.getElementById(
        "costGroupSelect"
    );

if (groupSelect) {

    groupSelect
        .addEventListener(
            "change",
            renderDetailBreakdown
        );

}

    startFiscalYearSelect.addEventListener("change", renderCostDashboard);
    endFiscalYearSelect.addEventListener("change", renderCostDashboard);
}

function populateFiscalYearOptions(data) {
    const startFiscalYearSelect = document.getElementById("startFiscalYearSelect");
    const endFiscalYearSelect = document.getElementById("endFiscalYearSelect");

    startFiscalYearSelect.innerHTML = "";
    endFiscalYearSelect.innerHTML = "";

    data.forEach(item => {
        const startOption = document.createElement("option");
        startOption.value = String(item.fiscalYear);
        startOption.textContent = `ปีงบประมาณ ${item.fiscalYear}`;

        const endOption = document.createElement("option");
        endOption.value = String(item.fiscalYear);
        endOption.textContent = `ปีงบประมาณ ${item.fiscalYear}`;

        startFiscalYearSelect.appendChild(startOption);
        endFiscalYearSelect.appendChild(endOption);
    });
}

function renderCostDashboard() {
    const selectedData = getSelectedCostRangeData();

    if (!selectedData || selectedData.length === 0) {
        alert("ไม่พบข้อมูลปีงบประมาณที่เลือก");
        return;
    }

    const calculatedData = calculateCostRangeData(selectedData);

    updateCostCards(selectedData, calculatedData);
    updateCostTable(selectedData);
    renderPieCharts();
    renderDetailBreakdown();
}

function getSelectedCostRangeData() {
    const startFiscalYearSelect = document.getElementById("startFiscalYearSelect");
    const endFiscalYearSelect = document.getElementById("endFiscalYearSelect");

    const startYear = String(startFiscalYearSelect.value);
    const endYear = String(endFiscalYearSelect.value);

    const startIndex = activeCostData.findIndex(item => {
        return String(item.fiscalYear) === startYear;
    });

    const endIndex = activeCostData.findIndex(item => {
        return String(item.fiscalYear) === endYear;
    });

    if (startIndex === -1 || endIndex === -1) {
        return [];
    }

    const from = Math.min(startIndex, endIndex);
    const to = Math.max(startIndex, endIndex);

    return activeCostData.slice(from, to + 1);
}

function calculateCostRangeData(items) {
    const staffCost = sumCost(items, "staffCost");
    const energyCost = sumCost(items, "energyCost");
    const maintenanceCost = sumCost(items, "maintenanceCost");
    const indirectCost = sumCost(items, "indirectCost");

    const totalCost =
        staffCost +
        energyCost +
        maintenanceCost +
        indirectCost;

    const yearCount = items.length;

    const averageTotalCost =
        yearCount > 1
            ? totalCost / yearCount
            : null;

    return {
        staffCost,
        energyCost,
        maintenanceCost,
        indirectCost,
        totalCost,
        averageTotalCost,
        yearCount
    };
}

function sumCost(items, key) {
    return items.reduce((sum, item) => {
        return sum + Number(item[key] || 0);
    }, 0);
}

function calculateSingleYearCost(item) {
    const staffCost = Number(item.staffCost || 0);
    const energyCost = Number(item.energyCost || 0);
    const maintenanceCost = Number(item.maintenanceCost || 0);
    const indirectCost = Number(item.indirectCost || 0);

    const totalCost =
        staffCost +
        energyCost +
        maintenanceCost +
        indirectCost;

    return {
        staffCost,
        energyCost,
        maintenanceCost,
        indirectCost,
        totalCost
    };
}

function updateCostCards(selectedData, data) {
    const first = selectedData[0];
    const last = selectedData[selectedData.length - 1];

    const fiscalYearText =
        selectedData.length === 1
            ? `ปีงบประมาณ ${first.fiscalYear}`
            : `ปีงบประมาณ ${first.fiscalYear} ถึง ${last.fiscalYear}`;

    setCostText("selectedFiscalYearText", fiscalYearText);
    setCostText("costFiscalYearText", fiscalYearText);

    // แสดงข้อมูลรายปีงบในกล่องทั้ง 4 ด้าน ไม่ใช่การ sum
    setCostYearList("staffCostText", selectedData, "staffCost");
    setCostYearList("energyCostText", selectedData, "energyCost");
    setCostYearList("maintenanceCostText", selectedData, "maintenanceCost");
    setCostYearList("indirectCostText", selectedData, "indirectCost");

    // กล่อง Total ยังเป็นผลรวมของช่วงที่เลือก
    setCostText("totalCostText", formatCost(data.totalCost));
    setCostText("totalCostPill", `Total ${formatCost(data.totalCost)}`);

    // กล่อง Average เฉลี่ยเฉพาะช่วงที่เลือก
    if (selectedData.length === 1) {
        setCostText("averageCostText", "ไม่คำนวณเฉลี่ย");
        setCostText("averageCostCardText", "ไม่คำนวณ");
    } else {
        setCostText("averageCostText", formatCost(data.averageTotalCost));
        setCostText("averageCostCardText", formatCost(data.averageTotalCost));
    }
}

function setCostYearList(id, selectedData, key) {
    const element = document.getElementById(id);

    if (!element) {
        console.warn(`ไม่พบ id="${id}" ใน cost.html`);
        return;
    }

    element.classList.add("cost-year-list");

    const yearRows = selectedData
        .map(item => {
            return `
                <div class="cost-year-row">
                    <span>ปีงบ ${item.fiscalYear}</span>
                    <strong>${formatCost(item[key])}</strong>
                </div>
            `;
        })
        .join("");

    let averageRow = "";

    if (selectedData.length > 1) {
        const averageValue =
            selectedData.reduce((sum, item) => {
                return sum + Number(item[key] || 0);
            }, 0) / selectedData.length;

        averageRow = `
            <div class="cost-year-row cost-year-average-row">
                <span>เฉลี่ย</span>
                <strong>${formatCost(averageValue)}</strong>
            </div>
        `;
    }

    element.innerHTML = yearRows + averageRow;
}

function updateCostTable(selectedData) {
    const tableBody = document.getElementById("costTableBody");
    const tableFooter = document.getElementById("costTableFooter");

    if (!tableBody) {
        console.warn('ไม่พบ <tbody id="costTableBody"> ใน cost.html');
        return;
    }

    tableBody.innerHTML = "";

    if (tableFooter) {
        tableFooter.innerHTML = "";
    }

    selectedData.forEach(item => {
        const calculatedData = calculateSingleYearCost(item);

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>ปีงบประมาณ ${item.fiscalYear}</td>
            <td>${formatCost(calculatedData.staffCost)}</td>
            <td>${formatCost(calculatedData.energyCost)}</td>
            <td>${formatCost(calculatedData.maintenanceCost)}</td>
            <td>${formatCost(calculatedData.indirectCost)}</td>
            <td>${formatCost(calculatedData.totalCost)}</td>
        `;

        tableBody.appendChild(row);
    });

    if (selectedData.length > 1 && tableFooter) {
        const averageRow = document.createElement("tr");

        const averageStaffCost = sumCost(selectedData, "staffCost") / selectedData.length;
        const averageEnergyCost = sumCost(selectedData, "energyCost") / selectedData.length;
        const averageMaintenanceCost = sumCost(selectedData, "maintenanceCost") / selectedData.length;
        const averageIndirectCost = sumCost(selectedData, "indirectCost") / selectedData.length;

        const averageTotalCost =
            selectedData.reduce((sum, item) => {
                return sum + calculateSingleYearCost(item).totalCost;
            }, 0) / selectedData.length;

        averageRow.innerHTML = `
            <td>เฉลี่ยช่วงที่เลือก</td>
            <td>${formatCost(averageStaffCost)}</td>
            <td>${formatCost(averageEnergyCost)}</td>
            <td>${formatCost(averageMaintenanceCost)}</td>
            <td>${formatCost(averageIndirectCost)}</td>
            <td>${formatCost(averageTotalCost)}</td>
        `;

        tableFooter.appendChild(averageRow);
    }
}

function setCostText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    } else {
        console.warn(`ไม่พบ id="${id}" ใน cost.html`);
    }
}

function formatCost(value) {
    const number = Number(value || 0);

    return number.toLocaleString("th-TH", {
        maximumFractionDigits: 0
    });
}

let costPieChart = null;
let detailPieChart = null;

function renderPieCharts() {

    const endSelect =
        document.getElementById(
            "endFiscalYearSelect"
        );

    if (!endSelect) {
        return;
    }

    const selectedYear =
        Number(endSelect.value);

    const data =
        activeCostData.find(
            x =>
                Number(x.fiscalYear)
                === selectedYear
        );

    if (!data) {
        return;
    }

    const pieCanvas =
        document.getElementById(
            "costPieChart"
        );

    if (pieCanvas) {

        if (costPieChart) {
            costPieChart.destroy();
        }

        costPieChart =
    new Chart(
        pieCanvas,
        {

            type: "pie",

            data: {

                labels: [

                    "Staff",
                    "Energy",
                    "Maintenance",
                    "Indirect"

                ],

                datasets: [

                    {

                        data: [

                            data.staffCost,
                            data.energyCost,
                            data.maintenanceCost,
                            data.indirectCost

                        ],

                        backgroundColor:[
                            "#dc2626",
                            "#f97316",
                            "#10b981",
                            "#8b5cf6"
                        ]

                    }

                ]

            },

            options:{

                responsive:true,

                maintainAspectRatio:false,

                plugins:{

                    legend:{
                        position:"right"
                    },

                    tooltip:{

                        callbacks:{

                            label:function(context){

                                const value =
                                    context.raw;

                                const total =
                                    context.dataset.data
                                        .reduce(
                                            (a,b)=>a+b,
                                            0
                                        );

                                const percent =
                                    (
                                        value /
                                        total *
                                        100
                                    )
                                    .toFixed(1);

                                return (
                                    context.label +
                                    " : " +
                                    formatCost(value) +
                                    " บาท (" +
                                    percent +
                                    "%)"
                                );

                            }

                        }

                    }

                }

            }

        }
    );

    }

    renderDetailBreakdown();

}

function renderDetailBreakdown() {

    const year =
        Number(
            document
                .getElementById(
                    "endFiscalYearSelect"
                )
                .value
        );

    const group =
        selectedGroup;

    if (!group) {
        return;
    }

    const rows =
        window.costDetail.filter(
            item =>

                Number(
                    item.FiscalYear
                ) === year

                &&

                item.CostGroup === group
        );

    const tbody =
        document.getElementById(
            "detailTableBody"
        );

    if (tbody) {

        tbody.innerHTML =
            rows.map(r => `

            <tr>

              <td>${r.CostGroup}</td>

              <td>${r.CostItem}</td>

              <td>${formatCost(r.Amount)}</td>

            </tr>

        `).join("");

    }

    const pie =
        document.getElementById(
            "detailPieChart"
        );

    if (!pie) {
        return;
    }

    if (detailPieChart) {
        detailPieChart.destroy();
    }

    detailPieChart =
        new Chart(
            pie,
            {

                type: "pie",

                data: {

                    labels:
                        rows.map(
                            x =>
                            x.CostItem
                        ),

                    datasets: [

                        {

                            data:
                                rows.map(
                                    x =>
                                    x.Amount
                                )

                        }

                    ]

                }

            }

        );
}

function setupCostCards(){

    document
        .getElementById(
            "staffCard"
        )
        ?.addEventListener(
            "click",
            () => {

                selectedGroup =
                    "Staff";

                renderDetailBreakdown();

            }
        );

    document
        .getElementById(
            "energyCard"
        )
        ?.addEventListener(
            "click",
            () => {

                selectedGroup =
                    "Energy";

                renderDetailBreakdown();

            }
        );

    document
        .getElementById(
            "maintenanceCard"
        )
        ?.addEventListener(
            "click",
            () => {

                selectedGroup =
                    "Maintenance";

                renderDetailBreakdown();

            }
        );

    document
        .getElementById(
            "indirectCard"
        )
        ?.addEventListener(
            "click",
            () => {

                selectedGroup =
                    "Indirect";

                renderDetailBreakdown();

            }
        );

}
