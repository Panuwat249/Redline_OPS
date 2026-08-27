async function loadCostData() {
    console.log("load-cost.js loaded");

    try {
        const response = await fetch("data/cost-data.xlsx");

        if (!response.ok) {
            throw new Error(
                `โหลดไฟล์ Excel ไม่สำเร็จ (${response.status})`
            );
        }

        const buffer = await response.arrayBuffer();

        const workbook = XLSX.read(buffer);

        const worksheet = workbook.Sheets["Cost"];

        window.costData =
            XLSX.utils.sheet_to_json(worksheet);

        console.log("Excel Data:", window.costData);

        initCostDashboard();

    } catch (error) {
        console.error(error);

        alert(
            "ไม่สามารถโหลดไฟล์ cost-data.xlsx ได้"
        );
    }
}

document.addEventListener(
    "DOMContentLoaded",
    loadCostData
);
