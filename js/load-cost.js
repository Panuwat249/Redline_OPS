async function loadCostData() {

    const response =
        await fetch("data/cost-data.xlsx");

    const buffer =
        await response.arrayBuffer();

    const workbook =
        XLSX.read(buffer);

    const worksheet =
        workbook.Sheets["Cost"];

    window.costData =
        XLSX.utils.sheet_to_json(
            worksheet
        );

    initCostDashboard();
}

document.addEventListener(
    "DOMContentLoaded",
    loadCostData
);
