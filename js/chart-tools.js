/* =========================================================
   chart-tools.js
   ชุดเครื่องมือ "ปรับแต่งกราฟ" ใช้ร่วมกันทุกหน้า (index.html / cost.html)

   สร้างกราฟด้วย  ChartTools.create(canvas, config, options)
   แทน  new Chart(canvas, config)  แล้วจะได้ปุ่ม "ปรับแต่ง" ที่มุมการ์ดกราฟ
   ผู้ใช้เปลี่ยนได้เอง:
     • ชนิดกราฟ   แท่ง / เส้น / พื้นที่  (หรือ โดนัท / พาย) ทั้งกราฟ
     • ชนิดกราฟ "แยกตามชุดข้อมูล"  เช่น ชุดหนึ่งเป็นแท่ง อีกชุดเป็นเส้น (กราฟผสม)
     • แกนของแต่ละชุดข้อมูล ซ้าย/ขวา (เมื่อหน่วยต่างกันมาก เช่น ล้านบาท กับ บาท/ตู้/กม.)
     • สีของแต่ละชุดข้อมูล + ชุดสีสำเร็จรูป
     • แสดงตัวเลขบนกราฟ, เส้นกริด, คำอธิบายกราฟ, เส้นโค้ง, ซ้อนแท่ง
     • ดาวน์โหลดเป็นรูป PNG
   ค่าที่ปรับจะถูกจำไว้ในเครื่อง (localStorage) แม้เปลี่ยนช่วงข้อมูลแล้วกราฟถูกสร้างใหม่

   options ที่ใช้ได้:
     id            รหัสกราฟ (ค่าเริ่มต้น = id ของ canvas) ใช้เป็นกุญแจเก็บค่าที่ปรับ
     title         ชื่อกราฟ ใช้ตั้งชื่อไฟล์ PNG
     kinds         ชนิดที่ให้เลือก เช่น ["bar","line","area"] หรือ ["doughnut","pie"]
     initialKind   ชนิดเริ่มต้นของกราฟที่ส่งเข้ามา
     stackable     true = มีสวิตช์ "ซ้อนแท่ง"
     stacked       ค่าเริ่มต้นของการซ้อนแท่ง
     autoStyle     true = ให้ ChartTools จัดสไตล์ชุดข้อมูลให้เอง (ใช้ ctColor เป็นสี)
     dualAxis      true = แผงปรับแต่งมีตัวเลือก "แกนซ้าย/แกนขวา" ให้แต่ละชุดข้อมูล
     autoZero      true = แกนที่มีแท่ง/พื้นที่เริ่มที่ 0 ส่วนแกนที่มีแต่เส้นไม่ต้องเริ่มที่ 0
     labelFormat   ฟังก์ชันจัดรูปตัวเลขเมื่อเปิด "แสดงตัวเลข"
     onChange      ฟังก์ชันที่ถูกเรียกทุกครั้งที่กราฟถูกสร้าง/ปรับใหม่ (รับ chart)
                   ใช้อัปเดตส่วนอื่นของหน้าให้ตรงกับสีที่ผู้ใช้เลือก
   ตำแหน่งตัวเลข: ผู้ใช้เลือกได้ในแผง (บน/กลาง/ล่าง/ลูกศรชี้) เก็บที่ pref.labelPos
   วาดโดย js/chart-labels.js (ต้องโหลดก่อนไฟล์นี้) พร้อมกันไม่ให้ป้ายทับกัน
   ชุดข้อมูล (dataset) พิเศษ:
     ctColor       สีตั้งต้นของชุดข้อมูล (hex)
     ctFixed       true = ไม่เปลี่ยนชนิดตามที่ผู้ใช้เลือก (เช่น เส้นเฉลี่ยที่วางทับ)
     ctKey         รหัสประจำชุดข้อมูล ใช้จำค่าที่ปรับ (ถ้าไม่ระบุจะใช้ลำดับที่) ควรระบุเมื่อรายการชุดข้อมูลเพิ่ม/ลดได้
     ctKind        ชนิดตั้งต้นของชุดนี้ "bar" | "line" | "area" (ทำให้กราฟตั้งต้นเป็นแบบผสมได้)
     ctUnit        หน่วยของชุดข้อมูล ใช้เป็นชื่อแกนอัตโนมัติ
     ctFmt         ฟังก์ชันจัดรูปตัวเลขของชุดนี้ (ป้ายตัวเลข/ทูลทิป)
     ctLabelFmt    เหมือน ctFmt แต่ใช้เฉพาะป้ายตัวเลขบนกราฟ (เช่น ตัดทศนิยมบนมือถือ)
     ctEn          ชื่อภาษาอังกฤษ แสดงในทูลทิป
     yAxisID       "y" (ซ้าย) หรือ "y1" (ขวา) – ถ้าใช้ y1 ระบบสร้างแกนขวาให้เอง
   ========================================================= */

(function () {
    "use strict";

    var STORE_KEY = "redline-chart-prefs-v1";
    var RADIAL = ["pie", "doughnut"];

    var KIND_LABEL = {
        bar: "แท่ง",
        line: "เส้น",
        area: "พื้นที่",
        doughnut: "โดนัท",
        pie: "พาย"
    };

    var PALETTES = [
        { name: "ค่าเริ่มต้น", colors: null },
        { name: "โทนแดง", colors: ["#7f0b0b", "#c8102e", "#ef4444", "#f59e9e", "#fbd0d0"] },
        { name: "สดใส", colors: ["#c8102e", "#eda100", "#2a78d6", "#1baf7a", "#6250d6"] },
        { name: "แดง-เทา", colors: ["#c8102e", "#374151", "#9ca3af", "#e5a3ab", "#d1d5db"] },
        { name: "พาสเทล", colors: ["#f4a6b0", "#f7c873", "#9cc5f2", "#a8dcc3", "#c7b8f0"] }
    ];

    var registry = {};      // id -> { id, canvas, base, opts, chart, ui }
    var prefs = loadPrefs();
    var openId = null;
    var panelEl = null;

    /* ---------- storage ---------- */

    function loadPrefs() {
        try {
            return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
        } catch (e) {
            return {};
        }
    }

    function savePrefs() {
        try {
            localStorage.setItem(STORE_KEY, JSON.stringify(prefs));
        } catch (e) { /* ใช้ต่อได้ แม้บันทึกไม่ได้ */ }
    }

    /* ---------- helpers ---------- */

    function isPlain(v) {
        return v && typeof v === "object" && (Object.getPrototypeOf(v) === Object.prototype || Array.isArray(v));
    }

    function clone(v) {
        if (Array.isArray(v)) return v.map(clone);
        if (isPlain(v)) {
            var out = {};
            Object.keys(v).forEach(function (k) { out[k] = clone(v[k]); });
            return out;
        }
        return v;
    }

    function toHex(color, fallback) {
        if (typeof color !== "string") return fallback || "#c8102e";
        var c = color.trim();
        var m = c.match(/^#([0-9a-f]{3})$/i);
        if (m) return "#" + m[1].split("").map(function (x) { return x + x; }).join("").toLowerCase();
        if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
        m = c.match(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i);
        if (m) {
            return "#" + [m[1], m[2], m[3]].map(function (n) {
                return ("0" + Math.min(255, Number(n)).toString(16)).slice(-2);
            }).join("");
        }
        return fallback || "#c8102e";
    }

    function rgba(hex, a) {
        var h = toHex(hex);
        return "rgba(" + parseInt(h.slice(1, 3), 16) + "," + parseInt(h.slice(3, 5), 16) + "," + parseInt(h.slice(5, 7), 16) + "," + a + ")";
    }

    function luminance(hex) {
        var h = toHex(hex);
        var ch = [1, 3, 5].map(function (i) {
            var v = parseInt(h.slice(i, i + 2), 16) / 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
    }

    /* อ่านสีจากตัวแปร CSS ของธีมปัจจุบัน (สว่าง/มืด) */
    function css(name, fallback) {
        try {
            var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
            return v || fallback;
        } catch (e) {
            return fallback;
        }
    }

    function el(tag, cls, html) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (html != null) n.innerHTML = html;
        return n;
    }

    function esc(s) {
        return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
        });
    }

    function isRadial(base) {
        return RADIAL.indexOf(base.type) !== -1;
    }

    /* สีตั้งต้นของชุดข้อมูลลำดับที่ i (หรือชิ้นที่ i ของโดนัท) */
    function baseColor(base, dsIndex, pointIndex) {
        var ds = base.data.datasets[dsIndex];
        if (isRadial(base)) {
            if (ds.ctColors && ds.ctColors[pointIndex]) return toHex(ds.ctColors[pointIndex]);
            var bg = Array.isArray(ds.backgroundColor) ? ds.backgroundColor[pointIndex] : ds.backgroundColor;
            return toHex(bg);
        }
        return toHex(ds.ctColor || ds.borderColor || ds.backgroundColor);
    }

    function initialKindOf(entry) {
        if (entry.opts.initialKind) return entry.opts.initialKind;
        return entry.base.type;
    }

    /* รหัสของชุดข้อมูล: ใช้ ctKey ถ้ามี ไม่งั้นใช้ลำดับที่ (ค่าที่เคยบันทึกไว้แบบลำดับที่ยังใช้ได้) */
    function dsKey(ds, i) {
        return ds && ds.ctKey != null ? String(ds.ctKey) : String(i);
    }

    /* ความละเอียดการวาดกราฟ: ใช้ "พิกเซลจริงของจอ" ตรง ๆ (1 พิกเซลกราฟ = 1 พิกเซลจอ) ตัวหนังสือและเส้นจึงคมที่สุด
       การวาดใหญ่กว่าจอแล้วให้เบราว์เซอร์ย่อ (supersampling) จะทำให้เบลอ โดยเฉพาะจอ 1x หรือซูม 125%/150%
       ตอนซูม/ย้ายจอ ค่านี้เปลี่ยน → syncDpr() ด้านล่างปรับกราฟทุกอันให้ตรงกับจอใหม่ · ภาพ PNG วาดใหม่ที่ 3 เท่าตอนดาวน์โหลด */
    function crispDpr() {
        return Math.max(1, window.devicePixelRatio || 1);
    }

    var lastDpr = crispDpr();
    var dprTimer = null;
    function syncDpr() {
        var d = crispDpr();
        if (d === lastDpr) return;
        lastDpr = d;
        Object.keys(registry).forEach(function (k) {
            var c = registry[k] && registry[k].chart;
            if (c && c.canvas && c.canvas.isConnected) {
                c.options.devicePixelRatio = d;
                c.resize();
            }
        });
    }
    window.addEventListener("resize", function () {
        clearTimeout(dprTimer);
        dprTimer = setTimeout(syncDpr, 120);
    });

    /* ---------- จำนวนทศนิยม (ผู้ใช้เลือกต่อชุด/ทั้งกราฟ) ----------
       ปัดตามหลักคณิตศาสตร์: ตั้งแต่ .5 ขึ้นไปปัดขึ้น น้อยกว่า .5 ปัดลง (744.5 → 745, 744.4 → 744, ค่าลบปัดห่างศูนย์) */
    function fmtDec(v, n) {
        v = Number(v);
        if (!isFinite(v)) return String(v);
        var f = Math.pow(10, n);
        var r = Math.sign(v) * Math.round((Math.abs(v) + 1e-9) * f) / f;     // + 1e-9 กันปัญหาเลขทศนิยมฐานสองเช่น 1.005
        return r.toLocaleString("en-US", { minimumFractionDigits: n, maximumFractionDigits: n });
    }

    /* ครอบตัวจัดรูปเดิมของกราฟ: คงหน่วย/คำนำหน้า/คำต่อท้าย (เช่น "%", "บาท") ไว้ เปลี่ยนเฉพาะตัวเลข */
    function withDecimals(orig, n) {
        return function (value, ctx) {
            var s = typeof orig === "function" ? orig(value, ctx) : String(value);
            var m = String(s).match(/-?\d[\d,]*(\.\d+)?/);
            if (!m) return s;
            var shown = parseFloat(m[0].replace(/,/g, ""));
            var raw = Number(value);
            /* ถ้าเลขที่แสดงตรงกับค่าจริง ใช้ค่าจริงเพื่อไม่เสียความละเอียด (ไม่งั้นเป็นค่าที่ย่อหน่วยแล้ว) */
            var num = isFinite(raw) && Math.abs(shown - raw) <= 0.5 ? raw : shown;
            return String(s).replace(m[0], fmtDec(num, n));
        };
    }

    /* ลำดับชุดข้อมูลที่ผู้ใช้เลือก (pref.order = รายการ key เรียงตามที่ต้องการ)
       คืนค่าเป็นดัชนีของ base.data.datasets เรียงตามลำดับนั้น (ชุดที่ไม่อยู่ในรายการไปต่อท้ายตามเดิม) */
    function orderedIdx(base, pref) {
        var dss = base.data.datasets;
        var idx = dss.map(function (_, i) { return i; });
        var ord = pref && pref.order;
        if (!ord || !ord.length) return idx;
        function rank(i) {
            var p = ord.indexOf(dsKey(dss[i], i));
            return p === -1 ? 1000 + i : p;
        }
        return idx.sort(function (a, b) { return rank(a) - rank(b); });
    }

    /* เส้นเฉลี่ยที่วางทับ ฯลฯ — ไม่ถูกเปลี่ยนชนิดและไม่โชว์ในแผงปรับแต่ง */
    function isOverlay(ds, base) {
        return !!(ds.ctFixed || (ds.type && ds.type !== base.type && !ds.ctKind));
    }

    /* ชนิดที่ใช้จริงของชุดข้อมูลที่ i: เลือกแยกชุด > เลือกทั้งกราฟ > ctKind > ชนิดตั้งต้น */
    function seriesKind(entry, ds, i) {
        var pref = prefs[entry.id] || {};
        var key = dsKey(ds, i);
        return (pref.series && pref.series[key]) || pref.type || ds.ctKind || initialKindOf(entry);
    }

    /* ตั้งต้นเป็นกราฟผสมอยู่แล้วหรือไม่ (ชุดข้อมูลมี ctKind ต่างจากชนิดตั้งต้น) */
    function hasMixedDefaults(entry) {
        var k0 = initialKindOf(entry);
        return entry.base.data.datasets.some(function (ds) { return ds.ctKind && ds.ctKind !== k0; });
    }

    /* แกนขวา: สร้างให้อัตโนมัติเมื่อมีชุดข้อมูลที่ใช้ y1 และเขียนชื่อแกนจาก ctUnit */
    function ensureAxes(cfg, o, opts) {
        var sc = o.scales = o.scales || {};
        var y = sc.y = sc.y || {};
        var dss = cfg.data.datasets;
        var right = dss.filter(function (d) { return d.yAxisID === "y1"; });
        var left = dss.filter(function (d) { return d.yAxisID !== "y1"; });

        if (right.length) {
            if (!sc.y1) {
                sc.y1 = clone(y);
            }
            sc.y1.position = "right";
            sc.y1.grid = { display: false, drawOnChartArea: false };
            if (!left.length) y.display = false;
        } else {
            delete sc.y1;
        }

        var small = window.innerWidth < 640;

        ["y", "y1"].forEach(function (ax) {
            var s = sc[ax];
            if (!s) return;

            var units = [];
            dss.forEach(function (d) {
                if ((d.yAxisID === "y1") !== (ax === "y1")) return;
                if (d.ctUnit && units.indexOf(d.ctUnit) === -1) units.push(d.ctUnit);
            });

            if (units.length) {
                s.title = s.title || {};
                s.title.text = units.join(" / ");
                s.title.display = !small;
                s.title.color = s.title.color || css("--mute", "#76686c");
                s.title.font = s.title.font || { family: "Sarabun, sans-serif", size: 12, weight: "600" };
            }

            if (opts.autoZero) {
                var needZero = dss.some(function (d) {
                    if ((d.yAxisID === "y1") !== (ax === "y1")) return false;
                    var t = d.type || cfg.type;
                    return t === "bar" || (d.fill && d.fill !== false);
                });
                s.beginAtZero = needZero;
            }
        });
    }

    /* ---------- สร้าง config จริงจาก config ตั้งต้น + ค่าที่ผู้ใช้ปรับ ---------- */

    function buildConfig(entry) {
        var base = entry.base;
        var opts = entry.opts;
        var pref = prefs[entry.id] || {};
        var cfg = clone(base);

        cfg.options = cfg.options || {};
        var o = cfg.options;
        if (o.devicePixelRatio == null) o.devicePixelRatio = crispDpr();
        o.plugins = o.plugins || {};
        cfg.plugins = (base.plugins || []).slice();   // ปลั๊กอินใช้ตัวเดิม ไม่ทำสำเนา

        if (typeof ChartDataLabels !== "undefined" && cfg.plugins.indexOf(ChartDataLabels) === -1) {
            cfg.plugins.push(ChartDataLabels);
        }

        var radial = isRadial(base);
        var kind = pref.type || initialKindOf(entry);

        /* ---------- โดนัท / พาย ---------- */
        if (radial) {
            cfg.type = kind === "pie" ? "pie" : "doughnut";
            if (cfg.type === "pie") { o.cutout = 0; }
            else if (o.cutout == null || kind !== initialKindOf(entry)) { o.cutout = "62%"; }

            cfg.data.datasets.forEach(function (ds, di) {
                var n = cfg.data.labels.length;
                var colors = [];
                for (var i = 0; i < n; i++) {
                    var key = di + ":" + i;
                    colors.push((pref.colors && pref.colors[key]) || baseColor(base, di, i));
                }
                ds.backgroundColor = colors;
                ds.borderColor = css("--card", "#ffffff");
                ds.borderWidth = 3;
            });
        }

        /* ---------- แท่ง / เส้น / พื้นที่ (เลือกชนิดแยกตามชุดข้อมูลได้) ---------- */
        if (!radial) {
            var baseKind = initialKindOf(entry);
            var stacked = pref.stacked != null ? pref.stacked : !!opts.stacked;
            var smooth = pref.smooth != null ? pref.smooth : (opts.smooth != null ? opts.smooth : true);
            var axisPref = pref.axes || {};

            // ชนิดของแต่ละชุด (null = เส้นที่วางทับ ไม่ยุ่งกับมัน)
            var kinds = cfg.data.datasets.map(function (ds, i) {
                return isOverlay(ds, base) ? null : seriesKind(entry, ds, i);
            });
            var anyBar = kinds.indexOf("bar") !== -1;
            var anyLine = kinds.some(function (k) { return k === "line" || k === "area"; });
            var mixed = anyBar && anyLine;
            var anyStackable = kinds.some(function (k) { return k === "bar" || k === "area"; });

            cfg.type = anyBar ? "bar" : "line";

            cfg.data.datasets.forEach(function (ds, i) {
                var k = kinds[i];
                var key = dsKey(ds, i);
                var color = (pref.colors && pref.colors[key]) || baseColor(base, i);
                var colorChanged = !!(pref.colors && pref.colors[key]);

                if (axisPref[key]) ds.yAxisID = axisPref[key];

                /* เส้นที่วางทับ: เปลี่ยนได้แค่สี */
                if (k === null) {
                    if (colorChanged) {
                        ds.borderColor = color;
                        ds.backgroundColor = color;
                        ds.pointBackgroundColor = color;
                    }
                    return;
                }

                if (mixed) {
                    ds.type = k === "bar" ? "bar" : "line";
                    ds.order = k === "bar" ? 2 : 1;       // เส้นวาดทับแท่ง
                } else {
                    delete ds.type;
                }

                var kindChanged = k !== (ds.ctKind || baseKind);
                var restyle = opts.autoStyle || mixed || kindChanged || colorChanged || pref.smooth != null;

                if (restyle) {
                    if (k === "bar") {
                        ds.backgroundColor = color;
                        ds.borderColor = stacked ? css("--card", "#ffffff") : color;
                        ds.borderWidth = stacked ? 2 : 0;
                        ds.borderRadius = stacked ? 0 : 7;
                        ds.borderSkipped = false;
                        ds.maxBarThickness = 56;
                        ds.fill = undefined;
                        ds.tension = undefined;
                        ds.pointRadius = undefined;
                    } else {
                        var area = k === "area";
                        ds.borderColor = color;
                        ds.borderWidth = 2.5;
                        ds.tension = smooth ? 0.35 : 0;
                        ds.cubicInterpolationMode = smooth ? "monotone" : "default";   // โค้งนุ่มแต่ไม่พุ่งเกินค่าจริง
                        ds.pointRadius = 4;
                        ds.pointHoverRadius = 6;
                        ds.pointBackgroundColor = color;
                        ds.pointBorderColor = css("--card", "#ffffff");
                        ds.pointBorderWidth = 2;
                        ds.borderRadius = undefined;
                        ds.maxBarThickness = undefined;
                        ds.fill = area ? (stacked ? "stack" : "origin") : false;
                        ds.backgroundColor = area ? rgba(color, stacked ? 0.55 : 0.16) : color;
                    }
                }

                /* ความกว้างแท่ง / ความชิดของกลุ่มแท่ง (ผู้ใช้ปรับเองในแผง) */
                if (k === "bar" && (pref.barW != null || pref.catW != null)) {
                    if (pref.barW != null) ds.barPercentage = pref.barW / 100;
                    if (pref.catW != null) ds.categoryPercentage = pref.catW / 100;
                    ds.maxBarThickness = 400;                 // ปลดเพดานความหนาเดิม (56px) เพื่อให้แท่งกว้างขึ้นได้จริง
                }

                /* ซ้อนแท่ง/พื้นที่: เส้นล้วนไม่ถูกซ้อนกับชุดอื่น */
                if (opts.stackable && stacked && k === "line") {
                    ds.stack = "ct-line-" + key;
                }

                /* ป้ายตัวเลขเฉพาะชุด: ใช้รูปแบบตัวเลขของชุดนั้น และเส้นในกราฟผสมใส่กรอบให้อ่านออกเมื่อทับแท่ง */
                var dlo = {};
                var labelFmt = ds.ctLabelFmt || ds.ctFmt;
                if (typeof labelFmt === "function") {
                    dlo.formatter = (function (f) { return function (v) { return f(v); }; })(labelFmt);
                }
                if (mixed && k === "bar") {
                    /* กราฟผสม: ป้ายของแท่งอยู่ในแท่งด้านล่าง ไม่ชนกับป้ายของเส้นด้านบน */
                    dlo.anchor = "start";
                    dlo.align = "end";
                    dlo.offset = 8;
                    dlo.color = luminance(color) > 0.34 ? "#1b1416" : "#ffffff";
                }
                if (mixed && k !== "bar") {
                    dlo.backgroundColor = css("--card", "#ffffff");
                    dlo.borderColor = color;
                    dlo.borderWidth = 1.5;
                    dlo.borderRadius = 6;
                    dlo.padding = { top: 2, bottom: 2, left: 5, right: 5 };
                    dlo.anchor = "end";
                    dlo.align = "top";
                    dlo.offset = 8;
                    dlo.color = css("--ink", "#1b1416");
                }
                if (Object.keys(dlo).length) ds.datalabels = Object.assign({}, ds.datalabels, dlo);
            });

            /* ซ้อนแท่ง / พื้นที่ */
            if (opts.stackable) {
                o.scales = o.scales || {};
                var doStack = stacked && anyStackable;
                ["x", "y"].forEach(function (ax) {
                    o.scales[ax] = o.scales[ax] || {};
                    o.scales[ax].stacked = doStack;
                });
            }

            /* แกนซ้าย/ขวา + ชื่อแกนจากหน่วย */
            ensureAxes(cfg, o, opts);

            /* เส้นกริด */
            if (pref.grid != null && o.scales && o.scales.y) {
                o.scales.y.grid = o.scales.y.grid || {};
                o.scales.y.grid.display = !!pref.grid;
            }
        }

        /* คำอธิบายกราฟ (legend) */
        if (pref.legend != null) {
            o.plugins.legend = o.plugins.legend || {};
            o.plugins.legend.display = !!pref.legend;
        }

        /* ตัวเลขบนกราฟ */
        if (pref.labels != null) {
            var dl = o.plugins.datalabels = o.plugins.datalabels || {};
            dl.display = pref.labels ? function (ctx) {
                if (ctx.dataset.ctFixed) return false;
                var v = ctx.dataset.data[ctx.dataIndex];
                return v != null && v !== 0;
            } : false;

            if (pref.labels) {
                var fmt = opts.labelFormat || function (v) { return Number(v).toLocaleString("th-TH", { maximumFractionDigits: 2 }); };
                dl.formatter = function (value, ctx) {
                    if (radial) {
                        var data = ctx.dataset.data;
                        var total = data.reduce(function (a, b) { return a + Number(b || 0); }, 0);
                        return total ? (value / total * 100).toFixed(1) + "%" : "";
                    }
                    return fmt(value, ctx);
                };
                dl.font = { family: "Sarabun", weight: "bold", size: 12 };
                dl.clamp = true;

                var stackedBar = !radial && cfg.type === "bar" && o.scales && o.scales.y && o.scales.y.stacked;
                if (radial || stackedBar || (cfg.type === "line" && o.scales && o.scales.y && o.scales.y.stacked)) {
                    dl.anchor = "center";
                    dl.align = "center";
                    dl.offset = 0;
                    dl.color = function (ctx) {
                        var c = radial
                            ? ctx.dataset.backgroundColor[ctx.dataIndex]
                            : (cfg.type === "line" ? ctx.dataset.borderColor : ctx.dataset.backgroundColor);
                        return luminance(c) > 0.34 ? "#1b1416" : "#ffffff"; // ตัวอักษรบนสีแท่ง เลือกตามความสว่างของสีแท่ง
                    };
                } else {
                    dl.anchor = "end";
                    if (typeof dl.align !== "function") dl.align = "top";
                    dl.offset = 4;
                    dl.color = css("--ink", "#1b1416");
                }
            }
        }

        /* ---------- ตัวจัดตำแหน่งตัวเลข (บน/กลาง/ล่าง/ลูกศรชี้ + ไม่ทับกัน) ----------
           ปิด datalabels เดิมทั้งหมด แล้วให้ ChartLabels วาดเองโดยใช้ตัวเลือกเดิมเป็นฐาน */
        if (typeof ChartLabels !== "undefined" && o.indexAxis !== "y") {
            var lab = o.plugins.datalabels || {};
            cfg.data.datasets.forEach(function (ds, di) {
                if (ds.datalabels !== undefined) ds.ctLabelOpts = ds.datalabels;
                ds.datalabels = { display: false };

                /* จำนวนทศนิยมที่ผู้ใช้เลือก (เฉพาะชุด > ทั้งกราฟ) */
                if (!radial) {
                    var decKey = dsKey(ds, di);
                    var dec = pref.decBy && pref.decBy[decKey] != null ? pref.decBy[decKey] : pref.dec;
                    if (dec != null) {
                        var ownF = ds.ctLabelOpts && ds.ctLabelOpts.formatter;
                        ds.ctLabelOpts = Object.assign({}, ds.ctLabelOpts, { formatter: withDecimals(ownF || lab.formatter, dec) });
                        ds.ctDec = dec;
                        ds.ctFmt = function (v) { return fmtDec(v, dec); };     // ทูลทิปใช้ตัวนี้
                    }
                }
                /* ตำแหน่งตัวเลขที่ผู้ใช้เลือกแยกรายชุดข้อมูล (ถ้ามี) */
                var own = pref.labelPosBy && pref.labelPosBy[dsKey(ds, di)];
                if (own) ds.ctLabelPos = own;
            });
            o.plugins.datalabels = { display: false };
            cfg.plugins.push(ChartLabels.create({ base: lab, pos: pref.labelPos || "auto", radial: radial }));

            if (radial) {
                var labelsOn = pref.labels != null ? pref.labels : labelsDefaultOn(entry);
                if (labelsOn) {
                    o.layout = o.layout || {};
                    o.layout.padding = 30;
                }
            }
        }

        /* ---------- เรียงลำดับชุดข้อมูลตามที่ผู้ใช้เลือก (ทำหลังสุด เพราะ key อิงลำดับเดิม) ---------- */
        var hasOrder = !radial && pref.order && pref.order.length;
        if (hasOrder) {
            var oi = orderedIdx(base, pref);
            cfg.data.datasets = oi.map(function (i) { return cfg.data.datasets[i]; });
        }
        if (hasOrder || (!radial && mixed)) {
            /* คำอธิบายกราฟ/ทูลทิปเรียงตามลำดับชุดข้อมูล (ปกติ Chart.js จัดเส้นขึ้นก่อนแท่งในกราฟผสม) */
            o.plugins.legend = o.plugins.legend || {};
            o.plugins.legend.labels = o.plugins.legend.labels || {};
            o.plugins.legend.labels.sort = function (a, b) { return a.datasetIndex - b.datasetIndex; };
            o.plugins.tooltip = o.plugins.tooltip || {};
            o.plugins.tooltip.itemSort = function (a, b) { return a.datasetIndex - b.datasetIndex; };
        }

        return cfg;
    }

    /* ---------- สร้าง / สร้างใหม่ ---------- */

    function instantiate(entry) {
        var existing = typeof Chart !== "undefined" && Chart.getChart ? Chart.getChart(entry.canvas) : null;
        if (existing) existing.destroy();

        /* ความกว้างกราฟ (ผู้ใช้ปรับเอง): หดกรอบของ canvas ให้แคบลงแล้วจัดกลางการ์ด */
        var holder = entry.canvas.parentElement;
        var cw = prefs[entry.id] && prefs[entry.id].chartW;
        if (holder) {
            holder.style.width = cw && cw < 100 ? cw + "%" : "";
            holder.style.marginLeft = holder.style.marginRight = cw && cw < 100 ? "auto" : "";
        }

        entry.chart = new Chart(entry.canvas, buildConfig(entry));
        if (typeof entry.opts.onChange === "function") {
            entry.opts.onChange(entry.chart);
        }
        return entry.chart;
    }

    function create(canvasOrId, config, options) {
        var canvas = typeof canvasOrId === "string" ? document.getElementById(canvasOrId) : canvasOrId;
        if (!canvas || typeof Chart === "undefined") return null;

        var opts = options || {};
        var id = opts.id || canvas.id;
        var radial = isRadial(config);

        if (!opts.kinds) opts.kinds = radial ? ["doughnut", "pie"] : ["bar", "line", "area"];
        if (!opts.initialKind) opts.initialKind = config.type;

        var entry = registry[id] || (registry[id] = { id: id, ui: null });
        entry.canvas = canvas;
        entry.base = config;
        entry.opts = opts;

        instantiate(entry);
        mountButton(entry);

        if (openId === id) renderPanel();
        return entry.chart;
    }

    /* ---------- ปุ่มบนการ์ด ---------- */

    function mountButton(entry) {
        if (entry.ui && document.body.contains(entry.ui.btn)) return;

        var canvas = entry.canvas;
        var card = canvas.closest("[data-ct-card]") || canvas.closest(".chart-card") || canvas.closest(".viz-card");
        if (!card) return;

        var holder = card.querySelector("[data-ct-actions]");

        if (!holder) {
            var header = card.querySelector(".chart-header, .viz-head");
            if (!header) return;

            holder = header.querySelector(".ct-actions");
            if (!holder) {
                holder = el("div", "ct-actions");
                var pill = header.querySelector(".chart-pill");
                if (pill) holder.appendChild(pill);
                header.appendChild(holder);
            }
        }

        var btn = el("button", "ct-btn",
            '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
            '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>' +
            "<span>ปรับแต่งกราฟ</span>");
        btn.type = "button";
        btn.setAttribute("aria-haspopup", "dialog");
        btn.setAttribute("aria-expanded", "false");
        btn.addEventListener("click", function (e) {
            e.stopPropagation();
            togglePanel(entry.id);
        });

        holder.appendChild(btn);
        entry.ui = { btn: btn };
        updateDirtyMark(entry);
    }

    function updateDirtyMark(entry) {
        if (!entry.ui) return;
        var p = prefs[entry.id];
        var dirty = p && Object.keys(p).length > 0;
        entry.ui.btn.classList.toggle("is-dirty", !!dirty);
    }

    /* ---------- แผงปรับแต่ง ---------- */

    function togglePanel(id) {
        if (openId === id) { closePanel(); return; }
        openId = id;
        renderPanel();
        positionPanel();

        // มือถือ: แผงเป็นแผ่นเลื่อนขึ้นจากล่างจอ → เลื่อนกราฟขึ้นมาไว้ด้านบนเพื่อให้เห็นผลที่ปรับทันที
        if (window.innerWidth <= 640 && registry[id]) {
            var top = registry[id].canvas.getBoundingClientRect().top;
            window.scrollBy({ top: top - 90, behavior: "smooth" });
        }
    }

    function closePanel() {
        if (panelEl) { panelEl.remove(); panelEl = null; }
        Object.keys(registry).forEach(function (k) {
            var e = registry[k];
            if (e.ui && e.ui.btn) e.ui.btn.setAttribute("aria-expanded", "false");
        });
        openId = null;
    }

    function setPref(id, key, value) {
        var p = prefs[id] = prefs[id] || {};
        if (value === undefined || value === null) delete p[key];
        else p[key] = value;
        if (Object.keys(p).length === 0) delete prefs[id];
        savePrefs();
    }

    function setColor(id, key, hex) {
        var p = prefs[id] = prefs[id] || {};
        p.colors = p.colors || {};
        p.colors[key] = hex;
        savePrefs();
    }

    /* ตั้งค่าแยกตามชุดข้อมูล field = "series" (ชนิด) หรือ "axes" (แกน) */
    function setSeriesPref(id, field, key, value) {
        var p = prefs[id] = prefs[id] || {};
        p[field] = p[field] || {};
        p[field][key] = value;
        savePrefs();
    }

    function apply(entry, rerenderPanel) {
        instantiate(entry);
        updateDirtyMark(entry);
        if (rerenderPanel) renderPanel();
    }

    function renderPanel() {
        var entry = registry[openId];
        if (!entry) return;

        var scrollTop = panelEl ? panelEl.querySelector(".ct-body").scrollTop : 0;
        if (panelEl) panelEl.remove();

        var pref = prefs[entry.id] || {};
        var base = entry.base;
        var radial = isRadial(base);
        var dss = base.data.datasets;

        // ชนิดที่ใช้จริงของแต่ละชุด (null = เส้นที่วางทับ ไม่แสดงในแผง)
        var kindsNow = dss.map(function (ds, i) {
            return isOverlay(ds, base) ? null : (radial ? null : seriesKind(entry, ds, i));
        });
        var live = kindsNow.filter(function (k) { return k; });
        var uniform = live.length > 0 && live.every(function (k) { return k === live[0]; });
        var kind = radial ? (pref.type || initialKindOf(entry)) : (uniform ? live[0] : null);
        var multi = !radial && live.length >= 2;
        var anyNonBar = live.some(function (k) { return k !== "bar"; });
        var anyStackable = live.some(function (k) { return k === "bar" || k === "area"; });

        panelEl = el("div", "ct-panel");
        panelEl.setAttribute("role", "dialog");
        panelEl.setAttribute("aria-label", "ปรับแต่งกราฟ");
        panelEl.addEventListener("click", function (e) { e.stopPropagation(); });

        var html = "";
        html += '<div class="ct-head"><strong>ปรับแต่งกราฟ</strong>' +
            '<button type="button" class="ct-close" aria-label="ปิด">✕</button></div>';
        html += '<div class="ct-body">';

        /* ชนิดกราฟ */
        if (entry.opts.kinds.length > 1) {
            html += '<div class="ct-sec"><div class="ct-label">ชนิดกราฟ</div><div class="ct-seg">';
            entry.opts.kinds.forEach(function (k) {
                html += '<button type="button" data-kind="' + k + '" class="' + (k === kind ? "is-on" : "") + '">' + KIND_LABEL[k] + "</button>";
            });
            html += "</div>";
            if (!radial && kind === null) {
                html += '<p class="ct-hint">ตอนนี้เป็นกราฟผสม · ปรับชนิดแยกตามข้อมูลได้ด้านล่าง</p>';
            }
            html += "</div>";
        }

        /* สี */
        html += '<div class="ct-sec"><div class="ct-label">' + (multi ? "สี และชนิดของข้อมูลแต่ละชุด" : "สี") + '</div><div class="ct-palettes">';
        PALETTES.forEach(function (p, i) {
            var sw = (p.colors || ["#c8102e", "#eda100", "#2a78d6", "#e87ba4"]).slice(0, 4)
                .map(function (c) { return '<i style="background:' + c + '"></i>'; }).join("");
            html += '<button type="button" class="ct-pal" data-pal="' + i + '" title="' + esc(p.name) + '">' + sw + "<span>" + esc(p.name) + "</span></button>";
        });
        html += "</div><div class=\"ct-colors\">";

        if (radial) {
            base.data.labels.forEach(function (label, i) {
                var key = "0:" + i;
                var color = (pref.colors && pref.colors[key]) || baseColor(base, 0, i);
                html += colorRow(key, label, color);
            });
        } else {
            var liveOrder = orderedIdx(base, pref).filter(function (i) { return kindsNow[i] !== null; });
            orderedIdx(base, pref).forEach(function (i) {
                var ds = dss[i];
                var key = dsKey(ds, i);
                var color = (pref.colors && pref.colors[key]) || baseColor(base, i);
                var row = colorRow(key, ds.label || ("ชุดที่ " + (i + 1)), color);

                if (!multi || kindsNow[i] === null) { html += row; return; }

                /* หลายชุดข้อมูล: ใต้ชื่อแต่ละชุดมีปุ่มเลือก แท่ง/เส้น/พื้นที่ และแกนซ้าย/ขวา */
                var lp = liveOrder.indexOf(i);
                var minis = '<div class="ct-mini ct-mini-move" role="group" aria-label="ลำดับของ ' + esc(ds.label) + '">' +
                    '<span class="ct-mini-cap">ลำดับ ' + (lp + 1) + "/" + liveOrder.length + "</span>" +
                    '<button type="button" data-move="up" data-key="' + esc(key) + '"' + (lp === 0 ? " disabled" : "") + ">▲ ขึ้นก่อน</button>" +
                    '<button type="button" data-move="down" data-key="' + esc(key) + '"' + (lp === liveOrder.length - 1 ? " disabled" : "") + ">▼ ไปหลัง</button></div>";
                minis += '<div class="ct-mini" role="group" aria-label="ชนิดกราฟของ ' + esc(ds.label) + '">';
                entry.opts.kinds.forEach(function (k) {
                    minis += '<button type="button" data-skind="' + k + '" data-key="' + esc(key) + '" class="' +
                        (k === kindsNow[i] ? "is-on" : "") + '">' + KIND_LABEL[k] + "</button>";
                });
                minis += "</div>";

                if (entry.opts.dualAxis) {
                    var ax = (pref.axes && pref.axes[key]) || ds.yAxisID || "y";
                    minis += '<div class="ct-mini ct-mini-axis" role="group" aria-label="แกนของ ' + esc(ds.label) + '">' +
                        '<button type="button" data-saxis="y" data-key="' + esc(key) + '" class="' + (ax !== "y1" ? "is-on" : "") + '">แกนซ้าย</button>' +
                        '<button type="button" data-saxis="y1" data-key="' + esc(key) + '" class="' + (ax === "y1" ? "is-on" : "") + '">แกนขวา</button></div>';
                }

                var ownDec = pref.decBy && pref.decBy[key] != null ? String(pref.decBy[key]) : "inherit";
                minis += '<div class="ct-mini ct-mini-pos" role="group" aria-label="ทศนิยมของ ' + esc(ds.label) + '"><span class="ct-mini-cap">ทศนิยม</span>';
                DEC_OPTS.forEach(function (dv) {
                    minis += '<button type="button" data-sdec="' + dv[0] + '" data-key="' + esc(key) + '" class="' + (dv[0] === ownDec ? "is-on" : "") + '">' + dv[1] + "</button>";
                });
                minis += "</div>";

                if (typeof ChartLabels !== "undefined") {
                    var ownPos = (pref.labelPosBy && pref.labelPosBy[key]) || "inherit";
                    minis += '<div class="ct-mini ct-mini-pos" role="group" aria-label="ตำแหน่งตัวเลขของ ' + esc(ds.label) + '"><span class="ct-mini-cap">ตัวเลข</span>';
                    [["inherit", "ตามกราฟ"], ["top", "บน"], ["center", "กลาง"], ["bottom", "ล่าง"], ["callout", "ลูกศรชี้"]].forEach(function (pv) {
                        minis += '<button type="button" data-spos="' + pv[0] + '" data-key="' + esc(key) + '" class="' +
                            (pv[0] === ownPos ? "is-on" : "") + '">' + pv[1] + "</button>";
                    });
                    minis += "</div>";
                }

                html += '<div class="ct-ser">' + row + '<div class="ct-minis">' + minis + "</div></div>";
            });
        }
        html += "</div></div>";

        /* สวิตช์ */
        html += '<div class="ct-sec"><div class="ct-label">การแสดงผล</div>';

        var dlOn = pref.labels != null ? pref.labels : labelsDefaultOn(entry);
        html += toggle("labels", "แสดงตัวเลขบนกราฟ", dlOn);

        if (typeof ChartLabels !== "undefined") {
            var posList = radial
                ? [["center", "ในวง"], ["outside", "นอกวง"], ["callout", "ลูกศรชี้"]]
                : [["auto", "อัตโนมัติ"], ["top", "บน"], ["center", "กลาง"], ["bottom", "ล่าง"], ["callout", "ลูกศรชี้"]];
            var curPos = pref.labelPos || (radial ? "center" : "auto");
            html += '<div class="ct-labelpos"><div class="ct-sublabel">ตำแหน่งตัวเลข</div><div class="ct-seg ct-seg-sm" role="group" aria-label="ตำแหน่งตัวเลข">';
            posList.forEach(function (pv) {
                html += '<button type="button" data-lpos="' + pv[0] + '" class="' + (pv[0] === curPos ? "is-on" : "") + '">' + pv[1] + "</button>";
            });
            html += "</div></div>";
        }

        if (!radial && typeof ChartLabels !== "undefined") {
            var curDec = pref.dec != null ? String(pref.dec) : "inherit";
            html += '<div class="ct-labelpos"><div class="ct-sublabel">ทศนิยม (ตัวเลขบนกราฟและทูลทิป)</div><div class="ct-seg ct-seg-sm" role="group" aria-label="ทศนิยม">';
            DEC_OPTS.forEach(function (dv) {
                html += '<button type="button" data-dec="' + dv[0] + '" class="' + (dv[0] === curDec ? "is-on" : "") + '">' + dv[1] + "</button>";
            });
            html += "</div></div>";
        }

        if (!radial) {
            var gridOn = pref.grid != null ? pref.grid : gridDefaultOn(entry);
            html += toggle("grid", "เส้นกริดแนวนอน", gridOn);
        }

        var legendOn = pref.legend != null ? pref.legend : legendDefaultOn(entry);
        html += toggle("legend", "คำอธิบายกราฟ", legendOn);

        if (!radial && anyNonBar) {
            var smoothOn = pref.smooth != null ? pref.smooth : (entry.opts.smooth != null ? entry.opts.smooth : true);
            html += toggle("smooth", "เส้นโค้งนุ่ม", smoothOn);
        }

        if (!radial && entry.opts.stackable && anyStackable) {
            var stackOn = pref.stacked != null ? pref.stacked : !!entry.opts.stacked;
            html += toggle("stacked", live.indexOf("bar") === -1 ? "ซ้อนพื้นที่" : "ซ้อนแท่ง", stackOn);
        }

        html += rangeRow("chartW", "ความกว้างกราฟ", pref.chartW != null ? pref.chartW : 100, 40, 100);

        if (!radial && live.indexOf("bar") !== -1) {
            html += rangeRow("barW", "ความกว้างแท่ง", pref.barW != null ? pref.barW : 90, 30, 100);
            html += rangeRow("catW", "ความกว้างกลุ่มแท่ง (มาก = ชิดกัน)", pref.catW != null ? pref.catW : 80, 40, 100);
        }

        html += "</div></div>";

        html += '<div class="ct-foot">' +
            '<button type="button" class="ct-reset">คืนค่าเริ่มต้น</button>' +
            '<button type="button" class="ct-save">ดาวน์โหลดรูป PNG</button></div>';

        panelEl.innerHTML = html;
        document.body.appendChild(panelEl);

        positionPanel();
        panelEl.querySelector(".ct-body").scrollTop = scrollTop;

        /* events */
        panelEl.querySelector(".ct-close").addEventListener("click", closePanel);

        panelEl.querySelectorAll("[data-kind]").forEach(function (b) {
            b.addEventListener("click", function () {
                var k = b.getAttribute("data-kind");
                var p = prefs[entry.id] = prefs[entry.id] || {};
                delete p.series;                                   // เลือกทั้งกราฟ = ล้างค่าที่เลือกแยกชุด
                if (k === initialKindOf(entry) && !hasMixedDefaults(entry)) delete p.type;
                else p.type = k;
                if (Object.keys(p).length === 0) delete prefs[entry.id];
                savePrefs();
                apply(entry, true);
            });
        });

        panelEl.querySelectorAll("[data-skind]").forEach(function (b) {
            b.addEventListener("click", function () {
                setSeriesPref(entry.id, "series", b.getAttribute("data-key"), b.getAttribute("data-skind"));
                apply(entry, true);
            });
        });

        panelEl.querySelectorAll("[data-dec]").forEach(function (b) {
            b.addEventListener("click", function () {
                var v = b.getAttribute("data-dec");
                var p = prefs[entry.id] = prefs[entry.id] || {};
                if (v === "inherit") delete p.dec; else p.dec = +v;
                delete p.decBy;                                    // เลือกทั้งกราฟ = ล้างค่าที่เลือกแยกชุด
                savePrefs();
                apply(entry, true);
            });
        });

        panelEl.querySelectorAll("[data-sdec]").forEach(function (b) {
            b.addEventListener("click", function () {
                var v = b.getAttribute("data-sdec"), key = b.getAttribute("data-key");
                var p = prefs[entry.id] = prefs[entry.id] || {};
                p.decBy = p.decBy || {};
                if (v === "inherit") delete p.decBy[key]; else p.decBy[key] = +v;
                if (!Object.keys(p.decBy).length) delete p.decBy;
                savePrefs();
                apply(entry, true);
            });
        });

        panelEl.querySelectorAll("[data-move]").forEach(function (b) {
            b.addEventListener("click", function () {
                var key = b.getAttribute("data-key");
                var step = b.getAttribute("data-move") === "up" ? -1 : 1;
                var p = prefs[entry.id] = prefs[entry.id] || {};
                var keys = orderedIdx(base, p)
                    .filter(function (i) { return kindsNow[i] !== null; })
                    .map(function (i) { return dsKey(dss[i], i); });
                var j = keys.indexOf(key), k = j + step;
                if (j < 0 || k < 0 || k >= keys.length) return;
                var t = keys[j]; keys[j] = keys[k]; keys[k] = t;
                p.order = keys;
                savePrefs();
                apply(entry, true);
            });
        });

        panelEl.querySelectorAll("[data-spos]").forEach(function (b) {
            b.addEventListener("click", function () {
                var v = b.getAttribute("data-spos"), key = b.getAttribute("data-key");
                var p = prefs[entry.id] = prefs[entry.id] || {};
                p.labelPosBy = p.labelPosBy || {};
                if (v === "inherit") delete p.labelPosBy[key]; else p.labelPosBy[key] = v;
                if (!Object.keys(p.labelPosBy).length) delete p.labelPosBy;
                if (v !== "inherit") p.labels = true;               // เลือกตำแหน่ง = เปิดตัวเลขให้เลย
                savePrefs();
                apply(entry, true);
            });
        });

        panelEl.querySelectorAll("[data-saxis]").forEach(function (b) {
            b.addEventListener("click", function () {
                setSeriesPref(entry.id, "axes", b.getAttribute("data-key"), b.getAttribute("data-saxis"));
                apply(entry, true);
            });
        });

        panelEl.querySelectorAll("[data-pal]").forEach(function (b) {
            b.addEventListener("click", function () {
                var pal = PALETTES[Number(b.getAttribute("data-pal"))];
                var p = prefs[entry.id] = prefs[entry.id] || {};
                if (!pal.colors) {
                    delete p.colors;
                } else {
                    p.colors = {};
                    var n = radial ? base.data.labels.length : base.data.datasets.length;
                    for (var i = 0; i < n; i++) {
                        var color = pal.colors[i % pal.colors.length];
                        p.colors[radial ? "0:" + i : dsKey(base.data.datasets[i], i)] = color;
                    }
                }
                if (Object.keys(p).length === 0) delete prefs[entry.id];
                savePrefs();
                apply(entry, true);
            });
        });

        panelEl.querySelectorAll("input[type=color]").forEach(function (inp) {
            inp.addEventListener("input", function () {
                inp.parentNode.querySelector("code").textContent = inp.value.toUpperCase();
            });
            inp.addEventListener("change", function () {
                inp.parentNode.querySelector("code").textContent = inp.value.toUpperCase();
                setColor(entry.id, inp.getAttribute("data-key"), inp.value);
                apply(entry, false);
            });
        });

        panelEl.querySelectorAll("[data-lpos]").forEach(function (b) {
            b.addEventListener("click", function () {
                var v = b.getAttribute("data-lpos");
                var def = radial ? "center" : "auto";
                var p = prefs[entry.id] = prefs[entry.id] || {};
                if (v === def) delete p.labelPos; else p.labelPos = v;
                delete p.labelPosBy;                               // เลือกทั้งกราฟ = ล้างค่าที่เลือกแยกชุด
                p.labels = true;                                   // เลือกตำแหน่ง = เปิดตัวเลขให้เลย
                savePrefs();
                apply(entry, true);
            });
        });

        panelEl.querySelectorAll("[data-range]").forEach(function (inp) {
            inp.addEventListener("input", function () {
                var key = inp.getAttribute("data-range"), v = +inp.value;
                var p = prefs[entry.id] = prefs[entry.id] || {};
                p[key] = v;
                var tag = panelEl.querySelector('[data-rv="' + key + '"]');
                if (tag) tag.textContent = v + "%";
                savePrefs();
                apply(entry, false);                          // ไม่วาดแผงใหม่ จะได้ลากต่อเนื่องได้
            });
        });

        panelEl.querySelectorAll("[data-toggle]").forEach(function (inp) {
            inp.addEventListener("change", function () {
                setPref(entry.id, inp.getAttribute("data-toggle"), inp.checked);
                apply(entry, true);
            });
        });

        panelEl.querySelector(".ct-reset").addEventListener("click", function () {
            delete prefs[entry.id];
            savePrefs();
            apply(entry, true);
        });

        panelEl.querySelector(".ct-save").addEventListener("click", function () {
            downloadPng(entry);
        });

        entry.ui.btn.setAttribute("aria-expanded", "true");
    }

    function colorRow(key, label, color) {
        return '<label class="ct-color"><span class="ct-color-name">' + esc(label) + "</span>" +
            '<span class="ct-color-pick"><code>' + color.toUpperCase() + "</code>" +
            '<input type="color" data-key="' + key + '" value="' + color + '" aria-label="สีของ ' + esc(label) + '"></span></label>';
    }

    var DEC_OPTS = [["inherit", "ตามเดิม"], ["0", "0"], ["1", "1"], ["2", "2"], ["3", "3"]];

    function rangeRow(key, label, val, min, max) {
        return '<label class="ct-range"><span>' + label + ' <b data-rv="' + key + '">' + val + '%</b></span>' +
            '<input type="range" min="' + min + '" max="' + max + '" step="5" value="' + val + '" data-range="' + key + '"></label>';
    }

    function toggle(key, label, on) {
        return '<label class="ct-switch"><span>' + label + '</span>' +
            '<input type="checkbox" data-toggle="' + key + '"' + (on ? " checked" : "") + '><i></i></label>';
    }

    function labelsDefaultOn(entry) {
        var dl = entry.base.options && entry.base.options.plugins && entry.base.options.plugins.datalabels;
        if (!dl) return false;
        return dl.display !== false;
    }

    function gridDefaultOn(entry) {
        var s = entry.base.options && entry.base.options.scales && entry.base.options.scales.y;
        return !(s && s.grid && s.grid.display === false);
    }

    function legendDefaultOn(entry) {
        var l = entry.base.options && entry.base.options.plugins && entry.base.options.plugins.legend;
        return !(l && l.display === false);
    }

    /* ---------- ตำแหน่งแผง ---------- */

    function positionPanel() {
        if (!panelEl) return;
        var entry = registry[openId];
        if (!entry || !entry.ui) return;

        if (window.innerWidth <= 640) {
            panelEl.classList.add("is-sheet");
            panelEl.style.top = "";
            panelEl.style.left = "";
            return;
        }

        panelEl.classList.remove("is-sheet");
        var r = entry.ui.btn.getBoundingClientRect();
        var w = panelEl.offsetWidth || 340;
        var h = panelEl.offsetHeight || 420;
        var left = Math.min(Math.max(12, r.right - w), window.innerWidth - w - 12);
        var top = r.bottom + 10;

        if (top + h > window.innerHeight - 12) {
            top = Math.max(12, window.innerHeight - h - 12);
        }

        panelEl.style.left = left + "px";
        panelEl.style.top = top + "px";
    }

    window.addEventListener("resize", positionPanel);
    window.addEventListener("scroll", function () {
        if (panelEl) window.requestAnimationFrame(positionPanel);
    }, { passive: true });

    document.addEventListener("click", function (e) {
        if (panelEl && !panelEl.contains(e.target)) closePanel();
    });

    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && panelEl) closePanel();
    });

    /* ---------- ดาวน์โหลด PNG ---------- */

    function downloadPng(entry) {
        var chart = entry.chart;
        if (!chart) return;

        /* วาดกราฟใหม่ที่ 3 เท่าชั่วคราวเพื่อให้ไฟล์ PNG คมชัด แล้วคืนค่าเดิม */
        var prevDpr = chart.options.devicePixelRatio;
        var hiDpr = Math.max(3, prevDpr || 1);
        if (prevDpr !== hiDpr) {
            chart.options.devicePixelRatio = hiDpr;
            chart.resize();
        }

        var src = chart.canvas;
        var out = document.createElement("canvas");
        out.width = src.width;
        out.height = src.height;

        var ctx = out.getContext("2d");
        ctx.fillStyle = css("--card", "#ffffff");
        ctx.fillRect(0, 0, out.width, out.height);
        ctx.drawImage(src, 0, 0);

        if (prevDpr !== hiDpr) {
            chart.options.devicePixelRatio = prevDpr;
            chart.resize();
        }

        var a = document.createElement("a");
        a.download = (entry.opts.title || entry.id || "chart") + ".png";
        a.href = out.toDataURL("image/png");
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    window.ChartTools = {
        create: create,
        palettes: PALETTES,
        toHex: toHex,
        fmtDec: fmtDec,
        css: css,
        rgba: rgba,
        get: function (id) { return registry[id] ? registry[id].chart : null; },
        resetAll: function () {
            prefs = {};
            savePrefs();
            Object.keys(registry).forEach(function (k) { apply(registry[k], false); });
        }
    };
})();
