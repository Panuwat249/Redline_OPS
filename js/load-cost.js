async function loadCostData() {

    console.log("load-cost.js loaded");

    try {

        const response =
            await fetch("data/cost-data.xlsx");

        if (!response.ok) {
            throw new Error(
                `โหลดไฟล์ Excel ไม่สำเร็จ (${response.status})`
            );
        }

        const buffer =
            await response.arrayBuffer();

        const workbook =
            XLSX.read(buffer);

        const worksheet =
            workbook.Sheets["Cost"];

        if (!worksheet) {
            throw new Error(
                'ไม่พบ Sheet ชื่อ "Cost"'
            );
        }

        const excelRows =
            XLSX.utils.sheet_to_json(
                worksheet
            );

        window.costData =
            excelRows.map(row => ({
                fiscalYear: String(
                    row.FiscalYear || ""
                ),

                staffCost: Number(
                    row.StaffCost || 0
                ),

                energyCost: Number(
                    row.EnergyCost || 0
                ),

                maintenanceCost: Number(
                    row.MaintenanceCost || 0
                ),

                indirectCost: Number(
                    row.IndirectCost || 0
                )
            }));

        console.log(
            "Converted Data :",
            window.costData
        );

        initCostDashboard();

    }
    catch (error) {

        console.error(error);

        alert(
            "ไม่สามารถโหลดข้อมูลจาก cost-data.xlsx ได้"
        );
    }
}

document.addEventListener(
    "DOMContentLoaded",
    loadCostData
);
