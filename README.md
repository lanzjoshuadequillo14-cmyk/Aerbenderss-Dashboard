# Aerbenderss-Dashboard

Sensor status badges read the firmware fields `co2_Status` and `vocIdx_Status`
in telemetry and individual history records. The CO₂ `normal` category is
displayed as **Harmless**. VOC `Deterioration` uses the firmware's yellow color.
Readings do not override reported statuses, and missing fields stay unavailable.

The current firmware does not publish particulate statuses or individual sensor
statuses in history. The frontend accepts optional `pm1p0_Status`,
`pm2p5_Status`, `pm4p0_Status`, and `pm10p0_Status` fields at the record root or
inside `pm`. The dashboard calculates its **24-hour** PM2.5 status from the
rolling history average once valid PM2.5 readings span at least 24 hours.
An instantaneous PM2.5 status is never used for the average. Other particulate
badges require the optional firmware fields.
Older historical records are not reclassified in the browser.

The measurement reference section contains separate SCD41, SGP40, and SPS30
tables. Temperature and humidity remain readings only. The 24-hour PM2.5
number uses only readings in the last 24 hours. Collection duration is checked
against the full valid PM2.5 history so normal sampling intervals do not keep
the dashboard stuck on **Collecting Data**. Once ready, the calculated status
enables the PM2.5 badge, insights, recommendations, and alerts. Insight and
recommendation text is loaded from the configured Firebase content.

Run checks with `npm test` (or `node --test`).
