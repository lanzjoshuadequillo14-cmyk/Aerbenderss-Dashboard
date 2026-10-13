// Live and historical badges use firmware fields only, never numeric thresholds.
// PM fields are optional: the current firmware does not publish them.
export const STATUS_FIELDS = {
  co2: ['co2_Status'],
  voc: ['vocIdx_Status'],
  pm1: ['pm1p0_Status', 'pm.pm1p0_Status'],
  pm25: ['pm2p5_Status', 'pm.pm2p5_Status'],
  pm4: ['pm4p0_Status', 'pm.pm4p0_Status'],
  pm10: ['pm10p0_Status', 'pm.pm10p0_Status'],
  pm25avg: ['pm2p5_24h_Status', 'pm.pm2p5_24h_Status']
};

const STATUS_COLORS = { normal: '#10b981', attention: '#f59e0b', critical: '#ef4444' };
const CATEGORIES = {
  co2: {
    normal: { label: 'Harmless', tone: 'normal' },
    harmless: { label: 'Harmless', tone: 'normal' },
    elevated: { label: 'Elevated', tone: 'attention' },
    unacceptable: { label: 'Unacceptable', tone: 'critical' }
  },
  voc: {
    improvement: { label: 'Improvement', tone: 'normal' },
    baseline: { label: 'Baseline', tone: 'normal' },
    normal_baseline: { label: 'Normal Baseline', tone: 'normal' },
    deterioration: { label: 'Deterioration', tone: 'attention' }
  },
  pm25avg: {
    within_who_24_hour_aqg: { label: 'Within WHO 24-hour AQG', tone: 'normal' },
    above_who_24_hour_aqg: { label: 'Above WHO 24-hour AQG', tone: 'critical' }
  }
};

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

export function getValueByPath(record, path) {
  return path.split('.').reduce((value, part) => value?.[part], record);
}

export function describeFirmwareStatus(metric, raw, missingLabel = 'Not reported') {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { label: missingLabel, raw: null, key: null, tone: null, color: '#94a3b8' };
  }
  const text = raw.trim();
  const key = text.toLowerCase().replace(/[\s-]+/g, '_');
  const category = CATEGORIES[metric]?.[key];
  return {
    label: category?.label ?? text,
    raw: text,
    key,
    tone: category?.tone ?? null,
    color: STATUS_COLORS[category?.tone] ?? '#94a3b8'
  };
}

export function getFirmwareStatus(record, metric, missingLabel = 'Not reported') {
  for (const path of STATUS_FIELDS[metric] ?? []) {
    const value = getValueByPath(record, path);
    if (typeof value === 'string' && value.trim()) {
      return describeFirmwareStatus(metric, value, missingLabel);
    }
  }
  return describeFirmwareStatus(metric, null, missingLabel);
}

export function statusBadge(status) {
  return '<span class="status-badge ' + (status.tone ?? 'unavailable') + '">' +
    escapeHtml(status.label) + '</span>';
}
