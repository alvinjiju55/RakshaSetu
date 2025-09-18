// qr.js

let qrInstance = null;

function generateQR(elementId, text) {
  const container = document.getElementById(elementId);
  container.innerHTML = "";
  container.classList.add("qr-quiet-zone");

  qrInstance = new QRCode(container, {
    text,
    width: 360,
    height: 360,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M
  });
}

function downloadCurrentQR(elementId, filename = "block-qr.png") {
  const container = document.getElementById(elementId);
  const img = container.querySelector("img");
  const canvas = container.querySelector("canvas");
  const src = img?.src || canvas?.toDataURL("image/png");
  if (!src) return;
  const a = document.createElement("a");
  a.href = src;
  a.download = filename;
  a.click();
}

let scannerInstance = null;
let scannerRunning = false;

async function startScanner({
  elementId = "reader",
  onText
} = {}) {
  if (scannerRunning) return;
  scannerRunning = true;

  const config = {
    fps: 10,
    qrbox: { width: 320, height: 320 },
    aspectRatio: 1.0
  };

  const html5QrcodeScanner = new Html5Qrcode(elementId);

  try {
    await html5QrcodeScanner.start(
      { facingMode: "environment" },
      config,
      (decodedText, decodedResult) => {
        if (typeof onText === "function") onText(decodedText, decodedResult);
      },
      (_) => {}
    );

    setTimeout(() => {
      try {
        html5QrcodeScanner.applyVideoConstraints({
          focusMode: "continuous",
          advanced: [{ zoom: 2.0 }]
        });
      } catch {}
    }, 1200);

    scannerInstance = html5QrcodeScanner;
  } catch (err) {
    scannerRunning = false;
    throw err;
  }
}

async function stopScanner() {
  if (!scannerInstance) return;
  try {
    await scannerInstance.stop();
  } finally {
    await scannerInstance.clear();
    scannerInstance = null;
    scannerRunning = false;
  }
}

function captureScannerFrame(mime = "image/png", quality) {
  if (!scannerInstance || !scannerRunning) return null;
  const readerEl = document.getElementById("reader");
  const video = readerEl ? readerEl.querySelector("video") : null;
  if (!video || video.readyState < 2) return null;

  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, w, h);

  try {
    return canvas.toDataURL(mime, quality);
  } catch {
    return null;
  }
}

window.QRUtils = {
  generateQR,
  downloadCurrentQR,
  startScanner,
  stopScanner,
  captureScannerFrame
};
