/* =========================================================
   cost-app.js
   หน้า "ต้นทุนการเดินรถ" (cost.html)

   ลำดับการทำงาน
     load-cost.js  โหลด Excel → window.costData / window.costDetail
     initCostDashboard()  เตรียมข้อมูล, ตัวเลือกปี, แล้ว render()
     render()  คำนวณจากช่วงปีที่เลือก แล้ววาดทุกส่วนของหน้า

   แนวคิดของหน้านี้
     • KPI และข้อความสรุปด้านบน  = "ปีล่าสุดของช่วงที่เลือก" เทียบกับปีก่อนหน้า
     • กราฟแนวโน้ม = ทุกปีในช่วงที่เลือก (ถ้าเลือกปีเดียว จะแสดงทุกปีที่มีข้อมูลเพื่อให้เห็นแนวโน้ม)
     • ปีที่ยังไม่มีตัวเลขต้นทุนจะถูกข้ามอัตโนมัติ
   ========================================================= */

(function () {
    "use strict";

    /* ---------- ค่าคงที่ ---------- */

    // หมวดต้นทุน 4 ด้าน (สีผ่านการตรวจสอบการมองเห็นของผู้ตาบอดสีแล้ว)
    const GROUPS = [
        { key: "staffCost",       group: "Staff",       th: "บุคลากร",   en: "Staff",       color: "#c8102e" },
        { key: "energyCost",      group: "Energy",      th: "พลังงาน",   en: "Energy",      color: "#eda100" },
        { key: "maintenanceCost", group: "Maintenance", th: "ซ่อมบำรุง", en: "Maintenance", color: "#2a78d6" },
        { key: "indirectCost",    group: "Indirect",    th: "อื่น ๆ",   en: "Indirect",    color: "#e87ba4" }
    ];

    const COLOR = {
        cost: "#c8102e",
        revenue: "#1baf7a",
        carKm: "#eda100",
        passenger: "#2a78d6",
        unitCost: "#2a78d6"
    };

    // สีตัวอักษร/เส้นกริดของกราฟ — อ่านจากตัวแปร CSS ของธีมที่เปิดอยู่ (สว่าง/มืด)
    let INK = "#1b1416";
    let INK2 = "#4a3d41";
    let MUTE = "#76686c";
    let GRID = "#f3eaeb";

    function readTheme() {
        const v = (name, fb) => (window.ChartTools ? ChartTools.css(name, fb) : fb);
        INK = v("--ink", INK);
        INK2 = v("--ink-2", INK2);
        MUTE = v("--mute", MUTE);
        GRID = v("--grid", GRID);

        if (typeof Chart !== "undefined") Chart.defaults.color = MUTE;
    }

    // จอเล็ก (มือถือ) ใช้ฟอนต์/ป้ายตัวเลขที่เล็กลง
    const isSmall = () => window.innerWidth < 640;
    const TOP_N = 10;

    /* ---------- สถานะ ---------- */

    let allYears = [];     // ทุกปีใน Excel
    let valid = [];        // เฉพาะปีที่มีตัวเลขต้นทุน
    let pending = [];      // ปีที่ยังไม่มีตัวเลขต้นทุน

    // กราฟอิสระ
    const FREE_STORE = "redline-cost-free-v1";
    const FREE_DEFAULT = ["total", "passenger"];
    const FREE_MAX = 12;
    const FREE_COLORS = ["#c8102e", "#eda100", "#2a78d6", "#e87ba4", "#1baf7a", "#6250d6", "#0e9aa7", "#c2410c"];
    let freeCatalog = [];  // ข้อมูลทุกชุดที่เลือกมาวาดได้ (จากทุกคอลัมน์ใน Excel)
    let freeSel = [];      // รหัสข้อมูลที่เลือกอยู่ (เรียงตามที่เลือก)
    let freeSet = [];      // ปีที่แสดงล่าสุด
    let freeMode = "actual";   // "actual" = ค่าจริง, "index" = ดัชนี (ปีแรก = 100)

    const state = {
        start: null,
        end: null,
        drillGroup: "all",
        drillYear: null,
        showAllRank: false
    };

    window.initCostDashboard = init;

    /* ---------- ตัวช่วยจัดรูปแบบ ---------- */

    const nf = (v, min, max) =>
        Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: min, maximumFractionDigits: max });

    const fmtM  = v => nf(v / 1e6, 2, 2);          // ล้านบาท 2 ตำแหน่ง
    const fmtM1 = v => nf(v / 1e6, 1, 1);
    const fmt2  = v => nf(v, 2, 2);
    const fmt1  = v => nf(v, 1, 1);
    const fmt0  = v => nf(v, 0, 0);

    function esc(s) {
        return String(s == null ? "" : s).replace(/[&<>"]/g, c => (
            { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]
        ));
    }

    const $ = id => document.getElementById(id);

    function pctChange(cur, prev) {
        if (!prev) return null;
        return (cur - prev) / prev * 100;
    }

    /* วลีเปลี่ยนแปลง เช่น "เพิ่มขึ้น 9.4%" */
    function changeText(p) {
        if (p == null) return "";
        if (Math.abs(p) < 0.05) return "ไม่เปลี่ยนแปลง";
        return (p > 0 ? "เพิ่มขึ้น " : "ลดลง ") + fmt1(Math.abs(p)) + "%";
    }

    /* ป้ายเปลี่ยนแปลง (ลูกศร + ตัวเลข ไม่ใช้สีอย่างเดียว)
       good = "down" → ลดลงคือดี (ต้นทุน), "up" → เพิ่มขึ้นคือดี */
    function deltaChip(p, good, suffix) {
        if (p == null || !isFinite(p)) return "";

        const sfx = suffix || "%";

        if (Math.abs(p) < 0.05) {
            return '<span class="delta flat"><i>–</i>คงที่</span>';
        }

        const up = p > 0;
        const isGood = good === "down" ? !up : up;

        return '<span class="delta ' + (isGood ? "good" : "bad") + '"><i>' +
            (up ? "▲" : "▼") + "</i>" + fmt1(Math.abs(p)) + sfx + "</span>";
    }

    /* ---------- เตรียมข้อมูล ---------- */

    function normalize(d) {
        const total = d.totalCost ||
            d.staffCost + d.energyCost + d.maintenanceCost + d.indirectCost;

        const revenue = d.passenger * d.avgFare;

        return Object.assign({}, d, {
            total: total,
            revenue: revenue,
            recovery: total ? revenue / total : 0,
            costPerCarKm: d.costPerCarKm || (d.carKm ? total / d.carKm : 0),
            costPerPassenger: d.costPerPassenger || (d.passenger ? total / d.passenger : 0),
            // ผู้โดยสารต่อวัน แยกสาย (ค่าจาก Excel เท่านั้น ว่าง/0 = ยังไม่มีข้อมูล)
            paxActualNorth: d.paxActualNorth > 0 ? d.paxActualNorth : null,
            paxTargetNorth: d.paxTargetNorth > 0 ? d.paxTargetNorth : null,
            paxActualWest: d.paxActualWest > 0 ? d.paxActualWest : null,
            paxTargetWest: d.paxTargetWest > 0 ? d.paxTargetWest : null,
            // ผู้โดยสารต่อวัน "รวมทั้งสองสาย" (ค่าจาก Excel เท่านั้น) — ไม่เกี่ยวกับคอลัมน์ Passenger (รวมทั้งปี) ที่ใช้คำนวณรายได้
            paxActualTotal: d.paxActualTotal > 0 ? d.paxActualTotal : null,
            paxTargetTotal: d.paxTargetTotal > 0 ? d.paxTargetTotal : null,
            hasData: total > 0
        });
    }

    function sumBy(items, fn) {
        return items.reduce((s, x) => s + Number(fn(x) || 0), 0);
    }

    function selectedYears() {
        const a = Math.min(state.start, state.end);
        const b = Math.max(state.start, state.end);
        return valid.filter(d => d.fiscalYear >= a && d.fiscalYear <= b);
    }

    function previousOf(d) {
        const i = valid.indexOf(d);
        return i > 0 ? valid[i - 1] : null;
    }

    function detailRows(year) {
        return (window.costDetail || []).filter(r => r.FiscalYear === year && r.Amount);
    }

    /* เปรียบเทียบรายการต้นทุนย่อยระหว่างสองปี → [{group,item,cur,prev,diff}] */
    function itemChanges(curYear, baseYear, groupFilter) {
        const map = {};

        const add = (rows, field) => rows.forEach(r => {
            if (groupFilter && groupFilter !== "all" && r.CostGroup !== groupFilter) return;
            const k = r.CostGroup + "|" + r.CostItem;
            map[k] = map[k] || { group: r.CostGroup, item: r.CostItem, cur: 0, prev: 0 };
            map[k][field] += r.Amount;
        });

        add(detailRows(curYear), "cur");
        add(detailRows(baseYear), "prev");

        return Object.keys(map).map(k => {
            const x = map[k];
            x.diff = x.cur - x.prev;
            return x;
        });
    }

    /* ---------- เริ่มต้น ---------- */

    function init() {
        if (window.costLoadError || !Array.isArray(window.costData) || window.costData.length === 0) {
            showLoadError(window.costLoadError || "ไม่พบข้อมูลในชีต dashboard_cost");
            return;
        }

        allYears = window.costData
            .map(normalize)
            .sort((a, b) => a.fiscalYear - b.fiscalYear);

        valid = allYears.filter(d => d.hasData);
        pending = allYears.filter(d => !d.hasData);

        if (valid.length === 0) {
            showLoadError("ยังไม่มีปีงบประมาณใดที่มีตัวเลขต้นทุน");
            return;
        }

        if (typeof Chart !== "undefined") {
            Chart.defaults.font.family = "Sarabun, sans-serif";
            Chart.defaults.color = MUTE;
        }

        fillYearSelects();
        initFree();

        state.start = valid[0].fiscalYear;
        state.end = valid[valid.length - 1].fiscalYear;
        syncSelects();

        showPendingNote();
        bindEvents();
        render();

        // เปลี่ยนธีมสว่าง/มืด → วาดกราฟใหม่ด้วยสีของธีมนั้น
        window.addEventListener("themechange", render);

        // หมุนจอ/ปรับขนาดข้ามจุดมือถือ → จัดกราฟใหม่ให้พอดี
        let wasSmall = isSmall();
        let timer = null;

        window.addEventListener("resize", () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                if (wasSmall !== isSmall()) {
                    wasSmall = isSmall();
                    render();
                }
            }, 200);
        });
    }

    function showLoadError(message) {
        $("heroHeadline").textContent = "ยังแสดงข้อมูลต้นทุนไม่ได้";
        $("heroSub").textContent = "";
        $("loadErrorText").textContent = message;
        $("loadError").hidden = false;
    }

    function showPendingNote() {
        const note = $("pendingNote");
        if (!pending.length) return;

        note.hidden = false;
        note.textContent =
            "ปีงบประมาณ " + pending.map(d => d.fiscalYear).join(", ") +
            " ยังไม่มีตัวเลขต้นทุนในไฟล์ Excel จึงยังไม่นำมาแสดง " +
            "(กรอกที่ data/cost-data.xlsx แล้วรีเฟรชหน้านี้ ระบบจะนำมาแสดงให้เอง)";
    }

    function fillYearSelects() {
        const options = valid.map(d =>
            '<option value="' + d.fiscalYear + '">ปีงบ ' + d.fiscalYear + "</option>"
        ).join("");

        $("startFiscalYearSelect").innerHTML = options;
        $("endFiscalYearSelect").innerHTML = options;
    }

    function syncSelects() {
        $("startFiscalYearSelect").value = String(state.start);
        $("endFiscalYearSelect").value = String(state.end);

        const first = valid[0].fiscalYear;
        const last = valid[valid.length - 1].fiscalYear;

        $("quickAll").classList.toggle("is-on", state.start === first && state.end === last);
        $("quickLatest").classList.toggle("is-on", state.start === last && state.end === last);
    }

    function bindEvents() {
        $("startFiscalYearSelect").addEventListener("change", e => {
            state.start = Number(e.target.value);
            if (state.start > state.end) state.end = state.start;
            onRangeChange();
        });

        $("endFiscalYearSelect").addEventListener("change", e => {
            state.end = Number(e.target.value);
            if (state.end < state.start) state.start = state.end;
            onRangeChange();
        });

        $("quickAll").addEventListener("click", () => {
            state.start = valid[0].fiscalYear;
            state.end = valid[valid.length - 1].fiscalYear;
            onRangeChange();
        });

        $("quickLatest").addEventListener("click", () => {
            state.start = state.end = valid[valid.length - 1].fiscalYear;
            onRangeChange();
        });

        $("drillYear").addEventListener("change", e => {
            state.drillYear = Number(e.target.value);
            state.showAllRank = false;
            renderDrill();
        });

        $("rankMore").addEventListener("click", () => {
            state.showAllRank = !state.showAllRank;
            renderDrill();
        });

        $("printBtn").addEventListener("click", () => window.print());
        $("exportExcelBtn").addEventListener("click", exportExcel);
    }

    function onRangeChange() {
        state.drillYear = null;
        state.showAllRank = false;
        syncSelects();
        render();
    }

    /* =========================================================
       RENDER
    ========================================================= */

    function render() {
        const sel = selectedYears();
        if (!sel.length) return;

        readTheme();

        const focus = sel[sel.length - 1];
        const prev = previousOf(focus);
        const trendSet = sel.length >= 2 ? sel : valid;

        renderHero(sel, focus, prev);
        renderKpis(focus, prev);
        renderTrend(trendSet, sel.length < 2);
        renderMix(sel);
        renderStack(trendSet);
        renderRevenue(trendSet, focus);
        renderPax(trendSet, focus);
        renderFree(trendSet);
        renderDrill(sel, focus);
        renderTable(sel);
    }

    /* ---------- Hero: สรุปใจความสำคัญ ---------- */

    function renderHero(sel, focus, prev) {
        const multi = sel.length > 1;
        const first = sel[0];
        const total = sumBy(sel, d => d.total);

        let headline;
        let sub;

        if (!multi) {
            headline = "ปีงบประมาณ " + focus.fiscalYear + " ใช้ต้นทุนเดินรถรวม <mark>" +
                fmtM(focus.total) + " ล้านบาท</mark>";

            sub = prev
                ? deltaChip(pctChange(focus.total, prev.total), "down") +
                  ' <span>เทียบปีงบประมาณ ' + prev.fiscalYear + " (" + fmtM(prev.total) + " ล้านบาท)</span>"
                : "ปีแรกที่มีข้อมูลต้นทุนในระบบ";
        } else {
            headline = "ปีงบประมาณ " + first.fiscalYear + "–" + focus.fiscalYear +
                " ใช้ต้นทุนเดินรถสะสม <mark>" + fmtM(total) + " ล้านบาท</mark>";

            sub = "<span>เฉลี่ยปีละ " + fmtM(total / sel.length) + " ล้านบาท</span>" +
                (prev && sel.indexOf(prev) !== -1
                    ? "<span>·</span><span>ปี " + focus.fiscalYear + " เทียบปี " + prev.fiscalYear + "</span>" +
                      deltaChip(pctChange(focus.total, prev.total), "down")
                    : "");
        }

        $("heroHeadline").innerHTML = headline;
        $("heroSub").innerHTML = sub;

        const points = buildInsights(sel, focus, prev);
        $("heroPoints").innerHTML = points.map(p => "<li>" + p + "</li>").join("");
    }

    /* ข้อสังเกตอัตโนมัติ (ภาษาไทย) */
    function buildInsights(sel, focus, prev) {
        const out = [];
        const base = sel.length > 1 ? sel[0] : prev;

        // 1) การใช้งานเทียบกับต้นทุน
        if (base && base.passenger > 0 && focus.passenger > 0) {
            const paxP = pctChange(focus.passenger, base.passenger);
            const costP = pctChange(focus.total, base.total);
            const unitP = pctChange(focus.costPerPassenger, base.costPerPassenger);

            out.push(
                "เทียบปี " + base.fiscalYear + " ผู้โดยสาร<b>" + changeText(paxP) + "</b> " +
                "ขณะที่ต้นทุนรวม<b>" + changeText(costP) + "</b> " +
                "ต้นทุนต่อผู้โดยสารจึง<b>" + changeText(unitP) + "</b> " +
                "(" + fmt2(base.costPerPassenger) + " → " + fmt2(focus.costPerPassenger) + " บาท)"
            );
        }

        // 2) โครงสร้างต้นทุน
        const ranked = GROUPS
            .map(g => ({ g: g, v: focus[g.key] }))
            .sort((a, b) => b.v - a.v);

        out.push(
            "<b>" + ranked[0].g.th + "</b> เป็นหมวดต้นทุนใหญ่สุด " + fmt1(ranked[0].v / focus.total * 100) +
            "% ของต้นทุนปี " + focus.fiscalYear + " รองลงมาคือ" + ranked[1].g.th +
            " " + fmt1(ranked[1].v / focus.total * 100) + "%"
        );

        // 3) ค่าโดยสารคุ้มทุนแค่ไหน
        if (focus.revenue > 0) {
            const gap = focus.total - focus.revenue;

            out.push(
                gap > 0
                    ? "ค่าโดยสารครอบคลุมต้นทุนประมาณ <b>" + fmt1(focus.recovery * 100) + "%</b> " +
                      "เหลือส่วนต่างที่ต้องสนับสนุน " + fmtM(gap) + " ล้านบาท (ประมาณการ)"
                    : "รายได้ค่าโดยสารสูงกว่าต้นทุน <b>" + fmtM(-gap) + " ล้านบาท</b> (ประมาณการ)"
            );
        }

        // 4) รายการที่เปลี่ยนมากที่สุด
        if (base) {
            const movers = itemChanges(focus.fiscalYear, base.fiscalYear)
                .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

            const top = movers[0];

            if (top && Math.abs(top.diff) >= 1e6) {
                out.push(
                    "รายการที่เปลี่ยนมากที่สุดเทียบปี " + base.fiscalYear + " คือ <b>" + esc(shortName(top.item)) +
                    "</b> " + (top.diff > 0 ? "เพิ่มขึ้น " : "ลดลง ") + fmtM(Math.abs(top.diff)) + " ล้านบาท"
                );
            }
        }

        return out;
    }

    /* ตัดชื่อรายการที่ยาวมากให้อ่านง่าย */
    function shortName(name) {
        const s = String(name);
        return s.length > 60 ? s.slice(0, 58).trim() + "…" : s;
    }

    /* ---------- KPI ---------- */

    function sparkline(values, activeIndex) {
        const w = 104;
        const h = 36;
        const pad = 4;

        if (values.length < 2) return "";

        const min = Math.min.apply(null, values);
        const max = Math.max.apply(null, values);
        const span = max - min || 1;

        const pts = values.map((v, i) => [
            pad + i * (w - pad * 2) / (values.length - 1),
            h - pad - (v - min) / span * (h - pad * 2)
        ]);

        const path = pts.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
        const a = pts[activeIndex] || pts[pts.length - 1];

        return '<svg class="spark" viewBox="0 0 ' + w + " " + h + '" width="' + w + '" height="' + h + '" aria-hidden="true">' +
            '<polyline points="' + path + '" fill="none" stroke="#e8a6ae" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
            '<circle cx="' + a[0].toFixed(1) + '" cy="' + a[1].toFixed(1) + '" r="4.5" fill="#c8102e" stroke="#fff" stroke-width="2"/>' +
            "</svg>";
    }

    function renderKpis(focus, prev) {
        const idx = valid.indexOf(focus);
        const vs = prev ? "เทียบปี " + prev.fiscalYear : "ปีแรกที่มีข้อมูล";

        const tiles = [
            {
                label: "ต้นทุนรวม",
                info: "ck-total",
                value: fmtM(focus.total),
                unit: "ล้านบาท",
                delta: prev ? pctChange(focus.total, prev.total) : null,
                good: "down",
                series: valid.map(d => d.total)
            },
            {
                label: "ต้นทุนต่อ Car-Km",
                info: "ck-carkm",
                value: fmt2(focus.costPerCarKm),
                unit: "บาท/ตู้/กม.",
                delta: prev ? pctChange(focus.costPerCarKm, prev.costPerCarKm) : null,
                good: "down",
                series: valid.map(d => d.costPerCarKm)
            },
            {
                label: "ต้นทุนต่อผู้โดยสาร",
                info: "ck-pax",
                value: fmt2(focus.costPerPassenger),
                unit: "บาท/คน",
                delta: prev ? pctChange(focus.costPerPassenger, prev.costPerPassenger) : null,
                good: "down",
                series: valid.map(d => d.costPerPassenger)
            },
            {
                label: "คืนทุนจากค่าโดยสาร",
                info: "ck-recovery",
                value: fmt1(focus.recovery * 100),
                unit: "%",
                delta: prev ? (focus.recovery - prev.recovery) * 100 : null,
                deltaSuffix: " จุด",
                good: "up",
                series: valid.map(d => d.recovery)
            }
        ];

        $("kpiGrid").innerHTML = tiles.map(t =>
            '<article class="kpi" data-info="' + t.info + '">' +
                '<div class="kpi-top"><span class="kpi-label">' + t.label + "</span>" +
                    '<span class="kpi-year">ปีงบ ' + focus.fiscalYear + "</span></div>" +
                '<div class="kpi-main"><strong>' + t.value + "</strong><em>" + t.unit + "</em></div>" +
                '<div class="kpi-foot"><div class="kpi-delta">' +
                    deltaChip(t.delta, t.good, t.deltaSuffix) + "<small>" + vs + "</small></div>" +
                    sparkline(t.series, idx) + "</div>" +
            "</article>"
        ).join("");
    }

    /* =========================================================
       กราฟ
    ========================================================= */

    function baseOptions(cfg) {
        const c = cfg || {};
        const unit = c.unit === undefined ? "ล้านบาท" : c.unit;
        const tipFmt = c.tipFmt || fmt2;

        // มือถือ: ฟอนต์เล็กลง ซ่อนชื่อแกน และไม่ใส่ตัวเลขบนกราฟที่แท่งติดกันเกินไป
        const small = isSmall();
        const axisFont = { family: "Sarabun, sans-serif", size: small ? 12 : 13, weight: "600" };
        const showLabels = c.labels && !(small && c.hideLabelsOnSmall);

        return {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            layout: { padding: { top: small ? 20 : 24, right: small ? 6 : 10 } },
            animation: { duration: 450 },

            plugins: {
                legend: {
                    display: c.legend !== false,
                    position: "bottom",
                    labels: {
                        usePointStyle: true,
                        pointStyle: "circle",
                        boxWidth: 8,
                        boxHeight: 8,
                        padding: small ? 12 : 18,
                        color: INK2,
                        font: axisFont
                    }
                },

                tooltip: {
                    backgroundColor: "rgba(27, 20, 22, 0.95)",
                    titleFont: { family: "Sarabun, sans-serif", weight: "700", size: 13 },
                    bodyFont: { family: "Sarabun, sans-serif", size: 13 },
                    footerFont: { family: "Sarabun, sans-serif", weight: "700", size: 13 },
                    padding: 12,
                    cornerRadius: 12,
                    boxPadding: 5,
                    callbacks: Object.assign({
                        title: items => "ปีงบประมาณ " + items[0].label,
                        label: ctx => {
                            const ds = ctx.dataset;
                            const u = ds.ctUnit != null ? ds.ctUnit : unit;
                            const f = ds.ctFmt || tipFmt;
                            const suffix = u && String(ds.label).indexOf(u) === -1 ? " " + u : "";
                            const line = " " + ds.label + ": " + (ctx.parsed.y == null ? "–" : f(ctx.parsed.y)) + suffix;
                            return ds.ctEn ? [line, "    " + ds.ctEn] : line;
                        }
                    }, c.tooltip || {})
                },

                datalabels: showLabels
                    ? Object.assign({
                        display: true,
                        anchor: "end",
                        align: "top",
                        offset: 4,
                        clamp: true,
                        color: INK,
                        font: { family: "Sarabun, sans-serif", weight: "700", size: small ? 11 : 12 },
                        formatter: v => (c.labelFmt || fmt2)(v)
                    }, c.labelExtra || {})
                    : { display: false }
            },

            scales: {
                x: {
                    offset: true,
                    grid: { display: false },
                    border: { display: false },
                    ticks: { color: INK2, font: axisFont, maxRotation: 0, autoSkip: true }
                },
                y: {
                    beginAtZero: c.beginAtZero !== false,
                    grace: "8%",
                    grid: { color: GRID },
                    border: { display: false },
                    ticks: {
                        color: MUTE,
                        font: { family: "Sarabun, sans-serif", size: small ? 11 : 12 },
                        maxTicksLimit: small ? 6 : 8,
                        callback: v => nf(v, 0, 1)
                    },
                    title: {
                        display: !!c.yTitle && !small,
                        text: c.yTitle || "",
                        color: MUTE,
                        font: { family: "Sarabun, sans-serif", size: 12, weight: "600" }
                    }
                }
            }
        };
    }

    const yearLabels = set => set.map(d => String(d.fiscalYear));

    /* ---------- ต้นทุนรวมรายปี ---------- */

    function renderTrend(set, showingAll) {
        $("trendNote").innerHTML =
            "แท่ง = ต้นทุนรวม 4 หมวด (ล้านบาท · แกนซ้าย) · เส้น = ต้นทุนการเดินรถ บาท/ตู้/กม. " +
            "<span class=\"en\">Operating Cost per Car.Km</span> (แกนขวา)" +
            (showingAll ? " · เลือกปีเดียวอยู่ จึงแสดงทุกปีเพื่อให้เห็นแนวโน้ม" : "");

        ChartTools.create("trendChart", {
            type: "bar",
            data: {
                labels: yearLabels(set),
                datasets: [
                    {
                        label: "ต้นทุนรวม",
                        data: set.map(d => d.total / 1e6),
                        ctKey: "total", ctKind: "bar", ctUnit: "ล้านบาท", ctFmt: fmt1,
                        ctLabelFmt: v => (isSmall() ? fmt0(v) : fmt1(v)),   // มือถือ: ตัดทศนิยมให้พอดีแท่ง
                        ctColor: COLOR.cost
                    },
                    {
                        label: "ต้นทุนการเดินรถ (บาท/ตู้/กม.)",
                        data: set.map(d => d.costPerCarKm),
                        ctKey: "costPerCarKm", ctKind: "line", ctUnit: "บาท/ตู้/กม.", ctFmt: fmt2,
                        ctEn: "Operating Cost per Car.Km",
                        yAxisID: "y1",
                        ctColor: COLOR.unitCost
                    }
                ]
            },
            options: baseOptions({ legend: true, labels: true, labelFmt: fmt1, yTitle: "ล้านบาท" })
        }, {
            title: "ต้นทุนรวมรายปี",
            autoStyle: true,
            dualAxis: true,
            autoZero: true,
            labelFormat: fmt1
        });

        // ชิป % เปลี่ยนแปลงจากปีก่อน
        $("yoyChips").innerHTML = "<span class=\"chips-label\">เปลี่ยนแปลงจากปีก่อน</span>" +
            set.map(d => {
                const p = previousOf(d);
                return '<span class="chip"><b>' + d.fiscalYear + "</b>" +
                    (p ? deltaChip(pctChange(d.total, p.total), "down") : "<small>ปีฐาน</small>") + "</span>";
            }).join("");
    }

    /* ---------- สัดส่วนต้นทุน (โดนัท) ---------- */

    function renderMix(sel) {
        const sums = GROUPS.map(g => sumBy(sel, d => d[g.key]));
        const total = sums.reduce((a, b) => a + b, 0);

        $("mixNote").textContent = sel.length > 1
            ? "รวมปีงบประมาณ " + sel[0].fiscalYear + "–" + sel[sel.length - 1].fiscalYear
            : "ปีงบประมาณ " + sel[0].fiscalYear;

        const centerText = fmtM(total);

        ChartTools.create("mixChart", {
            type: "doughnut",
            data: {
                labels: GROUPS.map(g => g.th),
                datasets: [{
                    label: "ต้นทุน",
                    data: sums.map(v => v / 1e6),
                    ctColors: GROUPS.map(g => g.color),
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "64%",
                layout: { padding: 8 },
                animation: { duration: 450 },
                plugins: {
                    legend: { display: false },
                    datalabels: { display: false },
                    tooltip: {
                        backgroundColor: "rgba(27, 20, 22, 0.95)",
                        titleFont: { family: "Sarabun, sans-serif", weight: "700", size: 13 },
                        bodyFont: { family: "Sarabun, sans-serif", size: 13 },
                        padding: 12,
                        cornerRadius: 12,
                        callbacks: {
                            label: ctx => {
                                const t = ctx.dataset.data.reduce((a, b) => a + b, 0);
                                return " " + ctx.label + ": " + fmt2(ctx.parsed) + " ล้านบาท (" +
                                    fmt1(ctx.parsed / t * 100) + "%)";
                            }
                        }
                    }
                }
            },
            plugins: [{
                id: "ctCenter",
                afterDraw(chart) {
                    if (chart.config.type !== "doughnut") return;

                    const a = chart.chartArea;
                    const x = (a.left + a.right) / 2;
                    const y = (a.top + a.bottom) / 2;
                    const ctx = chart.ctx;

                    ctx.save();
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillStyle = MUTE;
                    ctx.font = "600 13px Sarabun, sans-serif";
                    ctx.fillText("ต้นทุนรวม", x, y - 20);
                    ctx.fillStyle = INK;
                    ctx.font = "800 24px Sarabun, sans-serif";
                    ctx.fillText(centerText, x, y + 4);
                    ctx.fillStyle = MUTE;
                    ctx.font = "600 12px Sarabun, sans-serif";
                    ctx.fillText("ล้านบาท", x, y + 26);
                    ctx.restore();
                }
            }]
        }, {
            title: "สัดส่วนต้นทุน",
            kinds: ["doughnut", "pie"],
            initialKind: "doughnut",
            onChange: renderMixLegend
        });
    }

    /* คำอธิบายสัดส่วน — ดึงสีจากกราฟจริง เพื่อให้ตรงกับที่ผู้ใช้เลือก */
    function renderMixLegend(chart) {
        const ds = chart.data.datasets[0];
        const total = ds.data.reduce((a, b) => a + b, 0);

        $("mixLegend").innerHTML = GROUPS.map((g, i) => {
            const color = Array.isArray(ds.backgroundColor) ? ds.backgroundColor[i] : ds.backgroundColor;

            return '<li><i style="background:' + color + '"></i>' +
                '<div class="ml-name"><strong>' + g.th + "</strong><small>" + g.en + " Cost</small></div>" +
                '<div class="ml-val"><strong>' + fmt1(ds.data[i] / total * 100) + "%</strong>" +
                "<small>" + fmtM1(ds.data[i] * 1e6) + " ล้านบาท</small></div></li>";
        }).join("");
    }

    /* ---------- ต้นทุนแยกหมวดรายปี ---------- */

    function renderStack(set) {
        ChartTools.create("stackChart", {
            type: "bar",
            data: {
                labels: yearLabels(set),
                datasets: GROUPS.map(g => ({
                    label: g.th,
                    data: set.map(d => d[g.key] / 1e6),
                    ctColor: g.color
                }))
            },
            options: baseOptions({
                yTitle: "ล้านบาท",
                labels: false,
                tooltip: {
                    footer: items => {
                        const t = items.reduce((s, i) => s + i.parsed.y, 0);
                        return "รวม " + fmt2(t) + " ล้านบาท";
                    }
                }
            })
        }, {
            title: "ต้นทุนแยกหมวดรายปี",
            autoStyle: true,
            stackable: true,
            stacked: true,
            labelFormat: fmt1
        });
    }

    /* ---------- รายได้ vs ต้นทุน ---------- */

    function renderRevenue(set, focus) {
        ChartTools.create("revChart", {
            type: "bar",
            data: {
                labels: yearLabels(set),
                datasets: [
                    { label: "รายได้ค่าโดยสาร (ประมาณการ)", data: set.map(d => d.revenue / 1e6), ctColor: COLOR.revenue },
                    { label: "ต้นทุนรวม", data: set.map(d => d.total / 1e6), ctColor: COLOR.cost }
                ]
            },
            options: baseOptions({ yTitle: "ล้านบาท", labels: true, labelFmt: fmt1, hideLabelsOnSmall: true })
        }, {
            title: "รายได้เทียบต้นทุน",
            autoStyle: true,
            labelFormat: fmt1
        });

        // แผงอัตราคืนทุน (แถบรายปี)
        $("recoveryPanel").innerHTML =
            "<h3>ค่าโดยสารครอบคลุมต้นทุนกี่ %</h3>" +
            '<ul class="rec-bars">' +
            set.map(d =>
                '<li class="' + (d === focus ? "is-focus" : "") + '"><span>' + d.fiscalYear + "</span>" +
                '<div class="rec-track"><div style="width:' + Math.min(100, d.recovery * 100).toFixed(1) + '%"></div></div>' +
                "<b>" + fmt1(d.recovery * 100) + "%</b></li>"
            ).join("") +
            "</ul>" +
            '<p class="rec-note">ส่วนที่เหลือคือต้นทุนที่ต้องมีแหล่งรายได้อื่นหรือการสนับสนุนมาครอบคลุม</p>';

        // จุดคุ้มทุนของปีล่าสุด
        const beMillions = focus.avgFare ? focus.total / focus.avgFare / 1e6 : 0;
        const actualMillions = focus.passenger / 1e6;
        const gap = focus.total - focus.revenue;
        const reach = beMillions ? actualMillions / beMillions * 100 : 0;

        $("revFacts").innerHTML =
            fact("ค่าโดยสารเฉลี่ย ปีงบ " + focus.fiscalYear, fmt2(focus.avgFare) + " บาท", "") +
            fact(gap > 0 ? "ส่วนต่าง (ต้นทุน − รายได้)" : "รายได้สูงกว่าต้นทุน", fmtM(Math.abs(gap)) + " ล้านบาท", "ประมาณการจากผู้โดยสาร × ค่าโดยสารเฉลี่ย") +
            fact("ผู้โดยสารที่ต้องมีเพื่อคุ้มทุน", fmt1(beMillions) + " ล้านคน/ปี", "≈ " + fmt0(beMillions * 1e6 / 365) + " คน/วัน") +
            fact("ผู้โดยสารจริง", fmt1(actualMillions) + " ล้านคน/ปี", "≈ " + fmt0(focus.passenger / 365) + " คน/วัน · " + fmt1(reach) + "% ของจุดคุ้มทุน");
    }

    /* ---------- ผู้โดยสารจริง vs ผู้โดยสารที่ต้องการ (คน/วัน) แยกสาย ---------- */
    const PAX_LINES = [
        { id: "Total", th: "รวม", en: "Total" },
        { id: "North", th: "สายเหนือ", en: "North Line" },
        { id: "West",  th: "สายตะวันตก", en: "West Line" }
    ];

    function renderPax(set, focus) {
        PAX_LINES.forEach(L => renderPaxLine(L, set, focus));
    }

    function renderPaxLine(L, set, focus) {
        const A = "paxActual" + L.id, T = "paxTarget" + L.id;
        const colA = "PaxActualPerDay_" + L.id, colT = "PaxTargetPerDay_" + L.id;
        const p = "pax" + L.id;                               // ไอดีองค์ประกอบในหน้า
        const hasActual = set.some(d => d[A] != null);
        const hasTarget = set.some(d => d[T] != null);

        $(p + "Box").parentElement.classList.toggle("is-empty", !hasActual && !hasTarget);
        $(p + "Box").hidden = !hasActual && !hasTarget;

        if (hasActual || hasTarget) {
            ChartTools.create(p + "Chart", {
                type: "bar",
                data: {
                    labels: yearLabels(set),
                    datasets: [
                        {
                            label: "ผู้โดยสารจริง",
                            data: set.map(d => d[A]),
                            ctKey: "paxActual", ctKind: "bar", ctUnit: "คน/วัน", ctFmt: fmt0,
                            ctEn: "Actual Passengers per Day · " + L.en, ctColor: COLOR.passenger
                        },
                        {
                            label: "ผู้โดยสารที่ต้องการ",
                            data: set.map(d => d[T]),
                            ctKey: "paxTarget", ctKind: "line", ctUnit: "คน/วัน", ctFmt: fmt0,
                            ctEn: "Target Passengers per Day · " + L.en, ctColor: COLOR.cost
                        }
                    ]
                },
                options: baseOptions({ legend: true, labels: true, labelFmt: fmt0, yTitle: "คน/วัน", hideLabelsOnSmall: true })
            }, {
                title: "ผู้โดยสารจริงเทียบกับที่ต้องการ " + L.th,
                autoStyle: true,
                autoZero: true,
                labelFormat: fmt0
            });
        }

        // แผงด้านขวา: ทำได้กี่ % ของที่ต้องการ
        const missing = [];
        if (!hasActual) missing.push(colA);
        if (!hasTarget) missing.push(colT);
        const howTo = '<p class="rec-note">เพิ่มคอลัมน์ ' + missing.map(m => "<b>" + m + "</b>").join(" และ ") +
            " (คน/วัน) ในชีต <b>dashboard_cost</b> ของไฟล์ data/cost-data.xlsx แล้วกรอกตัวเลขของแต่ละปีงบประมาณ " +
            "กราฟจะแสดงเองหลังรีเฟรช</p>";

        $(p + "Panel").innerHTML = hasActual && hasTarget
            ? "<h3>ผู้โดยสารจริงได้กี่ % ของที่ต้องการ</h3>" +
              '<ul class="rec-bars">' +
              set.map(d => {
                  const r = d[A] && d[T] ? d[A] / d[T] : null;
                  return '<li class="' + (d === focus ? "is-focus" : "") + '"><span>' + d.fiscalYear + "</span>" +
                      '<div class="rec-track"><div style="width:' + (r == null ? 0 : Math.min(100, r * 100)).toFixed(1) + '%"></div></div>' +
                      "<b>" + (r == null ? "–" : fmt1(r * 100) + "%") + "</b></li>";
              }).join("") +
              "</ul>" +
              '<p class="rec-note">100% = ผู้โดยสารจริงถึงเป้าที่ต้องการ · “–” = ปีนั้นยังไม่ได้กรอกข้อมูลครบ</p>'
            : "<h3>ยังไม่มีข้อมูลครบสำหรับ" + (L.id === "Total" ? "ผู้โดยสารรวม" : L.th) + "</h3>" + howTo;

        const gap = focus[A] != null && focus[T] != null ? focus[T] - focus[A] : null;
        const ratio = gap != null ? focus[A] / focus[T] * 100 : null;

        $(p + "Facts").innerHTML =
            fact("ผู้โดยสารจริง ปีงบ " + focus.fiscalYear,
                focus[A] != null ? fmt0(focus[A]) + " คน/วัน" : "ยังไม่ได้กรอก",
                "คอลัมน์ " + colA) +
            fact("ผู้โดยสารที่ต้องการ",
                focus[T] != null ? fmt0(focus[T]) + " คน/วัน" : "ยังไม่ได้กรอก",
                "คอลัมน์ " + colT) +
            fact(gap == null ? "ส่วนต่าง" : gap > 0 ? "ยังขาดอีก" : "เกินเป้า",
                gap == null ? "–" : fmt0(Math.abs(gap)) + " คน/วัน", "เป้า − จริง") +
            fact("ทำได้ตามเป้า", ratio == null ? "–" : fmt1(ratio) + "%", "ผู้โดยสารจริง ÷ ที่ต้องการ");
    }

    function fact(label, value, note) {
        return '<div class="fact"><span>' + label + "</span><strong>" + value + "</strong>" +
            (note ? "<small>" + note + "</small>" : "") + "</div>";
    }

    /* =========================================================
       กราฟอิสระ — เลือกข้อมูลจาก Excel มาสร้างกราฟเองได้ทุกคอลัมน์
       • เพิ่ม/ลบข้อมูลได้อิสระ (จำค่าที่เลือกไว้ในเครื่อง)
       • แต่ละชุดเลือกชนิด แท่ง/เส้น/พื้นที่ สี และแกนซ้าย/ขวาได้ในปุ่ม "ปรับแต่งกราฟ"
       • หน่วยที่ต่างกัน (ล้านบาท กับ บาท/ตู้/กม.) แยกเป็นแกนซ้าย/ขวาให้อัตโนมัติ
    ========================================================= */

    /* รายการข้อมูลที่เลือกได้ = คอลัมน์ในชีต dashboard_cost + ค่าที่คำนวณ + รายการย่อยในชีต dashboard_cost_detail */
    function buildFreeCatalog() {
        const G1 = "ต้นทุนหมวดหลัก";
        const G2 = "การใช้งานและผู้โดยสาร";
        const G3 = "ต้นทุนต่อหน่วย";
        const G4 = "รายได้และการคืนทุน";

        const list = [
            { key: "total",           group: G1, th: "ต้นทุนรวม",       en: "Total Cost",       unit: "ล้านบาท", kind: "bar",  color: "#c8102e", get: d => d.total / 1e6,           fmt: fmt1 },
            { key: "staffCost",       group: G1, th: "ต้นทุนบุคลากร",   en: "Staff Cost",       unit: "ล้านบาท", kind: "bar",  color: "#8f0a20", get: d => d.staffCost / 1e6,       fmt: fmt1 },
            { key: "energyCost",      group: G1, th: "ต้นทุนพลังงาน",   en: "Energy Cost",      unit: "ล้านบาท", kind: "bar",  color: "#eda100", get: d => d.energyCost / 1e6,      fmt: fmt1 },
            { key: "maintenanceCost", group: G1, th: "ต้นทุนซ่อมบำรุง", en: "Maintenance Cost", unit: "ล้านบาท", kind: "bar",  color: "#2a78d6", get: d => d.maintenanceCost / 1e6, fmt: fmt1 },
            { key: "indirectCost",    group: G1, th: "ต้นทุนอื่น ๆ",    en: "Indirect Cost",    unit: "ล้านบาท", kind: "bar",  color: "#e87ba4", get: d => d.indirectCost / 1e6,    fmt: fmt1 },

            { key: "carKm",     group: G2, th: "ระยะทางเดินรถ", en: "Car-Km",     unit: "ล้านตู้-กม.", kind: "line", color: "#1baf7a", get: d => d.carKm / 1e6,     fmt: fmt2 },
            { key: "passenger", group: G2, th: "ผู้โดยสาร",     en: "Passengers", unit: "ล้านคน",      kind: "line", color: "#6250d6", get: d => d.passenger / 1e6, fmt: fmt2 },
            { key: "paxActualTotal", group: G2, th: "ผู้โดยสารจริง รวม (ต่อวัน)",       en: "Actual Passengers per Day · Total", unit: "คน/วัน", kind: "line", color: "#6250d6", get: d => d.paxActualTotal, fmt: fmt0 },
            { key: "paxTargetTotal", group: G2, th: "ผู้โดยสารที่ต้องการ รวม (ต่อวัน)", en: "Target Passengers per Day · Total", unit: "คน/วัน", kind: "line", color: "#c8102e", get: d => d.paxTargetTotal, fmt: fmt0 },
            { key: "paxActualNorth", group: G2, th: "ผู้โดยสารจริง สายเหนือ (ต่อวัน)",       en: "Actual Passengers per Day · North", unit: "คน/วัน", kind: "line", color: "#2a78d6", get: d => d.paxActualNorth, fmt: fmt0 },
            { key: "paxTargetNorth", group: G2, th: "ผู้โดยสารที่ต้องการ สายเหนือ (ต่อวัน)", en: "Target Passengers per Day · North", unit: "คน/วัน", kind: "line", color: "#a1121b", get: d => d.paxTargetNorth, fmt: fmt0 },
            { key: "paxActualWest",  group: G2, th: "ผู้โดยสารจริง สายตะวันตก (ต่อวัน)",    en: "Actual Passengers per Day · West",  unit: "คน/วัน", kind: "line", color: "#1d9a6c", get: d => d.paxActualWest,  fmt: fmt0 },
            { key: "paxTargetWest",  group: G2, th: "ผู้โดยสารที่ต้องการ สายตะวันตก (ต่อวัน)", en: "Target Passengers per Day · West",  unit: "คน/วัน", kind: "line", color: "#e08a00", get: d => d.paxTargetWest,  fmt: fmt0 },

            { key: "costPerCarKm",     group: G3, th: "ต้นทุนการเดินรถ",   en: "Operating Cost per Car.Km", unit: "บาท/ตู้/กม.", kind: "line", color: "#0e9aa7", get: d => d.costPerCarKm,     fmt: fmt2 },
            { key: "costPerPassenger", group: G3, th: "ต้นทุนต่อผู้โดยสาร", en: "Cost per Passenger",        unit: "บาท/คน",       kind: "line", color: "#374151", get: d => d.costPerPassenger, fmt: fmt2 },

            { key: "avgFare",  group: G4, th: "ค่าโดยสารเฉลี่ย",             en: "Average Fare",           unit: "บาท", kind: "line", color: "#c2410c", get: d => d.avgFare,           fmt: fmt2 },
            { key: "revenue",  group: G4, th: "รายได้ค่าโดยสาร (ประมาณการ)", en: "Estimated Fare Revenue", unit: "ล้านบาท",    kind: "bar",  color: "#15803d", get: d => d.revenue / 1e6,     fmt: fmt1 },
            { key: "recovery", group: G4, th: "คืนทุนจากค่าโดยสาร",         en: "Fare Recovery Ratio",    unit: "%",           kind: "line", color: "#0369a1", get: d => d.recovery * 100,    fmt: fmt1 }
        ];

        // รายการย่อยจากชีต dashboard_cost_detail (รวมยอดของรายการเดียวกันในปีเดียวกัน)
        const groupTh = {};
        GROUPS.forEach(g => { groupTh[g.group] = g.th; });

        const sums = {};
        const order = [];

        (window.costDetail || []).forEach(r => {
            if (!r.CostItem) return;

            const key = "d:" + r.CostGroup + "|" + r.CostItem;

            if (!sums[key]) {
                sums[key] = { group: r.CostGroup, item: r.CostItem, byYear: {} };
                order.push(key);
            }

            sums[key].byYear[r.FiscalYear] = (sums[key].byYear[r.FiscalYear] || 0) + r.Amount;
        });

        order.forEach((key, i) => {
            const x = sums[key];
            const hasAny = Object.keys(x.byYear).some(y => x.byYear[y]);
            if (!hasAny) return;

            list.push({
                key: key,
                group: "รายการย่อย · " + (groupTh[x.group] || x.group),
                th: shortName(x.item),
                full: x.item,
                en: "",
                unit: "ล้านบาท",
                kind: "bar",
                color: FREE_COLORS[i % FREE_COLORS.length],
                get: d => x.byYear[d.fiscalYear] ? x.byYear[d.fiscalYear] / 1e6 : null,
                fmt: fmt2
            });
        });

        return list;
    }

    function loadFreeSel() {
        let saved = null;

        try {
            saved = JSON.parse(localStorage.getItem(FREE_STORE));
        } catch (e) { /* ใช้ค่าเริ่มต้น */ }

        const ok = k => freeCatalog.some(e => e.key === k);

        if (saved && saved.mode === "index") freeMode = "index";

        if (saved && Array.isArray(saved.keys)) {
            const keys = saved.keys.filter(ok).slice(0, FREE_MAX);
            if (keys.length || saved.keys.length === 0) return keys;
        }

        return FREE_DEFAULT.filter(ok);
    }

    function saveFreeSel() {
        try {
            localStorage.setItem(FREE_STORE, JSON.stringify({ keys: freeSel, mode: freeMode }));
        } catch (e) { /* บันทึกไม่ได้ก็ยังใช้งานต่อได้ */ }
    }

    const FREE_PRESETS = [
        { label: "ต้นทุนรวม + ผู้โดยสาร", keys: ["total", "passenger"] },
        { label: "ต้นทุน vs รายได้",       keys: ["total", "revenue"] },
        { label: "ต้นทุนรวม + คืนทุน %",   keys: ["total", "recovery"] },
        { label: "ทุกหมวดต้นทุน",          keys: ["staffCost", "energyCost", "maintenanceCost", "indirectCost"] },
        { label: "ต้นทุนต่อหน่วย",         keys: ["costPerCarKm", "costPerPassenger"] },
        { label: "ล้างทั้งหมด",            keys: [], clear: true }
    ];

    function initFree() {
        freeCatalog = buildFreeCatalog();
        freeSel = loadFreeSel();

        $("freePresets").innerHTML = FREE_PRESETS.map((p, i) =>
            '<button type="button" data-preset="' + i + '"' + (p.clear ? ' class="is-clear"' : "") + ">" + esc(p.label) + "</button>"
        ).join("");

        // รายการให้เลือก (แบ่งกลุ่ม; รายการย่อยพับไว้)
        const groups = [];
        freeCatalog.forEach(e => { if (groups.indexOf(e.group) === -1) groups.push(e.group); });

        $("freeGroups").innerHTML = groups.map(g => {
            const items = freeCatalog.filter(e => e.group === g);
            const pills = items.map(e =>
                '<button type="button" class="fp" data-key="' + esc(e.key) + '" aria-pressed="false" ' +
                'data-q="' + esc((e.th + " " + e.en + " " + (e.full || "") + " " + e.unit + " " + e.group).toLowerCase()) + '" ' +
                'title="' + esc((e.full || e.th) + (e.en ? " · " + e.en : "")) + '">' +
                '<i style="background:' + e.color + '"></i><span>' + esc(e.th) + "</span><small>" + esc(e.unit) + "</small></button>"
            ).join("");

            return g.indexOf("รายการย่อย") === 0
                ? '<div class="fg"><details><summary>' + esc(g) + " <small>(" + items.length + ' รายการ)</small></summary><div class="fp-wrap">' + pills + "</div></details></div>"
                : '<div class="fg"><h4>' + esc(g) + '</h4><div class="fp-wrap">' + pills + "</div></div>";
        }).join("");

        // เหตุการณ์ (ผูกครั้งเดียว)
        $("freeAdd").addEventListener("click", () => {
            const open = $("freePicker").hidden;
            $("freePicker").hidden = !open;
            $("freeAdd").setAttribute("aria-expanded", String(open));
            $("freeAddText").textContent = open ? "ซ่อนรายการข้อมูล" : "เพิ่ม / ลบข้อมูล";
            if (open) $("freeSearch").focus({ preventScroll: true });
        });

        $("freeGroups").addEventListener("click", e => {
            const b = e.target.closest(".fp");
            if (b) toggleFree(b.getAttribute("data-key"));
        });

        $("freeChips").addEventListener("click", e => {
            const b = e.target.closest(".fc-x");
            if (b) toggleFree(b.getAttribute("data-key"), false);
        });

        $("freePresets").addEventListener("click", e => {
            const b = e.target.closest("button[data-preset]");
            if (!b) return;
            freeSel = FREE_PRESETS[Number(b.getAttribute("data-preset"))].keys.filter(k => freeCatalog.some(c => c.key === k));
            setFreeHint("");
            changedFree();
        });

        $("freeSearch").addEventListener("input", filterFreePicker);

        $("freeMode").addEventListener("click", e => {
            const b = e.target.closest("button[data-mode]");
            if (!b) return;
            freeMode = b.getAttribute("data-mode");
            changedFree();
        });
    }

    /* แกนซ้าย/ขวาอัตโนมัติ: หน่วยเดียวกันอยู่แกนเดียวกัน หน่วยที่ 2 ไปแกนขวา
       หน่วยที่ 3 เป็นต้นไปเลือกแกนที่ตัวเลขมีขนาดใกล้เคียงกว่า (ผู้ใช้เปลี่ยนเองได้ในปุ่ม "ปรับแต่งกราฟ") */
    function assignFreeAxes(entries, set) {
        const out = {};
        let left = null;
        let right = null;

        entries.forEach(e => {
            const vals = set.map(e.get).filter(v => v != null && isFinite(v));
            const mag = Math.max.apply(null, vals.map(Math.abs).concat([1e-9]));

            if (!left) { left = { unit: e.unit, mag: mag }; out[e.key] = "y"; return; }

            if (e.unit === left.unit) { left.mag = Math.max(left.mag, mag); out[e.key] = "y"; return; }

            if (!right) { right = { unit: e.unit, mag: mag }; out[e.key] = "y1"; return; }

            if (e.unit === right.unit) { right.mag = Math.max(right.mag, mag); out[e.key] = "y1"; return; }

            const dl = Math.abs(Math.log(mag / left.mag));
            const dr = Math.abs(Math.log(mag / right.mag));
            out[e.key] = dl <= dr ? "y" : "y1";
        });

        return out;
    }

    /* ค่าเทียบปีแรกที่มีข้อมูล = 100 */
    function toIndex(values) {
        const base = values.find(v => v != null && isFinite(v) && v !== 0);
        return values.map(v => (v == null || !base ? null : v / base * 100));
    }

    function setFreeHint(text, warn) {
        const h = $("freeHint");
        h.textContent = text || "";
        h.classList.toggle("is-warn", !!warn);
    }

    function toggleFree(key, forceOn) {
        const at = freeSel.indexOf(key);
        const on = forceOn === undefined ? at === -1 : forceOn;

        if (on && at === -1) {
            if (freeSel.length >= FREE_MAX) {
                setFreeHint("เลือกได้สูงสุด " + FREE_MAX + " ชุดต่อกราฟ เพื่อให้อ่านออก ลองลบบางชุดออกก่อน", true);
                return;
            }
            freeSel.push(key);
        } else if (!on && at !== -1) {
            freeSel.splice(at, 1);
        }

        setFreeHint("");
        changedFree();
    }

    function changedFree() {
        saveFreeSel();
        renderFree(freeSet);
    }

    function filterFreePicker() {
        const q = $("freeSearch").value.trim().toLowerCase();

        document.querySelectorAll("#freeGroups .fg").forEach(g => {
            let any = false;

            g.querySelectorAll(".fp").forEach(p => {
                const show = !q || p.getAttribute("data-q").indexOf(q) !== -1;
                p.hidden = !show;
                if (show) any = true;
            });

            g.hidden = !any;

            const det = g.querySelector("details");
            if (det && q) det.open = any;
        });
    }

    function freeColorOf(chart, key) {
        const i = chart ? chart.data.datasets.findIndex(d => d.ctKey === key) : -1;
        const entry = freeCatalog.find(e => e.key === key);

        if (i === -1) return entry ? entry.color : "#c8102e";

        const ds = chart.data.datasets[i];
        const isLine = (ds.type || chart.config.type) === "line";
        return ChartTools.toHex(isLine ? ds.borderColor : ds.backgroundColor, entry && entry.color);
    }

    /* ชิปแสดงข้อมูลที่เลือก — สีดึงจากกราฟจริง เพื่อให้ตรงกับที่ผู้ใช้ปรับในแผง "ปรับแต่งกราฟ" */
    function renderFreeChips(chart) {
        const entries = freeSel.map(k => freeCatalog.find(e => e.key === k)).filter(Boolean);

        $("freeChips").innerHTML = entries.length
            ? entries.map(e =>
                '<span class="fc"><i style="background:' + freeColorOf(chart, e.key) + '"></i>' +
                '<span class="fc-name" title="' + esc(e.full || e.th) + '">' + esc(e.th) + "<small>" + esc(e.unit) + "</small></span>" +
                '<button type="button" class="fc-x" data-key="' + esc(e.key) + '" aria-label="ลบ ' + esc(e.th) + '">✕</button></span>'
            ).join("")
            : '<span class="fb-none">ยังไม่ได้เลือกข้อมูล</span>';

        document.querySelectorAll("#freeGroups .fp").forEach(p => {
            p.setAttribute("aria-pressed", String(freeSel.indexOf(p.getAttribute("data-key")) !== -1));
        });
    }

    function renderFree(set) {
        freeSet = set;

        const entries = freeSel.map(k => freeCatalog.find(e => e.key === k)).filter(Boolean);
        const first = set[0].fiscalYear;
        const last = set[set.length - 1].fiscalYear;

        $("freeNote").textContent = "เลือกข้อมูลจาก Excel มาสร้างกราฟเองได้ทุกคอลัมน์ · ปีงบประมาณ " +
            first + (last !== first ? "–" + last : "") + " ตามช่วงที่เลือกด้านบน";

        if (!entries.length) {
            const old = window.ChartTools ? ChartTools.get("freeChart") : null;
            if (old) old.destroy();

            $("freeBox").hidden = true;
            $("freeEmpty").hidden = false;
            renderFreeChips(null);
            return;
        }

        $("freeBox").hidden = false;
        $("freeEmpty").hidden = true;

        const asIndex = freeMode === "index";
        const axes = assignFreeAxes(entries, set);

        document.querySelectorAll("#freeMode button").forEach(b => {
            b.classList.toggle("is-on", b.getAttribute("data-mode") === freeMode);
        });

        $("freeModeNote").textContent = asIndex
            ? "ทุกชุดเริ่มที่ 100 ในปีแรก เทียบการเติบโตกันได้แม้หน่วยต่างกัน"
            : (new Set(entries.map(e => e.unit)).size >= 3
                ? "มีหลายหน่วยในกราฟเดียว ลองเลือก “ดัชนี (ปีแรก = 100)” จะเทียบการเติบโตได้ชัดขึ้น"
                : "หน่วยต่างกันจะแยกแกนซ้าย/ขวาให้เอง");

        ChartTools.create("freeChart", {
            type: "bar",
            data: {
                labels: yearLabels(set),
                datasets: entries.map(e => ({
                    label: asIndex ? e.th : e.th + " (" + e.unit + ")",
                    data: asIndex ? toIndex(set.map(e.get)) : set.map(e.get),
                    ctKey: e.key,
                    ctKind: asIndex ? "line" : e.kind,
                    ctUnit: asIndex ? "ดัชนี (ปีแรก = 100)" : e.unit,
                    ctFmt: asIndex ? fmt1 : e.fmt,
                    ctEn: e.en || undefined,
                    ctColor: e.color,
                    yAxisID: asIndex ? "y" : axes[e.key]
                }))
            },
            options: baseOptions({ legend: true, labels: false, yTitle: "" })
        }, {
            id: "freeChart",
            title: "กราฟอิสระ",
            initialKind: "bar",
            autoStyle: true,
            dualAxis: true,
            autoZero: true,
            stackable: true,
            stacked: false,
            labelFormat: fmt1,
            onChange: renderFreeChips
        });
    }

    /* =========================================================
       เจาะลึกรายการต้นทุน
    ========================================================= */

    function renderDrill(sel, focus) {
        // เรียกจาก render() จะส่ง sel/focus มา, เรียกจากอีเวนต์ในแผงนี้จะไม่ส่ง
        if (!sel) {
            sel = selectedYears();
            focus = sel[sel.length - 1];
        }

        if (state.drillYear == null || !valid.some(d => d.fiscalYear === state.drillYear)) {
            state.drillYear = focus.fiscalYear;
        }

        $("drillYear").innerHTML = valid.map(d =>
            '<option value="' + d.fiscalYear + '"' + (d.fiscalYear === state.drillYear ? " selected" : "") +
            ">ปีงบ " + d.fiscalYear + "</option>"
        ).join("");

        // แท็บหมวด
        const tabs = [{ group: "all", label: "ทุกหมวด", color: COLOR.cost }]
            .concat(GROUPS.map(g => ({ group: g.group, label: g.th, color: g.color })));

        $("drillTabs").innerHTML = tabs.map(t =>
            '<button type="button" role="tab" class="tab' + (t.group === state.drillGroup ? " is-on" : "") +
            '" data-group="' + t.group + '" aria-selected="' + (t.group === state.drillGroup) + '">' +
            (t.group === "all" ? "" : '<i style="background:' + t.color + '"></i>') + t.label + "</button>"
        ).join("");

        $("drillTabs").querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => {
            state.drillGroup = b.getAttribute("data-group");
            state.showAllRank = false;
            renderDrill();
        }));

        const cur = valid.find(d => d.fiscalYear === state.drillYear);
        const prev = previousOf(cur);
        const groupColor = {};
        GROUPS.forEach(g => { groupColor[g.group] = g.color; });

        /* --- รายการสูงสุด --- */
        let rows = detailRows(cur.fiscalYear)
            .filter(r => state.drillGroup === "all" || r.CostGroup === state.drillGroup)
            .sort((a, b) => b.Amount - a.Amount);

        const prevMap = {};
        if (prev) {
            detailRows(prev.fiscalYear).forEach(r => { prevMap[r.CostGroup + "|" + r.CostItem] = r.Amount; });
        }

        const max = rows.length ? rows[0].Amount : 1;
        const shown = state.showAllRank ? rows : rows.slice(0, TOP_N);

        $("rankList").innerHTML = shown.length
            ? shown.map((r, i) => {
                const p = prevMap[r.CostGroup + "|" + r.CostItem];
                const chip = prev && p ? deltaChip(pctChange(r.Amount, p), "down") : "";

                return '<li><span class="rk-n">' + (i + 1) + "</span>" +
                    '<div class="rk-body">' +
                        '<div class="rk-line"><span class="rk-name" title="' + esc(r.CostItem) + '">' + esc(r.CostItem) + "</span>" +
                        '<span class="rk-amt">' + fmtM(r.Amount) + "</span></div>" +
                        '<div class="rk-track"><div style="width:' + (r.Amount / max * 100).toFixed(1) +
                            "%;background:" + (groupColor[r.CostGroup] || COLOR.cost) + '"></div></div>' +
                        '<div class="rk-meta"><span>' + fmt1(r.Amount / cur.total * 100) + "% ของต้นทุนรวม</span>" + chip + "</div>" +
                    "</div></li>";
            }).join("")
            : '<li class="empty">ไม่มีข้อมูลรายการต้นทุนของปีนี้ในชีต dashboard_cost_detail</li>';

        const more = $("rankMore");
        if (rows.length > TOP_N) {
            more.hidden = false;
            more.textContent = state.showAllRank ? "แสดงเฉพาะ " + TOP_N + " อันดับแรก" : "แสดงทั้งหมด " + rows.length + " รายการ";
        } else {
            more.hidden = true;
        }

        /* --- เปลี่ยนแปลงมากที่สุด --- */
        const box = $("movers");

        if (!prev) {
            $("moversTitle").textContent = "เปลี่ยนแปลงมากที่สุด";
            box.innerHTML = '<p class="empty">ปีนี้เป็นปีแรกที่มีข้อมูล จึงยังไม่มีปีก่อนหน้าให้เปรียบเทียบ</p>';
            return;
        }

        $("moversTitle").textContent = "เปลี่ยนแปลงมากที่สุด เทียบปีงบ " + prev.fiscalYear;

        const changes = itemChanges(cur.fiscalYear, prev.fiscalYear, state.drillGroup)
            .filter(x => Math.abs(x.diff) >= 5e4);

        const ups = changes.filter(x => x.diff > 0).sort((a, b) => b.diff - a.diff).slice(0, 5);
        const downs = changes.filter(x => x.diff < 0).sort((a, b) => a.diff - b.diff).slice(0, 5);
        const maxDiff = Math.max.apply(null, changes.map(x => Math.abs(x.diff)).concat([1]));

        const list = (items, cls, sign) => items.length
            ? items.map(x =>
                '<li class="' + cls + '"><div class="mv-line"><span class="mv-name" title="' + esc(x.item) + '">' + esc(x.item) + "</span>" +
                '<b>' + sign + fmtM(Math.abs(x.diff)) + "</b></div>" +
                '<div class="mv-track"><div style="width:' + (Math.abs(x.diff) / maxDiff * 100).toFixed(1) + '%"></div></div>' +
                "<small>" + fmtM(x.prev) + " → " + fmtM(x.cur) + " ล้านบาท</small></li>"
            ).join("")
            : '<li class="empty">ไม่มีรายการ</li>';

        box.innerHTML =
            '<div class="mv-col"><h4><i class="up">▲</i> เพิ่มขึ้นมากสุด <small>ล้านบาท</small></h4><ul>' + list(ups, "up", "+") + "</ul></div>" +
            '<div class="mv-col"><h4><i class="down">▼</i> ลดลงมากสุด <small>ล้านบาท</small></h4><ul>' + list(downs, "down", "−") + "</ul></div>";
    }

    /* =========================================================
       ตาราง
    ========================================================= */

    const TABLE_COLS = [
        { label: "ปีงบประมาณ", cls: "sticky" },
        { label: "บุคลากร" },
        { label: "พลังงาน" },
        { label: "ซ่อมบำรุง" },
        { label: "อื่น ๆ" },
        { label: "ต้นทุนรวม", cls: "strong" },
        { label: "เปลี่ยนจากปีก่อน" },
        { label: "Car-Km" },
        { label: "ผู้โดยสาร (คน)" },
        { label: "บาท / Car-Km" },
        { label: "บาท / ผู้โดยสาร" },
        { label: "ค่าโดยสารเฉลี่ย" },
        { label: "รายได้ประมาณการ" },
        { label: "คืนทุน" }
    ];

    function renderTable(sel) {
        $("tableHead").innerHTML = "<tr>" + TABLE_COLS.map(c =>
            '<th class="' + (c.cls || "") + '">' + c.label + "</th>"
        ).join("") + "</tr>";

        $("tableBody").innerHTML = sel.map(d => {
            const p = previousOf(d);

            return "<tr>" +
                '<td class="sticky">ปีงบ ' + d.fiscalYear + "</td>" +
                GROUPS.map(g => "<td>" + fmtM(d[g.key]) + "</td>").join("") +
                '<td class="strong">' + fmtM(d.total) + "</td>" +
                "<td>" + (p ? deltaChip(pctChange(d.total, p.total), "down") : "–") + "</td>" +
                "<td>" + fmt0(d.carKm) + "</td>" +
                "<td>" + fmt0(d.passenger) + "</td>" +
                "<td>" + fmt2(d.costPerCarKm) + "</td>" +
                "<td>" + fmt2(d.costPerPassenger) + "</td>" +
                "<td>" + fmt2(d.avgFare) + "</td>" +
                "<td>" + fmtM(d.revenue) + "</td>" +
                "<td>" + fmt1(d.recovery * 100) + "%</td></tr>";
        }).join("");

        if (sel.length < 2) {
            $("tableFoot").innerHTML = "";
            return;
        }

        const n = sel.length;
        const sum = fn => sumBy(sel, fn);

        const totalCost = sum(d => d.total);
        const totalKm = sum(d => d.carKm);
        const totalPax = sum(d => d.passenger);
        const totalRev = sum(d => d.revenue);

        $("tableFoot").innerHTML =
            "<tr>" +
                '<td class="sticky">รวม</td>' +
                GROUPS.map(g => "<td>" + fmtM(sum(d => d[g.key])) + "</td>").join("") +
                '<td class="strong">' + fmtM(totalCost) + "</td><td></td>" +
                "<td>" + fmt0(totalKm) + "</td><td>" + fmt0(totalPax) + "</td>" +
                "<td>" + fmt2(totalKm ? totalCost / totalKm : 0) + "</td>" +
                "<td>" + fmt2(totalPax ? totalCost / totalPax : 0) + "</td>" +
                "<td>" + fmt2(totalPax ? totalRev / totalPax : 0) + "</td>" +
                "<td>" + fmtM(totalRev) + "</td>" +
                "<td>" + fmt1(totalCost ? totalRev / totalCost * 100 : 0) + "%</td>" +
            "</tr>" +
            "<tr>" +
                '<td class="sticky">เฉลี่ยต่อปี</td>' +
                GROUPS.map(g => "<td>" + fmtM(sum(d => d[g.key]) / n) + "</td>").join("") +
                '<td class="strong">' + fmtM(totalCost / n) + "</td><td></td>" +
                "<td>" + fmt0(totalKm / n) + "</td><td>" + fmt0(totalPax / n) + "</td>" +
                "<td></td><td></td><td></td>" +
                "<td>" + fmtM(totalRev / n) + "</td><td></td>" +
            "</tr>";
    }

    /* =========================================================
       ส่งออก Excel
    ========================================================= */

    function exportExcel() {
        if (typeof XLSX === "undefined") {
            alert("ไม่พบไลบรารี XLSX จึงส่งออกไม่ได้");
            return;
        }

        const sel = selectedYears();

        const summary = [[
            "ปีงบประมาณ",
            "ต้นทุนบุคลากร (บาท)", "ต้นทุนพลังงาน (บาท)", "ต้นทุนซ่อมบำรุง (บาท)", "ต้นทุนอื่น ๆ (บาท)",
            "ต้นทุนรวม (บาท)", "เปลี่ยนจากปีก่อน (%)",
            "Car-Km", "ผู้โดยสาร (คน)", "บาทต่อ Car-Km", "บาทต่อผู้โดยสาร",
            "ค่าโดยสารเฉลี่ย (บาท)", "รายได้ประมาณการ (บาท)", "คืนทุน (%)",
            "ผู้โดยสารจริง สายเหนือ (คน/วัน)", "ผู้โดยสารที่ต้องการ สายเหนือ (คน/วัน)",
            "ผู้โดยสารจริง สายตะวันตก (คน/วัน)", "ผู้โดยสารที่ต้องการ สายตะวันตก (คน/วัน)", "ผู้โดยสารจริง รวม (คน/วัน)", "ผู้โดยสารที่ต้องการ รวม (คน/วัน)"
        ]];

        sel.forEach(d => {
            const p = previousOf(d);
            summary.push([
                d.fiscalYear,
                d.staffCost, d.energyCost, d.maintenanceCost, d.indirectCost,
                d.total, p ? Number(pctChange(d.total, p.total).toFixed(2)) : "",
                d.carKm, d.passenger,
                Number(d.costPerCarKm.toFixed(2)), Number(d.costPerPassenger.toFixed(2)),
                d.avgFare, Number(d.revenue.toFixed(2)), Number((d.recovery * 100).toFixed(2)),
                ...["paxActualNorth", "paxTargetNorth", "paxActualWest", "paxTargetWest", "paxActualTotal", "paxTargetTotal"].map(k => d[k] != null ? Math.round(d[k]) : "")
            ]);
        });

        const detail = [["ปีงบประมาณ", "หมวด", "รายการ", "จำนวนเงิน (บาท)"]];
        const years = sel.map(d => d.fiscalYear);

        (window.costDetail || [])
            .filter(r => years.indexOf(r.FiscalYear) !== -1)
            .forEach(r => detail.push([r.FiscalYear, r.CostGroup, r.CostItem, r.Amount]));

        const wsSummary = XLSX.utils.aoa_to_sheet(summary);
        wsSummary["!cols"] = summary[0].map((h, i) => ({ wch: i === 0 ? 12 : 22 }));

        const wsDetail = XLSX.utils.aoa_to_sheet(detail);
        wsDetail["!cols"] = [{ wch: 12 }, { wch: 14 }, { wch: 70 }, { wch: 20 }];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, wsSummary, "สรุปรายปี");
        XLSX.utils.book_append_sheet(wb, wsDetail, "รายการต้นทุน");

        XLSX.writeFile(wb, "Redline_cost_" + years[0] + (years.length > 1 ? "-" + years[years.length - 1] : "") + ".xlsx");
    }

})();
