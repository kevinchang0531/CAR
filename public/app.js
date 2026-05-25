const LEXUS_BASE = "https://www.lexuscpo.com.tw";
const TESLA_BASE = "https://www.tesla.com";
const EQUIPMENT_KEYS = [
  "CarPlay",
  "Lss",
  "Lss2",
  "Lss3",
  "Bsm",
  "Ics",
  "Rias",
  "SurroundView",
  "Epb",
  "Fsrivdmscs"
];

const TESLA_NEW_PRICE_BASELINE = {
  "Model 3": 1749900,
  "Model 3 Long Range": 1749900,
  "Model 3 Performance": 1999900,
  "Model Y": 1899900,
  "Model Y Long Range": 2299900,
  "Model Y Performance": 2499900,
  "Model S": 0,
  "Model X": 0
};

const state = {
  cars: [],
  sourceWarnings: [],
  filtered: []
};

const elements = {
  source: document.querySelector("#sourceFilter"),
  series: document.querySelector("#seriesFilter"),
  keyword: document.querySelector("#keywordFilter"),
  year: document.querySelector("#yearFilter"),
  mileage: document.querySelector("#mileageFilter"),
  refresh: document.querySelector("#refreshButton"),
  totalCars: document.querySelector("#totalCars"),
  bestCp: document.querySelector("#bestCp"),
  avgDiscount: document.querySelector("#avgDiscount"),
  updatedAt: document.querySelector("#updatedAt"),
  visibleCount: document.querySelector("#visibleCount"),
  status: document.querySelector("#statusMessage"),
  body: document.querySelector("#inventoryBody"),
  topList: document.querySelector("#topList"),
  topTemplate: document.querySelector("#topCardTemplate")
};

function numberFrom(...values) {
  for (const value of values) {
    const parsed = Number(String(value ?? "").replace(/[^\d.]/g, ""));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 0;
}

function money(value) {
  if (!Number.isFinite(value) || value <= 0) return "--";
  return `${Math.round(value / 10000).toLocaleString("zh-TW")}萬`;
}

function percent(value) {
  if (!Number.isFinite(value)) return "--";
  return `${value.toFixed(1)}%`;
}

function formatMileage(value) {
  if (!Number.isFinite(value) || value < 0) return "--";
  return `${value.toLocaleString("zh-TW")} km`;
}

function equipmentScore(raw) {
  const available = EQUIPMENT_KEYS.filter((key) => raw[key] === true).length;
  return available / EQUIPMENT_KEYS.length;
}

function calculateCp(car) {
  const discountRate = car.newPrice > 0 ? (car.newPrice - car.salePrice) / car.newPrice : 0;
  const currentYear = new Date().getFullYear();
  const age = Number.isFinite(car.year) ? Math.max(0, currentYear - car.year) : 8;
  const mileagePenalty = Number.isFinite(car.mileage) ? Math.min(22, car.mileage / 5000) : 12;
  const agePenalty = Math.min(18, age * 2.2);
  const equipmentBonus = car.equipmentScore * 14;

  return Math.max(0, discountRate * 100 + equipmentBonus - mileagePenalty - agePenalty);
}

function finishCar(car) {
  const discount = car.newPrice > 0 ? car.newPrice - car.salePrice : 0;
  const discountRate = car.newPrice > 0 ? (discount / car.newPrice) * 100 : 0;
  const normalized = {
    ...car,
    discount,
    discountRate
  };

  return {
    ...normalized,
    cp: calculateCp(normalized)
  };
}

function normalizeLexus(raw) {
  return finishCar({
    id: raw.ID,
    source: "Lexus CPO",
    series: raw.Series || "Lexus",
    model: raw.Model || raw.Series || "Lexus CPO",
    trim: raw.CarType || "",
    year: Number(raw.Year),
    mileage: Number(raw.Mileage),
    salePrice: Number(raw.SellPrice),
    newPrice: Number(raw.Prices),
    store: raw.Store || "",
    color: raw.ColorString || "",
    displacement: raw.EngineDisplacement || "",
    imageUrl: raw.ImagePath ? `${LEXUS_BASE}${raw.ImagePath}` : "",
    detailUrl: `${LEXUS_BASE}/Home/Details/${raw.ID}`,
    equipmentScore: equipmentScore(raw)
  });
}

function teslaModelName(raw) {
  const text = [
    raw.TrimName,
    raw.Trim,
    raw.ModelName,
    raw.Model,
    raw.Title,
    raw.VehicleName
  ]
    .filter(Boolean)
    .join(" ");

  if (/model\s*y|(^|\W)my($|\W)/i.test(text)) return "Model Y";
  if (/model\s*s|(^|\W)ms($|\W)/i.test(text)) return "Model S";
  if (/model\s*x|(^|\W)mx($|\W)/i.test(text)) return "Model X";
  return "Model 3";
}

function teslaNewPrice(raw, modelName) {
  const trim = String(raw.TrimName || raw.Trim || raw.ADLEnabled || "").toLowerCase();
  if (modelName === "Model Y" && trim.includes("performance")) return TESLA_NEW_PRICE_BASELINE["Model Y Performance"];
  if (modelName === "Model Y" && trim.includes("long")) return TESLA_NEW_PRICE_BASELINE["Model Y Long Range"];
  if (modelName === "Model 3" && trim.includes("performance")) return TESLA_NEW_PRICE_BASELINE["Model 3 Performance"];
  if (modelName === "Model 3" && trim.includes("long")) return TESLA_NEW_PRICE_BASELINE["Model 3 Long Range"];
  return TESLA_NEW_PRICE_BASELINE[modelName] || numberFrom(raw.MSRP, raw.NewPrice);
}

function teslaImage(raw, modelName) {
  const images = raw.Images || raw.Pictures || raw.ImageURLs || [];
  if (Array.isArray(images) && images.length > 0) {
    const first = images[0]?.url || images[0]?.Url || images[0];
    if (first) return String(first).startsWith("http") ? first : `${TESLA_BASE}${first}`;
  }

  const modelSlug = modelName.toLowerCase().replace(" ", "");
  return `${TESLA_BASE}/model${modelSlug.slice(-1)}`;
}

function normalizeTesla(raw) {
  const modelName = teslaModelName(raw);
  const salePrice = numberFrom(raw.price, raw.Price, raw.PurchasePrice, raw.TotalPrice, raw.InventoryPrice, raw.SalesPrice);
  const year = Number(raw.year || raw.Year || raw.ModelYear);
  const mileage = numberFrom(raw.odometer, raw.Odometer, raw.Mileage, raw.UsedVehicleOdometer);
  const vin = raw.VIN || raw.Vin || raw.vin || "";
  const store = raw.City || raw.DeliveryLocation || raw.Location || raw.StateProvince || "Tesla Taiwan";
  const trim = raw.trim || raw.TrimName || raw.Trim || raw.OptionCodeData || "";
  const isNew = raw.status === "new";

  return finishCar({
    id: vin || `${modelName}-${salePrice}-${mileage}`,
    source: "Tesla",
    series: modelName,
    model: trim ? `${modelName} ${trim}` : modelName,
    trim,
    year,
    mileage,
    salePrice,
    newPrice: isNew ? salePrice : teslaNewPrice(raw, modelName),
    store,
    color: raw.color || raw.PAINT || raw.ExteriorColor || "",
    displacement: "EV",
    imageUrl: raw.img_src || teslaImage(raw, modelName),
    detailUrl: raw.url || (vin ? `${TESLA_BASE}/zh_TW/inventory/used/${modelName.toLowerCase().replace(" ", "")}?vin=${vin}` : `${TESLA_BASE}/zh_TW/inventory/used/m3`),
    equipmentScore: Array.isArray(raw.features) ? Math.min(1, 0.55 + raw.features.length / 20) : 0.8
  });
}

function setStatus(message, visible = true) {
  elements.status.textContent = message;
  elements.status.classList.toggle("is-visible", visible);
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} 讀取失敗`);
  return response.json();
}

async function loadInventory() {
  setStatus("讀取 Lexus CPO 與 Tesla 官方庫存中...");
  elements.refresh.disabled = true;
  state.sourceWarnings = [];

  const [lexusResult, teslaResult] = await Promise.allSettled([
    fetchJson("/api/lexus-inventory"),
    fetchJson("/api/tesla-inventory")
  ]);

  const cars = [];
  if (lexusResult.status === "fulfilled") {
    cars.push(...(lexusResult.value.rows || []).map(normalizeLexus));
  } else {
    state.sourceWarnings.push("Lexus CPO 讀取失敗");
  }

  if (teslaResult.status === "fulfilled") {
    cars.push(...(teslaResult.value.rows || []).map(normalizeTesla).filter((car) => car.salePrice > 0));
    if (teslaResult.value.errors?.length) {
      state.sourceWarnings.push("Tesla 官方庫存部分車系讀取失敗");
    }
  } else {
    state.sourceWarnings.push("Tesla 官方庫存讀取失敗");
  }

  state.cars = cars.sort((a, b) => b.cp - a.cp);
  fillSeriesOptions();
  applyFilters();
  elements.updatedAt.textContent = new Date().toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit"
  });
  setStatus(state.sourceWarnings.join("；"), state.sourceWarnings.length > 0);
  elements.refresh.disabled = false;
}

function fillSeriesOptions() {
  const currentValue = elements.series.value;
  const seriesList = [...new Set(state.cars.map((car) => car.series).filter(Boolean))].sort();
  elements.series.innerHTML = '<option value="">全部</option>';

  for (const series of seriesList) {
    const option = document.createElement("option");
    option.value = series;
    option.textContent = series;
    elements.series.append(option);
  }

  if (seriesList.includes(currentValue)) {
    elements.series.value = currentValue;
  }
}

function applyFilters() {
  const selectedSource = elements.source.value;
  const selectedSeries = elements.series.value;
  const keyword = elements.keyword.value.trim().toLowerCase();
  const minYear = Number(elements.year.value || 0);
  const maxMileage = Number(elements.mileage.value || Infinity);

  state.filtered = state.cars
    .filter((car) => !selectedSource || car.source === selectedSource)
    .filter((car) => !selectedSeries || car.series === selectedSeries)
    .filter((car) => !minYear || car.year >= minYear)
    .filter((car) => !maxMileage || car.mileage <= maxMileage)
    .filter((car) => {
      if (!keyword) return true;
      const haystack = [car.source, car.series, car.model, car.trim, car.store, car.color]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    })
    .sort((a, b) => b.cp - a.cp);

  renderStats();
  renderTopList();
  renderTable();
}

function renderStats() {
  const cars = state.filtered;
  const best = cars[0];
  const avgDiscount = cars.length
    ? cars.reduce((sum, car) => sum + car.discountRate, 0) / cars.length
    : 0;

  elements.totalCars.textContent = state.cars.length.toLocaleString("zh-TW");
  elements.bestCp.textContent = best ? best.cp.toFixed(1) : "--";
  elements.avgDiscount.textContent = cars.length ? percent(avgDiscount) : "--";
  elements.visibleCount.textContent = `${cars.length.toLocaleString("zh-TW")} 台`;
}

function renderTopList() {
  elements.topList.innerHTML = "";

  for (const car of state.filtered.slice(0, 5)) {
    const node = elements.topTemplate.content.cloneNode(true);
    const image = node.querySelector("img");
    const title = node.querySelector("strong");
    const meta = node.querySelector("span");
    const score = node.querySelector("b");

    image.src = car.imageUrl;
    image.alt = `${car.year} ${car.model}`;
    title.textContent = `${car.source} · ${car.year || "--"} ${car.model}`;
    meta.textContent = `${money(car.salePrice)} / ${formatMileage(car.mileage)}`;
    score.textContent = car.cp.toFixed(1);
    elements.topList.append(node);
  }
}

function renderTable() {
  elements.body.innerHTML = "";

  for (const car of state.filtered) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><span class="cp-badge">${car.cp.toFixed(1)}</span></td>
      <td><span class="source-pill ${car.source === "Tesla" ? "tesla" : ""}">${car.source}</span></td>
      <td>
        <div class="car-name">
          <a href="${car.detailUrl}" target="_blank" rel="noreferrer">${car.model || "--"}</a>
          <span>${car.series || "--"} · ${car.color || "--"} · ${car.displacement || "--"}</span>
        </div>
      </td>
      <td>${car.year || "--"}</td>
      <td>${formatMileage(car.mileage)}</td>
      <td>${money(car.salePrice)}</td>
      <td>${money(car.newPrice)}</td>
      <td><span class="discount">${money(car.discount)} / ${percent(car.discountRate)}</span></td>
      <td>${car.store || "--"}</td>
    `;
    elements.body.append(row);
  }
}

elements.refresh.addEventListener("click", () => {
  loadInventory().catch((error) => {
    setStatus(error.message);
    elements.refresh.disabled = false;
  });
});

for (const input of [elements.source, elements.series, elements.keyword, elements.year, elements.mileage]) {
  input.addEventListener("input", applyFilters);
}

loadInventory().catch((error) => {
  setStatus(error.message);
  elements.refresh.disabled = false;
});
