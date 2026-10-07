const COST_DATA_FILE = "data/cost-data.xlsx";
const COST_SHEET_NAME = "dashboard_cost";

document.addEventListener(
    "DOMContentLoaded",
    loadCostData
);

async function loadCostData() {

    try {

        const response =
            await fetch(
                COST_DATA_FILE +
                "?t=" +
                Date.now()
            );

        if (!response.ok) {
            throw new Error(
                `โหลดไฟล์ Excel ไม่สำเร็จ (${response.status})`
            );
        }

        const workbook = XLSX.read(
            await response.arrayBuffer(),
            {
                type: "array"
            }
        );

        const worksheet =
            workbook.Sheets[COST_SHEET_NAME];

        if (!worksheet) {
            throw new Error(
                `ไม่พบชีต ${COST_SHEET_NAME}`
            );
        }

        const rows =
            XLSX.utils.sheet_to_json(
                worksheet,
                {
                    defval: 0
                }
            );

        window.costData =
            rows.map(row => ({

                fiscalYear:
                    Number(row.FiscalYear),

                staffCost:
                    toNumber(row.StaffCost),

                energyCost:
                    toNumber(row.EnergyCost),

                maintenanceCost:
                    toNumber(row.MaintenanceCost),

                indirectCost:
                    toNumber(row.IndirectCost),

                totalCost:
                    toNumber(row.TotalCost),

                carKm:
                    toNumber(row.CarKm),

                passenger:
                    toNumber(row.Passenger),

                avgFare:
                    toNumber(row.AvgFare),

                costPerCarKm:
                    toNumber(row.CostPerCarKm),

                costPerPassenger:
                    toNumber(row.CostPerPassenger)

            }));

        console.log(
            "โหลด Cost Dashboard สำเร็จ",
            window.costData
        );

    }
    catch (error) {

        alert(
            "โหลดข้อมูลต้นทุนไม่ได้\n\n" +
            error.message
        );

        console.error(error);

        return;

    }

    initCostDashboard();

}

function toNumber(value) {

    const parsed =
        parseFloat(
            String(value ?? "")
                .replace(/,/g, "")
        );

    return isNaN(parsed)
        ? 0
        : parsed;
}
``
