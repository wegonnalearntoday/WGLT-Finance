
/* Notify Wix loader that the HTML game is ready */
window.addEventListener("load", function () {
  if (window.parent) {
    window.parent.postMessage({ type: "WGLT_READY" }, "*");
  }
});



