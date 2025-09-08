// stls-hello-1.0.0.js
(function () {
  function onReady(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  function addHello() {
    // Only run inside HireHop Job pages
    if (typeof user === "undefined" || typeof doc_type === "undefined" || doc_type !== "job") return false;

    // Make the "Hello" label
    var hello = document.createElement("span");
    hello.textContent = " Hello";
    hello.style.color = "#15803d";          // green
    hello.style.fontWeight = "600";
    hello.style.marginLeft = "8px";

    // Try a few common title-bar containers used in HireHop UI
    var header = document.querySelector("#title_bar, #titlebar, .title_bar, .titleBar, .hh-title-bar");
    if (header) {
      header.appendChild(hello);
      return true;
    }

    // Fallback: small visible marker near the page header
    var tag = document.createElement("div");
    tag.textContent = "Hello";
    tag.style.position = "fixed";
    tag.style.top = "8px";
    tag.style.left = "8px";
    tag.style.color = "#15803d";
    tag.style.fontWeight = "700";
    tag.style.background = "rgba(0,0,0,0.05)";
    tag.style.border = "1px solid rgba(0,0,0,0.10)";
    tag.style.padding = "2px 6px";
    tag.style.borderRadius = "4px";
    tag.style.zIndex = "9999";
    document.body.appendChild(tag);
    return true;
  }

  onReady(function () {
    // HireHop builds pages dynamically; retry a few times until the header exists
    var tries = 0, timer = setInterval(function () {
      tries++;
      if (addHello() || tries > 20) clearInterval(timer);
    }, 200);
  });
})();
