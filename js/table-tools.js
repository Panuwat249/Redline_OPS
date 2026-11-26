/* =========================================================
   table-tools.js
   ตัวปรับแต่ง "ตารางสรุปรายปีงบประมาณ" (หน้า cost)

   ปรับได้อิสระ:
   • เลือกคอลัมน์ที่แสดง/ซ่อน และเรียงลำดับ (รวมคอลัมน์ผู้โดยสารรายวันที่ซ่อนไว้)
   • จำนวนทศนิยมของแต่ละคอลัมน์ (หรือทั้งตาราง) ปัดตามหลักคณิตศาสตร์
   • หน่วยของตัวเลข: บาท / พันบาท / ล้านบาท (จำนวนคน/Car-Km: เต็ม / พัน / ล้าน)
   • คอลัมน์ "% เพิ่ม/ลด จากปีก่อน" ต่อท้ายคอลัมน์ไหนก็ได้ เปิด-ปิดได้
   • ป้ายสีขอบมนหลังชื่อคอลัมน์ (ตามสีหมวดที่ใช้ในกราฟ หรือเลือกสีเอง)
   • ธีมตาราง เรียบ / แดงตามภาพตัวอย่าง · ความโค้งขอบ · เส้นตาราง · แถบสลับสี · ความสูงแถว
   • แถว "รวม" และ "เฉลี่ยต่อปี" เปิด-ปิดได้ · เปลี่ยนชื่อหัวคอลัมน์ได้

   ค่าที่ตั้งจำในเบราว์เซอร์ (localStorage คีย์ redline-table-prefs-v1)
   ใช้: TableTools.render(selectedRows, previousOfFn)
   ========================================================= */
(function () {
    "use strict";

    var STORE = "redline-table-prefs-v1";
    var prefs = {};
    try { prefs = JSON.parse(localStorage.getItem(STORE) || "{}") || {}; } catch (e) { prefs = {}; }

    /* ---------- ตารางที่บันทึกไว้ (ชุดค่าตั้งหลายชุด) · localStorage redline-table-presets-v1 ---------- */
    var PSTORE = "redline-table-presets-v1";
    var presets = { list: [], active: null };
    try {
        var _p = JSON.parse(localStorage.getItem(PSTORE) || "null");
        if (_p && Array.isArray(_p.list)) presets = { list: _p.list.filter(function (x) { return x && x.id && x.prefs; }), active: _p.active || null };
    } catch (e) { /* ค่าเริ่มต้น */ }
    function savePresets() {
        try { localStorage.setItem(PSTORE, JSON.stringify(presets)); } catch (e) { /* ใช้ต่อได้ แค่ไม่จำ */ }
    }
    function clone(o) { return JSON.parse(JSON.stringify(o || {})); }
    function stable(o) {
        if (o && typeof o === "object") {
            if (Array.isArray(o)) return "[" + o.map(stable).join(",") + "]";
            return "{" + Object.keys(o).sort().map(function (k) { return JSON.stringify(k) + ":" + stable(o[k]); }).join(",") + "}";
        }
        return JSON.stringify(o);
    }
    function presetById(id) { for (var i = 0; i < presets.list.length; i++) if (presets.list[i].id === id) return presets.list[i]; return null; }
    function presetIdx(id) { for (var i = 0; i < presets.list.length; i++) if (presets.list[i].id === id) return i; return -1; }
    function newId() { return "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
    function uniqueName(base) {
        var names = presets.list.map(function (x) { return x.name; }), n = base, i = 2;
        while (names.indexOf(n) >= 0) n = base + " " + (i++);
        return n;
    }
    var delConfirm = null;     // id ที่กำลังรอกดยืนยันลบ

    function save() {
        try { localStorage.setItem(STORE, JSON.stringify(prefs)); } catch (e) { /* ใช้ต่อได้ แค่ไม่จำค่า */ }
        markDirty();
    }

    /* ---------- รายการคอลัมน์ทั้งหมดที่เลือกได้ ---------- */

    function sum(sel, fn) {
        return sel.reduce(function (s, x) { return s + Number(fn(x) || 0); }, 0);
    }
    function mean(sel, fn) {
        var v = sel.map(fn).filter(function (x) { return x != null; });
        return v.length ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : null;
    }

    // รอบคำนวณจุดคุ้มทุนและผู้โดยสารต่อวัน ตามตารางต้นแบบ: 1 ปี = 12 เดือน = 360 วัน
    var DAYS = 360, MONTHS = 12;

    function bep(d) { return d.avgFare > 0 && d.total > 0 ? d.total / d.avgFare : null; }       // คนต่อปี = ต้นทุนรวม ÷ ค่าโดยสารเฉลี่ยต่อคน

    // good: "down" = ลดลงคือดี (ต้นทุน) · "up" = เพิ่มขึ้นคือดี · tag = ข้อความต่อท้ายใต้ชื่อ เช่น (1) (2)
    // group = หัวกลุ่มที่คร่อมหลายคอลัมน์ (ตอนนี้มีกลุ่ม "จุดคุ้มทุน")
    var COLS = [
        { key: "staffCost", label: "บุคลากร", unit: "บาท", kind: "money", dec: 2, good: "down", color: "#c8102e", pill: true,
          get: function (d) { return d.staffCost; }, tot: "sum" },
        { key: "energyCost", label: "พลังงาน", unit: "บาท", kind: "money", dec: 2, good: "down", color: "#eda100", pill: true,
          get: function (d) { return d.energyCost; }, tot: "sum" },
        { key: "maintenanceCost", label: "ซ่อมบำรุง", unit: "บาท", kind: "money", dec: 2, good: "down", color: "#2a78d6", pill: true,
          get: function (d) { return d.maintenanceCost; }, tot: "sum" },
        { key: "indirectCost", label: "อื่น ๆ", unit: "บาท", kind: "money", dec: 2, good: "down", color: "#e87ba4", pill: true,
          get: function (d) { return d.indirectCost; }, tot: "sum" },
        { key: "total", label: "ต้นทุนรวม", unit: "บาท", kind: "money", dec: 2, good: "down", color: "#a1121b", pill: true, strong: true, pct: true,
          get: function (d) { return d.total; }, tot: "sum" },
        { key: "carKm", label: "Car.Km", unit: "", kind: "count", dec: 0, good: "up", color: "#1baf7a",
          get: function (d) { return d.carKm; }, tot: "sum" },
        { key: "passenger", label: "จำนวนผู้โดยสารจริง", unit: "คน/ปี", kind: "count", dec: 0, good: "up", color: "#6250d6",
          get: function (d) { return d.passenger; }, tot: "sum" },
        { key: "paxPerDay", label: "จำนวนผู้โดยสาร", unit: "คน/วัน", kind: "count", dec: 0, good: "up", color: "#7c6ae0", hidden: true,
          get: function (d) { return d.passenger > 0 ? d.passenger / DAYS : null; }, tot: "none" },
        { key: "costPerCarKm", label: "บาท/ตู้/กม.", unit: "", kind: "rate", dec: 2, good: "down", color: "#0e9aa7",
          get: function (d) { return d.costPerCarKm; }, tot: "ratioKm" },
        { key: "tripNorth", label: "North Line (22.45 กม.)", unit: "บาท/เที่ยว", kind: "rate", dec: 2, good: "down", color: "#2a78d6", hidden: true,
          get: function (d) { return d.costPerTripNorth; }, tot: "none" },
        { key: "tripWest", label: "West Line (14.54 กม.)", unit: "บาท/เที่ยว", kind: "rate", dec: 2, good: "down", color: "#1d9a6c", hidden: true,
          get: function (d) { return d.costPerTripWest; }, tot: "none" },
        { key: "costPerPassenger", label: "ต้นทุน/คน", unit: "", tag: "(1)", kind: "rate", dec: 2, good: "down", color: "#374151",
          get: function (d) { return d.costPerPassenger; }, tot: "ratioPax" },
        { key: "avgFare", label: "ค่าโดยสารเฉลี่ยต่อคน", unit: "บาท", tag: "(2)", kind: "rate", dec: 2, good: "up", color: "#c2410c",
          get: function (d) { return d.avgFare; }, tot: "fare" },
        { key: "costGap", label: "ผลต่าง ต้นทุน/คน", unit: "", tag: "(1) - (2)", kind: "rate", dec: 2, good: "down", color: "#a1121b", hidden: true,
          get: function (d) { return d.costPerPassenger != null && d.avgFare != null ? d.costPerPassenger - d.avgFare : null; }, tot: "none" },
        { key: "revenue", label: "รายได้", unit: "บาท", kind: "money", dec: 2, good: "up", color: "#15803d",
          get: function (d) { return d.revenue; }, tot: "sum" },
        { key: "recovery", label: "คืนทุน", unit: "%", kind: "rate", dec: 1, good: "up", color: "#0369a1",
          get: function (d) { return d.recovery * 100; }, tot: "recovery" },

        { key: "bepYear", label: "คนต่อปี", unit: "", kind: "count", dec: 0, good: "down", color: "#d4a017", group: "bep", hidden: true,
          get: function (d) { return bep(d); }, tot: "none" },
        { key: "bepMonth", label: "คนต่อเดือน", unit: "", kind: "count", dec: 0, good: "down", color: "#d4a017", group: "bep", hidden: true,
          get: function (d) { var v = bep(d); return v == null ? null : v / MONTHS; }, tot: "none" },
        { key: "bepDay", label: "คนต่อวัน", unit: "", kind: "count", dec: 0, good: "down", color: "#d4a017", group: "bep", hidden: true,
          get: function (d) { var v = bep(d); return v == null ? null : v / DAYS; }, tot: "none" },

        { key: "paxActualTotal", label: "ผู้โดยสารจริง รวม", unit: "คน/วัน", kind: "pax", dec: 0, good: "up", color: "#6250d6", hidden: true,
          get: function (d) { return d.paxActualTotal; }, tot: "mean" },
        { key: "paxTargetTotal", label: "ผู้โดยสารที่ต้องการ รวม", unit: "คน/วัน", kind: "pax", dec: 0, good: "up", color: "#c8102e", hidden: true,
          get: function (d) { return d.paxTargetTotal; }, tot: "mean" },
        { key: "paxActualNorth", label: "ผู้โดยสารจริง สายเหนือ", unit: "คน/วัน", kind: "pax", dec: 0, good: "up", color: "#2a78d6", hidden: true,
          get: function (d) { return d.paxActualNorth; }, tot: "mean" },
        { key: "paxTargetNorth", label: "ผู้โดยสารที่ต้องการ สายเหนือ", unit: "คน/วัน", kind: "pax", dec: 0, good: "up", color: "#a1121b", hidden: true,
          get: function (d) { return d.paxTargetNorth; }, tot: "mean" },
        { key: "paxActualWest", label: "ผู้โดยสารจริง สายตะวันตก", unit: "คน/วัน", kind: "pax", dec: 0, good: "up", color: "#1d9a6c", hidden: true,
          get: function (d) { return d.paxActualWest; }, tot: "mean" },
        { key: "paxTargetWest", label: "ผู้โดยสารที่ต้องการ สายตะวันตก", unit: "คน/วัน", kind: "pax", dec: 0, good: "up", color: "#e08a00", hidden: true,
          get: function (d) { return d.paxTargetWest; }, tot: "mean" }
    ];

    var GROUP_LABEL = { bep: "จุดคุ้มทุน หรือ Break Even Point" };

    var BY_KEY = {};
    COLS.forEach(function (c) { BY_KEY[c.key] = c; });

    var DEFAULT_ORDER = COLS.map(function (c) { return c.key; });

    /* ---------- อ่านค่าตั้ง (มีค่าเริ่มต้น) ---------- */

    function pv(name, fallback) { return prefs[name] != null ? prefs[name] : fallback; }
    function sub(name) { return prefs[name] || (prefs[name] = {}); }

    function order() {
        var o = (prefs.order || []).filter(function (k) { return BY_KEY[k]; });
        DEFAULT_ORDER.forEach(function (k) { if (o.indexOf(k) === -1) o.push(k); });
        return o;
    }
    function isShown(c) {
        var h = prefs.show && prefs.show[c.key];
        return h != null ? !!h : !c.hidden;
    }
    function scalable(c) { return c.kind === "money" || c.kind === "count"; }

    function scaleOf(c) {
        if (!scalable(c)) return 1;
        var s = prefs.unit && prefs.unit[c.key];
        if (s != null) return s;
        var all = c.kind === "money" ? prefs.unitMoney : prefs.unitCount;
        if (all != null) return all;
        return c.kind === "money" ? 1e6 : 1;                    // ค่าเริ่มต้นเดิม: เงินเป็นล้านบาท
    }
    function decOf(c) {
        var d = prefs.dec && prefs.dec[c.key];
        if (d != null) return d;
        if (prefs.decAll != null) return prefs.decAll;
        if (c.kind === "count" && scaleOf(c) > 1) return 2;
        return c.dec;
    }
    function hasPct(c) {
        var p = prefs.pct && prefs.pct[c.key];
        return p != null ? !!p : !!c.pct;
    }
    function pillOn(c) {
        var p = prefs.pill && prefs.pill[c.key];
        return p != null ? !!p : !!c.pill;
    }
    function pillColor(c) { return (prefs.pillColor && prefs.pillColor[c.key]) || c.color; }
    function labelOf(c) { return (prefs.label && prefs.label[c.key]) || c.label; }
    function groupLabel(g) { return prefs[g + "Label"] || GROUP_LABEL[g]; }

    function unitText(c) {
        var s = scaleOf(c);
        if (c.kind === "money") return s === 1e6 ? "ล้านบาท" : s === 1e3 ? "พันบาท" : "บาท";
        if (c.kind === "count") return (s === 1e6 ? "ล้าน" : s === 1e3 ? "พัน" : "") + c.unit;
        return c.unit;
    }

    /* บรรทัดที่สองใต้ชื่อคอลัมน์ เช่น (ล้านบาท) · (1) · (บาท) (2) */
    function autoSub(c) {
        var u = unitText(c);
        return (u ? "(" + u + ")" : "") + (c.tag ? (u ? " " : "") + c.tag : "");
    }
    /* ผู้ใช้แก้ข้อความบรรทัดที่สองเองได้ (prefs.sub[key]) · ว่าง = อัตโนมัติ */
    function subText(c) {
        return (prefs.sub && prefs.sub[c.key]) || autoSub(c);
    }

    /* ---------- ตัวเลข: ปัดตามหลักคณิตศาสตร์ (.5 ขึ้นไปปัดขึ้น) ---------- */

    function fmt(v, n) {
        v = Number(v);
        if (!isFinite(v)) return "–";
        var f = Math.pow(10, n);
        var r = Math.sign(v) * Math.round((Math.abs(v) + 1e-9) * f) / f;
        return r.toLocaleString("th-TH", { minimumFractionDigits: n, maximumFractionDigits: n });
    }

    function fg(hex) {
        var m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
        if (!m) return "#ffffff";
        var n = parseInt(m[1], 16);
        var l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
        return l > 0.62 ? "#1b1416" : "#ffffff";
    }

    /* ---------- สีธีม + กรอบตาราง ---------- */

    function hexRgb(h) {
        var m = /^#?([0-9a-f]{6})$/i.exec(h || "");
        var n = m ? parseInt(m[1], 16) : 0xc00000;
        return [n >> 16, (n >> 8) & 255, n & 255];
    }
    function mix(a, b, t) {                    // ผสมสี a→b ที่สัดส่วน t
        var x = hexRgb(a), y = hexRgb(b);
        return "#" + x.map(function (v, i) {
            var o = Math.round(v + (y[i] - v) * t);
            return (o < 16 ? "0" : "") + o.toString(16);
        }).join("");
    }
    function rgba(h, a) { var c = hexRgb(h); return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }
    function isDark() { return document.documentElement.getAttribute("data-theme") === "dark"; }

    var PALETTES = [["red", "แดง", "#d4182d"], ["blue", "น้ำเงิน", "#1f6fd1"], ["green", "เขียว", "#14935f"], ["purple", "ม่วง", "#6a4fd1"],
                    ["orange", "ส้ม", "#e8730c"], ["pink", "ชมพู", "#d6336c"], ["teal", "ฟ้าน้ำทะเล", "#0e9aa7"], ["gray", "เทา", "#4b5563"]];

    // คืน null เมื่อใช้สีแดงเดิม · ไม่เช่นนั้นคืนชุดสีที่คำนวณจากสีหลัก
    function palette() {
        var p = prefs.palette;
        if (!p || p === "red") return null;
        var M = "#c00000";
        if (p === "custom") M = prefs.paletteColor || M;
        else PALETTES.forEach(function (x) { if (x[0] === p) M = x[2]; });
        var dk = isDark();
        return {
            M: M, h1: mix(M, "#ffffff", 0.12), h2: mix(M, "#000000", 0.22), solid: mix(M, "#000000", 0.1),
            tint: dk ? mix(M, "#000000", 0.72) : mix(M, "#ffffff", 0.88),
            tint2: dk ? mix(M, "#000000", 0.76) : mix(M, "#ffffff", 0.92),
            tint3: dk ? mix(M, "#000000", 0.66) : mix(M, "#ffffff", 0.8),
            softBg: dk ? mix(M, "#000000", 0.66) : mix(M, "#ffffff", 0.9),
            softInk: dk ? mix(M, "#ffffff", 0.6) : mix(M, "#000000", 0.35)
        };
    }

    /* ไฮไลท์คอลัมน์กลุ่มจุดคุ้มทุน: สีหัว + แถบสลับสีอ่อน/เข้มเหมือนแถวสีเทา · ค่าเริ่มต้นสีทอง */
    var HI_COLORS = [["gold", "ทอง", "#f1c84b"], ["orange", "ส้ม", "#f7a45b"], ["green", "เขียว", "#8fd19e"], ["blue", "ฟ้า", "#8ec5f2"],
                     ["pink", "ชมพู", "#f4a7c0"], ["purple", "ม่วง", "#c3b1f2"], ["gray", "เทา", "#c4c4c4"]];

    /* ไฮไลท์อื่น ๆ: แถบสลับสี (hiZ) · แถวสรุปเฉลี่ย/รวม (hiF) · คอลัมน์เน้น (hiS) — ว่าง = ตามธีม */
    var HL = [["hiZ", "แถบสลับสีรายแถว"], ["hiF", "แถวสรุป (เฉลี่ย / รวม)"], ["hiS", "คอลัมน์เน้น (เช่น ปีงบ)"]];
    function hlBase(k) {
        var key = prefs[k];
        if (!key) return null;
        if (key === "custom") return prefs[k + "Color"] || null;
        var H = null;
        HI_COLORS.forEach(function (x) { if (x[0] === key) H = x[2]; });
        return H;
    }
    function hlTints() {
        var dk = isDark(), o = {}, z = hlBase("hiZ"), f = hlBase("hiF"), c = hlBase("hiS");
        if (z) o.z = dk ? mix(z, "#000000", 0.78) : mix(z, "#ffffff", 0.8);
        if (f) { o.f = dk ? mix(f, "#000000", 0.7) : mix(f, "#ffffff", 0.68); o.f2 = dk ? mix(f, "#000000", 0.6) : mix(f, "#ffffff", 0.5); }
        if (c) o.s = dk ? mix(c, "#000000", 0.76) : mix(c, "#ffffff", 0.82);
        return o;
    }

    function hiColors() {
        var key = prefs.hi || "gold", H = "#f1c84b", dk = isDark();
        if (key === "custom") H = prefs.hiColor || H;
        else HI_COLORS.forEach(function (x) { if (x[0] === key) H = x[2]; });
        var head = dk ? mix(H, "#000000", 0.25) : H;
        return {
            H: H, head: head,
            ink: fg(head) === "#ffffff" ? "#ffffff" : mix(H, "#000000", 0.8),
            b1: dk ? mix(H, "#000000", 0.74) : mix(H, "#ffffff", 0.78),
            b2: dk ? mix(H, "#000000", 0.64) : mix(H, "#ffffff", 0.58),
            bf: dk ? mix(H, "#000000", 0.55) : mix(H, "#ffffff", 0.42)
        };
    }

    // กรอบตาราง: ความหนา / ลาย / สี (ไม่ได้ตั้ง = ค่าตามธีม · ถ้าเลือกสีธีมจะใช้สีหลักของธีม)
    function frameSpec(realColor) {
        var th = pv("theme", "soft"), dk = isDark(), P = palette();
        var w = pv("frameW", th === "red" ? 2 : 1);
        var st = pv("frameStyle", "solid");
        if (st === "double" && w < 3) w = 3;
        var col = prefs.frameColor || (P ? P.M :
            th === "red" ? (dk ? "#e5384f" : "#d4182d") :
            th === "excel" ? (dk ? "#5a4c50" : "#9a9a9a") :
            (realColor ? cssv("--line", "#e4d0d4") : "var(--line)"));
        var custom = prefs.frameW != null || prefs.frameStyle || prefs.frameColor || !!P;
        return { w: w, style: st, color: col, custom: custom };
    }

    function esc(s) {
        return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
        });
    }

    /* ---------- วาดตาราง ---------- */

    var last = null;          // { sel, prevOf }

    function wrap() {
        var h = document.getElementById("tableHead");
        return h ? h.closest(".table-wrap") : null;
    }

    function delta(p, good) {
        if (p == null || !isFinite(p)) return "–";
        var flat = Math.abs(p) < 0.05;
        var up = p > 0;
        var cls = flat ? "flat" : ((good === "down" ? !up : up) ? "good" : "bad");
        if (pv("deltaColor", true) === false) cls = "flat";
        var body = flat ? "<i>–</i>คงที่" : "<i>" + (up ? "▲" : "▼") + "</i>" + fmt(Math.abs(p), pv("pctDec", 1)) + "%";
        return pv("deltaStyle", "chip") === "text"
            ? '<span class="tt-d ' + cls + '">' + body + "</span>"
            : '<span class="delta ' + cls + '">' + body + "</span>";
    }

    function pct(cur, prev) {
        if (cur == null || prev == null || !prev) return null;
        return (cur - prev) / prev * 100;
    }

    function shown() {
        return order().map(function (k) { return BY_KEY[k]; }).filter(isShown);
    }

    function render(sel, prevOf) {
        if (sel) last = { sel: sel, prevOf: prevOf };
        if (!last) return;
        sel = last.sel; prevOf = last.prevOf;

        var w = wrap();
        if (!w) return;

        var cols = shown();
        var theme = pv("theme", "soft");

        w.className = "table-wrap tt-theme-" + theme;
        w.setAttribute("data-lines", pv("lines", "h"));
        w.setAttribute("data-zebra", pv("zebra", false) ? "1" : "0");
        w.setAttribute("data-dens", pv("dens", "normal"));
        w.style.setProperty("--tt-r", pv("radius", 20) + "px");

        var P = palette();
        var vars = { "--tt-h1": P && P.h1, "--tt-h2": P && P.h2, "--tt-solid": P && P.solid, "--tt-tint": P && P.tint,
            "--tt-tint2": P && P.tint2, "--tt-tint3": P && P.tint3, "--tt-softbg": P && P.softBg, "--tt-softink": P && P.softInk,
            "--tt-glow1": P && rgba(P.M, 0.1), "--tt-glow2": P && rgba(P.M, 0.22) };
        Object.keys(vars).forEach(function (k) { if (vars[k]) w.style.setProperty(k, vars[k]); else w.style.removeProperty(k); });
        var HI = hiColors();
        w.style.setProperty("--tt-hi", HI.head);
        w.style.setProperty("--tt-hi-ink", HI.ink);
        w.style.setProperty("--tt-hi1", HI.b1);
        w.style.setProperty("--tt-hi2", HI.b2);
        w.style.setProperty("--tt-hif", HI.bf);
        var HT = hlTints();
        [["z", "zb", "data-hz"], ["f", "ft", "data-hf"], ["s", "sc", "data-hs"]].forEach(function (a) {
            if (HT[a[0]]) { w.style.setProperty("--tt-" + a[1], HT[a[0]]); w.setAttribute(a[2], "1"); }
            else { w.style.removeProperty("--tt-" + a[1]); w.removeAttribute(a[2]); }
        });
        if (HT.f2) w.style.setProperty("--tt-ft2", HT.f2); else w.style.removeProperty("--tt-ft2");
        var fr = frameSpec(false);
        if (fr.custom) {
            w.setAttribute("data-frame", "1");
            w.style.setProperty("--tt-fw", fr.w + "px");
            w.style.setProperty("--tt-fs", fr.style);
            w.style.setProperty("--tt-fc", fr.color);
        } else {
            w.removeAttribute("data-frame");
        }

        var showUnit = pv("showUnit", true);
        var nCols = cols.length + cols.filter(hasPct).length + 1;
        w.firstElementChild.style.setProperty("--tt-min", Math.max(360, nCols * 96) + "px");

        /* หัวตาราง: ถ้ามีคอลัมน์ที่อยู่ในกลุ่ม (จุดคุ้มทุน) จะเป็นหัวสองชั้นแบบในตารางต้นแบบ */
        var anyGroup = cols.some(function (c) { return c.group; });
        var spanAttr = anyGroup ? ' rowspan="2"' : "";
        var yearHead = esc(pv("yearHead", "ปีงบประมาณ"));
        var row1 = '<tr><th class="sticky"' + spanAttr + ">" + yearHead + "</th>";
        var row2 = "";

        function thFor(c, sub2) {
            var name = esc(labelOf(c));
            var inner = pillOn(c)
                ? '<span class="tt-name tt-pill" style="--pill:' + pillColor(c) + ";--pill-fg:" + fg(pillColor(c)) + '">' + name + "</span>"
                : '<span class="tt-name">' + name + "</span>";
            var st = showUnit ? subText(c) : "";
            return '<th class="' + (c.strong ? "strong " : "") + (c.group ? "tt-bep" : "") + '"' + (sub2 ? "" : spanAttr) + '><span class="tt-th">' + inner +
                (st ? '<small class="tt-unit">' + esc(st) + "</small>" : "") + "</span></th>";
        }
        function thPct(c, sub2) {
            return '<th class="tt-pct' + (c.group ? " tt-bep" : "") + '"' + (sub2 ? "" : spanAttr) + '><span class="tt-th"><span class="tt-name">' + esc((prefs.pctLabel && prefs.pctLabel[c.key]) || pv("pctName", "% เพิ่ม/ลด")) + '</span>' +
                (showUnit ? '<small class="tt-unit">' + esc(pv("pctSub", "จากปีก่อน")) + "</small>" : "") + "</span></th>";
        }

        for (var i = 0; i < cols.length; i++) {
            var c = cols[i];
            if (c.group) {
                var run = [];
                var j = i;
                while (j < cols.length && cols[j].group === c.group) { run.push(cols[j]); j++; }
                var span = run.reduce(function (n, x) { return n + 1 + (hasPct(x) ? 1 : 0); }, 0);
                row1 += '<th class="tt-group" colspan="' + span + '">' + esc(groupLabel(c.group)) + "</th>";
                run.forEach(function (x) { row2 += thFor(x, true) + (hasPct(x) ? thPct(x, true) : ""); });
                i = j - 1;
            } else {
                row1 += thFor(c, false) + (hasPct(c) ? thPct(c, false) : "");
            }
        }
        document.getElementById("tableHead").innerHTML = row1 + "</tr>" + (anyGroup ? "<tr>" + row2 + "</tr>" : "");

        var yearFmt = pv("yearFmt", "full");
        function yearCell(y) { return yearFmt === "short" ? String(y) : "ปีงบ " + y; }

        function num(c, v) {
            if (v == null) return "–";
            return fmt(v / scaleOf(c), decOf(c)) + (c.unit === "%" ? "%" : "");
        }
        function tdCls(c) { return ((c.strong ? "strong " : "") + (c.group ? "tt-bep" : "")).trim(); }

        /* เนื้อตาราง */
        document.getElementById("tableBody").innerHTML = sel.map(function (d) {
            var p = prevOf ? prevOf(d) : null;
            var row = '<tr><td class="sticky">' + yearCell(d.fiscalYear) + "</td>";
            cols.forEach(function (c) {
                var v = c.get(d);
                row += '<td class="' + tdCls(c) + '">' + num(c, v) + "</td>";
                if (hasPct(c)) {
                    row += '<td class="tt-pct' + (c.group ? " tt-bep" : "") + '">' + (p ? delta(pct(v, c.get(p)), c.good) : "–") + "</td>";
                }
            });
            return row + "</tr>";
        }).join("");

        /* แถวรวม / เฉลี่ย (เฉลี่ย = ค่าเฉลี่ยของตัวเลขรายปีในคอลัมน์นั้น เหมือนตารางต้นแบบ) */
        var foot = "";
        var n = sel.length;
        if (n >= 2) {
            var S = {
                cost: sum(sel, function (d) { return d.total; }),
                km: sum(sel, function (d) { return d.carKm; }),
                pax: sum(sel, function (d) { return d.passenger; }),
                rev: sum(sel, function (d) { return d.revenue; })
            };

            var total = function (c) {
                switch (c.tot) {
                    case "sum": return sum(sel, c.get);
                    case "ratioKm": return S.km ? S.cost / S.km : null;
                    case "ratioPax": return S.pax ? S.cost / S.pax : null;
                    case "fare": return S.pax ? S.rev / S.pax : null;
                    case "recovery": return S.cost ? S.rev / S.cost * 100 : null;
                    default: return null;
                }
            };
            var avg = function (c) { return mean(sel, c.get); };
            var avgPct = function (c) {
                var v = sel.map(function (d) {
                    var p = prevOf ? prevOf(d) : null;
                    return p ? pct(c.get(d), c.get(p)) : null;
                }).filter(function (x) { return x != null && isFinite(x); });
                return v.length ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : null;
            };

            var cell = function (c, kind) {
                var v = kind === "tot" ? total(c) : avg(c);
                return '<td class="' + tdCls(c) + '">' + (v == null || !isFinite(v) ? "" : num(c, v)) + "</td>";
            };

            if (pv("showTotal", true)) {
                foot += '<tr class="tt-total"><td class="sticky">' + esc(pv("totalLabel", "รวม")) + "</td>";
                cols.forEach(function (c) {
                    foot += cell(c, "tot");
                    if (hasPct(c)) foot += '<td class="tt-pct' + (c.group ? " tt-bep" : "") + '"></td>';
                });
                foot += "</tr>";
            }
            if (pv("showAvg", true)) {
                foot += '<tr class="tt-avg"><td class="sticky"><span class="tt-avg-pill">' + esc(pv("avgLabel", "เฉลี่ยต่อปี")) + "</span></td>";
                cols.forEach(function (c) {
                    foot += cell(c, "avg");
                    if (hasPct(c)) {
                        var ap = avgPct(c);
                        foot += '<td class="tt-pct' + (c.group ? " tt-bep" : "") + '">' + (ap == null || !pv("avgPct", true) ? "" : delta(ap, c.good)) + "</td>";
                    }
                });
                foot += "</tr>";
            }
        }
        document.getElementById("tableFoot").innerHTML = foot;

        var note = document.getElementById("tableNote");
        if (note) note.textContent = "หน่วยอยู่ใต้ชื่อคอลัมน์ · ส่งออก Excel เป็นบาทเต็ม";
    }

    /* ---------- แผงปรับแต่ง ---------- */

    var panelEl = null;
    var openCol = null;       // คอลัมน์ที่กางตัวเลือกอยู่

    function btn() { return document.getElementById("tableToolsBtn"); }

    function markDirty() {
        var b = btn();
        if (b) b.classList.toggle("is-dirty", Object.keys(prefs).length > 0);
    }

    function seg(attr, items, cur, extra, cls) {
        return '<div class="ct-seg ' + (cls || "ct-seg-sm") + '">' + items.map(function (it) {
            return '<button type="button" ' + attr + '="' + it[0] + '"' + (extra || "") +
                ' class="' + (String(it[0]) === String(cur) ? "is-on" : "") + '">' + it[1] + "</button>";
        }).join("") + "</div>";
    }

    function sw(key, label, on) {
        return '<label class="ct-switch"><span>' + label + '</span><input type="checkbox" data-tt-tog="' + key + '"' +
            (on ? " checked" : "") + "><i></i></label>";
    }

    function range(key, label, val, min, max, step, unit) {
        return '<label class="ct-range"><span>' + label + ' <b data-tt-rv="' + key + '">' + val + unit + '</b></span>' +
            '<input type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val +
            '" data-tt-range="' + key + '" data-unit="' + unit + '"></label>';
    }

    function textIn(key, ph) {
        return '<input type="text" class="tt-text tt-text-gap" data-tt-text="' + key + '" value="' + esc(prefs[key] || "") + '" placeholder="' + esc(ph) + '" maxlength="60" aria-label="' + esc(ph) + '">';
    }

    /* ชุดตามตารางต้นแบบ: ปีงบ · Car.Km · บาท/ตู้/กม. · North · West · ผู้โดยสารจริง · ผู้โดยสาร/วัน · รายได้ · ต้นทุน/คน (1) · ค่าโดยสารเฉลี่ย (2) · ผลต่าง · จุดคุ้มทุน 3 ช่อง */
    var SAMPLE_ORDER = ["carKm", "costPerCarKm", "tripNorth", "tripWest", "passenger", "paxPerDay", "revenue", "costPerPassenger", "avgFare", "costGap", "bepYear", "bepMonth", "bepDay"];

    function applySample() {
        var rest = DEFAULT_ORDER.filter(function (k) { return SAMPLE_ORDER.indexOf(k) === -1; });
        prefs = {
            theme: "excel", lines: "grid", zebra: true, dens: "normal", radius: 10, yearFmt: "short",
            yearHead: "ปีงบ", avgLabel: "เฉลี่ย", showTotal: false, showAvg: true, showUnit: true,
            unitMoney: 1, unitCount: 1,
            order: SAMPLE_ORDER.concat(rest),
            show: {}, dec: { carKm: 2, revenue: 0 }, pct: {}, pill: {}
        };
        COLS.forEach(function (c) { prefs.show[c.key] = SAMPLE_ORDER.indexOf(c.key) !== -1; prefs.pct[c.key] = false; prefs.pill[c.key] = false; });
        openCol = null;
    }

    var DEC_ITEMS = [["auto", "ตามเดิม"], ["0", "0"], ["1", "1"], ["2", "2"], ["3", "3"]];
    var SCALE_MONEY = [["1", "บาท"], ["1000", "พันบาท"], ["1000000", "ล้านบาท"]];
    var SCALE_COUNT = [["1", "เต็ม"], ["1000", "พัน"], ["1000000", "ล้าน"]];

    function colBlock(c, idx, vis, list) {
        var shown1 = isShown(c);
        var pos = vis.indexOf(c.key);
        var h = '<div class="tt-col' + (shown1 ? "" : " is-off") + '">';
        h += '<div class="tt-col-top">' +
            '<label class="tt-chk"><input type="checkbox" data-tt-show="' + c.key + '"' + (shown1 ? " checked" : "") + '><span>' + esc(labelOf(c)) + "</span></label>";
        if (shown1) {
            h += '<span class="tt-arrows">' +
                '<button type="button" data-tt-move="up" data-key="' + c.key + '"' + (pos <= 0 ? " disabled" : "") + ' aria-label="เลื่อนไปก่อน">▲</button>' +
                '<button type="button" data-tt-move="down" data-key="' + c.key + '"' + (pos === vis.length - 1 ? " disabled" : "") + ' aria-label="เลื่อนไปหลัง">▼</button></span>' +
                '<button type="button" class="tt-more" data-tt-more="' + c.key + '" aria-expanded="' + (openCol === c.key) + '">ตั้งค่า ' + (openCol === c.key ? "▴" : "▾") + "</button>";
        }
        h += "</div>";

        if (shown1 && openCol === c.key) {
            h += '<div class="tt-col-body">';
            h += '<div class="ct-sublabel">จำนวนทศนิยม</div>' +
                seg("data-tt-dec", DEC_ITEMS, prefs.dec && prefs.dec[c.key] != null ? prefs.dec[c.key] : "auto", ' data-key="' + c.key + '"');
            if (scalable(c)) {
                h += '<div class="ct-sublabel">หน่วย</div>' +
                    seg("data-tt-unit", c.kind === "money" ? SCALE_MONEY : SCALE_COUNT, scaleOf(c), ' data-key="' + c.key + '"');
            }
            h += sw("pct:" + c.key, "แสดง % เพิ่ม/ลด จากปีก่อน", hasPct(c));
            if (hasPct(c)) {
                h += '<div class="ct-sublabel">ชื่อหัวคอลัมน์ % ของคอลัมน์นี้</div>' +
                    '<input type="text" class="tt-text" data-tt-pctlabel="' + c.key + '" value="' + esc((prefs.pctLabel && prefs.pctLabel[c.key]) || "") + '" placeholder="' + esc(pv("pctName", "% เพิ่ม/ลด")) + '" maxlength="40">';
            }
            h += sw("pill:" + c.key, "ป้ายสีหลังชื่อคอลัมน์", pillOn(c));
            if (pillOn(c)) {
                h += '<label class="ct-color"><span class="ct-color-name">สีป้าย</span>' +
                    '<span class="ct-color-pick"><button type="button" class="tt-auto" data-tt-autocolor="' + c.key + '">ตามสีหมวด</button>' +
                    '<code>' + pillColor(c).toUpperCase() + '</code>' +
                    '<input type="color" data-tt-color="' + c.key + '" value="' + pillColor(c) + '" aria-label="สีป้ายของ ' + esc(labelOf(c)) + '"></span></label>';
            }
            h += '<div class="ct-sublabel">ชื่อหัวคอลัมน์</div>' +
                '<input type="text" class="tt-text" data-tt-label="' + c.key + '" value="' + esc((prefs.label && prefs.label[c.key]) || "") + '" placeholder="' + esc(c.label) + '" maxlength="40">';
            h += '<div class="ct-sublabel">ชื่อหน่วยใต้หัวคอลัมน์ (พิมพ์เอง เช่น (ล้านบาท))</div>' +
                '<input type="text" class="tt-text" data-tt-subtext="' + c.key + '" value="' + esc((prefs.sub && prefs.sub[c.key]) || "") + '" placeholder="' + esc(autoSub(c) || "ไม่มีหน่วย") + '" maxlength="40">';
            h += "</div>";
        }
        return h + "</div>";
    }

    function renderPanel() {
        var keep = panelEl ? panelEl.querySelector(".ct-body").scrollTop : 0;
        if (panelEl) panelEl.remove();

        var ord = order();
        var vis = ord.filter(function (k) { return isShown(BY_KEY[k]); });

        panelEl = document.createElement("div");
        panelEl.className = "ct-panel tt-panel";
        panelEl.setAttribute("role", "dialog");
        panelEl.setAttribute("aria-label", "ปรับแต่งตาราง");
        panelEl.addEventListener("click", function (e) { e.stopPropagation(); });

        var h = '<div class="ct-head"><strong>ปรับแต่งตาราง</strong><button type="button" class="ct-close" aria-label="ปิด">✕</button></div><div class="ct-body">';

        /* ตารางที่บันทึกไว้ */
        var cur = stable(prefs);
        h += '<div class="ct-sec"><div class="ct-label">ตารางที่บันทึกไว้ (' + presets.list.length + ')</div>' +
            '<div class="tt-save"><input type="text" class="tt-text" data-tt-savename="1" placeholder="ตั้งชื่อ เช่น ตารางผู้บริหาร" maxlength="40" aria-label="ชื่อตารางที่จะบันทึก">' +
            '<button type="button" class="tt-save-btn" data-tt-psave="1">บันทึกค่าปัจจุบัน</button></div>';
        if (!presets.list.length) h += '<p class="ct-hint">ยังไม่มีตารางที่บันทึก · ปรับตารางให้ถูกใจแล้วตั้งชื่อ กดบันทึก จะกลับมาใช้ได้ทันที</p>';
        presets.list.forEach(function (x, i) {
            var same = stable(x.prefs) === cur, act = presets.active === x.id;
            h += '<div class="tt-pset' + (same ? " is-on" : "") + '">' +
                '<div class="tt-pset-top"><input type="text" class="tt-text tt-pset-name" data-tt-pname="' + x.id + '" value="' + esc(x.name) + '" maxlength="40" aria-label="ชื่อตาราง">' +
                (same ? '<span class="tt-badge">ใช้อยู่</span>' : (act ? '<span class="tt-badge tt-badge-mod">แก้ไขแล้ว</span>' : "")) + '</div>' +
                '<div class="tt-pset-acts">' +
                '<button type="button" class="tt-pbtn tt-pbtn-main" data-tt-puse="' + x.id + '">ใช้ชุดนี้</button>' +
                '<button type="button" class="tt-pbtn" data-tt-pupd="' + x.id + '" title="เขียนทับด้วยค่าปัจจุบัน"' + (same ? " disabled" : "") + '>อัปเดต</button>' +
                '<button type="button" class="tt-pbtn" data-tt-pcopy="' + x.id + '" title="ทำสำเนา">คัดลอก</button>' +
                '<button type="button" class="tt-pbtn" data-tt-pmv="up|' + x.id + '"' + (i === 0 ? " disabled" : "") + ' aria-label="เลื่อนขึ้น">▲</button>' +
                '<button type="button" class="tt-pbtn" data-tt-pmv="down|' + x.id + '"' + (i === presets.list.length - 1 ? " disabled" : "") + ' aria-label="เลื่อนลง">▼</button>' +
                '<button type="button" class="tt-pbtn tt-pbtn-del' + (delConfirm === x.id ? " is-ask" : "") + '" data-tt-pdel="' + x.id + '">' + (delConfirm === x.id ? "ยืนยันลบ" : "ลบ") + '</button>' +
                '</div></div>';
        });
        h += '</div>';

        /* ชุดสำเร็จรูปตามตารางต้นแบบ */
        h += '<div class="ct-sec"><div class="ct-label">ชุดสำเร็จรูป</div>' +
            '<button type="button" class="tt-preset" data-tt-preset="sample">ใช้ชุดตามตารางตัวอย่าง</button>' +
            '<p class="ct-hint">จัดคอลัมน์ ชื่อหัว หน่วย ทศนิยม และสีแดง-ทอง ให้เหมือนตารางต้นแบบ (ปีงบ · Car.Km · North/West Line · จุดคุ้มทุน) ปรับต่อได้ทุกอย่าง</p></div>';

        /* จุดคุ้มทุน */
        var bepKeys = ["bepYear", "bepMonth", "bepDay"];
        var bepOn = bepKeys.filter(function (k) { return isShown(BY_KEY[k]); });
        var bepMode = bepOn.length === 0 ? "off" : bepOn.length === 3 ? "all" : (bepOn.length === 1 && bepOn[0] === "bepDay") ? "day" : "";
        h += '<div class="ct-sec"><div class="ct-label">จุดคุ้มทุน (Break Even Point)</div>' +
            seg("data-tt-bep", [["off", "ปิด"], ["day", "แค่คนต่อวัน"], ["all", "ทั้งหมด"]], bepMode, "", "") +
            '<p class="ct-hint">คนต่อปี = ต้นทุนรวม ÷ ค่าโดยสารเฉลี่ยต่อคน · คนต่อเดือน = ÷ 12 · คนต่อวัน = ÷ 360 (เลือกเปิดทีละคอลัมน์ได้ในรายการด้านล่าง)</p></div>';

        /* ธีม */
        h += '<div class="ct-sec"><div class="ct-label">รูปแบบตาราง</div>' +
            seg("data-tt-theme", [["soft", "เรียบ"], ["red", "แดงขอบมน"], ["excel", "แดง-ทอง"]], pv("theme", "soft"), "") +
            range("radius", "ความโค้งของขอบตาราง", pv("radius", 20), 0, 36, 2, "px") +
            '<div class="ct-sublabel">เส้นตาราง</div>' +
            seg("data-tt-lines", [["h", "แนวนอน"], ["grid", "ทุกช่อง"], ["none", "ไม่มี"]], pv("lines", "h")) +
            '<div class="ct-sublabel">ความสูงแถว</div>' +
            seg("data-tt-dens", [["compact", "แน่น"], ["normal", "ปกติ"], ["roomy", "โปร่ง"]], pv("dens", "normal")) +
            sw("zebra", "แถบสลับสีรายแถว", pv("zebra", false)) +
            sw("showUnit", "แสดงหน่วยใต้ชื่อคอลัมน์", pv("showUnit", true)) +
            '<div class="ct-sublabel">ชื่อปีในคอลัมน์แรก</div>' +
            seg("data-tt-year", [["full", "ปีงบ 2565"], ["short", "2565"]], pv("yearFmt", "full")) +
            sw("showTotal", "แถว “รวม”", pv("showTotal", true)) +
            sw("showAvg", "แถว “เฉลี่ย”", pv("showAvg", true)) +
            sw("avgPct", "แสดง % เพิ่ม/ลด ในแถว “เฉลี่ย” (% รายปียังอยู่)", pv("avgPct", true)) +
            '<div class="ct-sublabel">ชื่อหัวคอลัมน์ปี · ชื่อแถวรวม · ชื่อแถวเฉลี่ย · ชื่อกลุ่มจุดคุ้มทุน</div>' +
            textIn("yearHead", "ปีงบประมาณ") + textIn("totalLabel", "รวม") + textIn("avgLabel", "เฉลี่ยต่อปี") + textIn("bepLabel", GROUP_LABEL.bep) +
            "</div>";

        /* สีธีม + กรอบ */
        var curPal = prefs.palette || "red";
        h += '<div class="ct-sec"><div class="ct-label">สีธีมและกรอบตาราง</div>' +
            '<div class="ct-sublabel">สีธีม (หัวตาราง · แถบ · กรอบ)</div><div class="tt-swatches">' +
            PALETTES.map(function (x) {
                return '<button type="button" class="tt-swatch' + (curPal === x[0] ? " is-on" : "") + '" data-tt-pal="' + x[0] + '" style="--c:' + x[2] + '" title="' + x[1] + '" aria-label="' + x[1] + '"></button>';
            }).join("") +
            '<label class="tt-swatch tt-swatch-custom' + (curPal === "custom" ? " is-on" : "") + '" title="เลือกสีเอง" style="--c:' + (prefs.paletteColor || "#888888") + '">' +
            '<input type="color" data-tt-palcolor="1" value="' + (prefs.paletteColor || "#c00000") + '" aria-label="เลือกสีธีมเอง"></label></div>' +
            '<div class="ct-sublabel">สีไฮไลท์ (กลุ่มจุดคุ้มทุน · แถบสลับสีเหมือนแถวเทา)</div><div class="tt-swatches">' +
            HI_COLORS.map(function (x) {
                return '<button type="button" class="tt-swatch' + ((prefs.hi || "gold") === x[0] ? " is-on" : "") + '" data-tt-hi="' + x[0] + '" style="--c:' + x[2] + '" title="' + x[1] + '" aria-label="ไฮไลท์สี' + x[1] + '"></button>';
            }).join("") +
            '<label class="tt-swatch tt-swatch-custom' + (prefs.hi === "custom" ? " is-on" : "") + '" title="เลือกสีไฮไลท์เอง" style="--c:' + (prefs.hiColor || "#888888") + '">' +
            '<input type="color" data-tt-hicolor="1" value="' + (prefs.hiColor || "#f1c84b") + '" aria-label="เลือกสีไฮไลท์เอง"></label></div>' +
            HL.map(function (a) {
                var k = a[0], cur = prefs[k] || "";
                return '<div class="ct-sublabel">' + a[1] + ' <button type="button" class="tt-auto" data-tt-hlauto="' + k + '">ตามธีม</button></div><div class="tt-swatches">' +
                    HI_COLORS.map(function (x) {
                        return '<button type="button" class="tt-swatch' + (cur === x[0] ? " is-on" : "") + '" data-tt-hl="' + k + '|' + x[0] + '" style="--c:' + x[2] + '" title="' + x[1] + '" aria-label="' + a[1] + ' สี' + x[1] + '"></button>';
                    }).join("") +
                    '<label class="tt-swatch tt-swatch-custom' + (cur === "custom" ? " is-on" : "") + '" title="เลือกสีเอง" style="--c:' + (prefs[k + "Color"] || "#888888") + '">' +
                    '<input type="color" data-tt-hlcolor="' + k + '" value="' + (prefs[k + "Color"] || "#c4c4c4") + '" aria-label="' + a[1] + ' เลือกสีเอง"></label></div>';
            }).join("") +
            range("frameW", "ความหนากรอบ", frameSpec(false).w, 0, 6, 1, "px") +
            '<div class="ct-sublabel">ลายเส้นกรอบ</div>' +
            seg("data-tt-fstyle", [["solid", "เส้นเรียบ"], ["dashed", "ประ"], ["dotted", "จุด"], ["double", "เส้นคู่"]], pv("frameStyle", "solid")) +
            '<label class="ct-color"><span class="ct-color-name">สีกรอบ</span><span class="ct-color-pick">' +
            '<button type="button" class="tt-auto" data-tt-fauto="1">ตามธีม</button>' +
            '<code>' + (prefs.frameColor ? prefs.frameColor.toUpperCase() : "อัตโนมัติ") + '</code>' +
            '<input type="color" data-tt-fcolor="1" value="' + (prefs.frameColor || "#c00000") + '" aria-label="สีกรอบ"></span></label>' +
            "</div>";

        /* ตั้งทั้งตาราง */
        h += '<div class="ct-sec"><div class="ct-label">ตั้งทีเดียวทั้งตาราง</div>' +
            '<div class="ct-sublabel">หน่วยตัวเลขเงิน</div>' +
            seg("data-tt-allunit", SCALE_MONEY, pv("unitMoney", 1e6), ' data-kind="money"') +
            '<div class="ct-sublabel">หน่วยจำนวน (Car-Km / ผู้โดยสาร)</div>' +
            seg("data-tt-allunit", SCALE_COUNT, pv("unitCount", 1), ' data-kind="count"') +
            '<div class="ct-sublabel">จำนวนทศนิยมทุกคอลัมน์</div>' +
            seg("data-tt-alldec", DEC_ITEMS, prefs.decAll != null ? prefs.decAll : "auto") +
            '<div class="ct-sublabel">คอลัมน์ % เพิ่ม/ลด จากปีก่อน</div>' +
            '<div class="ct-seg ct-seg-sm"><button type="button" data-tt-allpct="on">เปิดทุกคอลัมน์</button><button type="button" data-tt-allpct="off">ปิดทั้งหมด</button></div>' +
            '<div class="ct-sublabel">ชื่อหัวคอลัมน์ % (บรรทัดบน · บรรทัดล่าง) — ใช้กับทุกคอลัมน์ %</div>' +
            textIn("pctName", "% เพิ่ม/ลด") + textIn("pctSub", "จากปีก่อน") +
            '<div class="ct-sublabel">ป้ายสีหลังชื่อคอลัมน์</div>' +
            '<div class="ct-seg ct-seg-sm"><button type="button" data-tt-allpill="on">เปิดทุกคอลัมน์</button><button type="button" data-tt-allpill="off">ปิดทั้งหมด</button></div>' +
            '<div class="ct-sublabel">จำนวนทศนิยมของ %</div>' +
            seg("data-tt-pctdec", [["0", "0"], ["1", "1"], ["2", "2"], ["3", "3"]], pv("pctDec", 1)) +
            '<div class="ct-sublabel">รูปแบบ % เพิ่ม/ลด</div>' +
            seg("data-tt-dstyle", [["chip", "ป้ายมน"], ["text", "ตัวอักษร"]], pv("deltaStyle", "chip")) +
            sw("deltaColor", "ใช้สีเขียว/แดง บอกดี-ไม่ดี", pv("deltaColor", true)) +
            "</div>";

        /* คอลัมน์ */
        h += '<div class="ct-sec"><div class="ct-label">ข้อมูลที่แสดง · ลำดับ · ตั้งค่าแต่ละคอลัมน์</div>';
        ord.forEach(function (k, i) { h += colBlock(BY_KEY[k], i, vis, ord); });
        h += '<p class="ct-hint">ติ๊กเพื่อแสดง/ซ่อน · ▲▼ เลื่อนลำดับ · “ตั้งค่า” ปรับทศนิยม หน่วย % ป้ายสี และชื่อของคอลัมน์นั้น</p></div>';

        h += "</div>";
        h += '<div class="ct-foot tt-foot"><button type="button" class="ct-reset" data-tt-reset="1">คืนค่าเริ่มต้น</button>' +
            '<button type="button" class="ct-save" data-tt-png="1">ดาวน์โหลดรูป PNG</button></div>';

        panelEl.innerHTML = h;
        document.body.appendChild(panelEl);
        panelEl.querySelector(".ct-body").scrollTop = keep;
        wirePanel();
        position();
        var b = btn();
        if (b) b.setAttribute("aria-expanded", "true");
    }

    function closePanel() {
        if (panelEl) { panelEl.remove(); panelEl = null; }
        var b = btn();
        if (b) b.setAttribute("aria-expanded", "false");
    }

    function position() {
        if (!panelEl) return;
        var b = btn();
        if (!b) return;
        if (window.innerWidth <= 640) {
            panelEl.classList.add("is-sheet");
            panelEl.style.top = panelEl.style.left = "";
            return;
        }
        panelEl.classList.remove("is-sheet");
        var r = b.getBoundingClientRect();
        var w = panelEl.offsetWidth || 360;
        var h = panelEl.offsetHeight || 500;
        var left = Math.min(Math.max(12, r.right - w), window.innerWidth - w - 12);
        var top = r.bottom + 10;
        if (top + h > window.innerHeight - 12) top = Math.max(12, window.innerHeight - h - 12);
        panelEl.style.left = left + "px";
        panelEl.style.top = top + "px";
    }

    function apply(redrawPanel) {
        // ล้างค่าว่าง เพื่อให้จุด "ปรับแต่งอยู่" ถูกต้องเมื่อกลับเป็นค่าเริ่มต้น
        save();
        render();
        if (redrawPanel) renderPanel();
    }

    function wirePanel() {
        var P = panelEl;
        var on = function (sel, ev, fn) {
            P.querySelectorAll(sel).forEach(function (n) { n.addEventListener(ev, function (e) { fn(n, e); }); });
        };

        P.querySelector(".ct-close").addEventListener("click", closePanel);

        on("[data-tt-theme]", "click", function (n) { prefs.theme = n.getAttribute("data-tt-theme"); apply(true); });
        on("[data-tt-lines]", "click", function (n) { prefs.lines = n.getAttribute("data-tt-lines"); apply(true); });
        on("[data-tt-dens]", "click", function (n) { prefs.dens = n.getAttribute("data-tt-dens"); apply(true); });
        on("[data-tt-year]", "click", function (n) { prefs.yearFmt = n.getAttribute("data-tt-year"); apply(true); });
        on("[data-tt-pctdec]", "click", function (n) { prefs.pctDec = +n.getAttribute("data-tt-pctdec"); apply(true); });
        on("[data-tt-dstyle]", "click", function (n) { prefs.deltaStyle = n.getAttribute("data-tt-dstyle"); apply(true); });

        on("[data-tt-tog]", "change", function (n) {
            var k = n.getAttribute("data-tt-tog"), v = n.checked;
            if (k.indexOf("pct:") === 0) sub("pct")[k.slice(4)] = v;
            else if (k.indexOf("pill:") === 0) sub("pill")[k.slice(5)] = v;
            else prefs[k] = v;
            apply(true);
        });

        on("[data-tt-range]", "input", function (n) {
            var v = +n.value;
            prefs[n.getAttribute("data-tt-range")] = v;
            var t = P.querySelector('[data-tt-rv="' + n.getAttribute("data-tt-range") + '"]');
            if (t) t.textContent = v + (n.getAttribute("data-unit") || "");
            apply(false);                                       // ไม่วาดแผงใหม่ จะได้ลากต่อเนื่อง
        });

        /* ทั้งตาราง */
        on("[data-tt-allunit]", "click", function (n) {
            var kind = n.getAttribute("data-kind"), v = +n.getAttribute("data-tt-allunit");
            prefs[kind === "money" ? "unitMoney" : "unitCount"] = v;
            COLS.forEach(function (c) { if (c.kind === kind && prefs.unit) delete prefs.unit[c.key]; });
            apply(true);
        });
        on("[data-tt-alldec]", "click", function (n) {
            var v = n.getAttribute("data-tt-alldec");
            if (v === "auto") delete prefs.decAll; else prefs.decAll = +v;
            delete prefs.dec;
            apply(true);
        });
        on("[data-tt-allpct]", "click", function (n) {
            var v = n.getAttribute("data-tt-allpct") === "on";
            prefs.pct = {};
            COLS.forEach(function (c) { prefs.pct[c.key] = v; });
            apply(true);
        });
        on("[data-tt-allpill]", "click", function (n) {
            var v = n.getAttribute("data-tt-allpill") === "on";
            prefs.pill = {};
            COLS.forEach(function (c) { prefs.pill[c.key] = v; });
            apply(true);
        });

        /* คอลัมน์ */
        on("[data-tt-show]", "change", function (n) {
            sub("show")[n.getAttribute("data-tt-show")] = n.checked;
            if (!n.checked && openCol === n.getAttribute("data-tt-show")) openCol = null;
            apply(true);
        });
        on("[data-tt-move]", "click", function (n) {
            var key = n.getAttribute("data-key"), dir = n.getAttribute("data-tt-move");
            var o = order();
            var visKeys = o.filter(function (k) { return isShown(BY_KEY[k]); });
            var p = visKeys.indexOf(key);
            var q = dir === "up" ? p - 1 : p + 1;
            if (p < 0 || q < 0 || q >= visKeys.length) return;
            var a = o.indexOf(key), b = o.indexOf(visKeys[q]);
            o[a] = visKeys[q]; o[b] = key;
            prefs.order = o;
            apply(true);
        });
        on("[data-tt-more]", "click", function (n) {
            var k = n.getAttribute("data-tt-more");
            openCol = openCol === k ? null : k;
            renderPanel();
        });
        on("[data-tt-dec]", "click", function (n) {
            var k = n.getAttribute("data-key"), v = n.getAttribute("data-tt-dec");
            if (v === "auto") { if (prefs.dec) delete prefs.dec[k]; } else sub("dec")[k] = +v;
            apply(true);
        });
        on("[data-tt-unit]", "click", function (n) {
            sub("unit")[n.getAttribute("data-key")] = +n.getAttribute("data-tt-unit");
            apply(true);
        });
        on("[data-tt-color]", "input", function (n) {
            var k = n.getAttribute("data-tt-color");
            sub("pillColor")[k] = n.value;
            var code = n.parentElement.querySelector("code");
            if (code) code.textContent = n.value.toUpperCase();
            apply(false);
        });
        on("[data-tt-autocolor]", "click", function (n) {
            if (prefs.pillColor) delete prefs.pillColor[n.getAttribute("data-tt-autocolor")];
            apply(true);
        });
        on("[data-tt-subtext]", "change", function (n) {
            var k = n.getAttribute("data-tt-subtext"), v = n.value.trim();
            if (v) sub("sub")[k] = v; else if (prefs.sub) delete prefs.sub[k];
            apply(false);
        });
        on("[data-tt-pctlabel]", "change", function (n) {
            var k = n.getAttribute("data-tt-pctlabel"), v = n.value.trim();
            if (v) sub("pctLabel")[k] = v; else if (prefs.pctLabel) delete prefs.pctLabel[k];
            apply(false);
        });
        on("[data-tt-label]", "change", function (n) {
            var k = n.getAttribute("data-tt-label"), v = n.value.trim();
            if (v) sub("label")[k] = v; else if (prefs.label) delete prefs.label[k];
            apply(false);
        });

        P.querySelector("[data-tt-png]").addEventListener("click", downloadPng);

        on("[data-tt-hi]", "click", function (n) {
            var v = n.getAttribute("data-tt-hi");
            if (v === "gold") delete prefs.hi; else prefs.hi = v;
            apply(true);
        });
        on("[data-tt-hicolor]", "input", function (n) {
            prefs.hi = "custom"; prefs.hiColor = n.value;
            n.parentElement.style.setProperty("--c", n.value);
            apply(false);
        });
        on("[data-tt-hl]", "click", function (n) {
            var a = n.getAttribute("data-tt-hl").split("|");
            prefs[a[0]] = a[1];
            apply(true);
        });
        on("[data-tt-hlauto]", "click", function (n) {
            var k = n.getAttribute("data-tt-hlauto");
            delete prefs[k]; delete prefs[k + "Color"];
            apply(true);
        });
        on("[data-tt-hlcolor]", "input", function (n) {
            var k = n.getAttribute("data-tt-hlcolor");
            prefs[k] = "custom"; prefs[k + "Color"] = n.value;
            n.parentElement.style.setProperty("--c", n.value);
            apply(false);
        });
        on("[data-tt-pal]", "click", function (n) {
            var v = n.getAttribute("data-tt-pal");
            if (v === "red") delete prefs.palette; else prefs.palette = v;
            apply(true);
        });
        on("[data-tt-palcolor]", "input", function (n) {
            prefs.palette = "custom"; prefs.paletteColor = n.value;
            n.parentElement.style.setProperty("--c", n.value);
            apply(false);
        });
        on("[data-tt-fstyle]", "click", function (n) { var v = n.getAttribute("data-tt-fstyle"); if (v === "solid") delete prefs.frameStyle; else prefs.frameStyle = v; apply(true); });
        on("[data-tt-fcolor]", "input", function (n) {
            prefs.frameColor = n.value;
            var code = n.parentElement.querySelector("code");
            if (code) code.textContent = n.value.toUpperCase();
            apply(false);
        });
        on("[data-tt-fauto]", "click", function () { delete prefs.frameColor; apply(true); });
        on("[data-tt-preset]", "click", function () { applySample(); apply(true); });

        /* ตารางที่บันทึกไว้ */
        var pdone = function () { savePresets(); renderPanel(); };
        var doSave = function () {
            var inp = P.querySelector("[data-tt-savename]");
            var nm = uniqueName((inp && inp.value.trim()) || "ตารางที่ " + (presets.list.length + 1));
            var it = { id: newId(), name: nm, prefs: clone(prefs) };
            presets.list.push(it); presets.active = it.id;
            pdone();
        };
        on("[data-tt-psave]", "click", doSave);
        on("[data-tt-savename]", "keydown", function (n, e) { if (e.key === "Enter") { e.preventDefault(); doSave(); } });
        on("[data-tt-puse]", "click", function (n) {
            var it = presetById(n.getAttribute("data-tt-puse"));
            if (!it) return;
            prefs = clone(it.prefs); openCol = null; presets.active = it.id; delConfirm = null;
            savePresets(); apply(true);
        });
        on("[data-tt-pupd]", "click", function (n) {
            var it = presetById(n.getAttribute("data-tt-pupd"));
            if (!it) return;
            it.prefs = clone(prefs); presets.active = it.id; pdone();
        });
        on("[data-tt-pcopy]", "click", function (n) {
            var i = presetIdx(n.getAttribute("data-tt-pcopy"));
            if (i < 0) return;
            var src = presets.list[i];
            presets.list.splice(i + 1, 0, { id: newId(), name: uniqueName(src.name + " (สำเนา)"), prefs: clone(src.prefs) });
            pdone();
        });
        on("[data-tt-pmv]", "click", function (n) {
            var a = n.getAttribute("data-tt-pmv").split("|"), i = presetIdx(a[1]), j = a[0] === "up" ? i - 1 : i + 1;
            if (i < 0 || j < 0 || j >= presets.list.length) return;
            var t = presets.list[i]; presets.list[i] = presets.list[j]; presets.list[j] = t;
            pdone();
        });
        on("[data-tt-pdel]", "click", function (n) {
            var id = n.getAttribute("data-tt-pdel");
            if (delConfirm !== id) { delConfirm = id; renderPanel(); return; }
            var i = presetIdx(id);
            if (i >= 0) presets.list.splice(i, 1);
            if (presets.active === id) presets.active = null;
            delConfirm = null; pdone();
        });
        on("[data-tt-pname]", "change", function (n) {
            var it = presetById(n.getAttribute("data-tt-pname"));
            if (!it) return;
            var v = n.value.trim();
            if (v) it.name = v; else n.value = it.name;
            savePresets();
        });
        on("[data-tt-bep]", "click", function (n) {
            var m = n.getAttribute("data-tt-bep");
            var showMap = { off: [0, 0, 0], day: [0, 0, 1], all: [1, 1, 1] }[m];
            ["bepYear", "bepMonth", "bepDay"].forEach(function (k, i) { sub("show")[k] = !!showMap[i]; });
            apply(true);
        });
        on("[data-tt-text]", "change", function (n) {
            var k = n.getAttribute("data-tt-text"), v = n.value.trim();
            if (v) prefs[k] = v; else delete prefs[k];
            apply(false);
        });

        P.querySelector("[data-tt-reset]").addEventListener("click", function () {
            prefs = {};
            openCol = null;
            apply(true);
        });
    }


    /* ---------- ดาวน์โหลดตารางเป็นรูป PNG (วาดเองบน canvas ความละเอียดสูง ไม่พึ่งไลบรารีเพิ่ม) ---------- */

    function cssv(n, fb) {
        var v = getComputedStyle(document.documentElement).getPropertyValue(n).trim();
        return v || fb;
    }

    function readDom() {
        var out = [];
        function grab(tr, section) {
            var cells = [].slice.call(tr.children).map(function (c) {
                var o = {
                    th: c.tagName === "TH", sticky: c.classList.contains("sticky"), strong: c.classList.contains("strong"),
                    pct: c.classList.contains("tt-pct"), group: c.classList.contains("tt-group"), bep: c.classList.contains("tt-bep"),
                    cs: c.colSpan || 1, rs: c.rowSpan || 1
                };
                if (o.th) {
                    var nm = c.querySelector(".tt-name"), un = c.querySelector(".tt-unit"), pl = c.querySelector(".tt-pill");
                    o.name = nm ? nm.textContent : c.textContent;
                    o.unit = un ? un.textContent : "";
                    if (pl) { o.pill = pl.style.getPropertyValue("--pill").trim(); o.pillFg = pl.style.getPropertyValue("--pill-fg").trim(); }
                } else {
                    var d = c.querySelector(".delta, .tt-d");
                    o.text = c.textContent;
                    if (d) {
                        o.delta = { cls: d.classList.contains("good") ? "good" : d.classList.contains("bad") ? "bad" : "flat", chip: d.classList.contains("delta"),
                            text: d.textContent.replace(/^([▲▼])/, "$1 ") };
                    }
                    if (c.querySelector(".tt-avg-pill")) o.avgPill = true;
                }
                return o;
            });
            out.push({ section: section, cells: cells });
        }
        [].forEach.call(document.querySelectorAll("#tableHead tr"), function (tr) { grab(tr, "head"); });
        [].forEach.call(document.querySelectorAll("#tableBody tr"), function (tr) { grab(tr, "body"); });
        [].forEach.call(document.querySelectorAll("#tableFoot tr"), function (tr) { grab(tr, "foot"); });
        return out;
    }

    function rr(ctx, x, y, w, h, r) {
        r = Math.max(0, Math.min(r, w / 2, h / 2));
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    function downloadPng() {
        var rows = readDom();
        var headRows = rows.filter(function (r) { return r.section === "head"; });
        var dataRows = rows.filter(function (r) { return r.section !== "head"; });
        if (!headRows.length || !dataRows.length) return;

        var go = function () {
            var theme = pv("theme", "soft");
            var red = theme === "red", xl = theme === "excel";
            var dark = document.documentElement.getAttribute("data-theme") === "dark";
            var C = {
                card: cssv("--card", "#ffffff"), ink: cssv("--ink", "#1b1416"), line: cssv("--line", "#e4d0d4"),
                thBg: cssv("--th-bg", "#fdf3f3"), accent: cssv("--accent-text", "#a1121b"), strong: cssv("--td-strong", "#fffafa"),
                foot: cssv("--foot-bg", "#fcf0f1"), hover: cssv("--td-hover", "#fff7f7"), mute: cssv("--mute", "#76686c"),
                good: cssv("--good", "#0b6b49"), goodBg: cssv("--good-bg", "#e4f4ec"), bad: cssv("--bad", "#a1121b"), badBg: cssv("--bad-bg", "#fdeaec"),
                flat: cssv("--flat-fg", "#6f6064"), flatBg: cssv("--flat-bg", "#f3eeef"),
                gold: "#f1c84b", goldInk: "#3b2a00", bepBg: "#fff3c7", bepBg2: "#fbe6a0", bepFoot: "#f6d777"
            };
            var HI = hiColors();
            C.gold = HI.head; C.goldInk = HI.ink; C.bepBg = HI.b1; C.bepBg2 = HI.b2; C.bepFoot = HI.bf;
            var PL = palette();
            var H1 = PL ? PL.h1 : "#ea1a31", H2 = PL ? PL.h2 : "#b50f22";
            if (PL && !red && !xl) { C.thBg = PL.softBg; C.accent = PL.softInk; }
            if (red) {
                C.strong = PL ? PL.tint : (dark ? "#3a1d24" : "#fde6e9");
                C.foot = PL ? PL.tint2 : (dark ? "#321b21" : "#fdebed");
                C.footStrong = PL ? PL.tint3 : (dark ? "#44202a" : "#fbd9de");
            }
            if (xl) {
                C.strong = null;
                C.foot = dark ? "#34282c" : "#e8e8e8";
                C.hover = dark ? "#2d2226" : "#e8e8e8";
                C.line = dark ? "#4a3a3f" : "#c9c9c9";
            }
            var HT = hlTints();
            if (HT.z) C.hover = HT.z;
            if (HT.f) { C.foot = HT.f; C.footStrong = HT.f2; }
            if (HT.s) C.strong = HT.s;
            var FONT = '"Sarabun", "Noto Sans Thai", sans-serif';
            var dens = pv("dens", "normal");
            var rowH = dens === "compact" ? 38 : dens === "roomy" ? 62 : 48;
            var lines = xl ? "grid" : pv("lines", "h");
            var zebra = pv("zebra", false);
            var R = pv("radius", 20);
            var center = function (c, ci) { return ci === 0 ? (red || xl) : (red || c.pct); };
            var alignOf = function (c, ci) { return center(c, ci) ? "center" : (ci === 0 ? "left" : "right"); };

            var cv = document.createElement("canvas");
            var ctx = cv.getContext("2d");
            var f = function (w, sz) { return w + " " + sz + "px " + FONT; };
            var tw = function (t, font) { ctx.font = font; return ctx.measureText(t).width; };

            /* จัดตำแหน่งเซลล์หัวตาราง (รองรับ rowspan / colspan) */
            var nCols = dataRows[0].cells.length;
            var occ = headRows.map(function () { return []; });
            var hcells = [];
            headRows.forEach(function (r, ri) {
                var col = 0;
                r.cells.forEach(function (c) {
                    while (occ[ri][col]) col++;
                    for (var rr_ = 0; rr_ < c.rs; rr_++) for (var cc_ = 0; cc_ < c.cs; cc_++) if (occ[ri + rr_]) occ[ri + rr_][col + cc_] = true;
                    hcells.push({ c: c, c0: col, r0: ri });
                    col += c.cs;
                });
            });
            var hasUnit = hcells.some(function (h) { return h.c.unit; });
            var two = headRows.length > 1;
            var subUnit = hcells.some(function (h) { return h.r0 === 1 && h.c.unit; });   // หัวย่อยของกลุ่มมีบรรทัดหน่วย → เพิ่มความสูง ไม่ให้ถูกตัด
            var headHs = two ? [38, subUnit ? 62 : 36] : [hasUnit ? 70 : 54];
            var headH = headHs.reduce(function (a, b) { return a + b; }, 0);
            var padX = 18;

            /* ความกว้างคอลัมน์ = ข้อความที่ยาวที่สุด + ช่องไฟ */
            var colW = [];
            for (var ci = 0; ci < nCols; ci++) {
                var m = 84;
                hcells.forEach(function (h) {
                    if (h.c0 !== ci || h.c.cs !== 1) return;
                    var c = h.c;
                    var w = Math.max(tw(c.name, f(800, 15)) + (c.pill ? 30 : 0), c.unit ? tw(c.unit, f(600, 12)) : 0);
                    m = Math.max(m, w + padX * 2);
                });
                dataRows.forEach(function (r) {
                    var c = r.cells[ci];
                    if (!c) return;
                    var w;
                    if (c.delta) w = tw(c.delta.text, f(800, 15)) + (c.delta.chip ? 26 : 0);
                    else if (c.avgPill) w = tw(c.text, f(800, 16)) + 40;
                    else w = tw(c.text, f(ci === 0 ? 800 : 700, red && ci === 0 ? 17 : 15));
                    m = Math.max(m, w + padX * 2);
                });
                colW.push(Math.ceil(m));
            }
            /* หัวกลุ่มที่คร่อมหลายคอลัมน์ ต้องกว้างพอสำหรับข้อความ */
            hcells.forEach(function (h) {
                if (h.c.cs <= 1) return;
                var need = tw(h.c.name || "", f(800, 15)) + 40, have = 0, k;
                for (k = h.c0; k < h.c0 + h.c.cs; k++) have += colW[k];
                if (need > have) for (k = h.c0; k < h.c0 + h.c.cs; k++) colW[k] += Math.ceil((need - have) / h.c.cs);
            });
            var colX = [0];
            colW.forEach(function (w, i) { colX.push(colX[i] + w); });
            var tableW = colX[nCols];
            var tableH = headH + dataRows.length * rowH;

            var title = "ตารางสรุปรายปีงบประมาณ";
            var yrs = rows.filter(function (r) { return r.section === "body"; }).map(function (r) { return r.cells[0].text.replace(/\D/g, ""); });
            var subT = (yrs.length ? "ปีงบประมาณ " + yrs[0] + (yrs.length > 1 ? "–" + yrs[yrs.length - 1] : "") + " · " : "") + "Red Line Operating Cost Dashboard";
            var pad = 30, titleH = 72;
            var W = tableW + pad * 2, H = titleH + tableH + pad * 2 - 6;

            var scale = Math.max(1, Math.min(4, 16000 / W));      // คมที่สุดเท่าที่ canvas ของเบราว์เซอร์รองรับ (สูงสุด 4 เท่า)
            cv.width = Math.round(W * scale);
            cv.height = Math.round(H * scale);
            ctx.scale(scale, scale);
            ctx.textBaseline = "middle";

            ctx.fillStyle = C.card;
            ctx.fillRect(0, 0, W, H);

            ctx.font = f(800, 24); ctx.fillStyle = C.ink; ctx.textAlign = "left";
            ctx.fillText(title, pad, pad + 14);
            ctx.font = f(500, 14); ctx.fillStyle = C.mute;
            ctx.fillText(subT, pad, pad + 42);

            var X0 = pad, Y0 = pad + titleH - 6;

            ctx.save();
            rr(ctx, X0, Y0, tableW, tableH, R);
            ctx.clip();
            ctx.fillStyle = C.card;
            ctx.fillRect(X0, Y0, tableW, tableH);

            var headFill = function (y, h) {
                if (red) {
                    var g = ctx.createLinearGradient(0, y, 0, y + h);
                    g.addColorStop(0, H1); g.addColorStop(1, H2);
                    return g;
                }
                return xl ? (PL ? PL.solid : "#c00000") : C.thBg;
            };
            var headInk = (red || xl) ? "#ffffff" : C.accent;

            /* ---- หัวตาราง ---- */
            hcells.forEach(function (h) {
                var c = h.c;
                var x = X0 + colX[h.c0], w = colX[h.c0 + c.cs] - colX[h.c0];
                var y = Y0, k;
                for (k = 0; k < h.r0; k++) y += headHs[k];
                var hh = 0;
                for (k = h.r0; k < h.r0 + c.rs; k++) hh += headHs[k];

                var gold = c.group || c.bep;
                ctx.fillStyle = gold ? C.gold : headFill(y, hh);
                ctx.fillRect(x, y, w, hh);

                var ink = gold ? C.goldInk : headInk;
                var cx = x + w / 2;
                ctx.textAlign = "center";
                var ty = c.unit ? y + hh / 2 - 11 : y + hh / 2;
                if (c.pill) {
                    var pw = tw(c.name, f(800, 15)) + 28;
                    var px = cx - pw / 2;
                    if (red) { rr(ctx, px - 2, ty - 15, pw + 4, 30, 15); ctx.fillStyle = "rgba(255,255,255,0.92)"; ctx.fill(); }
                    rr(ctx, px, ty - 13, pw, 26, 13); ctx.fillStyle = c.pill; ctx.fill();
                    ctx.font = f(800, 15); ctx.fillStyle = c.pillFg || "#fff";
                    ctx.fillText(c.name, cx, ty + 1);
                } else {
                    ctx.font = f(800, 15); ctx.fillStyle = ink;
                    ctx.fillText(c.name, cx, ty + 1);
                }
                if (c.unit) {
                    ctx.font = f(600, 12); ctx.fillStyle = ink; ctx.globalAlpha = 0.85;
                    ctx.fillText(c.unit, cx, y + hh / 2 + 17);
                    ctx.globalAlpha = 1;
                }
                /* เส้นคั่นในหัวตาราง */
                if (xl || lines === "grid" || gold) {
                    ctx.strokeStyle = gold ? "rgba(59,42,0,0.25)" : "rgba(255,255,255,0.4)";
                    ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.moveTo(x + w - 0.5, y); ctx.lineTo(x + w - 0.5, y + hh); ctx.stroke();
                    if (gold && h.r0 === 0 && c.group) { ctx.beginPath(); ctx.moveTo(x, y + hh - 0.5); ctx.lineTo(x + w, y + hh - 0.5); ctx.stroke(); }
                }
            });

            /* ---- เนื้อตาราง / แถวสรุป ---- */
            var y = Y0 + headH;
            dataRows.forEach(function (r, ri) {
                var bodyIdx = r.section === "body" ? ri : -1;
                r.cells.forEach(function (c, ci) {
                    var x = X0 + colX[ci], w = colW[ci];
                    var bg = null;
                    if (r.section === "foot") bg = c.bep ? C.bepFoot : (c.strong && C.footStrong ? C.footStrong : C.foot);
                    else if (c.bep) bg = (zebra && bodyIdx % 2 === 1) ? C.bepBg2 : C.bepBg;
                    else if (c.strong && C.strong) bg = C.strong;
                    else if (zebra && bodyIdx % 2 === 1) bg = C.hover;
                    if (bg) { ctx.fillStyle = bg; ctx.fillRect(x, y, w, rowH); }

                    var al = alignOf(c, ci);
                    var cx = al === "center" ? x + w / 2 : al === "left" ? x + padX : x + w - padX;
                    ctx.textAlign = al;
                    var cy = y + rowH / 2 + 1;

                    if (c.delta) {
                        var col = c.delta.cls === "good" ? C.good : c.delta.cls === "bad" ? C.bad : C.flat;
                        ctx.textAlign = "center";
                        if (c.delta.chip) {
                            var dw = tw(c.delta.text, f(800, 14)) + 22;
                            rr(ctx, x + w / 2 - dw / 2, y + rowH / 2 - 13, dw, 26, 13);
                            ctx.fillStyle = c.delta.cls === "good" ? C.goodBg : c.delta.cls === "bad" ? C.badBg : C.flatBg; ctx.fill();
                            ctx.font = f(800, 14);
                        } else ctx.font = f(800, 15);
                        ctx.fillStyle = col;
                        ctx.fillText(c.delta.text, x + w / 2, cy);
                    } else if (c.avgPill && red) {
                        var aw = tw(c.text, f(800, 16)) + 36;
                        var g2 = ctx.createLinearGradient(0, y, 0, y + rowH);
                        g2.addColorStop(0, H1); g2.addColorStop(1, H2);
                        rr(ctx, x + w / 2 - aw / 2, y + rowH / 2 - 17, aw, 34, 17); ctx.fillStyle = g2; ctx.fill();
                        ctx.font = f(800, 16); ctx.fillStyle = "#fff"; ctx.textAlign = "center";
                        ctx.fillText(c.text, x + w / 2, cy);
                    } else {
                        var first = ci === 0;
                        ctx.font = f(first || (c.strong && !xl) || (r.section === "foot" && !xl) ? 800 : 700, red && first ? 17 : 15);
                        ctx.fillStyle = (red && r.section === "foot" && first) ? C.bad : C.ink;
                        ctx.fillText(c.text, cx, cy);
                    }

                    /* เส้นตาราง */
                    ctx.strokeStyle = C.line; ctx.lineWidth = 1;
                    if (lines !== "none" && ri < dataRows.length - 1) {
                        ctx.beginPath(); ctx.moveTo(x, Math.round(y + rowH) - 0.5); ctx.lineTo(x + w, Math.round(y + rowH) - 0.5); ctx.stroke();
                    }
                    if ((lines === "grid" && ci < nCols - 1) || (ci === 0 && lines !== "none")) {
                        ctx.beginPath(); ctx.moveTo(x + w - 0.5, y); ctx.lineTo(x + w - 0.5, y + rowH); ctx.stroke();
                    }
                });
                y += rowH;
            });
            ctx.restore();

            var FR = frameSpec(true);
            if (FR.w > 0) {
                ctx.strokeStyle = FR.color;
                var drawFrame = function (inset, lw, dash) {
                    ctx.setLineDash(dash || []);
                    ctx.lineWidth = lw;
                    rr(ctx, X0 + inset, Y0 + inset, tableW - inset * 2, tableH - inset * 2, Math.max(0, R - inset));
                    ctx.stroke();
                };
                if (FR.style === "double") {
                    var t3 = FR.w / 3;
                    drawFrame(t3 / 2, t3);
                    drawFrame(FR.w - t3 / 2, t3);
                } else {
                    drawFrame(FR.w / 2, FR.w, FR.style === "dashed" ? [FR.w * 3 + 4, FR.w * 2 + 3] : FR.style === "dotted" ? [FR.w, FR.w * 2] : null);
                }
                ctx.setLineDash([]);
            }

            cv.toBlob(function (blob) {
                if (!blob) return;
                var url = URL.createObjectURL(blob);
                var a = document.createElement("a");
                a.download = "ตารางสรุปรายปีงบประมาณ.png";
                a.href = url;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
            }, "image/png");
        };

        if (document.fonts && document.fonts.ready) document.fonts.ready.then(go); else go();
    }

    /* ---------- ติดตั้ง ---------- */

    function init() {
        var b = btn();
        if (!b || b.__tt) return;
        b.__tt = true;
        var pb = document.getElementById("tablePngBtn");
        if (pb) pb.addEventListener("click", downloadPng);
        b.addEventListener("click", function () {
            if (panelEl) { closePanel(); return; }
            renderPanel();
            if (window.innerWidth <= 640) {
                var w = wrap();
                if (w) window.scrollBy({ top: w.getBoundingClientRect().top - 90, behavior: "smooth" });
            }
        });
        markDirty();
    }

    document.addEventListener("click", function (e) {
        if (!panelEl) return;
        if (panelEl.contains(e.target)) return;
        var b = btn();
        if (b && b.contains(e.target)) return;
        closePanel();
    });
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && panelEl) closePanel();
    });
    try {
        new MutationObserver(function () { if (last) render(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    } catch (e) { /* เบราว์เซอร์เก่า: สลับโหมดแล้วสีธีมจะอัปเดตเมื่อปรับแต่งครั้งถัดไป */ }
    window.addEventListener("resize", position);
    window.addEventListener("scroll", function () {
        if (panelEl) window.requestAnimationFrame(position);
    }, { passive: true });

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();

    window.TableTools = { render: function (sel, prevOf) { init(); render(sel, prevOf); }, fmt: fmt };
})();
