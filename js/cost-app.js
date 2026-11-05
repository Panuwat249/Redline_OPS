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
        { key: "indirectCost",    group: "Indirect",    th: "ทางอ้อม",   en: "Indirect",    color: "#e87ba4" }
    ];

    const COLOR = {
        cost: "#c8102e",
        revenue: "#1baf7a",
        carKm: "#eda100",
        passenger: "#2a78d6"
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
        renderUnit(trendSet);
        renderIndex(trendSet);
        renderRevenue(trendSet, focus);
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
                value: fmtM(focus.total),
                unit: "ล้านบาท",
                delta: prev ? pctChange(focus.total, prev.total) : null,
                good: "down",
                series: valid.map(d => d.total)
            },
            {
                label: "ต้นทุนต่อ Car-Km",
                value: fmt2(focus.costPerCarKm),
                unit: "บาท",
                delta: prev ? pctChange(focus.costPerCarKm, prev.costPerCarKm) : null,
                good: "down",
                series: valid.map(d => d.costPerCarKm)
            },
            {
                label: "ต้นทุนต่อผู้โดยสาร",
                value: fmt2(focus.costPerPassenger),
                unit: "บาท",
                delta: prev ? pctChange(focus.costPerPassenger, prev.costPerPassenger) : null,
                good: "down",
                series: valid.map(d => d.costPerPassenger)
            },
            {
                label: "คืนทุนจากค่าโดยสาร",
                value: fmt1(focus.recovery * 100),
                unit: "%",
                delta: prev ? (focus.recovery - prev.recovery) * 100 : null,
                deltaSuffix: " จุด",
                good: "up",
                series: valid.map(d => d.recovery)
            }
        ];

        $("kpiGrid").innerHTML = tiles.map(t =>
            '<article class="kpi">' +
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
                        label: ctx => " " + ctx.dataset.label + ": " + tipFmt(ctx.parsed.y) + (unit ? " " + unit : "")
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
        $("trendNote").textContent = showingAll
            ? "ผลรวมต้นทุน 4 หมวด หน่วย ล้านบาท · เลือกปีเดียวอยู่ จึงแสดงทุกปีเพื่อให้เห็นแนวโน้ม"
            : "ผลรวมต้นทุน 4 หมวด หน่วย ล้านบาท";

        ChartTools.create("trendChart", {
            type: "bar",
            data: {
                labels: yearLabels(set),
                datasets: [{ label: "ต้นทุนรวม", data: set.map(d => d.total / 1e6), ctColor: COLOR.cost }]
            },
            options: baseOptions({ legend: false, labels: true, labelFmt: fmt1, yTitle: "ล้านบาท" })
        }, {
            title: "ต้นทุนรวมรายปี",
            autoStyle: true,
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

    /* ---------- ต้นทุนต่อหน่วย ---------- */

    function renderUnit(set) {
        const opts = baseOptions({
            unit: "บาท",
            yTitle: "บาท",
            labels: true,
            labelFmt: fmt2,
            labelExtra: {
                // ป้ายตัวเลขสองเส้นอยู่ใกล้กัน → เส้นที่สูงกว่าวางบน เส้นที่ต่ำกว่าวางล่าง
                align: ctx => {
                    const other = ctx.chart.data.datasets.find((d, i) => i !== ctx.datasetIndex && !d.ctFixed);
                    const ov = other ? other.data[ctx.dataIndex] : -Infinity;
                    return ctx.dataset.data[ctx.dataIndex] >= ov ? "top" : "bottom";
                }
            }
        });

        ChartTools.create("unitChart", {
            type: "line",
            data: {
                labels: yearLabels(set),
                datasets: [
                    { label: "ต้นทุนต่อ Car-Km", data: set.map(d => d.costPerCarKm), ctColor: COLOR.cost },
                    { label: "ต้นทุนต่อผู้โดยสาร", data: set.map(d => d.costPerPassenger), ctColor: COLOR.passenger }
                ]
            },
            options: opts
        }, {
            title: "ต้นทุนต่อหน่วยบริการ",
            initialKind: "line",
            autoStyle: true,
            labelFormat: fmt2
        });
    }

    /* ---------- ดัชนีเติบโต ---------- */

    function renderIndex(set) {
        const base = set[0];
        const idx = (d, key) => base[key] ? d[key] / base[key] * 100 : 0;

        $("indexNote").textContent =
            "ดัชนีเทียบปีงบประมาณ " + base.fiscalYear + " = 100 · เส้นที่ชันกว่าคือโตเร็วกว่า";

        const lastOnly = ctx => ctx.dataIndex === ctx.dataset.data.length - 1;

        const opts = baseOptions({
            unit: "",
            beginAtZero: false,
            labels: true,
            labelFmt: v => fmt0(v),
            tipFmt: fmt0,
            labelExtra: {
                display: lastOnly,
                offset: 6,
                // เส้นที่ปลายทางใกล้กัน → เส้นที่สูงกว่าวางป้ายด้านบน เส้นที่ต่ำกว่าวางด้านล่าง
                align: ctx => {
                    const i = ctx.dataIndex;
                    const mine = ctx.dataset.data[i];
                    const higherCount = ctx.chart.data.datasets.filter((d, k) => k !== ctx.datasetIndex && d.data[i] > mine).length;
                    const total = ctx.chart.data.datasets.length;
                    return total > 1 && higherCount === total - 1 ? "bottom" : "top";
                }
            }
        });

        ChartTools.create("indexChart", {
            type: "line",
            data: {
                labels: yearLabels(set),
                datasets: [
                    { label: "ต้นทุนรวม", data: set.map(d => idx(d, "total")), ctColor: COLOR.cost },
                    { label: "ระยะทางเดินรถ (Car-Km)", data: set.map(d => idx(d, "carKm")), ctColor: COLOR.carKm },
                    { label: "ผู้โดยสาร", data: set.map(d => idx(d, "passenger")), ctColor: COLOR.passenger }
                ]
            },
            options: opts
        }, {
            title: "ดัชนีเติบโตเทียบปีฐาน",
            initialKind: "line",
            autoStyle: true,
            labelFormat: v => fmt0(v)
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
            fact("ค่าโดยสารเฉลี่ย ปีงบ " + focus.fiscalYear, fmt2(focus.avgFare) + " บาท/เที่ยว", "") +
            fact(gap > 0 ? "ส่วนต่าง (ต้นทุน − รายได้)" : "รายได้สูงกว่าต้นทุน", fmtM(Math.abs(gap)) + " ล้านบาท", "ประมาณการจากผู้โดยสาร × ค่าโดยสารเฉลี่ย") +
            fact("ผู้โดยสารที่ต้องมีเพื่อคุ้มทุน", fmt1(beMillions) + " ล้านคน/ปี", "≈ " + fmt0(beMillions * 1e6 / 365) + " คน/วัน") +
            fact("ผู้โดยสารจริง", fmt1(actualMillions) + " ล้านคน/ปี", "≈ " + fmt0(focus.passenger / 365) + " คน/วัน · " + fmt1(reach) + "% ของจุดคุ้มทุน");
    }

    function fact(label, value, note) {
        return '<div class="fact"><span>' + label + "</span><strong>" + value + "</strong>" +
            (note ? "<small>" + note + "</small>" : "") + "</div>";
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
        { label: "ทางอ้อม" },
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
            "ต้นทุนบุคลากร (บาท)", "ต้นทุนพลังงาน (บาท)", "ต้นทุนซ่อมบำรุง (บาท)", "ต้นทุนทางอ้อม (บาท)",
            "ต้นทุนรวม (บาท)", "เปลี่ยนจากปีก่อน (%)",
            "Car-Km", "ผู้โดยสาร (คน)", "บาทต่อ Car-Km", "บาทต่อผู้โดยสาร",
            "ค่าโดยสารเฉลี่ย (บาท)", "รายได้ประมาณการ (บาท)", "คืนทุน (%)"
        ]];

        sel.forEach(d => {
            const p = previousOf(d);
            summary.push([
                d.fiscalYear,
                d.staffCost, d.energyCost, d.maintenanceCost, d.indirectCost,
                d.total, p ? Number(pctChange(d.total, p.total).toFixed(2)) : "",
                d.carKm, d.passenger,
                Number(d.costPerCarKm.toFixed(2)), Number(d.costPerPassenger.toFixed(2)),
                d.avgFare, Number(d.revenue.toFixed(2)), Number((d.recovery * 100).toFixed(2))
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
