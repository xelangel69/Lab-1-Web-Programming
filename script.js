"use strict";

const STORAGE_KEY = "areaCheckResults.v1";
const form = document.querySelector("#point-form");
const xInput = document.querySelector("#x-value");
const yInput = document.querySelector("#y-value");
const radiusInputs = [...document.querySelectorAll('input[name="r"]')];
const errors = document.querySelector("#errors");
const resultsBody = document.querySelector("#results-body");
const clearButton = document.querySelector("#clear-results");
const canvas = document.querySelector("#plot");
const context = canvas.getContext("2d");

let results = loadResults();

function parseDecimal(rawValue) {
    const value = rawValue.trim().replace(",", ".");
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) return null;

    const negative = value.startsWith("-");
    const unsigned = value.replace(/^[+-]/, "");
    const [integerPart, fractionalPart = ""] = unsigned.split(".");
    const digits = `${integerPart || "0"}${fractionalPart}`.replace(/^0+(?=\d)/, "");
    const denominator = 10n ** BigInt(fractionalPart.length);
    let numerator = BigInt(digits || "0");
    if (negative) numerator = -numerator;

    return { numerator, denominator, normalized: value };
}

function compareDecimalToInteger(decimal, integer) {
    const right = BigInt(integer) * decimal.denominator;
    return decimal.numerator < right ? -1 : decimal.numerator > right ? 1 : 0;
}

function isPointInside(x, y, r) {
    const xBig = BigInt(x);
    const rBig = BigInt(r);
    const yN = y.numerator;
    const yD = y.denominator;

    const inRectangle =
        2n * xBig >= -rBig && xBig <= 0n &&
        yN >= 0n && yN <= rBig * yD;

    const inTriangle =
        xBig >= -rBig && xBig <= 0n && yN <= 0n &&
        2n * yN >= (-xBig - rBig) * yD;

    const inQuarterCircle =
        xBig >= 0n && yN <= 0n &&
        4n * (xBig * xBig * yD * yD + yN * yN) <= rBig * rBig * yD * yD;

    return inRectangle || inTriangle || inQuarterCircle;
}

function validate() {
    const messages = [];
    const x = Number(xInput.value);
    const y = parseDecimal(yInput.value);
    const selectedR = radiusInputs.filter((input) => input.checked);

    if (!Number.isInteger(x) || x < -4 || x > 4) {
        messages.push("Выберите значение X от −4 до 4");
    }

    if (!y) {
        messages.push("Число Y должно быть десятичным числом с точкой или запятой в качестве разделителя");
    } else if (compareDecimalToInteger(y, -5) < 0 || compareDecimalToInteger(y, 5) > 0) {
        messages.push("Координата Y должна находиться в диапазоне от −5 до 5");
    }

    if (selectedR.length !== 1) {
        messages.push("Выберите ровно одно значение радиуса R.");
    }

    return {
        messages,
        values: messages.length === 0
            ? { x, y, r: Number(selectedR[0].value) }
            : null
    };
}

function loadResults() {
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((item) =>
            item && Number.isInteger(item.x) && typeof item.y === "string" &&
            Number.isInteger(item.r) && typeof item.hit === "boolean" &&
            Number.isFinite(item.timestamp)
        );
    } catch {
        return [];
    }
}

function saveResults() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(results));
        return true;
    } catch {
        errors.textContent = "Не удалось сохранить историю: хранилище браузера недоступно или заполнено.";
        return false;
    }
}

function formatLocalDate(timestamp) {
    return new Intl.DateTimeFormat("ru-RU", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "short"
    }).format(new Date(timestamp));
}

function appendCell(row, text, attributes = {}) {
    const cell = document.createElement("td");
    cell.textContent = text;
    Object.entries(attributes).forEach(([name, value]) => cell.setAttribute(name, value));
    row.append(cell);
}

function renderResults() {
    resultsBody.replaceChildren();
    const fragment = document.createDocumentFragment();

    [...results].reverse().forEach((item) => {
        const row = document.createElement("tr");
        appendCell(row, String(item.x));
        appendCell(row, item.y.replace(".", ","));
        appendCell(row, String(item.r));
        appendCell(row, item.hit ? "Попадание" : "Промах", { "data-hit": String(item.hit) });
        appendCell(row, formatLocalDate(item.timestamp));
        fragment.append(row);
    });

    resultsBody.append(fragment);
}

function drawArrow(x1, y1, x2, y2) {
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.lineTo(x2 - 8, y2 - 4);
    context.moveTo(x2, y2);
    context.lineTo(x2 - 8, y2 + 4);
    context.stroke();
}

function drawPlot(r = 3) {
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const scale = 145 / r;

    context.clearRect(0, 0, width, height);
    context.fillStyle = "#2196f3";

    context.fillRect(centerX - r * scale / 2, centerY - r * scale, r * scale / 2, r * scale);

    context.beginPath();
    context.moveTo(centerX - r * scale, centerY);
    context.lineTo(centerX, centerY);
    context.lineTo(centerX, centerY + r * scale / 2);
    context.closePath();
    context.fill();

    context.beginPath();
    context.moveTo(centerX, centerY);
    context.arc(centerX, centerY, r * scale / 2, 0, Math.PI / 2);
    context.closePath();
    context.fill();

    context.strokeStyle = "#1d2835";
    context.fillStyle = "#1d2835";
    context.lineWidth = 1.4;
    drawArrow(22, centerY, width - 18, centerY);

    context.save();
    context.translate(centerX, centerY);
    context.rotate(-Math.PI / 2);
    drawArrow(-height / 2 + 22, 0, height / 2 - 18, 0);
    context.restore();

    context.font = "14px Arial, sans-serif";
    context.fillText("x", width - 19, centerY - 9);
    context.fillText("y", centerX + 8, 18);

    const ticks = [
        { value: -r, x: centerX - r * scale, label: "−R" },
        { value: -r / 2, x: centerX - r * scale / 2, label: "−R/2" },
        { value: r / 2, x: centerX + r * scale / 2, label: "R/2" },
        { value: r, x: centerX + r * scale, label: "R" }
    ];

    ticks.forEach((tick) => {
        context.beginPath();
        context.moveTo(tick.x, centerY - 4);
        context.lineTo(tick.x, centerY + 4);
        context.stroke();
        const metrics = context.measureText(tick.label);
        context.fillText(tick.label, tick.x - metrics.width / 2, centerY - 9);
    });

    [
        { y: centerY - r * scale, label: "R" },
        { y: centerY - r * scale / 2, label: "R/2" },
        { y: centerY + r * scale / 2, label: "−R/2" },
        { y: centerY + r * scale, label: "−R" }
    ].forEach((tick) => {
        context.beginPath();
        context.moveTo(centerX - 4, tick.y);
        context.lineTo(centerX + 4, tick.y);
        context.stroke();
        context.fillText(tick.label, centerX + 8, tick.y + 5);
    });

    results.forEach((item) => {
        if (item.r !== r) return;
        const y = Number(item.y);
        context.beginPath();
        context.arc(centerX + item.x * scale, centerY - y * scale, 4.5, 0, Math.PI * 2);
        context.fillStyle = item.hit ? "#087443" : "#c32f27";
        context.fill();
        context.strokeStyle = "white";
        context.stroke();
        context.strokeStyle = "#1d2835";
    });
}

radiusInputs.forEach((input) => {
    input.addEventListener("change", () => {
        if (input.checked) {
            radiusInputs.forEach((other) => {
                if (other !== input) other.checked = false;
            });
            drawPlot(Number(input.value));
        } else {
            drawPlot();
        }
        errors.textContent = "";
    });
});

yInput.addEventListener("input", () => {
    errors.textContent = "";
});

form.addEventListener("submit", (event) => {
    event.preventDefault();
    const { messages, values } = validate();
    errors.textContent = messages.join(" ");
    if (!values) return;

    const hit = isPointInside(values.x, values.y, values.r);
    results.push({
        x: values.x,
        y: values.y.normalized,
        r: values.r,
        hit,
        timestamp: Date.now()
    });
    saveResults();
    renderResults();
    drawPlot(values.r);
});

clearButton.addEventListener("click", () => {
    results = [];
    saveResults();
    renderResults();
    const selectedR = radiusInputs.find((input) => input.checked);
    drawPlot(selectedR ? Number(selectedR.value) : 3);
});

document.addEventListener("visibilitychange", () => {
    if (!document.hidden) renderResults();
});

renderResults();
drawPlot();
