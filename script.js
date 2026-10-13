"use strict";

const STORAGE_KEY = "areaCheckResults.v1";

const form = document.getElementById("point-form");
const xInput = document.getElementById("x-value");
const yInput = document.getElementById("y-value");
const rInputs = document.querySelectorAll('input[name="r"]');
const errors = document.getElementById("errors");
const resultsBody = document.getElementById("results-body");
const clearButton = document.getElementById("clear-results");
const radiusLabel = document.getElementById("current-radius");
const canvas = document.getElementById("plot");
const ctx = canvas.getContext("2d");

let results = loadResults();
let currentR = 3;

function loadResults() {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved === null) {
        return [];
    }

    try {
        const data = JSON.parse(saved);
        return Array.isArray(data) ? data : [];
    } catch (error) {
        return [];
    }
}

function saveResults() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(results));
}

function getSelectedR() {
    const selected = [];

    rInputs.forEach(function (input) {
        if (input.checked) {
            selected.push(Number(input.value));
        }
    });

    return selected;
}

function validateForm() {
    const messages = [];
    const yText = yInput.value.trim().replace(",", ".");
    const selectedR = getSelectedR();

    if (xInput.value === "") {
        messages.push("выберите X");
    }

    if (yText === "" || !/^-?\d+(\.\d+)?$/.test(yText)) {
        messages.push("Y должен быть числом");
    } else if (Number(yText) < -5 || Number(yText) > 5) {
        messages.push("Y должен быть от -5 до 5");
    }

    if (selectedR.length === 0) {
        messages.push("выберите хотя бы один радиус R");
    }

    return {
        messages: messages,
        values: messages.length === 0 ? {
            x: Number(xInput.value),
            y: Number(yText),
            radii: selectedR
        } : null
    };
}

function isPointInside(x, y, r) {
    const inRectangle = x >= -r / 2 && x <= 0 && y >= 0 && y <= r;
    const inTriangle = x >= -r && x <= 0 && y <= 0 && y >= (-x - r) / 2;
    const inCircle = x >= 0 && y <= 0 && x * x + y * y <= r * r / 4;

    return inRectangle || inTriangle || inCircle;
}

function addCell(row, text, hit) {
    const cell = document.createElement("td");
    cell.textContent = text;

    if (hit !== undefined) {
        cell.setAttribute("data-hit", hit);
    }

    row.appendChild(cell);
}

function showResults() {
    resultsBody.innerHTML = "";

    if (results.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.textContent = "Проверок пока нет";
        cell.colSpan = 5;
        cell.className = "empty-row";
        row.appendChild(cell);
        resultsBody.appendChild(row);
        return;
    }

    for (let i = results.length - 1; i >= 0; i--) {
        const item = results[i];
        const row = document.createElement("tr");

        addCell(row, item.x);
        addCell(row, String(item.y).replace(".", ","));
        addCell(row, item.r);
        addCell(row, item.hit ? "Попадание" : "Промах", item.hit);
        addCell(row, new Date(item.timestamp).toLocaleString("ru-RU"));

        resultsBody.appendChild(row);
    }
}

function drawPlot(r) {
    const center = canvas.width / 2;
    const scale = 140 / r;

    currentR = r;
    radiusLabel.textContent = r;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawArea(center, scale, r);
    drawAxes(center);
    drawMarks(center, scale, r);
    drawPoints(center, scale, r);
}

function drawArea(center, scale, r) {
    ctx.fillStyle = "#69a8df";
    ctx.fillRect(center - r * scale / 2, center - r * scale, r * scale / 2, r * scale);

    ctx.beginPath();
    ctx.moveTo(center - r * scale, center);
    ctx.lineTo(center, center);
    ctx.lineTo(center, center + r * scale / 2);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.arc(center, center, r * scale / 2, 0, Math.PI / 2);
    ctx.closePath();
    ctx.fill();
}

function drawAxes(center) {
    ctx.strokeStyle = "#20242b";
    ctx.fillStyle = "#20242b";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, center);
    ctx.lineTo(400, center);
    ctx.moveTo(400, center);
    ctx.lineTo(392, center - 4);
    ctx.moveTo(400, center);
    ctx.lineTo(392, center + 4);
    ctx.moveTo(center, 400);
    ctx.lineTo(center, 20);
    ctx.moveTo(center, 20);
    ctx.lineTo(center - 4, 28);
    ctx.moveTo(center, 20);
    ctx.lineTo(center + 4, 28);
    ctx.stroke();

    ctx.font = "14px Arial";
    ctx.fillText("x", 400, center - 8);
    ctx.fillText("y", center + 8, 20);
}

function drawMarks(center, scale, r) {
    const values = [-r, -r / 2, r / 2, r];

    values.forEach(function (value) {
        const x = center + value * scale;
        const y = center - value * scale;
        let label = "R";

        if (value === -r) label = "-R";
        if (value === -r / 2) label = "-R/2";
        if (value === r / 2) label = "R/2";

        ctx.beginPath();
        ctx.moveTo(x, center - 4);
        ctx.lineTo(x, center + 4);
        ctx.moveTo(center - 4, y);
        ctx.lineTo(center + 4, y);
        ctx.stroke();

        ctx.fillText(label, x - 10, center - 8);
        ctx.fillText(label, center + 8, y + 5);
    });
}

function drawPoints(center, scale, r) {
    results.forEach(function (item) {
        if (Number(item.r) !== r) {
            return;
        }

        ctx.beginPath();
        ctx.arc(center + Number(item.x) * scale, center - Number(item.y) * scale, 5, 0, Math.PI * 2);
        ctx.fillStyle = item.hit ? "#17823b" : "#d20f40";
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.stroke();
    });
}

rInputs.forEach(function (input) {
    input.addEventListener("change", function () {
        const selectedR = getSelectedR();

        if (input.checked) {
            drawPlot(Number(input.value));
        } else if (selectedR.length > 0) {
            drawPlot(selectedR[selectedR.length - 1]);
        } else {
            drawPlot(3);
        }

        errors.textContent = "";
    });
});

xInput.addEventListener("change", function () {
    errors.textContent = "";
});

yInput.addEventListener("input", function () {
    errors.textContent = "";
});

form.addEventListener("submit", function (event) {
    event.preventDefault();
    errors.textContent = "";

    const check = validateForm();
    errors.textContent = check.messages.join("; ");

    if (check.values === null) {
        return;
    }

    const values = check.values;
    const timestamp = Date.now();

    values.radii.forEach(function (r) {
        results.push({
            x: values.x,
            y: values.y,
            r: r,
            hit: isPointInside(values.x, values.y, r),
            timestamp: timestamp
        });
    });

    saveResults();
    showResults();
    drawPlot(values.radii[values.radii.length - 1]);
});

clearButton.addEventListener("click", function () {
    results = [];
    saveResults();
    showResults();
    drawPlot(currentR);
});

showResults();
drawPlot(currentR);
