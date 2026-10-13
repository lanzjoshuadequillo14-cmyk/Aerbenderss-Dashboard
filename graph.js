import { db, auth, BASE_PATH } from './firebase.js';
import { getFirmwareStatus, escapeHtml } from './sensor-status.js';
import { ref, onValue, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

onAuthStateChanged(auth, user => {
    if (!user) {
        window.location.href = 'Registration.html';
    }
});

document.getElementById('btn-logout')?.addEventListener('click', async e => {
    e.preventDefault();

    try {
        await signOut(auth);
        window.location.href = 'Registration.html';
    } catch (err) {
        console.error('Logout error:', err);
    }
});

const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebarOverlay');

const aeroCubePath = '/Aerocubes/' + (
    localStorage.getItem('aerocube-id') ||
    BASE_PATH.split('/').pop()
);

menuToggle?.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
});

overlay?.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
});

const METRIC_CONFIG = {
    co2: {
        label: 'CO₂ (ppm)',
        color: '#10b981',
        path: 'co2',
        unit: ' ppm',
        statusMetric: 'co2',
        zones: []
    },
    voc: {
        label: 'VOC Index',
        color: '#f59e0b',
        path: 'VOCidx',
        unit: '',
        statusMetric: 'voc',
        zones: []
    },
    pm25: {
        label: 'PM2.5 (µg/m³)',
        color: '#38bdf8',
        path: 'pm.pm2p5',
        unit: ' µg/m³',
        statusMetric: 'pm25',
        zones: []
    },
    temp: {
        label: 'Temperature (°C)',
        color: '#38bdf8',
        path: 'temp',
        unit: ' °C',
        monitoringOnly: true,
        zones: []
    },
    humidity: {
        label: 'Humidity (%)',
        color: '#a855f7',
        path: 'humidity',
        unit: ' %',
        monitoringOnly: true,
        zones: []
    }
};

METRIC_CONFIG.co2.desc = 'Carbon dioxide concentration measured in ppm. Higher values may indicate insufficient ventilation.';
METRIC_CONFIG.voc.desc = 'VOC Index shows changes in volatile organic compounds compared with the sensor baseline.';
METRIC_CONFIG.pm25.desc = 'Current PM2.5 concentration measured in micrograms per cubic metre.';
METRIC_CONFIG.temp.desc = 'Room temperature measured in degrees Celsius.';
METRIC_CONFIG.humidity.desc = 'Relative humidity measures the amount of moisture in the air.';

const RANGE_TITLES = {
    '24h': 'Time — last 24 hours',
    '7d': 'Date — last 7 days',
    'month': 'Date — last month'
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const PM25_MAX_GAP_MS = 30 * 60 * 1000;
const GAP_FACTOR = 3;
const MIN_GAP_MS = 10 * 60 * 1000;
const DEFAULT_VISIBLE_MS = {
    '24h': 6 * HOUR_MS,
    '7d': DAY_MS,
    'month': 3 * DAY_MS
};

let currentTimeRange = '24h';
let chartZoom = 1;
let allHistoryData = [];
let gapThresholdMs = MIN_GAP_MS;
let pm25HistoryReady = false;
let pm25CollectionStartedAt = null;

const chartInstances = {};
const chartViews = {};
const chartZoomInput = document.getElementById('chart-zoom');
const chartZoomValue = document.getElementById('chart-zoom-value');

function visibleDuration(windowRange) {
    return Math.min(
        windowRange.end - windowRange.start,
        DEFAULT_VISIBLE_MS[currentTimeRange] / chartZoom
    );
}

function updateZoomLabel() {
    const hours = DEFAULT_VISIBLE_MS[currentTimeRange] / chartZoom / HOUR_MS;
    const amount = Number((hours >= 24 ? hours / 24 : hours).toFixed(1));
    const unit = hours >= 24 ? 'day' : 'hour';
    const duration = amount + ' ' + unit + (amount === 1 ? '' : 's');

    if (chartZoomValue) {
        chartZoomValue.textContent = chartZoom + '× · ' + duration + ' visible';
    }
    chartZoomInput?.setAttribute('aria-valuetext', duration + ' visible');
}

function applyChartView(metricKey) {
    const view = chartViews[metricKey];
    const chart = chartInstances[metricKey];
    if (!view?.hasData || !chart) return;

    chart.options.scales.x.min = view.visibleStart;
    chart.options.scales.x.max = view.visibleStart + view.duration;
    const label = document.getElementById('window-' + metricKey);
    if (label) {
        label.textContent = 'Showing: ' + formatDateTime(view.visibleStart) +
            ' - ' + formatDateTime(view.visibleStart + view.duration);
    }
    chart.update('none');
}

function configureChartView(metricKey, windowRange) {
    let view = chartViews[metricKey];
    if (!view) {
        const scroll = document.getElementById('chart-' + metricKey).closest('.chart-scroll');
        view = chartViews[metricKey] = {
            scroll,
            timeline: scroll.querySelector('.chart-timeline'),
            wrapper: scroll.querySelector('.chart-wrapper'),
            atLatest: true,
            frame: null
        };
        scroll.addEventListener('scroll', () => {
            if (view.frame !== null) return;
            view.frame = window.requestAnimationFrame(() => {
                view.frame = null;
                if (!view.hasData) return;
                // Assigned scroll offsets may be rounded; retain the precise time window.
                if (scroll.scrollLeft === view.programmaticScrollLeft) return;
                view.programmaticScrollLeft = null;
                const distance = Math.max(0, scroll.scrollWidth - scroll.clientWidth);
                const position = distance ? Math.min(1, Math.max(0, scroll.scrollLeft / distance)) : 1;
                view.visibleStart = view.windowRange.start + position * (
                    view.windowRange.end - view.windowRange.start - view.duration
                );
                view.atLatest = distance - scroll.scrollLeft < 2;
                applyChartView(metricKey);
            });
        }, { passive: true });
    }

    const duration = visibleDuration(windowRange);
    const maximumStart = windowRange.end - duration;
    let start = view.visibleStart;
    if (view.range !== currentTimeRange || view.atLatest) {
        start = maximumStart;
    } else if (view.zoom !== chartZoom) {
        start += (view.duration - duration) / 2;
    }
    start = Math.min(maximumStart, Math.max(windowRange.start, start));

    const width = Math.max(1, view.scroll.clientWidth);
    view.wrapper.style.width = width + 'px';
    view.timeline.style.width = Math.ceil(
        width * (windowRange.end - windowRange.start) / duration
    ) + 'px';
    view.windowRange = windowRange;
    view.visibleStart = start;
    view.duration = duration;
    view.range = currentTimeRange;
    view.zoom = chartZoom;
    view.hasData = true;
    const timeDistance = maximumStart - windowRange.start;
    const scrollDistance = Math.max(0, view.scroll.scrollWidth - width);
    view.scroll.scrollLeft = timeDistance
        ? (start - windowRange.start) / timeDistance * scrollDistance
        : 0;
    view.programmaticScrollLeft = view.scroll.scrollLeft;
    view.atLatest = maximumStart - start < 1000;
    return { start, end: start + duration };
}

function refreshChartViews() {
    Object.entries(chartViews).forEach(([metricKey, view]) => {
        if (!view.hasData) return;
        configureChartView(metricKey, view.windowRange);
        chartInstances[metricKey]?.resize();
        applyChartView(metricKey);
    });
}

chartZoomInput?.addEventListener('input', () => {
    chartZoom = Number(chartZoomInput.value);
    updateZoomLabel();
    refreshChartViews();
});

document.getElementById('btn-chart-latest')?.addEventListener('click', () => {
    Object.values(chartViews).forEach(view => { view.atLatest = true; });
    refreshChartViews();
});

let resizeFrame = null;
window.addEventListener('resize', () => {
    if (resizeFrame !== null) return;
    resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = null;
        refreshChartViews();
    });
});

function pointColor(config,point) {
    if (config.monitoringOnly) return config.color;
    if (config.statusMetric === 'pm25' && Number.isFinite(point?.y)) {
        if (point.y > 15) return '#ef4444';
        if (point.y > 5) return '#f59e0b';
        return '#10b981';
    }
    return point?.firmwareStatus?.color || '#94a3b8';
}

function getTimestampFromPushId(pushId) {
    const PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';

    let time = 0;

    for (let i = 0; i < 8; i++) {
        const index = PUSH_CHARS.indexOf(
            pushId.charAt(i)
        );

        if (index < 0) {
            return 0;
        }

        time = time * 64 + index;
    }

    return time;
}

function normalizeTimestamp(raw) {
    if (
        raw === undefined ||
        raw === null ||
        raw === ''
    ) {
        return 0;
    }

    let value = Number(raw);

    if (Number.isNaN(value)) {
        value = Date.parse(raw);
    }

    if (
        Number.isNaN(value) ||
        value <= 0
    ) {
        return 0;
    }

    return value < 1e12
        ? value * 1000
        : value;
}

function getValueByPath(obj, path) {
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
        if (
            current === null ||
            current === undefined
        ) {
            return undefined;
        }

        current = current[part];
    }

    return current;
}

function getMetricValue(item, config) {
    const raw = getValueByPath(
        item,
        config.path
    );

    if (
        raw === undefined ||
        raw === null ||
        raw === ''
    ) {
        return null;
    }

    const value = parseFloat(raw);

    return Number.isFinite(value)
        ? value
        : null;
}

function addPm25RollingAverage(entries) {
    let queue = [];
    let sum = 0;
    let sessionStart = null;
    let previousPm25Timestamp = null;
    let lastPm25Timestamp = null;

    for (const item of entries) {
        item.pm25Avg24h = null;

        const raw = getValueByPath(
            item,
            'pm.pm2p5'
        );

        const value =
            raw === undefined ||
            raw === null ||
            raw === ''
                ? null
                : Number(raw);

        if (!Number.isFinite(value)) {
            continue;
        }

        if (
            previousPm25Timestamp !== null &&
            item.timestamp - previousPm25Timestamp > PM25_MAX_GAP_MS
        ) {
            queue = [];
            sum = 0;
            sessionStart = null;
        }

        if (sessionStart === null) {
            sessionStart = item.timestamp;
        }

        queue.push({
            timestamp: item.timestamp,
            value
        });

        sum += value;

        const cutoff = item.timestamp - DAY_MS;

        while (
            queue.length &&
            queue[0].timestamp < cutoff
        ) {
            sum -= queue.shift().value;
        }

        if (
            item.timestamp - sessionStart >= DAY_MS &&
            queue.length
        ) {
            item.pm25Avg24h = sum / queue.length;
        }

        previousPm25Timestamp = item.timestamp;
        lastPm25Timestamp = item.timestamp;
    }

    const now = Date.now();

    const currentSessionIsFresh =
        lastPm25Timestamp !== null &&
        now - lastPm25Timestamp <= PM25_MAX_GAP_MS;

    pm25CollectionStartedAt =
        currentSessionIsFresh
            ? sessionStart
            : null;

    pm25HistoryReady =
        currentSessionIsFresh &&
        sessionStart !== null &&
        now - sessionStart >= DAY_MS;
}

function getPm25CollectionMessage() {
    if (pm25HistoryReady) {
        return '';
    }

    if (pm25CollectionStartedAt === null) {
        return 'PM2.5: 0 µg/m³ · Collecting data: 0 / 24 hours';
    }

    const hours = Math.min(
        24,
        Math.max(
            0,
            (Date.now() - pm25CollectionStartedAt) / HOUR_MS
        )
    );

    return (
        'PM2.5: 0 µg/m³ · Collecting data: ' +
        hours.toFixed(1) +
        ' / 24 hours. The graph will appear after 24 hours.'
    );
}

function setEmptyMessage(element, message) {
    const target =
        element.querySelector('p') ||
        element;

    if (!element.dataset.defaultMessage) {
        element.dataset.defaultMessage =
            target.textContent ||
            'No data available.';
    }

    target.textContent =
        message ||
        element.dataset.defaultMessage;
}

function getTimeWindow(range) {
    const end = Date.now();
    let start;

    if (range === '24h') {
        start = end - DAY_MS;
    } else if (range === '7d') {
        start = end - 7 * DAY_MS;
    } else if (range === 'month') {
        const date = new Date(end);

        date.setMonth(
            date.getMonth() - 1
        );

        start = date.getTime();
    } else {
        start =
            allHistoryData.length
                ? allHistoryData[0].timestamp
                : end - DAY_MS;
    }

    return { start, end };
}

function filterByTimeRange(data, range) {
    const { start, end } = getTimeWindow(range);

    return data.filter(
        item =>
            item.timestamp > 0 &&
            item.timestamp >= start &&
            item.timestamp <= end
    );
}

function computeGapThreshold(entries) {
    const intervals = [];

    for (let i = 1; i < entries.length; i++) {
        const difference =
            entries[i].timestamp -
            entries[i - 1].timestamp;

        if (difference > 0) {
            intervals.push(difference);
        }
    }

    if (intervals.length === 0) {
        return MIN_GAP_MS;
    }

    intervals.sort(
        (a, b) => a - b
    );

    const median =
        intervals[
            Math.floor(
                intervals.length / 2
            )
        ];

    return Math.max(
        median * GAP_FACTOR,
        MIN_GAP_MS
    );
}

function buildSeries(filtered, config, windowRange) {
    const points = [];
    const gaps = [];
    let previousTimestamp = null;

    if (
        filtered.length &&
        filtered[0].timestamp - windowRange.start > gapThresholdMs
    ) {
        gaps.push({
            from: windowRange.start,
            to: filtered[0].timestamp
        });
    }

    for (const item of filtered) {
        if (
            previousTimestamp !== null &&
            item.timestamp - previousTimestamp > gapThresholdMs
        ) {
            points.push({
                x:
                    previousTimestamp +
                    (
                        item.timestamp -
                        previousTimestamp
                    ) / 2,
                y: null
            });

            gaps.push({
                from: previousTimestamp,
                to: item.timestamp
            });
        }

        points.push({
            x: item.timestamp,
            y: getMetricValue(
                item,
                config
            ),
            firmwareStatus: config.statusMetric
                ? getFirmwareStatus(item, config.statusMetric, 'Not recorded')
                : null
        });

        previousTimestamp = item.timestamp;
    }

    if (
        previousTimestamp !== null &&
        windowRange.end - previousTimestamp > gapThresholdMs
    ) {
        gaps.push({
            from: previousTimestamp,
            to: windowRange.end
        });
    }

    return {
        points,
        gaps
    };
}

document.getElementById('btn-clear-history')?.addEventListener('click', async () => {
    const confirmed = window.confirm(
        'Clear all history for this AeroCube? This cannot be undone.'
    );

    if (!confirmed) {
        return;
    }

    try {
        await remove(
            ref(
                db,
                aeroCubePath + '/history'
            )
        );

        allHistoryData = [];
        pm25HistoryReady = false;
        pm25CollectionStartedAt = null;

        renderAllCharts();
    } catch (error) {
        console.error(
            'Error clearing history:',
            error
        );

        window.alert(
            'Unable to clear history. Please try again.'
        );
    }
});

const zonesAndGapsPlugin = {
    id: 'zonesAndGaps',

    beforeDatasetsDraw(chart) {
        const meta = chart.$meta;

        if (!meta) {
            return;
        }

        const {
            ctx,
            chartArea,
            scales
        } = chart;

        const x = scales.x;
        const y = scales.y;

        ctx.save();
        ctx.beginPath();

        ctx.rect(
            chartArea.left,
            chartArea.top,
            chartArea.width,
            chartArea.height
        );

        ctx.clip();

        ctx.font = '600 10px sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';

        for (const zone of meta.zones) {
            const top = y.getPixelForValue(
                Math.min(
                    zone.max,
                    y.max
                )
            );

            const bottom = y.getPixelForValue(
                Math.max(
                    zone.min,
                    y.min
                )
            );

            if (!(bottom > top)) {
                continue;
            }

            ctx.fillStyle = zone.color + '14';

            ctx.fillRect(
                chartArea.left,
                top,
                chartArea.width,
                bottom - top
            );

            if (bottom - top > 16) {
                ctx.fillStyle = zone.color + 'b3';

                ctx.fillText(
                    zone.name,
                    chartArea.right - 6,
                    top + 4
                );
            }
        }

        for (const gap of meta.gaps) {
            const left = Math.max(
                x.getPixelForValue(
                    gap.from
                ),
                chartArea.left
            );

            const right = Math.min(
                x.getPixelForValue(
                    gap.to
                ),
                chartArea.right
            );

            if (right <= left) {
                continue;
            }

            const width = Math.max(
                right - left,
                2
            );

            ctx.fillStyle = 'rgba(148,163,184,0.12)';

            ctx.fillRect(
                left,
                chartArea.top,
                width,
                chartArea.height
            );

            ctx.strokeStyle = 'rgba(148,163,184,0.35)';

            ctx.setLineDash([4, 4]);

            ctx.strokeRect(
                left,
                chartArea.top,
                width,
                chartArea.height
            );

            ctx.setLineDash([]);

            if (width > 64) {
                ctx.fillStyle = 'rgba(148,163,184,0.9)';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                ctx.fillText(
                    'No data',
                    left + width / 2,
                    chartArea.top + chartArea.height / 2
                );

                ctx.textAlign = 'right';
                ctx.textBaseline = 'top';
            }
        }

        ctx.restore();
    },

    afterDatasetsDraw(chart) {
        const meta = chart.$meta || {};

        const {
            ctx,
            chartArea,
            scales
        } = chart;

        const mark = (point, above) => {
            if (!point) {
                return;
            }

            const px = scales.x.getPixelForValue(
                point.x
            );

            const py = scales.y.getPixelForValue(
                point.y
            );

            if (
                px < chartArea.left ||
                px > chartArea.right
            ) {
                return;
            }

            ctx.save();
            ctx.beginPath();

            ctx.arc(
                px,
                py,
                5,
                0,
                Math.PI * 2
            );

            ctx.fillStyle = '#ffffff';
            ctx.fill();

            ctx.lineWidth = 2;
            ctx.strokeStyle = point.ring;
            ctx.stroke();

            ctx.font = '600 11px sans-serif';
            ctx.textBaseline = 'middle';

            const width =
                ctx.measureText(
                    point.label
                ).width + 12;

            const boxX = Math.min(
                Math.max(
                    px - width / 2,
                    chartArea.left
                ),
                chartArea.right - width
            );

            let boxY =
                above
                    ? py - 22
                    : py + 22;

            boxY = Math.min(
                Math.max(
                    boxY,
                    chartArea.top + 9
                ),
                chartArea.bottom - 9
            );

            ctx.fillStyle = 'rgba(19,26,39,0.92)';

            ctx.fillRect(
                boxX,
                boxY - 9,
                width,
                18
            );

            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left';

            ctx.fillText(
                point.label,
                boxX + 6,
                boxY
            );

            ctx.restore();
        };

        mark(
            meta.peak,
            true
        );

        mark(
            meta.latest,
            false
        );
    }
};

const fmtNum = value =>
    Number(value).toLocaleString(
        'en-US',
        {
            maximumFractionDigits: 1
        }
    );

function timeAgo(ms) {
    const minutes = Math.round(
        (Date.now() - ms) / 60000
    );

    if (minutes < 1) {
        return 'just now';
    }

    if (minutes < 60) {
        return minutes + ' min ago';
    }

    if (minutes < 1440) {
        return Math.round(
            minutes / 60
        ) + ' h ago';
    }

    return Math.round(
        minutes / 1440
    ) + ' days ago';
}

function formatDateTime(timestamp) {
    return new Date(
        timestamp
    ).toLocaleString(
        'en-US',
        {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        }
    );
}

function formatTick(value) {
    const date = new Date(value);

    if (currentTimeRange === '24h') {
        return date.toLocaleTimeString(
            'en-US',
            {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            }
        );
    }

    return [
        date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    ];
}

function renderStats(metricKey, config, last, top) {
    const element = document.getElementById('stats-' + metricKey);
    if (!element) return;
    const entry = (label, point, when) =>
        '<span>' + label + ': <b style="color:' + pointColor(config, point) + '">' +
        fmtNum(point.y) + config.unit + '</b> · ' + when + '</span>';
    element.innerHTML = entry('Latest', last, timeAgo(last.x));
    if (config.monitoringOnly) return;
    element.innerHTML += entry('Peak', top, formatDateTime(top.x));
}

function renderDescription(metricKey, config) {
    const canvas = document.getElementById(
        'chart-' + metricKey
    );

    if (
        !canvas ||
        document.getElementById(
            'desc-' + metricKey
        )
    ) {
        return;
    }

    if (
        !document.getElementById(
            'chart-desc-style'
        )
    ) {
        const style = document.createElement(
            'style'
        );

        style.id = 'chart-desc-style';

        style.textContent =
            '.chart-desc{margin:0 0 10px;font-size:13px;line-height:1.5;color:#94a3b8}' +
            '.chart-desc-stats{display:flex;flex-wrap:wrap;gap:4px 16px;margin-top:8px;font-size:13px}' +
            '.chart-desc-stats b{font-weight:700}' +
            '.chart-desc-key{display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:6px;font-size:11px}' +
            '.chart-desc-key i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px}' +
            '.chart-window-label{margin-top:8px;color:#cbd5e1}';

        document.head.appendChild(
            style
        );
    }

    const box = document.createElement(
        'div'
    );

    box.id = 'desc-' + metricKey;
    box.className = 'chart-desc';

    box.innerHTML =
        config.desc +
        '<div class="chart-desc-stats" id="stats-' +
        metricKey +
        '"></div>' +
        '<div class="chart-window-label" id="window-' + metricKey + '"></div>';

    (
        canvas.closest(
            '.chart-viewport'
        ) ||
        canvas.parentElement
    ).insertAdjacentElement(
        'beforebegin',
        box
    );
}

function buildTicks(min, max) {
    const ticks = [];
    const steps = [
        HOUR_MS / 4, HOUR_MS / 2, HOUR_MS, 2 * HOUR_MS,
        4 * HOUR_MS, 6 * HOUR_MS, 12 * HOUR_MS, DAY_MS
    ];
    const step = steps.find(value => value >= (max - min) / 8) || DAY_MS;

    if (step < DAY_MS) {

        for (
            let time =
                Math.ceil(
                    min / step
                ) * step;
            time <= max;
            time += step
        ) {
            ticks.push({
                value: time
            });
        }
    } else {
        const date = new Date(min);

        date.setHours(
            24,
            0,
            0,
            0
        );

        while (
            date.getTime() <= max
        ) {
            ticks.push({
                value: date.getTime()
            });

            date.setDate(
                date.getDate() + 1
            );
        }
    }

    return ticks;
}

function makePointRadius(count) {
    return context => {
        if (count <= 50) {
            return 3;
        }

        const data = context.dataset.data;
        const index = context.dataIndex;

        const previousMissing =
            !data[index - 1] ||
            data[index - 1].y === null;

        const nextMissing =
            !data[index + 1] ||
            data[index + 1].y === null;

        return (
            previousMissing &&
            nextMissing
        )
            ? 3
            : 0;
    };
}

function renderMetricSummary(metricKey, filteredData) {
    const config = METRIC_CONFIG[
        metricKey
    ];

    const averageElement = document.getElementById(
        'average-' + metricKey
    );

    const highestElement = document.getElementById(
        'highest-' + metricKey
    );

    const lowestElement = document.getElementById(
        'lowest-' + metricKey
    );

    if (
        !averageElement ||
        !highestElement ||
        !lowestElement
    ) {
        return;
    }

    const values = filteredData.map(
        item => ({
            value: getMetricValue(
                item,
                config
            ),
            timestamp: item.timestamp
        })
    ).filter(
        item => item.value !== null
    );

    if (values.length === 0) {
        averageElement.innerText = '--';
        highestElement.innerText = '--';
        lowestElement.innerText = '--';
        return;
    }

    const average =
        values.reduce(
            (sum, item) =>
                sum + item.value,
            0
        ) / values.length;

    const highest =
        values.reduce(
            (result, item) =>
                item.value > result.value
                    ? item
                    : result
        );

    const lowest =
        values.reduce(
            (result, item) =>
                item.value < result.value
                    ? item
                    : result
        );

    const unit = config.unit;

    averageElement.innerText =
        average.toFixed(1) +
        unit;

    highestElement.innerText =
        highest.value +
        unit +
        ' · ' +
        formatDateTime(
            highest.timestamp
        );

    lowestElement.innerText =
        lowest.value +
        unit +
        ' · ' +
        formatDateTime(
            lowest.timestamp
        );
}

function processHistorySnapshot(snapshot) {
    if (!snapshot.exists()) {
        allHistoryData = [];
        gapThresholdMs = MIN_GAP_MS;
        pm25HistoryReady = false;
        pm25CollectionStartedAt = null;

        renderAllCharts();
        return;
    }

    try {
        const historyObj = snapshot.val();
        const entries = [];

        for (const key in historyObj) {
            const log = historyObj[key];

            let timestamp = normalizeTimestamp(
                log.timestamp ||
                log.time ||
                log.created_at
            );

            if (
                !timestamp &&
                key.startsWith('-')
            ) {
                timestamp = getTimestampFromPushId(
                    key
                );
            }

            if (!timestamp) {
                continue;
            }

            entries.push({
                ...log,
                timestamp
            });
        }

        entries.sort(
            (a, b) =>
                a.timestamp -
                b.timestamp
        );

        addPm25RollingAverage(
            entries
        );

        allHistoryData = entries;

        gapThresholdMs =
            computeGapThreshold(
                entries
            );

        renderAllCharts();
    } catch (err) {
        console.error(
            'Error processing history:',
            err
        );

        allHistoryData = [];
        gapThresholdMs = MIN_GAP_MS;
        pm25HistoryReady = false;
        pm25CollectionStartedAt = null;

        renderAllCharts();
    }
}

function renderChart(metricKey, filtered, windowRange) {
    const config = METRIC_CONFIG[
        metricKey
    ];

    const canvas = document.getElementById(
        'chart-' + metricKey
    );

    const emptyState = document.getElementById(
        'empty-' + metricKey
    );

    if (
        !canvas ||
        !emptyState
    ) {
        return;
    }

    renderDescription(
        metricKey,
        config
    );

    const showEmpty = message => {
        const stats = document.getElementById(
            'stats-' + metricKey
        );

        if (stats) {
            stats.innerHTML = '';
        }
        const windowLabel = document.getElementById('window-' + metricKey);
        if (windowLabel) windowLabel.textContent = '';
        const scroll = canvas.closest('.chart-scroll');
        scroll.style.visibility = 'hidden';
        scroll.tabIndex = -1;
        if (chartViews[metricKey]) chartViews[metricKey].hasData = false;

        canvas.style.display = 'none';
        emptyState.style.display = 'flex';

        setEmptyMessage(
            emptyState,
            message
        );

        if (window.lucide) {
            lucide.createIcons();
        }
    };

    setEmptyMessage(
        emptyState,
        ''
    );

    if (filtered.length === 0) {
        showEmpty();
        return;
    }

    const {
        points,
        gaps
    } = buildSeries(
        filtered,
        config,
        windowRange
    );

    const realValues =
        points.filter(
            point =>
                point.y !== null
        ).map(
            point =>
                point.y
        );

    if (realValues.length === 0) {
        showEmpty();
        return;
    }

    canvas.style.display = 'block';
    emptyState.style.display = 'none';
    const scroll = canvas.closest('.chart-scroll');
    scroll.style.visibility = 'visible';
    scroll.tabIndex = 0;
    const visibleWindow = configureChartView(metricKey, windowRange);

    const realPoints =
        points.filter(
            point =>
                point.y !== null
        );

    const lastPoint =
        realPoints[
            realPoints.length - 1
        ];

    const topPoint = config.monitoringOnly
        ? lastPoint
        : realPoints.reduce(
            (a, b) =>
                b.y > a.y
                    ? b
                    : a
        );

    const samePoint =
        lastPoint.x ===
        topPoint.x;

    const latestColor = pointColor(config, lastPoint);

    const peak = config.monitoringOnly ? null : {
        x: topPoint.x,
        y: topPoint.y,
        ring: pointColor(config, topPoint),
        label:
            (
                samePoint
                    ? 'Latest & peak '
                    : 'Peak '
            ) +
            fmtNum(
                topPoint.y
            ) +
            config.unit
    };

    const latest =
        !config.monitoringOnly && samePoint
            ? null
            : {
                x: lastPoint.x,
                y: lastPoint.y,
                ring: latestColor,
                label:
                    'Latest ' +
                    fmtNum(
                        lastPoint.y
                    ) +
                    config.unit
            };

    renderStats(
        metricKey,
        config,
        lastPoint,
        topPoint
    );

    const average = config.monitoringOnly
        ? null
        : realValues.reduce(
            (sum, value) =>
                sum + value,
            0
        ) / realValues.length;

    const averagePoints = config.monitoringOnly ? [] : [
        {
            x: windowRange.start,
            y: average
        },
        {
            x: windowRange.end,
            y: average
        }
    ];

    const xTitle =
        RANGE_TITLES[
            currentTimeRange
        ] +
        ' · grey area = no sensor data';

    const ctx = canvas.getContext(
        '2d'
    );

    const pointRadius = makePointRadius(
        filtered.length
    );

    if (
        chartInstances[
            metricKey
        ]
    ) {
        const chart =
            chartInstances[
                metricKey
            ];

        chart.$meta = {
            zones: config.zones,
            gaps,
            peak,
            latest
        };

        chart.data.datasets[0].data =
            points;

        chart.data.datasets[0].pointRadius =
            pointRadius;

        if (!config.monitoringOnly) {
            chart.data.datasets[1].data =
                averagePoints;

            chart.data.datasets[1].label =
                'Average: ' +
                average.toFixed(1) +
                config.unit;
        }

        chart.options.scales.x.min =
            visibleWindow.start;

        chart.options.scales.x.max =
            visibleWindow.end;

        chart.options.scales.x.title.text =
            xTitle;

        chart.resize();
        applyChartView(metricKey);

        return;
    }

    const chart = new Chart(
        ctx,
        {
            type: 'line',

            plugins: [
                zonesAndGapsPlugin
            ],

            data: {
                datasets: [
                    {
                        label: config.label,
                        data: points,

                        borderColor: config.monitoringOnly ? config.color : '#94a3b8',
                        backgroundColor: (config.monitoringOnly ? config.color : '#94a3b8') + '22',
                        segment: {
                            borderColor: context => pointColor(config,
                                context.chart.data.datasets[context.datasetIndex].data[context.p1DataIndex])
                        },
                        borderWidth: 2,
                        tension: 0.35,
                        fill: true,
                        spanGaps: false,
                        pointRadius,
                        pointHoverRadius: 6,
                        pointBackgroundColor: context => pointColor(config, context.raw),
                        pointBorderColor: context => pointColor(config, context.raw)
                    },
                    ...(config.monitoringOnly ? [] : [{
                        label:
                            'Average: ' +
                            average.toFixed(1) +
                            config.unit,

                        data: averagePoints,

                        borderColor: '#94a3b8',
                        borderWidth: 1.5,
                        borderDash: [6, 4],
                        pointRadius: 0,
                        pointHoverRadius: 0,
                        fill: false
                    }])
                ]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,

                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                },

                plugins: {
                    legend: {
                        display: !config.monitoringOnly,
                        position: 'top',
                        align: 'end',

                        labels: {
                            color: '#94a3b8',
                            boxWidth: 14,
                            boxHeight: 2,

                            font: {
                                size: 11
                            },

                            filter:
                                item =>
                                    item.datasetIndex === 1
                        }
                    },

                    tooltip: {
                        backgroundColor: '#131a27',
                        borderColor: '#1e293b',
                        borderWidth: 1,
                        titleColor: '#94a3b8',
                        bodyColor: '#ffffff',
                        padding: 12,
                        cornerRadius: 8,

                        filter:
                            item =>
                                item.datasetIndex === 0 &&
                                item.parsed.y !== null,

                        callbacks: {
                            title:
                                items =>
                                    items.length
                                        ? formatDateTime(
                                            items[0].parsed.x
                                        )
                                        : '',

                            labelColor: item => {
                                const color = pointColor(config, item.raw);
                                return { borderColor: color, backgroundColor: color };
                            },
                            label: item => {
                                const value = item.parsed.y.toFixed(1) + config.unit;
                                if (config.monitoringOnly || config.statusMetric === 'pm25') return value;
                                return value + ' · Status: ' +
                                    (item.raw.firmwareStatus?.label || 'Not recorded');
                            }
                        }
                    }
                },

                scales: {
                    x: {
                        type: 'linear',

                        min: visibleWindow.start,
                        max: visibleWindow.end,

                        bounds: 'ticks',

                        afterBuildTicks:
                            scale => {
                                scale.ticks = buildTicks(
                                    scale.min,
                                    scale.max
                                );
                            },

                        title: {
                            display: true,
                            text: xTitle,
                            color: '#64748b',

                            font: {
                                size: 12
                            },

                            padding: {
                                top: 8
                            }
                        },

                        ticks: {
                            color: '#94a3b8',
                            autoSkip: true,
                            maxRotation: 0,
                            minRotation: 0,

                            font: {
                                size: 12
                            },

                            callback:
                                value =>
                                    formatTick(value)
                        },

                        grid: {
                            color: 'rgba(255,255,255,0.04)'
                        }
                    },

                    y: {
                        beginAtZero: true,

                        title: {
                            display: true,
                            text: config.label,
                            color: '#94a3b8',

                            font: {
                                size: 12
                            }
                        },

                        ticks: {
                            color: '#94a3b8',

                            font: {
                                size: 12
                            }
                        },

                        grid: {
                            color: 'rgba(255,255,255,0.06)'
                        }
                    }
                }
            }
        }
    );

    chart.$meta = {
        zones: config.zones,
        gaps,
        peak,
        latest
    };

    chartInstances[
        metricKey
    ] = chart;
    applyChartView(metricKey);
}

function renderAllCharts() {
    updateZoomLabel();
    const windowRange = getTimeWindow(
        currentTimeRange
    );

    const filtered = filterByTimeRange(
        allHistoryData,
        currentTimeRange
    );

    [
        'co2',
        'voc',
        'pm25'
    ].forEach(
        metricKey => {
            renderMetricSummary(
                metricKey,
                filtered
            );
        }
    );

    Object.keys(
        METRIC_CONFIG
    ).forEach(
        metricKey => {
            renderChart(
                metricKey,
                filtered,
                windowRange
            );
        }
    );

    if (window.lucide) {
        lucide.createIcons();
    }
}

document.querySelectorAll('[data-range]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('[data-range]').forEach(button => {
            button.classList.remove('active');
        });

        btn.classList.add('active');

        currentTimeRange =
            btn.dataset.range;

        renderAllCharts();
    });
});

onValue(
    ref(
        db,
        aeroCubePath + '/history'
    ),
    snapshot => {
        processHistorySnapshot(
            snapshot
        );
    },
    error => {
        console.error(
            'Error loading history:',
            error
        );

        allHistoryData = [];
        pm25HistoryReady = false;
        pm25CollectionStartedAt = null;

        renderAllCharts();
    }
);
