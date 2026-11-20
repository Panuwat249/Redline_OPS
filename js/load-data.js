/* =========================================================
   load-data.js
   โหลดข้อมูลสถิติการเดินรถจาก data/ops-data.xlsx
   ถ้าโหลดไม่ได้ จะ fallback ไปใช้ window.statistics จาก js/data.js

   รองรับหัวคอลัมน์ทั้งชุดใหม่และชุดเก่า:
     TSP5_N   / TSP5_W   / TSP5_Total     (เดิม: P5North / P5West / P5Total)
     TSP10_N  / TSP10_W  / TSP10_Total    (เดิม: OnTimeNorth / OnTimeWest / OnTimeTotal)
     TSA_N    / TSA_W    / TSA_Total      (เดิม: RelNorth / RelWest / RelTotal)
     TA_N     / TA_W     / TA_Total       (เดิม: AvailNorth / AvailWest / AvailTotal)
     Trips_N  / Trips_W  / Trips_Total    (เดิม: TripsNorth / ...)
     Dist_N   / Dist_W   / Dist_Total     (เดิม: DistNorth / ...)
     Cancel_N / Cancel_W / Cancel_Total   (เดิม: CancelNorth / ...)

   หมายเหตุ: normalizeKeys() จะลบ  เว้นวรรค _ - ( ) . %  และแปลงเป็นตัวพิมพ์เล็ก
             ดังนั้น "TSP5_N", "tsp5 n", "TSP5-N" ล้วนกลายเป็น "tsp5n" เหมือนกันหมด
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

/* ---------------------------------------------------------
   ศูนย์รวม "ชื่อเล่น" ของทุกคอลัมน์
   อยากเพิ่มชื่อใหม่ในอนาคต → แก้แค่ตรงนี้ที่เดียว
   (ทุกตัวต้องเป็นตัวพิมพ์เล็ก ไม่มีเว้นวรรค ไม่มีขีดล่าง)
--------------------------------------------------------- */
const COL = {
    id:    ["id", "รหัส", "เดือนรหัส"],
    month: ["month", "เดือน"],

    tsp5North:  ["tsp5n", "tsp5north", "tsp5min n", "tsp5minn", "p5north", "punctuality5north"],
    tsp5West:   ["tsp5w", "tsp5west", "tsp5minw", "p5west", "punctuality5west"],
    tsp5Total:  ["tsp5total", "tsp5mintotal", "p5total", "punctuality5total"],

    tsp10North: ["tsp10n", "tsp10north", "tsp10minn", "ontimenorth"],
    tsp10West:  ["tsp10w", "tsp10west", "tsp10minw", "ontimewest"],
    tsp10Total: ["tsp10total", "tsp10mintotal", "ontimetotal"],

    tsaNorth:   ["tsan", "tsanorth", "relnorth", "reliabilitynorth"],
    tsaWest:    ["tsaw", "tsawest", "relwest", "reliabilitywest"],
    tsaTotal:   ["tsatotal", "reltotal", "reliabilitytotal"],

    taNorth:    ["tan", "tanorth", "availnorth", "availabilitynorth"],
    taWest:     ["taw", "tawest", "availwest", "availabilitywest"],
    taTotal:    ["tatotal", "availtotal", "availabilitytotal"],

    tripsNorth: ["tripsn", "tripsnorth", "เที่ยวเหนือ"],
    tripsWest:  ["tripsw", "tripswest", "เที่ยวตะวันตก"],
    tripsTotal: ["tripstotal", "เที่ยวรวม"],

    distNorth:  ["distn", "distnorth", "ระยะทางเหนือ"],
    distWest:   ["distw", "distwest", "ระยะทางตะวันตก"],
    distTotal:  ["disttotal", "ระยะทางรวม"],

    cancelNorth: ["canceln", "cancelnorth", "ยกเลิกเหนือ"],
    cancelWest:  ["cancelw", "cancelwest", "ยกเลิกตะวันตก"],
    cancelTotal: ["canceltotal", "ยกเลิกรวม"]
};

/* คอลัมน์ที่ "ต้องมี" — ใช้เตือนใน Console ถ้าพิมพ์หัวผิด */
const REQUIRED_COLUMNS = [
    ["Id",          COL.id],
    ["Month",       COL.month],
    ["TSP5_N",      COL.tsp5North],
    ["TSP5_W",      COL.tsp5West],
    ["TSP10_N",     COL.tsp10North],
    ["TSP10_W",     COL.tsp10West],
    ["TSA_N",       COL.tsaNorth],
    ["TSA_W",       COL.tsaWest],
    ["TA_N",        COL.taNorth],
    ["TA_W",        COL.taWest],
    ["Trips_N",     COL.tripsNorth],
    ["Trips_W",     COL.tripsWest]
];

document.addEventListener("DOMContentLoaded", bootstrapDashboard);

async function bootstrapDashboard() {
    setDataSourceBadge("กำลังโหลดข้อมูล...", "loading");

    try {
        const rows = await readOpsWorkbook();

        warnMissingColumns(rows);

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

/* ---------- ตรวจหัวคอลัมน์ แจ้งเตือนถ้าพิมพ์ผิด ---------- */

function warnMissingColumns(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
        return;
    }

    const normalized = normalizeKeys(rows[0]);

    const missing = REQUIRED_COLUMNS
        .filter(([, aliases]) => !aliases.some(key => normalized[key] !== undefined))
        .map(([label]) => label);

    if (missing.length > 0) {
        console.warn("⚠️ ไม่พบคอลัมน์เหล่านี้ใน Excel:", missing.join(", "));
        console.warn("ℹ️ หัวคอลัมน์ที่อ่านได้จริง:", Object.keys(rows[0]));
        console.warn("ℹ️ หลังผ่านตัวแปลงชื่อแล้วเป็น:", Object.keys(normalized));
    }
    else {
        console.log("✅ หัวคอลัมน์ครบทุกตัว");
    }
}

/* ---------- แปลง 1 แถว Excel เป็น object ---------- */

function convertExcelRow(row) {
    const normalized = normalizeKeys(row);
    const id = normalizeId(pick(normalized, COL.id));

    if (!id) {
        return null;
    }

    const tripsNorth = num(pick(normalized, COL.tripsNorth));
    const tripsWest  = num(pick(normalized, COL.tripsWest));
    const tripsTotal = numOr(
        pick(normalized, COL.tripsTotal),
        tripsNorth + tripsWest
    );

    const cancelNorth = num(pick(normalized, COL.cancelNorth));
    const cancelWest  = num(pick(normalized, COL.cancelWest));

    return {
        id: id,
        month: pick(normalized, COL.month) || buildThaiMonthLabel(id),

        // TSP 5 min — ตรงเวลาภายใน 5 นาที
        punctuality5: percentGroup(normalized,
            COL.tsp5North, COL.tsp5West, COL.tsp5Total,
            tripsNorth, tripsWest),

        // TSP 10 min — ตรงเวลาภายใน 10 นาที
        onTime: percentGroup(normalized,
            COL.tsp10North, COL.tsp10West, COL.tsp10Total,
            tripsNorth, tripsWest),

        // TSA — Train Service Availability
        reliability: percentGroup(normalized,
            COL.tsaNorth, COL.tsaWest, COL.tsaTotal,
            tripsNorth, tripsWest),

        // TA — Train Availability
        availability: percentGroup(normalized,
            COL.taNorth, COL.taWest, COL.taTotal,
            tripsNorth, tripsWest),

        distance: {
            north: numOr(pick(normalized, COL.distNorth),
                Math.round(tripsNorth * NORTH_KM)),
            west: numOr(pick(normalized, COL.distWest),
                Math.round(tripsWest * WEST_KM)),
            total: numOr(pick(normalized, COL.distTotal),
                Math.round(tripsNorth * NORTH_KM) + Math.round(tripsWest * WEST_KM))
        },

        trips: {
            north: tripsNorth,
            west: tripsWest,
            total: tripsTotal
        },

        cancelled: {
            north: cancelNorth,
            west: cancelWest,
            total: numOr(
                pick(normalized, COL.cancelTotal),
                cancelNorth + cancelWest
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
