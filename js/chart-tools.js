/* =========================================================
   chart-tools.js
   ชุดเครื่องมือ "ปรับแต่งกราฟ" ใช้ร่วมกันทุกหน้า (index.html / cost.html)

   สร้างกราฟด้วย  ChartTools.create(canvas, config, options)
   แทน  new Chart(canvas, config)  แล้วจะได้ปุ่ม "ปรับแต่ง" ที่มุมการ์ดกราฟ
   ผู้ใช้เปลี่ยนได้เอง:
     • ชนิดกราฟ   แท่ง / เส้น / พื้นที่  (หรือ โดนัท / พาย)
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
     labelFormat   ฟังก์ชันจัดรูปตัวเลขเมื่อเปิด "แสดงตัวเลข"
     onChange      ฟังก์ชันที่ถูกเรียกทุกครั้งที่กราฟถูกสร้าง/ปรับใหม่ (รับ chart)
                   ใช้อัปเดตส่วนอื่นของหน้าให้ตรงกับสีที่ผู้ใช้เลือก
   ชุดข้อมูล (dataset) พิเศษ:
     ctColor       สีตั้งต้นของชุดข้อมูล (hex)
     ctFixed       true = ไม่เปลี่ยนชนิดตามที่ผู้ใช้เลือก (เช่น เส้นเฉลี่ยที่วางทับ)
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

    /* ---------- สร้าง config จริงจาก config ตั้งต้น + ค่าที่ผู้ใช้ปรับ ---------- */

    function buildConfig(entry) {
        var base = entry.base;
        var opts = entry.opts;
        var pref = prefs[entry.id] || {};
        var cfg = clone(base);

        cfg.options = cfg.options || {};
        var o = cfg.options;
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

        /* ---------- แท่ง / เส้น / พื้นที่ ---------- */
        if (!radial) {
            var baseKind = initialKindOf(entry);
            var stacked = pref.stacked != null ? pref.stacked : !!opts.stacked;
            var smooth = pref.smooth != null ? pref.smooth : (opts.smooth != null ? opts.smooth : true);
            var kindChanged = kind !== baseKind;

            cfg.type = kind === "bar" ? "bar" : "line";

            cfg.data.datasets.forEach(function (ds, i) {
                var overlay = ds.ctFixed || (ds.type && ds.type !== base.type);
                var color = (pref.colors && pref.colors[String(i)]) || baseColor(base, i);
                var colorChanged = !!(pref.colors && pref.colors[String(i)]);

                if (!overlay) {
                    delete ds.type;
                }

                if (overlay) {
                    if (colorChanged) {
                        ds.borderColor = color;
                        ds.backgroundColor = color;
                        ds.pointBackgroundColor = color;
                    }
                    return;
                }

                var restyle = opts.autoStyle || kindChanged || colorChanged || pref.smooth != null;
                if (!restyle) return;

                if (kind === "bar") {
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
                    var area = kind === "area";
                    ds.borderColor = color;
                    ds.borderWidth = 2.5;
                    ds.tension = smooth ? 0.35 : 0;
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
            });

            /* ซ้อนแท่ง / พื้นที่ */
            if (opts.stackable) {
                o.scales = o.scales || {};
                var doStack = stacked && kind !== "line";
                ["x", "y"].forEach(function (ax) {
                    o.scales[ax] = o.scales[ax] || {};
                    o.scales[ax].stacked = doStack;
                });
            }

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

        return cfg;
    }

    /* ---------- สร้าง / สร้างใหม่ ---------- */

    function instantiate(entry) {
        var existing = typeof Chart !== "undefined" && Chart.getChart ? Chart.getChart(entry.canvas) : null;
        if (existing) existing.destroy();
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
        var kind = pref.type || initialKindOf(entry);

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
            html += "</div></div>";
        }

        /* สี */
        html += '<div class="ct-sec"><div class="ct-label">สี</div><div class="ct-palettes">';
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
            base.data.datasets.forEach(function (ds, i) {
                var color = (pref.colors && pref.colors[String(i)]) || baseColor(base, i);
                html += colorRow(String(i), ds.label || ("ชุดที่ " + (i + 1)), color);
            });
        }
        html += "</div></div>";

        /* สวิตช์ */
        html += '<div class="ct-sec"><div class="ct-label">การแสดงผล</div>';

        var dlOn = pref.labels != null ? pref.labels : labelsDefaultOn(entry);
        html += toggle("labels", "แสดงตัวเลขบนกราฟ", dlOn);

        if (!radial) {
            var gridOn = pref.grid != null ? pref.grid : gridDefaultOn(entry);
            html += toggle("grid", "เส้นกริดแนวนอน", gridOn);
        }

        var legendOn = pref.legend != null ? pref.legend : legendDefaultOn(entry);
        html += toggle("legend", "คำอธิบายกราฟ", legendOn);

        if (!radial && kind !== "bar") {
            var smoothOn = pref.smooth != null ? pref.smooth : (entry.opts.smooth != null ? entry.opts.smooth : true);
            html += toggle("smooth", "เส้นโค้งนุ่ม", smoothOn);
        }

        if (!radial && entry.opts.stackable && kind !== "line") {
            var stackOn = pref.stacked != null ? pref.stacked : !!entry.opts.stacked;
            html += toggle("stacked", kind === "area" ? "ซ้อนพื้นที่" : "ซ้อนแท่ง", stackOn);
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
                setPref(entry.id, "type", k === initialKindOf(entry) ? null : k);
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
                        p.colors[radial ? "0:" + i : String(i)] = color;
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

        var src = chart.canvas;
        var out = document.createElement("canvas");
        out.width = src.width;
        out.height = src.height;

        var ctx = out.getContext("2d");
        ctx.fillStyle = css("--card", "#ffffff");
        ctx.fillRect(0, 0, out.width, out.height);
        ctx.drawImage(src, 0, 0);

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
