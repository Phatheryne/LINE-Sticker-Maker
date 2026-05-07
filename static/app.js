/* ── State ────────────────────────────────────────────────────────────── */
const state = {
  file: null,
  bgColor: "#00FF00",
  previewInfo: null,
  resultBlob: null,
  resultObjectURL: null,  // tracked so we can revoke on re-convert / restart
};

/* ── DOM refs ─────────────────────────────────────────────────────────── */
const dropZone       = document.getElementById("drop-zone");
const fileInput      = document.getElementById("file-input");
const fileInfo       = document.getElementById("file-info");
const fileName       = document.getElementById("file-name");
const changeFileBtn  = document.getElementById("change-file-btn");
const previewSection = document.getElementById("preview-section");
const previewCanvas  = document.getElementById("preview-canvas");
const colorSwatch    = document.getElementById("color-swatch");
const colorPickerNative = document.getElementById("color-picker-native");
const bgColorInput   = document.getElementById("bg-color-input");
const videoMeta      = document.getElementById("video-meta");
const settingsSection = document.getElementById("settings-section");
const similaritySlider = document.getElementById("similarity-slider");
const similarityValue  = document.getElementById("similarity-value");
const blendSlider    = document.getElementById("blend-slider");
const blendValue     = document.getElementById("blend-value");
const frameSlider    = document.getElementById("frame-slider");
const frameValue     = document.getElementById("frame-value");
const targetDims     = document.getElementById("target-dims");
const convertRow     = document.getElementById("convert-row");
const convertBtn     = document.getElementById("convert-btn");
const progressSection = document.getElementById("progress-section");
const progressText   = document.getElementById("progress-text");
const resultSection  = document.getElementById("result-section");
const resultImg      = document.getElementById("result-img");
const resultDims     = document.getElementById("result-dims");
const resultSize     = document.getElementById("result-size");
const sizeWarning        = document.getElementById("size-warning");
const autoCompressNote   = document.getElementById("auto-compress-note");
const downloadBtn    = document.getElementById("download-btn");
const restartBtn     = document.getElementById("restart-btn");

/* ── Helpers ──────────────────────────────────────────────────────────── */
function show(el) { el.hidden = false; }
function hide(el) { el.hidden = true; }

function isValidHex(val) { return /^#[0-9A-Fa-f]{6}$/.test(val); }

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  return Math.round(bytes / 1024) + " KB";
}

function setColor(hex) {
  if (!isValidHex(hex)) return;
  state.bgColor = hex.toUpperCase();
  colorSwatch.style.background = hex;
  colorPickerNative.value = hex;
  bgColorInput.value = hex.toUpperCase();
}

/* ── File selection ───────────────────────────────────────────────────── */
dropZone.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("drag-over");
});
dropZone.addEventListener("dragleave", (e) => {
  // Only remove highlight when leaving the drop-zone itself, not a child element
  if (!dropZone.contains(e.relatedTarget)) {
    dropZone.classList.remove("drag-over");
  }
});
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});
fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
});
changeFileBtn.addEventListener("click", () => fileInput.click());

function handleFile(file) {
  state.file = file;
  fileName.textContent = file.name;
  show(fileInfo);
  hide(previewSection);
  hide(settingsSection);
  hide(convertRow);
  hide(resultSection);
  hide(progressSection);
  uploadPreview(file);
}

/* ── Upload & preview ─────────────────────────────────────────────────── */
async function uploadPreview(file) {
  const formData = new FormData();
  formData.append("file", file);

  show(progressSection);
  progressText.textContent = "Analysing video…";

  try {
    const res = await fetch("/preview", { method: "POST", body: formData });
    const data = await res.json();
    hide(progressSection);

    if (!res.ok) {
      alert("Error: " + (data.error || "Unknown error"));
      return;
    }

    state.previewInfo = data;

    // Draw first frame onto canvas
    const img = new Image();
    img.onload = () => {
      previewCanvas.width  = data.target_width;
      previewCanvas.height = data.target_height;
      const ctx = previewCanvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
    };
    img.src = "data:image/png;base64," + data.frame_b64;

    videoMeta.textContent =
      `Source: ${data.width}×${data.height}px, ${data.duration}s, ${data.fps} fps`;

    frameSlider.value = data.suggested_frames;
    frameValue.textContent = data.suggested_frames;

    targetDims.innerHTML =
      `Output will be resized to <strong>${data.target_width}×${data.target_height} px</strong>`;

    show(previewSection);
    show(settingsSection);
    show(convertRow);
  } catch (err) {
    hide(progressSection);
    alert("Network error: " + err.message);
  }
}

/* ── Color picking from canvas ────────────────────────────────────────── */
previewCanvas.addEventListener("click", (e) => {
  const rect = previewCanvas.getBoundingClientRect();
  const scaleX = previewCanvas.width  / rect.width;
  const scaleY = previewCanvas.height / rect.height;
  // Clamp to valid pixel range so getImageData never goes out of bounds
  const x = Math.min(Math.floor((e.clientX - rect.left) * scaleX), previewCanvas.width  - 1);
  const y = Math.min(Math.floor((e.clientY - rect.top)  * scaleY), previewCanvas.height - 1);
  const ctx = previewCanvas.getContext("2d");
  const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
  const hex = "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
  setColor(hex);
});

/* ── Color controls ───────────────────────────────────────────────────── */
colorPickerNative.addEventListener("input", () => setColor(colorPickerNative.value));

bgColorInput.addEventListener("input", () => {
  const val = bgColorInput.value.trim();
  const normalized = val.startsWith("#") ? val : "#" + val;
  if (isValidHex(normalized)) setColor(normalized);
});

document.querySelectorAll(".preset-btn").forEach((btn) => {
  btn.addEventListener("click", () => setColor(btn.dataset.color));
});

// Initialize swatch to default
setColor(state.bgColor);

/* ── Sliders ──────────────────────────────────────────────────────────── */
similaritySlider.addEventListener("input", () => {
  similarityValue.textContent = parseFloat(similaritySlider.value).toFixed(2);
});

blendSlider.addEventListener("input", () => {
  blendValue.textContent = parseFloat(blendSlider.value).toFixed(2);
});

frameSlider.addEventListener("input", () => {
  frameValue.textContent = frameSlider.value;
});

/* ── Convert ──────────────────────────────────────────────────────────── */
convertBtn.addEventListener("click", runConvert);

async function runConvert() {
  if (!state.file) return;

  convertBtn.disabled = true;
  show(progressSection);
  progressText.textContent = "Converting — this may take a moment…";
  hide(resultSection);

  const formData = new FormData();
  formData.append("file", state.file);
  formData.append("bg_color", state.bgColor);
  formData.append("similarity", similaritySlider.value);
  formData.append("blend", blendSlider.value);
  formData.append("frame_count", frameSlider.value);

  try {
    const res = await fetch("/convert", { method: "POST", body: formData });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    const blob = await res.blob();
    state.resultBlob = blob;

    const fileSizeBytes = parseInt(res.headers.get("X-File-Size") || "0", 10);
    const w = res.headers.get("X-Target-Width");
    const h = res.headers.get("X-Target-Height");
    const warning = res.headers.get("X-Size-Warning");
    const autoCompressed = res.headers.get("X-Auto-Compressed");

    hide(progressSection);
    convertBtn.disabled = false;

    // Revoke previous object URL before creating a new one
    if (state.resultObjectURL) {
      URL.revokeObjectURL(state.resultObjectURL);
    }
    const url = URL.createObjectURL(blob);
    state.resultObjectURL = url;

    resultImg.src = url;
    resultDims.innerHTML = `Dimensions: <strong>${w} × ${h} px</strong>`;
    resultSize.innerHTML = `File size: <strong>${formatBytes(fileSizeBytes)}</strong>`;

    if (warning) {
      sizeWarning.textContent = warning;
      show(sizeWarning);
    } else {
      hide(sizeWarning);
    }
    if (autoCompressed) {
      autoCompressNote.textContent = autoCompressed;
      show(autoCompressNote);
    } else {
      hide(autoCompressNote);
    }

    downloadBtn.onclick = () => {
      const a = document.createElement("a");
      a.href = url;
      a.download = "sticker.png";
      a.click();
    };

    show(resultSection);
    resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    hide(progressSection);
    convertBtn.disabled = false;
    alert("Conversion failed: " + err.message);
  }
}

/* ── Restart ──────────────────────────────────────────────────────────── */
restartBtn.addEventListener("click", () => {
  if (state.resultObjectURL) {
    URL.revokeObjectURL(state.resultObjectURL);
    state.resultObjectURL = null;
  }
  state.file = null;
  state.previewInfo = null;
  state.resultBlob = null;
  fileInput.value = "";
  hide(fileInfo);
  hide(previewSection);
  hide(settingsSection);
  hide(convertRow);
  hide(progressSection);
  hide(resultSection);
  resultImg.src = "";
  window.scrollTo({ top: 0, behavior: "smooth" });
});
