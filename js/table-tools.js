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

    // good: "down" = ลดลงคือดี (ต้นทุน) · "up" = เพิ่มขึ้นคือดี
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
        { key: "carKm", label: "Car-Km", unit: "ตู้-กม.", kind: "count", dec: 0, good: "up", color: "#1baf7a",
          get: function (d) { return d.carKm; }, tot: "sum" },
        { key: "passenger", label: "ผู้โดยสาร", unit: "คน", kind: "count", dec: 0, good: "up", color: "#6250d6",
          get: function (d) { return d.passenger; }, tot: "sum" },
        { key: "costPerCarKm", label: "ต้นทุน / Car-Km", unit: "บาท", kind: "rate", dec: 2, good: "down", color: "#0e9aa7",
          get: function (d) { return d.costPerCarKm; }, tot: "ratioKm" },
        { key: "costPerPassenger", label: "ต้นทุน / ผู้โดยสาร", unit: "บาท", kind: "rate", dec: 2, good: "down", color: "#374151",
          get: function (d) { return d.costPerPassenger; }, tot: "ratioPax" },
        { key: "avgFare", label: "ค่าโดยสารเฉลี่ย", unit: "บาท/เที่ยว", kind: "rate", dec: 2, good: "up", color: "#c2410c",
          get: function (d) { return d.avgFare; }, tot: "fare" },
        { key: "revenue", label: "รายได้ประมาณการ", unit: "บาท", kind: "money", dec: 2, good: "up", color: "#15803d",
          get: function (d) { return d.revenue; }, tot: "sum" },
        { key: "recovery", label: "คืนทุน", unit: "%", kind: "rate", dec: 1, good: "up", color: "#0369a1",
          get: function (d) { return d.recovery * 100; }, tot: "recovery" },

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

    function unitText(c) {
        var s = scaleOf(c);
        if (c.kind === "money") return s === 1e6 ? "ล้านบาท" : s === 1e3 ? "พันบาท" : "บาท";
        if (c.kind === "count") return (s === 1e6 ? "ล้าน" : s === 1e3 ? "พัน" : "") + c.unit;
        return c.unit;
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

        var showUnit = pv("showUnit", true);
        var nCols = cols.length + cols.filter(hasPct).length + 1;
        w.firstElementChild.style.setProperty("--tt-min", Math.max(360, nCols * 96) + "px");

        /* หัวตาราง */
        var head = '<tr><th class="sticky">ปีงบประมาณ</th>';
        cols.forEach(function (c) {
            var name = esc(labelOf(c));
            var inner = pillOn(c)
                ? '<span class="tt-name tt-pill" style="--pill:' + pillColor(c) + ";--pill-fg:" + fg(pillColor(c)) + '">' + name + "</span>"
                : '<span class="tt-name">' + name + "</span>";
            head += '<th class="' + (c.strong ? "strong" : "") + '"><span class="tt-th">' + inner +
                (showUnit && unitText(c) ? '<small class="tt-unit">(' + esc(unitText(c)) + ")</small>" : "") + "</span></th>";
            if (hasPct(c)) {
                head += '<th class="tt-pct"><span class="tt-th"><span class="tt-name">% เพิ่ม/ลด</span>' +
                    (showUnit ? '<small class="tt-unit">จากปีก่อน</small>' : "") + "</span></th>";
            }
        });
        document.getElementById("tableHead").innerHTML = head + "</tr>";

        var yearFmt = pv("yearFmt", "full");
        function yearCell(y) { return yearFmt === "short" ? String(y) : "ปีงบ " + y; }

        function num(c, v) {
            if (v == null) return "–";
            return fmt(v / scaleOf(c), decOf(c)) + (c.unit === "%" ? "%" : "");
        }

        /* เนื้อตาราง */
        document.getElementById("tableBody").innerHTML = sel.map(function (d) {
            var p = prevOf ? prevOf(d) : null;
            var row = '<tr><td class="sticky">' + yearCell(d.fiscalYear) + "</td>";
            cols.forEach(function (c) {
                var v = c.get(d);
                row += '<td class="' + (c.strong ? "strong" : "") + '">' + num(c, v) + "</td>";
                if (hasPct(c)) {
                    row += '<td class="tt-pct">' + (p ? delta(pct(v, c.get(p)), c.good) : "–") + "</td>";
                }
            });
            return row + "</tr>";
        }).join("");

        /* แถวรวม / เฉลี่ย */
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
            var avg = function (c) {
                if (c.tot === "sum") return sum(sel, c.get) / n;
                if (c.tot === "mean") return mean(sel, c.get);
                return null;
            };
            var avgPct = function (c) {
                var v = sel.map(function (d) {
                    var p = prevOf ? prevOf(d) : null;
                    return p ? pct(c.get(d), c.get(p)) : null;
                }).filter(function (x) { return x != null && isFinite(x); });
                return v.length ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : null;
            };

            var cell = function (c, kind) {
                var v = kind === "tot" ? total(c) : avg(c);
                return '<td class="' + (c.strong ? "strong" : "") + '">' + (v == null ? "" : num(c, v)) + "</td>";
            };

            if (pv("showTotal", true)) {
                foot += '<tr class="tt-total"><td class="sticky">รวม</td>';
                cols.forEach(function (c) {
                    foot += cell(c, "tot");
                    if (hasPct(c)) foot += '<td class="tt-pct"></td>';
                });
                foot += "</tr>";
            }
            if (pv("showAvg", true)) {
                foot += '<tr class="tt-avg"><td class="sticky"><span class="tt-avg-pill">เฉลี่ยต่อปี</span></td>';
                cols.forEach(function (c) {
                    foot += cell(c, "avg");
                    if (hasPct(c)) {
                        var ap = avgPct(c);
                        foot += '<td class="tt-pct">' + (ap == null ? "" : delta(ap, c.good)) + "</td>";
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
            h += sw("pill:" + c.key, "ป้ายสีหลังชื่อคอลัมน์", pillOn(c));
            if (pillOn(c)) {
                h += '<label class="ct-color"><span class="ct-color-name">สีป้าย</span>' +
                    '<span class="ct-color-pick"><button type="button" class="tt-auto" data-tt-autocolor="' + c.key + '">ตามสีหมวด</button>' +
                    '<code>' + pillColor(c).toUpperCase() + '</code>' +
                    '<input type="color" data-tt-color="' + c.key + '" value="' + pillColor(c) + '" aria-label="สีป้ายของ ' + esc(labelOf(c)) + '"></span></label>';
            }
            h += '<div class="ct-sublabel">ชื่อหัวคอลัมน์</div>' +
                '<input type="text" class="tt-text" data-tt-label="' + c.key + '" value="' + esc((prefs.label && prefs.label[c.key]) || "") + '" placeholder="' + esc(c.label) + '" maxlength="40">';
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

        /* ธีม */
        h += '<div class="ct-sec"><div class="ct-label">รูปแบบตาราง</div>' +
            seg("data-tt-theme", [["soft", "เรียบ"], ["red", "แดงขอบมน"]], pv("theme", "soft"), "", "") +
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
            sw("showAvg", "แถว “เฉลี่ยต่อปี”", pv("showAvg", true)) +
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
        h += '<div class="ct-foot tt-foot"><button type="button" class="ct-reset" data-tt-reset="1">คืนค่าเริ่มต้น</button></div>';

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
        on("[data-tt-label]", "change", function (n) {
            var k = n.getAttribute("data-tt-label"), v = n.value.trim();
            if (v) sub("label")[k] = v; else if (prefs.label) delete prefs.label[k];
            apply(false);
        });

        P.querySelector("[data-tt-reset]").addEventListener("click", function () {
            prefs = {};
            openCol = null;
            apply(true);
        });
    }

    /* ---------- ติดตั้ง ---------- */

    function init() {
        var b = btn();
        if (!b || b.__tt) return;
        b.__tt = true;
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
    window.addEventListener("resize", position);
    window.addEventListener("scroll", function () {
        if (panelEl) window.requestAnimationFrame(position);
    }, { passive: true });

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();

    window.TableTools = { render: function (sel, prevOf) { init(); render(sel, prevOf); }, fmt: fmt };
})();
