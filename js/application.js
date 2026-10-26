"use strict";

/* ============================================================
   UNIFIED ROULETTE SPREAD  v2.0.0
   ------------------------------------------------------------
   Одна версия вместо трёх:
     - Европейское и Американское колесо (переключается или берётся из данных)
     - Native и EUR валюта (переключатель на дашборде)
     - Работа с колонкой Winning Number и без неё (автоопределение)

   Данные: worksheet "work2" (см. CONFIG.worksheetName).
   Ожидаемые колонки (индексы из CONFIG.columns, если имя не распознано):
     0 Round Time | 1 Round Id | 2 Bet Position | 3 BET EUR | 4 NET EUR
     5 BET NAT(IVE) | 6 NET NAT(IVE) | ? Winning Number

   Демо-режим (без Tableau): откройте в браузере
     index.html            -> нет колонки выигрышного номера
     index.html?demo=win   -> есть колонка выигрышного номера
   ============================================================ */

const CONFIG = {
   version: "2.1.2",
   worksheetName: "work",

   /* Значения по умолчанию, меняются переключателями на дашборде */
   wheel: "EUROPEAN",       // 'EUROPEAN' | 'AMERICAN'  (или 'AUTO' из данных)
   wheelAuto: true,         // определять колесо автоматически по данным (SPLIT_00..., STRAIGHT_UP_00 и т.д.)
   currency: "EUR",         // 'EUR' | 'NATIVE'
   showWinner: true,        // рисовать фишку выигрышного номера (если колонка есть)

   /* Индексы колонок. Если автодetection по имени не сработает — берутся эти значения. */
   columns: {
      RoundTime: 0,
      RoundID: 1,
      BetPosition: 2,
      BetEur: 3,            // 'BET EUR'
      NetEur: 4,            // 'NET EUR'
      BetNative: 5,         // 'BET NAT(IVE)'
      NetNative: 6,         // 'NET NAT(IVE)'
      WinningNumber: null   // null -> автоопределение по слову 'win'; колонки нет -> фишки не рисуются
   }
};

/* ------------------------------------------------------------
   ГЕОМЕТРИЯ РАСКЛАДКИ (canvas 1143 x 480)
   Сетка чисел одинакова для обоих колёс, различается только нулевая зона.
   ------------------------------------------------------------ */
const COL_X = [140, 220, 293, 370, 450, 530, 600, 680, 750, 830, 910, 980];   // левый край колонок 1..12
const ROW_Y = { 0: 55, 2: 155, 1: 255 };      // строка числа: n%3 (0-верх, 2-середина, 1-низ)
const BOUND_TOP_Y = 105;                      // граница между верхней и средней строками
const BOUND_BOTTOM_Y = 200;                   // граница между средней и нижней строками
const LINE_Y = 305;                           // линия улиц (streets) и six-lines
const COL_STEP = 76.5;                        // ширина колонки (для границы между колонками)

const colOf = n => Math.ceil(n / 3);
const rowYOf = n => ROW_Y[n % 3];
const boundaryX = col => COL_X[col - 1] + COL_STEP / 2;   // граница между колонкой col и col+1

/* ------------------------------------------------------------ */
/* ОПИСАНИЕ КОЛЁС                                                */
/* ------------------------------------------------------------
   order      - порядок колеса (метки радара)
   wheelImg   - фон радара, tableImg - фон раскладки
   zeros      - координаты СТРЭЙТ-апа на нулях
   zeroBets   - позиции фишек возле нулевой зоны (вручную по картинке)
   ------------------------------------------------------------ */
const WHEELS = {
   EUROPEAN: {
      order: ["0", "32", "15", "19", "4", "21", "2", "25", "17", "34", "6", "27", "13", "36",
              "11", "30", "8", "23", "10", "5", "24", "16", "33", "1",
              "20", "14", "31", "9", "22", "18", "29", "7", "28", "12", "35", "3", "26"],
      wheelImg: "WhellEouro.png",
      tableImg: "BGLAYOUT.png",
      zeros: { "0": [60, 155] },
      zeroBets: {
         "SPLIT_0_TO_1": [100, 255],
         "SPLIT_0_TO_2": [100, 155],
         "SPLIT_0_TO_3": [100, 55],
         "TRIO_0_TO_2": [100, 200],
         "TRIO_0_AND_2_AND_3": [100, 105],
         "FIRST_FOUR": [100, 300]
      }
   },
   AMERICAN: {
      order: ["0", "28", "9", "26", "30", "11", "7", "20", "32", "17", "5", "22", "34", "15",
              "3", "24", "36", "13", "1", "00", "27", "10", "25", "29", "12", "8", "19", "31",
              "18", "6", "21", "33", "16", "4", "23", "35", "14", "2"],
      wheelImg: "WhellAmer.png",
      tableImg: "BGLAYOUT-American.png",
      zeros: { "0": [60, 220], "00": [60, 110] },
      zeroBets: {
         "SPLIT_0_TO_1": [100, 255],
         "SPLIT_0_TO_2": [100, 180],
         "SPLIT_0_TO_3": [100, 55],
         "SPLIT_0_TO_00": [60, 150],
         "SPLIT_00_TO_2": [100, 125],
         "SPLIT_00_TO_3": [100, 50],
         "STREET_0_00_2": [100, 150],
         "STREET_00_2_3": [100, 100],
         "BASKET_0_00_1_2_3": [100, 300],
         "FIRST_FOUR": [100, 300],
         "TRIO_0_TO_2": [100, 210],
         "TRIO_0_AND_2_AND_3": [100, 105]
      }
   }
};

/* Внешние ставки — координаты одинаковы для обоих колёс */
const OUTSIDE = {
   "COLUMN_FIRST": [1060, 255],
   "COLUMN_SECOND": [1060, 155],
   "COLUMN_THIRD": [1060, 55],
   "FIRST_12": [250, 340],
   "SECOND_12": [560, 340],
   "THIRD_12": [870, 340],
   "FIRST_HALF": [175, 420],
   "SECOND_HALF": [940, 420],
   "EVEN": [325, 420],
   "RED": [483, 420],
   "BLACK": [638, 420],
   "ODD": [790, 420]
};

/* ------------------------------------------------------------
   ВЫЧИСЛЕНИЕ ПОЗИЦИЙ ФИШЕК
   ------------------------------------------------------------ */
function straightPos(n) {
   const w = WHEELS[state.wheel];
   if (w.zeros[n] !== undefined) return w.zeros[n];
   const num = Number(n);
   if (!num) return null;
   return [COL_X[colOf(num) - 1], rowYOf(num)];
}

function splitPos(a, b) {
   const ca = colOf(a), cb = colOf(b), ya = rowYOf(a), yb = rowYOf(b);
   if (ca === cb) {
      // горизонтальный сплит (соседние строки одной колонки)
      const y = (ya === 55 || yb === 55) ? BOUND_TOP_Y : BOUND_BOTTOM_Y;
      return [COL_X[ca - 1] - 10, y];
   }
   // вертикальный сплит (соседние колонки одной строки)
   return [boundaryX(Math.min(ca, cb)), yb];
}

function insidePos(pos) {
   const w = WHEELS[state.wheel];
   if (w.zeroBets[pos] !== undefined) return w.zeroBets[pos];

   const parts = pos.split("_");
   const type = parts[0];
   if (parts.length < 4) return OUTSIDE[pos] || null;
   const a = Number(parts[1]), b = Number(parts[3]);
   if (isNaN(a) || isNaN(b)) return null;

   if (type === "SPLIT")   return splitPos(a, b);

   if (type === "CORNER") {
      // a - нижнее-левое число блока 2x2, b = a + 4
      const y = a % 3 === 1 ? BOUND_BOTTOM_Y : BOUND_TOP_Y;
      return [boundaryX(colOf(a)), y];
   }

   if (type === "STREET") {
      // три числа одной колонки, b = a + 2
      return [COL_X[colOf(b) - 1] - 5, LINE_Y];
   }

   if (type === "SIX_LINE") {
      // шесть чисел в двух колонках, b = a + 5
      return [boundaryX(colOf(a + 2)), LINE_Y];
   }

   return null;
}

/* ------------------------------------------------------------
   МОДИФИКАЦИОННЫЕ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
   ------------------------------------------------------------ */
function betNumbers(pos) {
   // Числа, покрываемые ставкой — для радара считаются STREIGHT-UP и SPLIT (как в оригинале)
   if (pos.startsWith("STRAIGHT_UP_")) return [pos.slice(12)];
   const m = pos.match(/^SPLIT_(.+)_TO_(.+)$/);
   return m ? [m[1], m[2]] : [];
}

function formatAmount(a) {
   if (isNaN(a)) return "";
   if (a >= 1000000) {
      return a % 1000000 === 0 ? (a / 1000000) + "M" : (a / 1000000).toFixed(a % 1 === 0 ? 0 : 2) + "M";
   }
   if (a >= 1000) {
      return a % 1000 === 0 ? (a / 1000) + "K" : (a / 1000).toFixed(a % 1 === 0 ? 0 : 2) + "K";
   }
   return a <= 1 ? a.toFixed(2) : a.toFixed(0);
}

/* ------------------------------------------------------------
   СОСТОЯНИЕ (переключатели)
   ------------------------------------------------------------ */
const state = {
   wheel: CONFIG.wheel,
   currency: CONFIG.currency,
   showWinner: CONFIG.showWinner,
   tableauReady: false
};

/* Псевдонимы (аналоги старых глобальных имён, чтобы менеджер не ругался) */
let currency = CONFIG.currency;               // для совместимости со старым кодом
let CURRENT_COLUMNS = Object.assign({}, CONFIG.columns);   // колонки после autodetect

let unregisterFilterEventListener = null;
let unregisterMarkSelectionEventListener = null;
let unregisterSettingsEventListener = null;
let currencyIndexCache = null;   // пересчитывается при каждом drawChartJS

/* ------------------------------------------------------------
   ЗАГРУЗКА КАРТИНОК (однократно)
   ------------------------------------------------------------ */
const IMG = {};
["coin.png", "WinGame.png"].forEach(src => {
   const im = new Image();
   im.src = src;
   IMG[src] = im;
});

/* ------------------------------------------------------------
   ДЕМО-РЕЖИМ (когда расширение открыто без Tableau)
   ------------------------------------------------------------ */
const params = new URLSearchParams(location.search);
const DEMO = params.get("demo");          // null | '' | 'win'
const DEMO_WIN = DEMO === "win";

function buildDemoData() {
   const mkRow = (time, rid, pos, eur, nat, win) => {
      const r = [];
      r[0] = { formattedValue: time };
      r[1] = { formattedValue: rid };
      r[2] = { formattedValue: pos };
      r[3] = { formattedValue: String(eur), value: eur };
      r[4] = { formattedValue: String(-eur), value: -eur };
      r[5] = { formattedValue: String(nat), value: nat };
      r[6] = { formattedValue: String(-nat), value: -nat };
      if (DEMO_WIN) r[7] = { formattedValue: win };
      return r;
   };

   /* Демо-раунды: [время раунда, RoundID, выигрышный номер, [позиции ставок]] */
   const rounds = [
      ["08:49:28 AM", "23221075", "17", [
         ["STRAIGHT_UP_9", 10.68, 12.55], ["STRAIGHT_UP_9", 10.68, 12.55],
         ["STRAIGHT_UP_6", 8.03, 9.45], ["STRAIGHT_UP_9", 10.68, 12.55],
         ["STRAIGHT_UP_11", 2.68, 3.15], ["STRAIGHT_UP_11", 2.68, 3.15],
         ["STRAIGHT_UP_6", 4.46, 5.25], ["STRAIGHT_UP_8", 8.03, 9.45],
         ["STRAIGHT_UP_10", 10.70, 12.55], ["STRAIGHT_UP_9", 10.68, 12.55],
         ["STRAIGHT_UP_9", 10.68, 12.55], ["SPLIT_4_TO_5", 5.35, 6.25],
         ["STRAIGHT_UP_23", 7.13, 8.35], ["SPLIT_31_TO_34", 3.57, 4.15],
         ["STREET_10_TO_12", 4.91, 5.75], ["CORNER_19_TO_23", 3.12, 3.65]
      ]],
      ["08:50:09 AM", "23221088", "11", [
         ["STRAIGHT_UP_11", 8.03, 9.45], ["STRAIGHT_UP_1", 11.59, 13.65],
         ["STRAIGHT_UP_5", 5.35, 6.25], ["STRAIGHT_UP_6", 5.35, 6.25],
         ["STRAIGHT_UP_8", 14.27, 16.75], ["STRAIGHT_UP_10", 10.70, 12.55],
         ["STRAIGHT_UP_11", 7.13, 8.35], ["STRAIGHT_UP_13", 7.13, 8.35],
         ["STRAIGHT_UP_14", 4.46, 5.25], ["SPLIT_17_TO_20", 6.24, 7.35],
         ["STRAIGHT_UP_24", 10.70, 12.55], ["SIX_LINE_28_TO_33", 2.23, 2.65],
         ["STRAIGHT_UP_30", 3.57, 4.15], ["STRAIGHT_UP_31", 3.57, 4.15],
         ["STRAIGHT_UP_33", 11.59, 13.65], ["STRAIGHT_UP_36", 7.13, 8.35],
         ["STRAIGHT_UP_35", 7.13, 8.35]
      ]],
      ["08:50:49 AM", "23221102", "0", [
         ["STRAIGHT_UP_0", 3.57, 4.15], ["STRAIGHT_UP_2", 1.78, 2.10],
         ["STRAIGHT_UP_11", 3.57, 4.15], ["STRAIGHT_UP_4", 1.78, 2.10]
      ]],
      ["08:52:31 AM", "23221120", "26", [
         ["STRAIGHT_UP_22", 5.35, 6.25], ["STRAIGHT_UP_26", 3.57, 4.15],
         ["SPLIT_26_TO_27", 2.68, 3.15], ["STRAIGHT_UP_28", 2.68, 3.15]
      ]]
   ];

   const rows = [];
   const base = moment("26-10-2026 08:00:00 AM", "DD-MM-YYYY hh:mm:ss a");
   rounds.forEach(([hm, rid, win, list]) => {
      list.forEach(([pos, eur, nat], j) => {
         const t = moment("26-10-2026 " + hm.slice(0, 6) + " " + (hm.endsWith("PM") ? "PM" : "AM"),
                          "DD-MM-YYYY hh:mm:ss a");
         t.add(j * 9, "seconds");
         rows.push(mkRow(t.format("DD-MM-YYYY hh:mm:ss A"), rid, pos, eur, nat, win));
      });
   });

   const columns = [];
   columns[0] = { fieldName: "Round Time" };
   columns[1] = { fieldName: "Round Id" };
   columns[2] = { fieldName: "Bet Position (R)" };
   columns[3] = { fieldName: "BET EUR" };
   columns[4] = { fieldName: "NET EUR" };
   columns[5] = { fieldName: "BET NAT (LOCAL)" };
   columns[6] = { fieldName: "NET NAT (LOCAL)" };
   if (DEMO_WIN) columns[7] = { fieldName: "WINNING NUMBER" };

   return { data: rows, columns: columns };
}

/* ------------------------------------------------------------
   ИНИЦИАЛИЗАЦИЯ (Tableau / демо)
   ------------------------------------------------------------ */
$(document).ready(function () {
   $(".version-label").text(CONFIG.version);
   updateBackgrounds();

   if (typeof tableau !== "undefined" && tableau.extensions) {
      tableau.extensions.initializeAsync().then(function () {
         state.tableauReady = true;
         getSettings();
         drawChartJS();
         // После изменения настроек дашборда перерисовать:
         unregisterSettingsEventListener =
            tableau.extensions.settings.addEventListener(tableau.TableauEventType.SettingsChanged, () => {
               drawChartJS();
            });
      }, function (err) { console.log('Error while Initializing: ' + err.toString()); });
   } else {
      // Демо-режим — без Tableau
      drawChartJS();
   }

   /* ---- переключатели ---- */
   $(".mode-switch").click(function () {
      $(".container-2").toggleClass("hide");
      $(".container").toggleClass("hide");
      requestAnimationFrame(fitLayoutCanvas);
   });

   $(".mode-switch-2").click(function () {          // Native <-> Euro
      state.currency = state.currency === "EUR" ? "NATIVE" : "EUR";
      updateCurrencyLabels();
      if (state.tableauReady || DEMO !== null) drawChartJS();
   });

   $(".mode-switch-wheel").click(function () {      // European <-> American
      CONFIG.wheelAuto = false;                     // пользователь выбрал вручную
      state.wheel = state.wheel === "EUROPEAN" ? "AMERICAN" : "EUROPEAN";
      updateWheelLabel();
      updateBackgrounds();
      if (state.tableauReady || DEMO !== null) drawChartJS();
   });

   $(".mode-switch-win").click(function () {        // показывать/прятать выигрышный номер
      state.showWinner = !state.showWinner;
      if (state.tableauReady || DEMO !== null) drawChartJS();
   });

   updateCurrencyLabels();
   updateWheelLabel();
   window.addEventListener("resize", fitLayoutCanvas);
   if (window.ResizeObserver) {
      const layoutContainer = document.querySelector(".layout-container");
      if (layoutContainer) new ResizeObserver(fitLayoutCanvas).observe(layoutContainer);
   }
   requestAnimationFrame(fitLayoutCanvas);
});

function fitLayoutCanvas() {
   const canvas = document.getElementById("RouletteLayout");
   const wrapper = document.querySelector(".layout-container");
   const section = document.querySelector(".container-2");
   if (!canvas || !wrapper || !section || section.classList.contains("hide")) return;

   const widthLimit = wrapper.clientWidth || 1143;
   const sectionTop = section.getBoundingClientRect().top;
   const titleHeight = section.querySelector(".idround")?.getBoundingClientRect().height || 70;
   // Only constrain by the space above the example controls; don't subtract
   // the full examples section, which can make the actual layout too small.
   const heightLimit = Math.max(240, window.innerHeight - sectionTop - titleHeight - 48);
   const scale = Math.min(widthLimit / 1143, heightLimit / 480, 1);

   canvas.style.width = Math.floor(1143 * scale) + "px";
   canvas.style.height = Math.floor(480 * scale) + "px";
}

/* Слушатели фильтров/марок рабочего листа */
function getSettings() {
   const worksheets = tableau.extensions.dashboardContent.dashboard.worksheets;
   const worksheet = worksheets.find(s => s.name === CONFIG.worksheetName);
   if (!worksheet) { console.log("Worksheet '" + CONFIG.worksheetName + "' not found"); return; }

   if (unregisterFilterEventListener) unregisterFilterEventListener();
   if (unregisterMarkSelectionEventListener) unregisterMarkSelectionEventListener();

   unregisterFilterEventListener = worksheet.addEventListener(
      tableau.TableauEventType.FilterChanged, () => drawChartJS());
   unregisterMarkSelectionEventListener = worksheet.addEventListener(
      tableau.TableauEventType.MarkSelectionChanged, () => drawChartJS());
}

/* ------------------------------------------------------------
   UI-обновления
   ------------------------------------------------------------ */
function updateBackgrounds() {
   const w = WHEELS[state.wheel];
   $("#myChart").css("background-image", "url('" + w.wheelImg + "')");
   $("#RouletteLayout").css("background-image", "url('" + w.tableImg + "')");
}

function updateWheelLabel() { $(".wheel-label").text(state.wheel === "AMERICAN" ? "AMERICAN" : "EUROPEAN"); }

function updateCurrencyLabels() {
   $(".cur-label").text(state.currency === "NATIVE" ? "NATIVE" : "EUR");
}

/* ------------------------------------------------------------
   ОПРЕДЕЛЕНИЕ КОЛОНОК ПО ИМЕНАМ (с фолбэком на CONFIG.columns)
   ------------------------------------------------------------ */
function detectColumns(sumdata) {
   const cols = Object.assign({}, CONFIG.columns);   // стартуем с дефолтов
   const src = sumdata.columns || [];

   src.forEach((c, i) => {
      const name = String(c.fieldName || c.caption || c.name || "").toUpperCase();
      if (!name) return;
      if (name.indexOf("POSITION") !== -1)                 cols.BetPosition = i;
      else if (name.indexOf("ROUND ID") !== -1)            cols.RoundID = i;
      else if (name.indexOf("TIME") !== -1)                cols.RoundTime = i;
      else if (name.indexOf("WIN RESULT") !== -1 || name.indexOf("WINNING NUMBER") !== -1 || name.indexOf("WIN NUMBER") !== -1) cols.WinningNumber = i;
      else if (name.indexOf("NET") !== -1 && name.indexOf("EUR") !== -1)   cols.NetEur = i;
      else if (name.indexOf("NET") !== -1 && (name.indexOf("NAT") !== -1 || name.indexOf("LOCAL") !== -1 || i === 6)) cols.NetNative = i;
      else if (name.indexOf("BET") !== -1 && name.indexOf("EUR") !== -1)   cols.BetEur = i;
      else if (name.indexOf("BET") !== -1 && (name.indexOf("NAT") !== -1 || name.indexOf("LOCAL") !== -1 || i === 5)) cols.BetNative = i;
   });

   CURRENT_COLUMNS = cols;
   return cols;
}

/* Индекс колонки валюты (с проверкой существования) */
function currencyIndex(worksheetData) {
   const colCount = worksheetData && worksheetData[0] ? worksheetData[0].length : 0;
   let idx = state.currency === "NATIVE" ? CURRENT_COLUMNS.BetNative : CURRENT_COLUMNS.BetEur;
   if (state.currency === "NATIVE" && (idx === null || idx >= colCount)) {
      // Native-колонки нет — откатываемся на EUR
      idx = CURRENT_COLUMNS.BetEur;
   }
   return idx;
}

/* ------------------------------------------------------------
   РАСКЛАДКА / РАДАР
   ------------------------------------------------------------ */
function drawChartJS() {
   let source;
   if (DEMO !== null) {
      source = Promise.resolve(buildDemoData());
   } else {
      const worksheets = tableau.extensions.dashboardContent.dashboard.worksheets;
      const worksheet = worksheets.find(s => s.name === CONFIG.worksheetName);
      if (!worksheet) { console.log("Worksheet '" + CONFIG.worksheetName + "' not found"); return; }
      source = worksheet.getSummaryDataAsync();
   }

   return source.then(function (sumdata) {
      return Promise.all(Object.keys(IMG).map(src => {
         const image = IMG[src];
         if (image.complete && image.naturalWidth > 0) return Promise.resolve();
         return new Promise(resolve => {
            image.onload = resolve;
            image.onerror = resolve;
         });
      })).then(() => render(sumdata));
   })
                .catch(err => console.log("drawChartJS error: " + err));
}

function render(sumdata) {
   let worksheetData = sumdata.data;
   const cols = detectColumns(sumdata);

   const RoundTime = cols.RoundTime,
         RoundID = cols.RoundID;

   const canvas = document.getElementById("RouletteLayout");
   const context = canvas.getContext("2d");
   canvas.width = 1143;
   canvas.height = 480;

   /* --- автоопределение типа колеса по значениям строк ---
      Ищем слово America во всех ячейках, чтобы не зависеть от имени
      или позиции Game Type и от наличия необязательной Win Result. */
   const gameTypeWheel = detectWheelFromData(worksheetData);
   if (gameTypeWheel && state.wheel !== gameTypeWheel) {
      state.wheel = gameTypeWheel;
      const wheelSelect = document.getElementById("wheelSelect");
      if (wheelSelect) wheelSelect.value = gameTypeWheel;
      updateWheelLabel();
      updateBackgrounds();
   } else if (!gameTypeWheel && CONFIG.wheelAuto && !isManualWheel()) {
      // Fallback for data without a Game Type field: a 00 bet implies American.
      const has00 = worksheetData.some(r => /00/.test(String(r[cols.BetPosition].formattedValue || "")));
      if (has00 && state.wheel !== "AMERICAN") {
         state.wheel = "AMERICAN";
         updateWheelLabel();
         updateBackgrounds();
      }
   }

   /* --- очистка раскладки --- */
   context.clearRect(0, 0, 1143, 480);

   /* --- счётчики перерывов --- */
   let RoundSkipp = 0, ShortBreak = 0, LongBreak = 0, Sequential = 0;

   /* --- данные радара --- */
   const order = WHEELS[state.wheel].order;
   let data = order.map(() => 0);

   const betIdx = currencyIndex(worksheetData);   // текущая колонка валюты
   const winIdx = (cols.WinningNumber !== null && worksheetData[0] && cols.WinningNumber < worksheetData[0].length)
                    ? cols.WinningNumber : null;
   $(".winner-setting").toggle(winIdx !== null);
   if (winIdx === null) state.showWinner = false;
   else if (document.getElementById("winnerToggle")) state.showWinner = document.getElementById("winnerToggle").checked;

   let lastWinner = null;

   if (!worksheetData.length) {
      $(".idround").text("No data");
      $(".skipcnt").text(0); $(".shortcnt").text(0); $(".longcnt").text(0);
      return;
   }

   /* --- обход всех строк --- */
   for (let i = 0; i < worksheetData.length; i++) {
      const row = worksheetData[i];
      const pos = getCellText(row[cols.BetPosition]);
      const amountCell = row[betIdx];
      const amount = parseDisplayedAmount(amountCell);

      /* радар: считаем только STRAIGHT_UP и SPLIT (как в оригинале) */
      betNumbers(pos).forEach(n => {
         const idx = order.indexOf(n);
         if (idx !== -1) data[idx] += 1;
      });

      /* фишка ставки на раскладке */
      const chipXY = (OUTSIDE[pos] !== undefined)
         ? OUTSIDE[pos]
         : insidePos(pos) || straightPos(pos.startsWith("STRAIGHT_UP_") ? pos.slice(12) : pos);
      if (chipXY) drawBetChip(context, chipXY[0], chipXY[1], amount);

      /* выигрышный номер (если колонка есть) */
      if (winIdx !== null) {
          const wv = getCellText(row[winIdx]);
         if (/^(\d{1,2}|00)$/.test(wv)) lastWinner = wv;
      }

      /* перерывы */
      if (worksheetData.length > 4) {
         const iNext = i === worksheetData.length - 1 ? i : i + 1;
         const delta = breakDelta(getCellText(row[RoundTime]), getCellText(worksheetData[iNext][RoundTime]));
         if (delta.kind === "skip")  RoundSkipp += 1;
         else if (delta.kind === "short") ShortBreak += 1;
         else if (delta.kind === "long")  LongBreak += 1;
         else if (getCellText(row[RoundID]) !== getCellText(worksheetData[iNext][RoundID])) Sequential += 1;
      }
   }

   /* --- фишка выигрышного номера (последний розыгрыш) --- */
   if (state.showWinner && winIdx !== null && lastWinner !== null) {
      const wpos = straightPos(lastWinner);
      if (wpos) drawWinnerChip(context, wpos[0], wpos[1]);
   }

   $(".skipcnt").text(RoundSkipp);
   $(".shortcnt").text(ShortBreak);
   $(".longcnt").text(LongBreak);

   /* --- заголовок --- */
   $(".idround").text(makeTitle(worksheetData, RoundID));

   drawRadar(order, data);
}

/* Переключатель колеса удерживается пользователем? */
function isManualWheel() {
   // CONFIG.wheelAuto отключается кликом по переключателю; после ручного
   // выбора автодетект больше не меняет колесо.
   return !CONFIG.wheelAuto;
}

function detectWheelFromData(rows) {
   let sawAmerican = false;
   let sawEuropean = false;

   for (const row of rows) {
      for (const cell of row) {
          const value = getCellText(cell);
         if (/america/i.test(value)) sawAmerican = true;
         if (/europe/i.test(value)) sawEuropean = true;
      }
   }

   if (sawAmerican) return "AMERICAN";
   if (sawEuropean) return "EUROPEAN";
   return null;
}

function getCellText(cell) {
   if (!cell) return "";
   const value = cell.formattedValue !== undefined && cell.formattedValue !== null
      ? cell.formattedValue
      : (cell.value !== undefined && cell.value !== null ? cell.value : cell.nativeValue);
   return value === undefined || value === null ? "" : String(value).trim();
}

function parseDisplayedAmount(cell) {
   const displayed = getCellText(cell);
   if (displayed) {
      let text = displayed.replace(/[^\d,.-]/g, "");
      const comma = text.lastIndexOf(",");
      const dot = text.lastIndexOf(".");
      if (comma !== -1 && dot !== -1) {
         // The last separator is the decimal mark; remove earlier grouping marks.
         if (comma > dot) text = text.replace(/\./g, "").replace(",", ".");
         else text = text.replace(/,/g, "");
      } else if (comma !== -1) {
         const decimals = text.length - comma - 1;
         text = decimals > 0 && decimals <= 2 ? text.replace(",", ".") : text.replace(/,/g, "");
      }
      const parsed = Number(text);
      if (Number.isFinite(parsed)) return parsed;
   }

   const raw = cell && cell.value !== undefined ? Number(cell.value) : NaN;
   return Number.isFinite(raw) ? raw : NaN;
}

/* Разница во времени между раундами */
function breakDelta(startStr, endStr) {
    const formats = ["DD-MM-YYYY HH:mm:ss a", "DD/MM/YYYY h:mm:ss A", "DD/MM/YYYY h:mm A", "M/D/YYYY h:mm:ss A"];
    const start = moment(startStr, formats, true);
    const end = moment(endStr, formats, true);
   if (!start.isValid() || !end.isValid()) return { kind: "seq" };
   const gapMinutes = end.diff(start, "seconds") / 60;
   if (gapMinutes >= 3 && gapMinutes <= 10) return { kind: "skip" };
   if (gapMinutes > 10 && gapMinutes <= 30) return { kind: "short" };
   if (gapMinutes > 30) return { kind: "long" };
   return { kind: "seq" };
}

/* Заголовок сверху */
function makeTitle(worksheetData, RoundID) {
   const roundIds = new Set(worksheetData.map(row => getCellText(row[RoundID])).filter(Boolean));
   const isLayout = $(".container").hasClass("hide");

   if (roundIds.size > 1) {
      return isLayout ? "All Bets — Roulette Layout" : "All Straight-Up Bets";
   }

   const roundId = roundIds.size === 1 ? Array.from(roundIds)[0] : getCellText(worksheetData[0][RoundID]);
   return isLayout
      ? "Game Round: " + roundId + " Layout Spread"
      : "Game Round: " + roundId + " Straight-Up Bet Spread";
}

/* ------------------------------------------------------------
   РИСОВАНИЕ ФИШЕК
   ------------------------------------------------------------ */
function drawBetChip(context, x, y, amount) {
   const chip = IMG["coin.png"];
   if (chip && chip.complete && chip.naturalWidth > 0) {
      context.drawImage(chip, x - 5, y - 10, 45, 45);
   } else {
      context.beginPath();
      context.arc(x + 17, y + 12, 15, 0, Math.PI * 2);
      context.fillStyle = "#e33b67";
      context.fill();
      context.beginPath();
      context.arc(x + 17, y + 12, 9, 0, Math.PI * 2);
      context.fillStyle = "#fff";
      context.fill();
   }
   if (!isNaN(amount)) {
      context.font = "bold 12px arial";
      context.textAlign = "center";
      context.fillStyle = "black";
      context.fillText(formatAmount(amount), x + 17, y + 17);
   }
}

function drawWinnerChip(context, x, y) {
   context.drawImage(IMG["WinGame.png"], x - 40, y - 35, 100, 100);
}

/* ------------------------------------------------------------
   РАДАР (Chart.js)
   ------------------------------------------------------------ */
function drawRadar(labels, data) {
   $("#myChart").remove();
   $(".roulette-container").append('<canvas id="myChart" class="neww"></canvas>');
   updateBackgrounds();

   const grey = "rgb(77, 77, 77)";
   const transparent = "transparent";
   const ctx = $("#myChart");

   new Chart(ctx, {
      type: "radar",
      data: {
         labels: labels,
         datasets: [{
            borderColor: grey,
            pointBackgroundColor: grey,
            backgroundColor: transparent,
            data: data
         }]
      },
      options: {
         layout: { padding: { left: 40, right: 40, top: 30, bottom: 40 } },
         pointRadius: 4,
         elements: { line: { borderWidth: 4 } },
         scales: {
            r: {
               suggestedMin: 0,
               suggestedMax: 1,
               angleLines: { color: transparent },
               pointLabels: { color: transparent },
               ticks: { color: transparent }
            }
         },
         plugins: { legend: { display: false } },
         scale: {
            maintainAspectRaito: false,
            ticks: { beginAtZero: true, fontColor: "transparent", showLabelBackdrop: false },
            pointLabels: { fontColor: "transparent" },
            gridLines: { color: "rgba(255, 255, 255, 0.2)" },
            angleLines: { color: "white" }
         }
      }
   });
}

/* ------------------------------------------------------------
   ЭКСПОРТ ПРИМЕРОВ (html2canvas)
   ------------------------------------------------------------ */
function getTimestampedFilename(baseName, extension) {
   const now = new Date();
   const timestamp = now.toISOString().replace(/T/, "_").replace(/:/g, "-").split(".")[0];
   return `${baseName}_${timestamp}.${extension}`;
}

function changeToImg() {
   let toImgArea;
   if ($(".container-2").hasClass("hide")) {
      toImgArea = document.getElementById("imgItcontainerem");
   } else {
      toImgArea = document.getElementById("imgItcontainerem2");
   }

   window.pageYOffset = 0;
   document.documentElement.scrollTop = 0;
   document.body.scrollTop = 0;

   html2canvas(toImgArea, {
      allowTaint: true,
      taintTest: false,
      type: "view",
      dpi: 144
   }).then(function (canvas) {
      const sreenshot = document.getElementById("sreenshot");
      canvas.style.width = Math.min(canvas.width, 1000) + "px";
      canvas.style.height = "auto";
      canvas.style.maxWidth = "100%";
      sreenshot.appendChild(canvas);
   });
}

function changeToImg2() {
   const toImgArea = document.getElementById("game-examples");

   window.pageYOffset = 0;
   document.documentElement.scrollTop = 0;
   document.body.scrollTop = 0;

   html2canvas(toImgArea, {
      allowTaint: true,
      taintTest: false,
      type: "view",
      dpi: 144,
      width: toImgArea.scrollWidth,
      height: toImgArea.scrollHeight
   }).then(function (canvas) {
      const sreenshot = document.getElementById("sreenshot");
      const downloadIcon = document.getElementById("download");

      canvas.style.width = "100%";
      canvas.style.height = "auto";
      canvas.style.maxWidth = "100%";
      sreenshot.appendChild(canvas);

      downloadIcon.href = canvas.toDataURL("image/jpeg").replace("image/jpeg", "image/octet-stream");
      downloadIcon.download = getTimestampedFilename("screenshot", "jpg");
   });
   document.getElementById("sreenshot").innerHTML = "";
}

function resetTheImageArea() {
   document.getElementById("sreenshot").innerHTML = "";
}
