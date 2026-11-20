/* =========================================================
   chart-labels.js  –  จัดตำแหน่งตัวเลขบนกราฟ (ไม่ทับกัน)
   ---------------------------------------------------------
   ใช้ร่วมกับ chart-tools.js (ChartTools จะเรียกให้เอง)

   โหมดตำแหน่ง
     auto     ตามค่าตั้งต้นของกราฟนั้น ๆ (แต่ยังกันไม่ให้ทับกัน)
     top      อยู่บน   (ปลายแท่ง / เหนือจุดบนเส้น)
     center   อยู่กลาง (กลางแท่ง / บนจุด)
     bottom   อยู่ล่าง (ฐานแท่ง / ใต้จุด)
     callout  ลูกศรชี้ + ตัวเลขในกรอบ
     (กราฟวงกลม)  center = ในวง · outside = นอกวง · callout = ลูกศรชี้

   วิธีกันทับ: วางทีละป้าย เลือกตำแหน่งแรกที่ไม่ชนป้ายอื่น / จุดบนเส้น /
   คำอธิบายกราฟ และไม่ล้นพื้นที่ ถ้าไม่ได้จะขยับออกเป็นวงแล้วลากเส้นชี้กลับ
   ========================================================= */

(function () {
    "use strict";

    var PAD_X = 6;      // ระยะซ้ายขวาของกรอบตัวเลข
    var PAD_Y = 3;      // ระยะบนล่าง

    /* ---------- สี ---------- */

    function parseColor(c) {
        if (typeof c !== "string") return null;
        c = c.trim();
        var m = c.match(/^#([0-9a-f]{3})$/i);
        if (m) {
            var h = m[1];
            return { r: parseInt(h[0] + h[0], 16), g: parseInt(h[1] + h[1], 16), b: parseInt(h[2] + h[2], 16), a: 1 };
        }
        m = c.match(/^#([0-9a-f]{6})$/i);
        if (m) {
            return { r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4, 6), 16), a: 1 };
        }
        m = c.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?/i);
        if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] == null ? 1 : +m[4] };
        return null;
    }

    function lum(col) {
        var ch = [col.r, col.g, col.b].map(function (v) {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
    }

    function inkOn(fill, dark, light) {
        var c = parseColor(fill);
        if (!c || c.a < 0.5) return null;               // โปร่งใส/ไม่รู้สี: ให้ผู้เรียกตัดสินเอง
        return lum(c) > 0.34 ? dark : light;
    }

    function cssVar(name, fb) {
        try {
            var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
            return v || fb;
        } catch (e) { return fb; }
    }

    /* ---------- เรขาคณิต ---------- */

    function rect(cx, cy, w, h) {
        return { l: cx - w / 2, r: cx + w / 2, t: cy - h / 2, b: cy + h / 2 };
    }

    function overlapArea(a, b) {
        var w = Math.min(a.r, b.r) - Math.max(a.l, b.l);
        var h = Math.min(a.b, b.b) - Math.max(a.t, b.t);
        return w > 0 && h > 0 ? w * h : 0;
    }

    function pad(r, n) {
        return { l: r.l - n, r: r.r + n, t: r.t - n, b: r.b + n };
    }

    /* จุดบนขอบกรอบที่ใกล้เป้าหมายที่สุด */
    function edgePoint(r, tx, ty) {
        var cx = (r.l + r.r) / 2, cy = (r.t + r.b) / 2;
        var dx = tx - cx, dy = ty - cy;
        if (dx === 0 && dy === 0) return { x: cx, y: cy };
        var hw = (r.r - r.l) / 2, hh = (r.b - r.t) / 2;
        var s = Math.min(dx !== 0 ? hw / Math.abs(dx) : Infinity, dy !== 0 ? hh / Math.abs(dy) : Infinity);
        return { x: cx + dx * s, y: cy + dy * s };
    }

    /* ---------- อ่านตัวเลือกป้ายของแต่ละชุด ---------- */

    function resolve(v, ctx, fb) {
        if (typeof v === "function") {
            try { v = v(ctx); } catch (e) { v = fb; }
        }
        return v == null ? fb : v;
    }

    function fontOf(d) {
        var f = d.font;
        if (typeof f === "function") { try { f = f({}); } catch (e) { f = null; } }
        f = f || {};
        var size = f.size || 12;
        var weight = f.weight || "bold";
        var fam = f.family || "Sarabun";
        if (fam.indexOf("sans-serif") === -1) fam += ", sans-serif";
        return { size: size, css: weight + " " + size + "px " + fam };
    }

    /* ---------- ตัวสร้างปลั๊กอิน ---------- */

    function create(settings) {
        var base = settings.base || {};          // ตัวเลือก datalabels ระดับกราฟ
        var pos = settings.pos || "auto";
        var radial = !!settings.radial;
        var timers = {};

        function textOf(chart, ds, di, i, value, dopts) {
            var ctx = { chart: chart, dataIndex: i, dataset: ds, datasetIndex: di, active: false };
            if (resolve(dopts.display, ctx, true) === false) return null;
            if (value == null || (typeof value === "number" && isNaN(value))) return null;
            var f = dopts.formatter;
            var t = typeof f === "function" ? f(value, ctx) : String(value);
            if (t == null || t === "") return null;
            return { text: String(t), ctx: ctx };
        }

        /* ---- รวบรวมป้ายทั้งหมด ---- */
        function collect(chart) {
            var ctx2d = chart.ctx;
            var items = [];
            var obstacles = [];
            var stackedY = chart.options.scales && chart.options.scales.y && chart.options.scales.y.stacked;

            chart.data.datasets.forEach(function (ds, di) {
                if (!chart.isDatasetVisible(di)) return;
                var meta = chart.getDatasetMeta(di);
                var dopts = Object.assign({}, base, ds.ctLabelOpts || {});
                var font = fontOf(dopts);
                var isBar = meta.type === "bar";
                var isArc = meta.type === "doughnut" || meta.type === "pie";
                ctx2d.save();
                ctx2d.font = font.css;

                meta.data.forEach(function (el, i) {
                    if (!el || el.skip) return;
                    var value = ds.data[i];
                    if (value && typeof value === "object" && value.y != null) value = value.y;

                    /* จุดบนเส้น = สิ่งกีดขวางของป้ายอื่น */
                    if (!isBar && !isArc && value != null) {
                        var pp = el.getProps(["x", "y"], true);
                        obstacles.push({ r: rect(pp.x, pp.y, 11, 11), di: di, soft: true });
                        var nx = meta.data[i + 1];
                        if (nx && !nx.skip && ds.data[i + 1] != null) {
                            var np = nx.getProps(["x", "y"], true);
                            var steps = Math.max(1, Math.round(Math.hypot(np.x - pp.x, np.y - pp.y) / 9));
                            for (var s = 1; s < steps; s++) {
                                var tt = s / steps;
                                obstacles.push({ r: rect(pp.x + (np.x - pp.x) * tt, pp.y + (np.y - pp.y) * tt, 5, 5), di: di, soft: true });
                            }
                        }
                    }

                    var t = textOf(chart, ds, di, i, value, dopts);
                    if (!t) return;
                    var w = ctx2d.measureText(t.text).width + PAD_X * 2;
                    var h = font.size + PAD_Y * 2 + 1;

                    var it = {
                        di: di, i: i, text: t.text, w: w, h: h, font: font, dopts: dopts,
                        ctx: t.ctx, value: value, el: el, color: null, fill: null
                    };

                    if (isArc) {
                        var a = el.getProps(["x", "y", "startAngle", "endAngle", "innerRadius", "outerRadius"], true);
                        it.arc = a;
                        it.kind = "arc";
                        it.fill = Array.isArray(ds.backgroundColor) ? ds.backgroundColor[i] : ds.backgroundColor;
                    } else if (isBar) {
                        var b = el.getProps(["x", "y", "base", "width", "height"], true);
                        var top = Math.min(b.y, b.base), bot = Math.max(b.y, b.base);
                        it.kind = "bar";
                        it.x = b.x; it.top = top; it.bot = bot; it.bw = b.width;
                        it.neg = b.y > b.base;                  // ค่าลบ: ปลายแท่งอยู่ด้านล่าง
                        it.stacked = !!stackedY;
                        it.fill = el.options && el.options.backgroundColor;
                    } else {
                        var p = el.getProps(["x", "y"], true);
                        it.kind = "point";
                        it.x = p.x; it.y = p.y;
                        it.stacked = !!stackedY;
                    }
                    items.push(it);
                });
                ctx2d.restore();
            });

            return { items: items, obstacles: obstacles };
        }

        /* ---- ตำแหน่งที่ลอง (เรียงตามความชอบ) ---- */
        function ring(ax, ay, w, h, angles, radii) {
            var out = [];
            radii.forEach(function (R) {
                angles.forEach(function (deg) {
                    var rad = deg * Math.PI / 180;
                    var cx = ax + Math.cos(rad) * (R + w / 2 * Math.abs(Math.cos(rad)));
                    var cy = ay + Math.sin(rad) * (R + h / 2 * Math.abs(Math.sin(rad)));
                    out.push({ cx: cx, cy: cy, mode: "callout" });
                });
            });
            return out;
        }

        var CALL_ANGLES = [-90, -55, -125, -20, -160, 20, 160, 55, 125, 90];

        function candidates(it, mode) {
            var w = it.w, h = it.h, c = [], gap = 4;

            if (it.kind === "arc") {
                var a = it.arc;
                var mid = (a.startAngle + a.endAngle) / 2;
                var span = Math.abs(a.endAngle - a.startAngle);
                var cosm = Math.cos(mid), sinm = Math.sin(mid);
                var rMid = (a.innerRadius + a.outerRadius) / 2;
                var arcLen = rMid * span;
                var thick = a.outerRadius - a.innerRadius;
                var fitsIn = arcLen >= w * 0.9 && thick >= h;

                var inside = function () { return { cx: a.x + cosm * rMid, cy: a.y + sinm * rMid, mode: "inside" }; };
                var outside = function (extra) {
                    var R = a.outerRadius + 10 + (extra || 0);
                    return {
                        cx: a.x + cosm * (R + Math.abs(cosm) * w / 2),
                        cy: a.y + sinm * (R + Math.abs(sinm) * h / 2),
                        mode: "outside"
                    };
                };
                var callout = function (extra, dAng) {
                    var ang = mid + (dAng || 0);
                    var R = a.outerRadius + 22 + (extra || 0);
                    return {
                        cx: a.x + Math.cos(ang) * (R + Math.abs(Math.cos(ang)) * w / 2),
                        cy: a.y + Math.sin(ang) * (R + Math.abs(Math.sin(ang)) * h / 2),
                        mode: "callout"
                    };
                };
                var tx = a.x + cosm * a.outerRadius, ty = a.y + sinm * a.outerRadius;
                var wantsIn = mode === "center" || mode === "auto" || mode === "top" || mode === "bottom";

                if (wantsIn && fitsIn) c.push(inside());
                if (mode === "outside") { c.push(outside(0)); c.push(outside(14)); }
                if (mode === "callout" || (wantsIn && !fitsIn)) {
                    c.push(callout(0, 0));
                    [0.12, -0.12, 0.24, -0.24, 0.36, -0.36].forEach(function (d) { c.push(callout(0, d)); });
                    [16, 32].forEach(function (e) {
                        [0, 0.15, -0.15, 0.3, -0.3].forEach(function (d) { c.push(callout(e, d)); });
                    });
                } else {
                    [0.1, -0.1, 0.2, -0.2].forEach(function (d) { c.push(callout(0, d)); });
                }
                c.forEach(function (x) { x.tx = tx; x.ty = ty; });
                return c;
            }

            if (it.kind === "bar") {
                var barH = it.bot - it.top;
                var inFits = barH >= h + 4 && it.bw >= Math.min(w, 30) * 0.9;
                var cxm = it.x;
                var endY = it.neg ? it.bot : it.top;            // ปลายแท่ง (ด้านที่ค่า)
                var baseY = it.neg ? it.top : it.bot;           // ฐานแท่ง
                var dir = it.neg ? 1 : -1;                      // ทิศออกจากฐาน
                var outEnd = function (lvl) { return { cx: cxm, cy: endY + dir * (gap + h / 2 + (lvl || 0) * (h + 3)), mode: "out" }; };
                var inEnd = function () { return { cx: cxm, cy: endY - dir * (3 + h / 2), mode: "inside" }; };
                var inBase = function () { return { cx: cxm, cy: baseY + dir * (3 + h / 2), mode: "inside" }; };
                var inMid = function () { return { cx: cxm, cy: (it.top + it.bot) / 2, mode: "inside" }; };
                var anchorY = it.stacked ? (it.top + it.bot) / 2 : endY;
                var targetX = cxm, targetY = anchorY;

                var m = mode;
                if (m === "auto") {
                    var an = it.dopts.anchor;
                    m = it.stacked ? "center" : (an === "start" ? "bottom" : an === "center" ? "center" : "top");
                }

                var sideR = function () { return { cx: cxm + it.bw / 2 + 10 + w / 2, cy: (it.top + it.bot) / 2, mode: "callout", tx: cxm + it.bw / 2 - 4, ty: (it.top + it.bot) / 2 }; };
                var sideL = function () { return { cx: cxm - it.bw / 2 - 10 - w / 2, cy: (it.top + it.bot) / 2, mode: "callout", tx: cxm - it.bw / 2 + 4, ty: (it.top + it.bot) / 2 }; };

                if (m === "top") {
                    if (it.stacked) { if (inFits) c.push(inEnd()); }
                    else { c.push(outEnd(0)); }
                    if (!it.stacked) { c.push(outEnd(1)); if (inFits) c.push(inEnd()); }
                } else if (m === "center") {
                    if (inFits) c.push(inMid());
                    if (!it.stacked) c.push(outEnd(0));
                } else if (m === "bottom") {
                    if (inFits) c.push(inBase());
                    if (inFits) c.push(inMid());
                    if (!it.stacked) c.push(outEnd(0));
                } else if (m === "callout") {
                    if (it.stacked) { c.push(sideR()); c.push(sideL()); }
                    ring(targetX, targetY, w, h, CALL_ANGLES, [30, 46, 62]).forEach(function (x) { c.push(x); });
                }
                if (m !== "callout" && it.stacked) { c.push(sideR()); c.push(sideL()); }
                if (m !== "callout") {
                    /* สำรอง: ขยับข้างแล้วค่อยออกเป็นวงพร้อมลูกศร */
                    var sh = w / 2 + 4;
                    if (!it.stacked) {
                        c.push({ cx: cxm + sh, cy: endY + dir * (gap + h / 2), mode: "out" });
                        c.push({ cx: cxm - sh, cy: endY + dir * (gap + h / 2), mode: "out" });
                    }
                    ring(targetX, targetY, w, h, CALL_ANGLES, [30, 46, 62]).forEach(function (x) { c.push(x); });
                }
                c.forEach(function (x) { if (x.tx == null) { x.tx = targetX; x.ty = targetY; } });
                return c;
            }

            /* จุดบนเส้น */
            var px = it.x, py = it.y;
            var m2 = mode;
            if (m2 === "auto") {
                var an2 = it.dopts.anchor;
                m2 = an2 === "start" ? "bottom" : an2 === "center" ? "center" : "top";
            }
            var above = function (lvl) { return { cx: px, cy: py - (9 + h / 2 + (lvl || 0) * (h + 3)), mode: "out" }; };
            var below = function (lvl) { return { cx: px, cy: py + (9 + h / 2 + (lvl || 0) * (h + 3)), mode: "out" }; };
            if (m2 === "top") { c.push(above(0)); c.push(below(0)); c.push(above(1)); c.push(below(1)); }
            else if (m2 === "bottom") { c.push(below(0)); c.push(above(0)); c.push(below(1)); c.push(above(1)); }
            else if (m2 === "center") { c.push({ cx: px, cy: py, mode: "on" }); c.push(above(0)); c.push(below(0)); }
            else { ring(px, py, w, h, CALL_ANGLES, [26, 42, 58]).forEach(function (x) { c.push(x); }); }
            if (m2 !== "callout") ring(px, py, w, h, CALL_ANGLES, [30, 46, 62]).forEach(function (x) { c.push(x); });
            c.forEach(function (x) { x.tx = px; x.ty = py; });
            return c;
        }

        /* ---- วางทั้งหมด ---- */
        function layout(chart, items, obstacles) {
            var W = chart.width, H = chart.height, ca = chart.chartArea;
            var bounds;
            if (radial) {
                bounds = { l: 2, r: W - 2, t: 2, b: H - 2 };
            } else {
                bounds = { l: 2, r: W - 2, t: Math.max(2, ca.top - 24), b: ca.bottom };
            }

            var fixed = [];
            var lg = chart.legend;
            if (lg && lg.options && lg.options.display !== false && lg.width) {
                fixed.push({ r: { l: lg.left, r: lg.left + lg.width, t: lg.top, b: lg.top + lg.height }, soft: false });
            }

            var placed = [];
            var mode = pos;

            items.forEach(function (it) {
                var cands = candidates(it, mode);
                var best = null, bestScore = Infinity;
                var ownMarkerOK = mode === "center" && it.kind === "point";

                for (var k = 0; k < cands.length; k++) {
                    var cd = cands[k];
                    var r = rect(cd.cx, cd.cy, it.w, it.h);
                    var score = k * 0.001;

                    /* ล้นขอบเล็กน้อย: ดันกลับเข้ามา (ลูกศรยังชี้ที่เดิม) ล้นมาก: ตัดสิทธิ์ */
                    var sx = r.l < bounds.l ? bounds.l - r.l : (r.r > bounds.r ? bounds.r - r.r : 0);
                    var sy = r.t < bounds.t ? bounds.t - r.t : (r.b > bounds.b ? bounds.b - r.b : 0);
                    if (sx || sy) {
                        if (Math.abs(sx) > 14 || Math.abs(sy) > 14) score += 400 + (Math.abs(sx) + Math.abs(sy)) * 4;
                        else score += (Math.abs(sx) + Math.abs(sy)) * 0.3;
                        r = rect(cd.cx + sx, cd.cy + sy, it.w, it.h);
                    }

                    var pr = pad(r, 1.5);
                    for (var q = 0; q < placed.length; q++) score += overlapArea(pr, placed[q].r) * 3;
                    for (q = 0; q < fixed.length; q++) score += overlapArea(r, fixed[q].r) * 3;
                    for (q = 0; q < obstacles.length; q++) {
                        var ob = obstacles[q];
                        if (ownMarkerOK && ob.di === it.di) continue;
                        score += overlapArea(r, ob.r) * 0.9;
                    }
                    /* ป้ายห่างเป้าหมายมาก ๆ ให้คะแนนแย่ลงเล็กน้อย */
                    if (cd.mode !== "inside" && cd.mode !== "on") score += Math.hypot(cd.cx - cd.tx, cd.cy - cd.ty) * 0.02;

                    if (score < bestScore) { best = { cd: cd, r: r, score: score }; bestScore = score; }
                    if (score < 0.5) break;                 // ได้ที่ว่างเลย ไม่ต้องหาต่อ
                }

                if (!best || bestScore > 500) { it.hidden = true; return; }
                it.cd = best.cd;
                it.r = best.r;
                placed.push({ r: best.r });
            });
            return items;
        }

        /* ---- วาด ---- */
        function drawArrow(ctx, from, to, color) {
            var dx = to.x - from.x, dy = to.y - from.y;
            var len = Math.hypot(dx, dy);
            if (len < 3) return;
            var ux = dx / len, uy = dy / len;
            var tipX = to.x - ux * 1.5, tipY = to.y - uy * 1.5;       // ห่างจากเป้าหมายนิดหน่อย
            var head = 6;
            ctx.save();
            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            ctx.lineWidth = 1.3;
            ctx.lineJoin = "round";
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(tipX - ux * head * 0.7, tipY - uy * head * 0.7);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(tipX, tipY);
            ctx.lineTo(tipX - ux * head - uy * head * 0.5, tipY - uy * head + ux * head * 0.5);
            ctx.lineTo(tipX - ux * head + uy * head * 0.5, tipY - uy * head - ux * head * 0.5);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        function roundRectPath(ctx, r, rad) {
            var x = r.l, y = r.t, w = r.r - r.l, h = r.b - r.t;
            rad = Math.min(rad, h / 2, w / 2);
            ctx.beginPath();
            ctx.moveTo(x + rad, y);
            ctx.arcTo(x + w, y, x + w, y + h, rad);
            ctx.arcTo(x + w, y + h, x, y + h, rad);
            ctx.arcTo(x, y + h, x, y, rad);
            ctx.arcTo(x, y, x + w, y, rad);
            ctx.closePath();
        }

        function seriesColor(chart, it) {
            var ds = chart.data.datasets[it.di];
            var c = (it.kind === "arc" || it.kind === "bar")
                ? (Array.isArray(ds.backgroundColor) ? ds.backgroundColor[it.i] : ds.backgroundColor)
                : (ds.borderColor && typeof ds.borderColor === "string" && ds.borderWidth ? ds.borderColor : ds.backgroundColor);
            if (Array.isArray(c)) c = c[it.i];
            return typeof c === "string" ? c : cssVar("--red", "#c8102e");
        }

        function draw(chart, items) {
            var ctx = chart.ctx;
            var card = cssVar("--card", "#ffffff");
            var ink = cssVar("--ink", "#1b1416");

            items.forEach(function (it) {
                if (it.hidden || !it.cd) return;
                var cd = it.cd, r = it.r;
                var d = it.dopts;
                var accent = seriesColor(chart, it);

                var chip = cd.mode === "callout" || cd.mode === "on" || !!d.backgroundColor;
                var farOut = (cd.mode === "out" || cd.mode === "outside") && Math.hypot(cd.cx - cd.tx, cd.cy - cd.ty) > it.h * 1.6;
                var onFill = cd.mode === "inside";

                /* สีตัวอักษร */
                var textColor = ink;
                if (onFill) {
                    var f = it.fill;
                    textColor = inkOn(f, "#1b1416", "#ffffff") || ink;
                }

                ctx.save();
                ctx.font = it.font.css;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";

                /* ลูกศร / เส้นนำ */
                if (cd.mode === "callout") {
                    var from = edgePoint(r, cd.tx, cd.ty);
                    drawArrow(ctx, from, { x: cd.tx, y: cd.ty }, it.kind === "point" ? accent : ink);
                } else if (farOut) {
                    var from2 = edgePoint(r, cd.tx, cd.ty);
                    ctx.strokeStyle = accent;
                    ctx.globalAlpha = 0.7;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(from2.x, from2.y);
                    ctx.lineTo(cd.tx, cd.ty);
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                }

                var cx = (r.l + r.r) / 2, cy = (r.t + r.b) / 2 + 0.5;

                if (chip) {
                    roundRectPath(ctx, r, 7);
                    ctx.fillStyle = d.backgroundColor || card;
                    ctx.fill();
                    ctx.lineWidth = 1.4;
                    ctx.strokeStyle = (typeof d.borderColor === "string" && d.borderColor) || accent;
                    ctx.stroke();
                    ctx.fillStyle = (typeof d.color === "string" && d.backgroundColor) ? d.color : ink;
                    ctx.fillText(it.text, cx, cy);
                } else if (onFill) {
                    ctx.fillStyle = textColor;
                    ctx.fillText(it.text, cx, cy);
                } else {
                    /* ตัวอักษรมีขอบสีพื้นหลังการ์ด อ่านออกแม้ทับเส้นกริด */
                    ctx.lineWidth = 3.5;
                    ctx.lineJoin = "round";
                    ctx.strokeStyle = card;
                    ctx.strokeText(it.text, cx, cy);
                    ctx.fillStyle = textColor;
                    ctx.fillText(it.text, cx, cy);
                }
                ctx.restore();
            });
        }

        /* ---- ปลั๊กอิน ---- */
        return {
            id: "ctLabels",

            afterDatasetsDraw: function (chart) {
                if (!chart.ctx || !chart.chartArea) return;
                var id = chart.id;

                /* รอให้อนิเมชันจบก่อนค่อยวาด (ตำแหน่งสุดท้ายนิ่งแล้ว) แล้วสั่งวาดซ้ำอีกครั้ง */
                var A = typeof Chart !== "undefined" && Chart.animator;
                var running = A && A.running ? A.running(chart) : false;
                if (running && (chart.$ctTries = (chart.$ctTries || 0) + 1) < 120) {
                    clearTimeout(timers[id]);
                    timers[id] = setTimeout(function () {
                        if (chart.ctx && chart.canvas && chart.canvas.isConnected) {
                            try { chart.draw(); } catch (e) { /* กราฟถูกทำลายแล้ว */ }
                        }
                    }, 90);
                    return;
                }
                chart.$ctTries = 0;

                var data = collect(chart);
                if (!data.items.length) return;
                layout(chart, data.items, data.obstacles);
                chart.$ctLayout = data.items;             // ไว้ให้ทดสอบ/ตรวจสอบตำแหน่ง
                draw(chart, data.items);
            },

            afterDestroy: function (chart) {
                clearTimeout(timers[chart.id]);
                delete timers[chart.id];
            }
        };
    }

    window.ChartLabels = { create: create, POSITIONS: ["auto", "top", "center", "bottom", "callout"] };
})();
