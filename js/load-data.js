/* =========================================================
   load-data.js
   โหลดข้อมูลสถิติการเดินรถจาก data/ops-data.xlsx
   ถ้าโหลดไม่ได้ จะ fallback ไปใช้ window.statistics จาก js/data.js
   ========================================================= */

const OPS_DATA_FILE  = "data/ops-data.xlsx";
const OPS_SHEET_NAME = "Stats";

const NORTH_KM = 22.452;   // สายเหนือ (Dark Red)
const WEST_KM  = 14.539;   // สายตะวันตก (Light Red)

const THAI_MONTH_NAMES = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน",
    "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม",
    "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

document.addEventListener("DOMContentLoaded", bootstrapDashboard);

async function bootstrapDashboard() {
    setDataSourceBadge("กำลังโหลดข้อมูล...", "loading");

    try {
        const rows = await readOpsWorkbook();
        const parsed = rows
            .map(convertExcelRow)
            .filter(Boolean)
            .sort((a, b) => a.id.localeCompare(b.id));

        if (parsed.length === 0) {
            throw new Error("ไม่พบข้อมูลในชีต " + OPS_SHEET_NAME);
        }

        window.statistics = parsed;
        setDataSourceBadge(`Excel · ${parsed.length} เดือน`, "excel");
        console.log("โหลดข้อมูลจาก Excel สำเร็จ:", parsed.length, "เดือน");
    }
    catch (error) {
        console.warn("โหลด Excel ไม่สำเร็จ ใช้ข้อมูลสำรองจาก js/data.js แทน");
        console.warn(error);

        if (!Array.isArray(window.statistics) || window.statistics.length === 0) {
            setDataSourceBadge("ไม่พบข้อมูล", "error");
            alert(
                "โหลดข้อมูลไม่ได้\n\n" +
                "1) ตรวจสอบว่ามีไฟล์ data/ops-data.xlsx\n" +
                "2) ต้องเปิดผ่าน Live Server หรือ GitHub Pages\n" +
                "   (เปิดไฟล์ตรง ๆ แบบ file:// จะโดน CORS บล็อก)"
            );
            return;
        }

        setDataSourceBadge(
            `ข้อมูลสำรอง · ${window.statistics.length} เดือน`,
            "fallback"
        );
    }

    if (typeof window.initDashboard === "function") {
        window.initDashboard();
    }
}

async function readOpsWorkbook() {
    if (typeof XLSX === "undefined") {
        throw new Error("ไม่พบไลบรารี XLSX");
    }

    const response = await fetch(OPS_DATA_FILE + "?t=" + Date.now());

    if (!response.ok) {
        throw new Error(`โหลดไฟล์ Excel ไม่สำเร็จ (${response.status})`);
    }

    const workbook = XLSX.read(await response.arrayBuffer(), { type: "array" });
    const worksheet =
        workbook.Sheets[OPS_SHEET_NAME] ||
        workbook.Sheets[workbook.SheetNames[0]];

    if (!worksheet) {
        throw new Error(`ไม่พบชีตชื่อ "${OPS_SHEET_NAME}"`);
    }

    return XLSX.utils.sheet_to_json(worksheet, { defval: "" });
}

/* ---------- แปลง 1 แถว Excel เป็น object ---------- */

function convertExcelRow(row) {
    const normalized = normalizeKeys(row);
    const id = normalizeId(pick(normalized, ["id", "รหัส", "เดือนรหัส"]));

    if (!id) {
        return null;
    }

    const tripsNorth  = num(pick(normalized, ["tripsnorth", "เที่ยวเหนือ"]));
    const tripsWest   = num(pick(normalized, ["tripswest", "เที่ยวตะวันตก"]));
    const tripsTotal  = numOr(
        pick(normalized, ["tripstotal", "เที่ยวรวม"]),
        tripsNorth + tripsWest
    );

    return {
        id: id,
        month: pick(normalized, ["month", "เดือน"]) || buildThaiMonthLabel(id),

        punctuality5: percentGroup(normalized,
            ["p5north", "punctuality5north"],
            ["p5west", "punctuality5west"],
            ["p5total", "punctuality5total"],
            tripsNorth, tripsWest),

        onTime: percentGroup(normalized,
            ["ontimenorth", "tsp10north"],
            ["ontimewest", "tsp10west"],
            ["ontimetotal", "tsp10total"],
            tripsNorth, tripsWest),

        reliability: percentGroup(normalized,
            ["relnorth", "reliabilitynorth", "tsanorth"],
            ["relwest", "reliabilitywest", "tsawest"],
            ["reltotal", "reliabilitytotal", "tsatotal"],
            tripsNorth, tripsWest),

        availability: percentGroup(normalized,
            ["availnorth", "availabilitynorth", "tanorth"],
            ["availwest", "availabilitywest", "tawest"],
            ["availtotal", "availabilitytotal", "tatotal"],
            tripsNorth, tripsWest),

        distance: {
            north: numOr(pick(normalized, ["distnorth", "ระยะทางเหนือ"]),
                Math.round(tripsNorth * NORTH_KM)),
            west: numOr(pick(normalized, ["distwest", "ระยะทางตะวันตก"]),
                Math.round(tripsWest * WEST_KM)),
            total: numOr(pick(normalized, ["disttotal", "ระยะทางรวม"]),
                Math.round(tripsNorth * NORTH_KM) + Math.round(tripsWest * WEST_KM))
        },

        trips: {
            north: tripsNorth,
            west: tripsWest,
            total: tripsTotal
        },

        cancelled: {
            north: num(pick(normalized, ["cancelnorth", "ยกเลิกเหนือ"])),
            west: num(pick(normalized, ["cancelwest", "ยกเลิกตะวันตก"])),
            total: numOr(
                pick(normalized, ["canceltotal", "ยกเลิกรวม"]),
                num(pick(normalized, ["cancelnorth"])) +
                num(pick(normalized, ["cancelwest"]))
            )
        }
    };
}

function percentGroup(row, northKeys, westKeys, totalKeys, tripsNorth, tripsWest) {
    const north = num(pick(row, northKeys));
    const west  = num(pick(row, westKeys));

    const totalRaw = pick(row, totalKeys);
    let total;

    if (totalRaw === "" || totalRaw === null || totalRaw === undefined) {
        const weight = tripsNorth + tripsWest;

        total = weight > 0
            ? (north * tripsNorth + west * tripsWest) / weight
            : (north + west) / 2;
    }
    else {
        total = num(totalRaw);
    }

    return {
        north: round2(north),
        west: round2(west),
        total: round2(total)
    };
}

/* ---------- helper ---------- */

function normalizeKeys(row) {
    const result = {};

    Object.keys(row).forEach(key => {
        const cleanKey = String(key)
            .replace(/[\s_\-().%]/g, "")
            .toLowerCase();

        result[cleanKey] = row[key];
    });

    return result;
}

function pick(row, keys) {
    for (const key of keys) {
        const value = row[key];

        if (value !== undefined && value !== null && value !== "") {
            return value;
        }
    }

    return "";
}

function normalizeId(value) {
    if (value === "" || value === null || value === undefined) {
        return "";
    }

    if (value instanceof Date) {
        return value.getFullYear() + "-" +
            String(value.getMonth() + 1).padStart(2, "0");
    }

    const match = String(value).trim().match(/^(\d{4})[-/](\d{1,2})/);

    return match
        ? `${match[1]}-${String(match[2]).padStart(2, "0")}`
        : "";
}

function buildThaiMonthLabel(id) {
    const [year, month] = id.split("-").map(Number);

    return `${THAI_MONTH_NAMES[month - 1]} ${year + 543}`;
}

function num(value) {
    const parsed = parseFloat(String(value ?? "").replace(/,/g, ""));

    return isNaN(parsed) ? 0 : parsed;
}

function numOr(value, fallback) {
    if (value === "" || value === null || value === undefined) {
        return fallback;
    }

    const parsed = parseFloat(String(value).replace(/,/g, ""));

    return isNaN(parsed) ? fallback : parsed;
}

function round2(value) {
    return Math.round(Number(value) * 100) / 100;
}

function setDataSourceBadge(text, state) {
    const badge = document.getElementById("dataSourceBadge");

    if (!badge) {
        return;
    }

    badge.textContent = text;
    badge.className = "data-source-badge state-" + state;
}
