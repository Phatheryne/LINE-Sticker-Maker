/* ── i18n ─────────────────────────────────────────────────────────────── */
const I18N = {
  en: {
    title: "LINE Sticker Maker",
    subtitle: "Convert MP4 → APNG animated sticker",
    qs_title: "Quick Start",
    qs_1: "Upload an MP4 (≤ 4 sec, solid-color background works best)",
    qs_2: "Click the background in the preview to set the transparent color",
    qs_3: "Adjust similarity / blend sliders if needed",
    qs_4: "Pick a frame count and hit Convert",
    step1: "Upload Video",
    drop_label: "Drag & drop an MP4 here",
    drop_hint: "or click to browse",
    change: "Change",
    step2: "Pick Background Color",
    canvas_hint: "Click to pick background color",
    bg_color_label: "Background color",
    presets: "Presets:",
    preset_green: "Green screen",
    preset_blue: "Blue screen",
    preset_white: "White background",
    preset_black: "Black background",
    step3: "Settings",
    similarity: "Color similarity",
    similarity_hint: "Higher = remove more shades of the color",
    blend: "Edge blend",
    blend_hint: "Smooths edges around removed color",
    frames: "Frames",
    frames_hint: "LINE requires 5–20 frames",
    specs_title: "LINE Sticker Specs",
    spec_format: "Format:", spec_format_val: "APNG (.png)",
    spec_size: "Max size:", spec_size_val: "320 × 270 px",
    spec_size_note: "(at least one side = 270 px)",
    spec_filesize: "File size:", spec_filesize_val: "≤ 500 KB",
    spec_frames: "Frames:", spec_frames_val: "5–20",
    spec_duration: "Duration:", spec_duration_val: "≤ 4 seconds",
    spec_bg: "Background:", spec_bg_val: "Transparent",
    convert_btn: "Convert to APNG",
    converting: "Converting — this may take a moment…",
    analysing: "Analysing video…",
    done: "Done!",
    download_btn: "Download sticker.png",
    convert_another: "Convert another",
    based_on: "Based on",
    line_guidelines: "LINE Animated Sticker Guidelines",
    developed_by: "Developed by",
    target_dims: "Output will be resized to",
    source: "Source:",
    dimensions: "Dimensions:",
    file_size: "File size:",
  },
  ja: {
    title: "LINEスタンプメーカー",
    subtitle: "MP4を動くスタンプ（APNG）に変換",
    qs_title: "クイックスタート",
    qs_1: "MP4をアップロード（4秒以内・単色背景がおすすめ）",
    qs_2: "プレビューで背景色をクリックして透明化",
    qs_3: "必要に応じて類似度・ブレンドを調整",
    qs_4: "フレーム数を選んで「変換」をクリック",
    step1: "動画をアップロード",
    drop_label: "MP4をここにドラッグ＆ドロップ",
    drop_hint: "またはクリックして選択",
    change: "変更",
    step2: "背景色を選択",
    canvas_hint: "クリックして背景色を取得",
    bg_color_label: "背景色",
    presets: "プリセット:",
    preset_green: "グリーンスクリーン",
    preset_blue: "ブルースクリーン",
    preset_white: "白背景",
    preset_black: "黒背景",
    step3: "設定",
    similarity: "色の類似度",
    similarity_hint: "高いほど広い範囲の色を除去",
    blend: "エッジブレンド",
    blend_hint: "除去した色の境界をなめらかに",
    frames: "フレーム数",
    frames_hint: "LINE仕様：5〜20フレーム",
    specs_title: "LINEスタンプ仕様",
    spec_format: "形式：", spec_format_val: "APNG (.png)",
    spec_size: "最大サイズ：", spec_size_val: "320 × 270 px",
    spec_size_note: "（短辺＝270 px）",
    spec_filesize: "ファイルサイズ：", spec_filesize_val: "500 KB以下",
    spec_frames: "フレーム数：", spec_frames_val: "5〜20",
    spec_duration: "再生時間：", spec_duration_val: "4秒以下",
    spec_bg: "背景：", spec_bg_val: "透明",
    convert_btn: "APNGに変換",
    converting: "変換中… しばらくお待ちください",
    analysing: "動画を解析中…",
    done: "完了！",
    download_btn: "sticker.pngをダウンロード",
    convert_another: "別の動画を変換",
    based_on: "参照：",
    line_guidelines: "LINEアニメーションスタンプガイドライン",
    developed_by: "開発：",
    target_dims: "出力サイズ：",
    source: "元動画：",
    dimensions: "サイズ：",
    file_size: "ファイルサイズ：",
  },
};

let currentLang = (localStorage.getItem("lang") === "en" ? "en" : "ja");
const t = (key) => (I18N[currentLang][key] ?? I18N.en[key] ?? key);

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

/* ── Language switching ───────────────────────────────────────────────── */
function applyLang(lang) {
  currentLang = lang;
  localStorage.setItem("lang", lang);
  document.documentElement.lang = lang;
  document.title = t("title");
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
  });
  document.querySelectorAll(".lang-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.lang === lang);
  });
  // Re-render any dynamic strings already on screen
  if (state.previewInfo) {
    const d = state.previewInfo;
    videoMeta.textContent =
      `${t("source")} ${d.width}×${d.height}px, ${d.duration}s, ${d.fps} fps`;
    targetDims.innerHTML =
      `${t("target_dims")} <strong>${d.target_width}×${d.target_height} px</strong>`;
  }
}

document.querySelectorAll(".lang-btn").forEach((btn) => {
  btn.addEventListener("click", () => applyLang(btn.dataset.lang));
});

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
  progressText.textContent = t("analysing");

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
      `${t("source")} ${data.width}×${data.height}px, ${data.duration}s, ${data.fps} fps`;

    frameSlider.value = data.suggested_frames;
    frameValue.textContent = data.suggested_frames;

    targetDims.innerHTML =
      `${t("target_dims")} <strong>${data.target_width}×${data.target_height} px</strong>`;

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

// Initialize swatch + language
setColor(state.bgColor);
applyLang(currentLang);

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
  progressText.textContent = t("converting");
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
    resultDims.innerHTML = `${t("dimensions")} <strong>${w} × ${h} px</strong>`;
    resultSize.innerHTML = `${t("file_size")} <strong>${formatBytes(fileSizeBytes)}</strong>`;

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
