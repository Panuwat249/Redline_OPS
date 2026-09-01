const COST_DATA_FILE  = "data/cost-data.xlsx";
const COST_SHEET_NAME = "Cost";

document.addEventListener("DOMContentLoaded", loadCostData);

async function loadCostData() {
    try {
        const response = await fetch(COST_DATA_FILE + "?t=" + Date.now());

        if (!response.ok) {
            throw new Error(`โหลดไฟล์ Excel ไม่สำเร็จ (${response.status})`);
        }

        const workbook = XLSX.read(await response.arrayBuffer(), { type: "array" });

        const worksheet =
            workbook.Sheets[COST_SHEET_NAME] ||
            workbook.Sheets[workbook.SheetNames[0]];

        if (!worksheet) {
            throw new Error(`ไม่พบชีตชื่อ "${COST_SHEET_NAME}"`);
        }

        const rows = XLSX.utils.sheet_to_json(worksheet, { defval: 0 });

        window.costData = rows
            .map(row => {
                const clean = {};

                Object.keys(row).forEach(key => {
                    clean[String(key).replace(/[\s_\-]/g, "").toLowerCase()] = row[key];
                });

                return {
                    fiscalYear: String(clean.fiscalyear || clean.ปีงบประมาณ || "").trim(),
                    staffCost: toNumber(clean.staffcost),
                    energyCost: toNumber(clean.energycost),
                    maintenanceCost: toNumber(clean.maintenancecost),
                    indirectCost: toNumber(clean.indirectcost)
                };
            })
            .filter(item => item.fiscalYear !== "");

        if (window.costData.length === 0) {
            throw new Error("ไม่มีข้อมูลในชีต Cost");
        }

        console.log("โหลด cost-data.xlsx สำเร็จ:", window.costData.length, "ปี");
    }
    catch (error) {
        console.warn("โหลด cost-data.xlsx ไม่ได้:", error.message);

        if (!Array.isArray(window.costData) || window.costData.length === 0) {
            alert(
                "โหลดข้อมูลต้นทุนไม่ได้\n\n" +
                "1) ตรวจสอบไฟล์ data/cost-data.xlsx (ชีตชื่อ Cost)\n" +
                "2) ต้องเปิดผ่าน Live Server หรือ GitHub Pages"
            );
            return;
        }
    }

    initCostDashboard();
}

function toNumber(value) {
    const parsed = parseFloat(String(value ?? "").replace(/,/g, ""));

    return isNaN(parsed) ? 0 : parsed;
}
