// app.js

// Optional public base for URL QR (set when deployed), else fallback to plain text
const PUBLIC_BASE_URL = ""; // e.g., "https://yourdomain.example/index.html"

const chain = new SimpleChain.Blockchain();

const els = {
  form: document.getElementById("data-form"),
  farmerName: document.getElementById("farmerName"),
  animalId: document.getElementById("animalId"),
  medicineName: document.getElementById("medicineName"),
  dosage: document.getElementById("dosage"),
  treatDate: document.getElementById("treatDate"),
  withdrawDate: document.getElementById("withdrawDate"),

  qrOut: document.getElementById("qr-output"),
  dlQR: document.getElementById("download-qr"),
  latestBlock: document.getElementById("latest-block"),
  chainView: document.getElementById("chain-view"),
  validateBtn: document.getElementById("validate-chain"),
  clearBtn: document.getElementById("clear-chain"),
  validationResult: document.getElementById("validation-result"),
  scanResult: document.getElementById("scan-result"),
  parsedFields: document.getElementById("parsed-fields"),
  toggleScan: document.getElementById("toggle-scan"),

  captureBtn: document.getElementById("capture-frame"),
  clearCaptureBtn: document.getElementById("clear-capture"),
  capturedImg: document.getElementById("captured-img"),

  decodeCaptureBtn: document.getElementById("decode-capture"),
  captureCanvas: document.getElementById("capture-canvas"),

  genUrlQr: document.getElementById("generate-url-qr")
};

function renderLatest() {
  const latest = chain.getLatestBlock();
  els.latestBlock.textContent = JSON.stringify(latest, null, 2);
}

function renderChain() {
  const list = document.createElement("ol");
  list.style.paddingLeft = "20px";
  list.style.lineHeight = "1.4";
  chain.chain.forEach((b) => {
    const d = b.data || {};
    const li = document.createElement("li");
    li.innerHTML = `<code>#${b.index}</code> &nbsp; <code>hash:</code> ${b.hash.slice(0, 12)}... &nbsp; <code>prev:</code> ${b.previousHash.slice(0, 12)}... &nbsp; <code>farmer:</code> ${d.farmerName ?? ""} &nbsp; <code>animal:</code> ${d.animalId ?? ""}`;
    list.appendChild(li);
  });
  els.chainView.innerHTML = "";
  els.chainView.appendChild(list);
}

function validateForm(data) {
  const required = ["farmerName", "animalId", "medicineName", "dosage", "treatDate", "withdrawDate"];
  for (const k of required) {
    if (!data[k] || !String(data[k]).trim()) throw new Error(`Missing required field: ${k}`);
  }
  // Basic date sanity: withdrawal >= treatment
  if (data.withdrawDate < data.treatDate) {
    throw new Error("Withdrawal date cannot be earlier than treatment date");
  }
}

function getFormData() {
  const data = {
    farmerName: els.farmerName.value.trim(),
    animalId: els.animalId.value.trim(),
    medicineName: els.medicineName.value.trim(),
    dosage: els.dosage.value.trim(),
    treatDate: els.treatDate.value,     // yyyy-mm-dd
    withdrawDate: els.withdrawDate.value
  };
  validateForm(data);
  return data;
}

// Plain-text payload tuned for Lens and readability
function buildLensText(rec) {
  // Keep short lines to reduce QR density
  return [
    `Farmer: ${rec.farmerName}`,
    `Animal: ${rec.animalId}`,
    `Med: ${rec.medicineName}`,
    `Dose: ${rec.dosage}`,
    `Treat: ${rec.treatDate}`,
    `Withdraw: ${rec.withdrawDate}`
  ].join(" | ");
}

// Optional URL payload if PUBLIC_BASE_URL is set
function buildUrlQr(rec) {
  const params = new URLSearchParams({
    farmer: rec.farmerName,
    animal: rec.animalId,
    med: rec.medicineName,
    dose: rec.dosage,
    treat: rec.treatDate,
    wd: rec.withdrawDate
  });
  if (PUBLIC_BASE_URL && /^https?:\/\//i.test(PUBLIC_BASE_URL)) {
    const sep = PUBLIC_BASE_URL.includes("#") ? "&" : "#view&";
    return `${PUBLIC_BASE_URL}${sep}${params.toString()}`;
  }
  // Fallback to plain text if not configured
  return buildLensText(rec);
}

function onFormSubmit(e) {
  e.preventDefault();
  try {
    const rec = getFormData();
    const newBlock = chain.addBlock(rec);
    renderLatest();
    renderChain();

    const text = buildLensText(rec);
    QRUtils.generateQR("qr-output", text);
  } catch (err) {
    alert(err.message || String(err));
  }
}

function onGenerateUrlQr() {
  try {
    const latest = chain.getLatestBlock();
    if (!latest || latest.index === 0) {
      alert("Add at least one block first.");
      return;
    }
    const rec = latest.data || {};
    const urlOrText = buildUrlQr(rec);
    QRUtils.generateQR("qr-output", urlOrText);
  } catch (err) {
    alert(err.message || String(err));
  }
}

function onDownloadQR() { QRUtils.downloadCurrentQR("qr-output", "block-qr.png"); }

function onValidateChain() {
  const ok = chain.isChainValid();
  els.validationResult.textContent = ok ? "Chain is valid ✅" : "Chain is INVALID ❌";
}

function onClearChain() {
  if (!confirm("Clear the whole chain?")) return;
  chain.clear();
  renderLatest();
  renderChain();
  els.validationResult.textContent = "Chain cleared";
}

let scanning = false;

async function onToggleScan() {
  try {
    if (!scanning) {
      await QRUtils.startScanner({
        elementId: "reader",
        onText: (txt) => handleDecodedText(txt)
      });
      els.toggleScan.textContent = "Stop Scanner";
      scanning = true;
    } else {
      await QRUtils.stopScanner();
      els.toggleScan.textContent = "Start/Stop Scanner";
      scanning = false;
    }
  } catch (err) {
    alert((err && err.message) || "Scanner error");
  }
}

function handleDecodedText(txt) {
  els.scanResult.textContent = txt;

  // Try plain-text key parsing first (Lens-friendly pattern)
  // Pattern: Farmer: X | Animal: Y | Med: Z | Dose: D | Treat: 2025-09-17 | Withdraw: 2025-09-25
  const kvPairs = {};
  txt.split("|").forEach(seg => {
    const [k, ...rest] = seg.split(":");
    if (!k || rest.length === 0) return;
    kvPairs[k.trim().toLowerCase()] = rest.join(":").trim();
  });

  if (kvPairs["farmer"] || kvPairs["animal"]) {
    els.parsedFields.innerHTML = `
      <div><strong>Farmer:</strong> ${kvPairs["farmer"] ?? ""}</div>
      <div><strong>Animal:</strong> ${kvPairs["animal"] ?? ""}</div>
      <div><strong>Medicine:</strong> ${kvPairs["med"] ?? ""}</div>
      <div><strong>Dosage:</strong> ${kvPairs["dose"] ?? ""}</div>
      <div><strong>Treat:</strong> ${kvPairs["treat"] ?? ""}</div>
      <div><strong>Withdraw:</strong> ${kvPairs["withdraw"] ?? kvPairs["withdrawal"] ?? ""}</div>
    `;
    return;
  }

  // Try JSON payloads if any
  try {
    const obj = JSON.parse(txt);
    const d = obj?.data ?? obj ?? {};
    els.parsedFields.innerHTML = `
      <div><strong>Farmer:</strong> ${d.farmerName ?? ""}</div>
      <div><strong>Animal:</strong> ${d.animalId ?? ""}</div>
      <div><strong>Medicine:</strong> ${d.medicineName ?? ""}</div>
      <div><strong>Dosage:</strong> ${d.dosage ?? ""}</div>
      <div><strong>Treat:</strong> ${d.treatDate ?? ""}</div>
      <div><strong>Withdraw:</strong> ${d.withdrawDate ?? ""}</div>
    `;
  } catch {
    els.parsedFields.textContent = "Parsed text not recognized as expected format";
  }
}

function onCaptureFrame() {
  const dataUrl = QRUtils.captureScannerFrame("image/png");
  if (!dataUrl) {
    alert("Start the scanner first and ensure the camera is active.");
    return;
  }
  els.capturedImg.src = dataUrl;
}

function onClearCapture() {
  els.capturedImg.removeAttribute("src");
  els.scanResult.textContent = "";
  els.parsedFields.textContent = "";
}

function onDecodeCaptured() {
  const img = els.capturedImg;
  if (!img || !img.src) {
    alert("No captured frame available. Capture a frame first.");
    return;
  }

  function drawToCanvas(image, maxDim = 1000) {
    const canvas = els.captureCanvas;
    const ctx = canvas.getContext("2d");
    const iw = image.naturalWidth || image.width;
    const ih = image.naturalHeight || image.height;
    const scale = Math.min(1, maxDim / Math.max(iw, ih));
    const w = Math.max(1, Math.round(iw * scale));
    const h = Math.max(1, Math.round(ih * scale));
    canvas.width = w;
    canvas.height = h;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, w, h);
    return canvas;
  }

  const attempts = ["attemptBoth", "dontInvert", "invertFirst", "onlyInvert"];

  const tmp = new Image();
  tmp.crossOrigin = "anonymous";
  tmp.onload = () => {
    const canvas = drawToCanvas(tmp, 1000);
    const ctx = canvas.getContext("2d");
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    let decoded = null;
    for (const inv of attempts) {
      decoded = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: inv });
      if (decoded && decoded.data) break;
    }

    if (decoded && decoded.data) {
      handleDecodedText(decoded.data);
    } else {
      els.scanResult.textContent = "No QR detected in captured image (try closer, brighter, larger QR)";
      els.parsedFields.textContent = "";
    }
  };
  tmp.onerror = () => { alert("Failed to load captured image for decoding."); };
  tmp.src = img.src;
}

els.form.addEventListener("submit", onFormSubmit);
els.dlQR.addEventListener("click", onDownloadQR);
els.validateBtn.addEventListener("click", onValidateChain);
els.clearBtn.addEventListener("click", onClearChain);
els.toggleScan.addEventListener("click", onToggleScan);
els.genUrlQr.addEventListener("click", onGenerateUrlQr);
els.captureBtn.addEventListener("click", onCaptureFrame);
els.clearCaptureBtn.addEventListener("click", onClearCapture);
els.decodeCaptureBtn.addEventListener("click", onDecodeCaptured);

renderLatest();
renderChain();
parseHashView();

function parseHashView() {
  const h = window.location.hash || "";
  if (!h.startsWith("#view")) return;
  const hash = h.slice(6); // after "#view&"
  const map = Object.fromEntries(new URLSearchParams(hash));
  els.parsedFields.innerHTML = `
    <div><strong>Farmer:</strong> ${map.farmer ?? ""}</div>
    <div><strong>Animal:</strong> ${map.animal ?? ""}</div>
    <div><strong>Medicine:</strong> ${map.med ?? ""}</div>
    <div><strong>Dosage:</strong> ${map.dose ?? ""}</div>
    <div><strong>Treat:</strong> ${map.treat ?? ""}</div>
    <div><strong>Withdraw:</strong> ${map.wd ?? ""}</div>
  `;
  els.scanResult.textContent = `URL Params → ${decodeURIComponent(hash)}`;
}
