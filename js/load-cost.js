/* =========================================================
   load-cost.js
   โหลดข้อมูลต้นทุนจาก data/cost-data.xlsx แล้วส่งต่อให้ cost-app.js

   ชีตที่ใช้:
     dashboard_cost         สรุปรายปีงบประมาณ (ต้นทุน 4 หมวด, Car-Km, ผู้โดยสาร, ค่าโดยสารเฉลี่ย ...)
     dashboard_cost_detail  รายการต้นทุนย่อยของแต่ละหมวดในแต่ละปี

   อยากเพิ่มปีงบประมาณใหม่ → เพิ่มแถวในสองชีตนี้ได้เลย ไม่ต้องแก้โค้ด
   ปีที่ยังไม่มีตัวเลขต้นทุน (เป็นช่องว่าง) หน้าเว็บจะข้ามไปให้เอง
   ========================================================= */

const COST_DATA_FILE = "data/cost-data.xlsx";
const COST_SHEET_NAME = "dashboard_cost";
const COST_DETAIL_SHEET_NAME = "dashboard_cost_detail";

document.addEventListener("DOMContentLoaded", loadCostData);

async function loadCostData() {
    try {
        if (typeof XLSX === "undefined") {
            throw new Error("ไม่พบไลบรารี XLSX (ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต)");
        }

        const response = await fetch(COST_DATA_FILE + "?t=" + Date.now());

        if (!response.ok) {
            throw new Error(`โหลดไฟล์ Excel ไม่สำเร็จ (${response.status})`);
        }

        const workbook = XLSX.read(await response.arrayBuffer(), { type: "array" });

        const worksheet = workbook.Sheets[COST_SHEET_NAME];
        if (!worksheet) {
            throw new Error(`ไม่พบชีต ${COST_SHEET_NAME}`);
        }

        const rows = XLSX.utils.sheet_to_json(worksheet, { defval: 0 });

        window.costData = rows
            .filter(row => row.FiscalYear)
            .map(row => ({
                fiscalYear: Number(row.FiscalYear),
                staffCost: toNumber(row.StaffCost),
                energyCost: toNumber(row.EnergyCost),
                maintenanceCost: toNumber(row.MaintenanceCost),
                indirectCost: toNumber(row.IndirectCost),
                totalCost: toNumber(row.TotalCost),
                carKm: toNumber(row.CarKm),
                passenger: toNumber(row.Passenger),
                avgFare: toNumber(row.AvgFare),
                costPerCarKm: toNumber(row.CostPerCarKm),
                costPerPassenger: toNumber(row.CostPerPassenger)
            }));

        const detailSheet = workbook.Sheets[COST_DETAIL_SHEET_NAME];

        window.costDetail = detailSheet
            ? XLSX.utils.sheet_to_json(detailSheet, { defval: 0 }).map(row => ({
                FiscalYear: Number(row.FiscalYear),
                CostGroup: String(row.CostGroup || "").trim(),
                CostItem: cleanItemName(row.CostItem),
                Amount: toNumber(row.Amount)
            }))
            : [];

        console.log("โหลด Cost Dashboard สำเร็จ", window.costData.length, "ปีงบประมาณ");
    }
    catch (error) {
        console.error(error);
        window.costLoadError = error.message;
    }

    if (typeof window.initCostDashboard === "function") {
        window.initCostDashboard();
    }
}

/* ชื่อรายการใน Excel มีขึ้นบรรทัดใหม่/เว้นวรรคนำหน้า → จัดให้เป็นบรรทัดเดียว */
function cleanItemName(value) {
    return String(value == null ? "" : value)
        .replace(/\s*\n\s*/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function toNumber(value) {
    const parsed = parseFloat(String(value ?? "").replace(/,/g, ""));
    return isNaN(parsed) ? 0 : parsed;
}
