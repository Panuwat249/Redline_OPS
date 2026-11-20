/* =========================================================
   theme.js
   สลับโหมดสว่าง / มืด ใช้ร่วมกันทุกหน้า

   • ต้องโหลดไว้ใน <head> (ก่อนวาดหน้า) เพื่อไม่ให้หน้าวาบสีขาวก่อนเปลี่ยนเป็นโหมดมืด
   • ครั้งแรกจะตามค่าของเครื่อง (prefers-color-scheme) หลังจากกดปุ่มแล้วจะจำค่าที่เลือกไว้
   • ปุ่มสลับ: ใส่ attribute  data-theme-toggle  ที่ปุ่มใดก็ได้
   • เมื่อธีมเปลี่ยน จะส่งอีเวนต์  "themechange"  ให้หน้าวาดกราฟใหม่ด้วยสีของธีมนั้น
   ========================================================= */

(function () {
    "use strict";

    var KEY = "redline-theme";
    var root = document.documentElement;

    function stored() {
        try { return localStorage.getItem(KEY); } catch (e) { return null; }
    }

    function systemDark() {
        return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    }

    function current() {
        var s = stored();
        if (s === "dark" || s === "light") return s;
        return systemDark() ? "dark" : "light";
    }

    function paint(theme) {
        root.setAttribute("data-theme", theme);

        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute("content", theme === "dark" ? "#150e10" : "#c8102e");

        document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
            btn.setAttribute("aria-pressed", String(theme === "dark"));
            btn.setAttribute("aria-label", theme === "dark" ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด");
            btn.setAttribute("title", theme === "dark" ? "โหมดสว่าง" : "โหมดมืด");
        });
    }

    function set(theme, remember) {
        if (remember) {
            try { localStorage.setItem(KEY, theme); } catch (e) { /* ใช้ต่อได้ แม้จำค่าไม่ได้ */ }
        }
        paint(theme);
        window.dispatchEvent(new CustomEvent("themechange", { detail: theme }));
    }

    paint(current());

    window.RedlineTheme = {
        get: current,
        toggle: function () { set(current() === "dark" ? "light" : "dark", true); }
    };

    document.addEventListener("DOMContentLoaded", function () {
        paint(current());

        document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
            btn.addEventListener("click", window.RedlineTheme.toggle);
        });
    });

    // ยังไม่เคยเลือกเอง → ตามการตั้งค่าของเครื่องแบบเรียลไทม์
    if (window.matchMedia) {
        var mq = window.matchMedia("(prefers-color-scheme: dark)");
        var onSystem = function () { if (!stored()) set(systemDark() ? "dark" : "light", false); };

        if (mq.addEventListener) mq.addEventListener("change", onSystem);
        else if (mq.addListener) mq.addListener(onSystem);
    }
})();
