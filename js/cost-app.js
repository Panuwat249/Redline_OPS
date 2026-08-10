document.addEventListener("DOMContentLoaded", initCostDashboard);

function initCostDashboard() {
    const data = window.costData;

    if (!Array.isArray(data) || data.length === 0) {
        alert("ไม่พบข้อมูลใน js/cost-data.js");
        return;
    }

    populateFiscalYearOptions(data);

    const lastIndex = data.length - 1;
    const fiscalYearSelect = document.getElementById("fiscalYearSelect");

    fiscalYearSelect.value = data[lastIndex].fiscalYear;

    renderCostDashboard();

    document
        .getElementById("applyCostBtn")
        .addEventListener("click", renderCostDashboard);
}

function populateFiscalYearOptions(data) {
    const fiscalYearSelect = document.getElementById("fiscalYearSelect");

    fiscalYearSelect.innerHTML = "";

    data.forEach(item => {
        const option = document.createElement("option");
        option.value = item.fiscalYear;
        option.textContent = `ปีงบประมาณ ${item.fiscalYear}`;

        fiscalYearSelect.appendChild(option);
    });
}

function renderCostDashboard() {
    const selectedData = getSelectedCostData();

    if (!selectedData) {
        alert("ไม่พบข้อมูลปีงบประมาณที่เลือก");
        return;
    }

    const calculatedData = calculateCostData(selectedData);

    updateCostCards(selectedData, calculatedData);
    updateCostTable();
}

function getSelectedCostData() {
    const fiscalYearSelect = document.getElementById("fiscalYearSelect");
    const selectedFiscalYear = fiscalYearSelect.value;

    return window.costData.find(item => {
        return item.fiscalYear === selectedFiscalYear;
    });
}

function calculateCostData(item) {
    const staffCost = Number(item.staffCost || 0);
    const energyCost = Number(item.energyCost || 0);
    const maintenanceCost = Number(item.maintenanceCost || 0);
    const indirectCost = Number(item.indirectCost || 0);

    const totalCost =
        staffCost +
        energyCost +
        maintenanceCost +
        indirectCost;

    const averageCost = totalCost / 4;

    return {
        staffCost,
        energyCost,
        maintenanceCost,
        indirectCost,
        totalCost,
        averageCost
    };
}

function updateCostCards(item, data) {
    const fiscalYearText = `ปีงบประมาณ ${item.fiscalYear}`;

    setCostText("selectedFiscalYearText", fiscalYearText);
    setCostText("costFiscalYearText", fiscalYearText);

    setCostText("staffCostText", formatCost(data.staffCost));
    setCostText("energyCostText", formatCost(data.energyCost));
    setCostText("maintenanceCostText", formatCost(data.maintenanceCost));
    setCostText("indirectCostText", formatCost(data.indirectCost));

    setCostText("totalCostText", formatCost(data.totalCost));
    setCostText("averageCostText", formatCost(data.averageCost));
    setCostText("averageCostCardText", formatCost(data.averageCost));
    setCostText("totalCostPill", `Total ${formatCost(data.totalCost)}`);
}

function updateCostTable() {
    const tableBody = document.getElementById("costTableBody");

    tableBody.innerHTML = "";

    window.costData.forEach(item => {
        const calculatedData = calculateCostData(item);

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>ปีงบประมาณ ${item.fiscalYear}</td>
            <td>${formatCost(calculatedData.staffCost)}</td>
            <td>${formatCost(calculatedData.energyCost)}</td>
            <td>${formatCost(calculatedData.maintenanceCost)}</td>
            <td>${formatCost(calculatedData.indirectCost)}</td>
            <td>${formatCost(calculatedData.totalCost)}</td>
            <td>${formatCost(calculatedData.averageCost)}</td>
        `;

        tableBody.appendChild(row);
    });
}

function setCostText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}

function formatCost(value) {
    const number = Number(value || 0);

    return number.toLocaleString("th-TH", {
        maximumFractionDigits: 0
    });
}
