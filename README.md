# AeroCube Web Dashboard

The AeroCube Web Dashboard is the web interface for our IoT-based Indoor Air Quality Monitoring and Automation System. It lets users view sensor readings, review trends, manage AeroPlug outlets, and configure automation through Firebase.

AeroCube is an undergraduate BSIT capstone project at Binalbagan Catholic College in the Philippines. Our focus is hardware and software integration, real-time monitoring, useful information, and reliable appliance control.

## Features

- **Live monitoring:** CO₂, VOC Index, temperature, humidity, and PM1.0, PM2.5, PM4.0, and PM10.0 readings.
- **Reading displays:** CO₂ and VOC Index gauges, current PM2.5, and a separate 24-hour PM2.5 average.
- **Device status:** Connection indicators and the time of the last received data.
- **Insights and recommendations:** Dedicated panels for interpreting readings and suggesting actions.
- **Analytics:** Historical charts, selectable periods, horizontal scrolling, zoom controls, and CO₂, VOC Index, and PM2.5 summary statistics.
- **History:** Recorded readings with Today, 7 Days, and 30 Days filters, plus a Clear History control.
- **AeroPlug control:** Automatic and manual modes with two relay controls.
- **Settings:** Device IDs, configurable automation thresholds, and outlet assignments.
- **Maintenance:** Controls for SPS30 fan cleaning and SCD41 CO₂ recalibration, performed by the ESP32.
- **Account pages:** Login, registration, password change, and logout controls.
- **Guide and About:** Sensor explanations, reading references, project information, and development team details.
- **Mobile navigation and app controls:** Mobile menu markup, app installation controls, and a notification button.

These features describe the interfaces in the supplied HTML. Their operation depends on the corresponding JavaScript, Firebase configuration, and device firmware.

## Technology

| Component | Purpose |
| --- | --- |
| HTML5 | Page structure and forms |
| CSS3 | Layout and visual styling |
| Vanilla JavaScript | Page behavior and Firebase integration |
| Firebase Realtime Database | Exchange of readings, settings, and commands |
| Chart.js | Gauges and historical charts |
| Chart.js Annotation Plugin | Chart annotations on the dashboard |
| Lucide Icons | Interface icons |
| Google Fonts: Inter | Dashboard typography |
| ESP32 firmware | Sensor acquisition and hardware operations |
| Netlify | Deployment platform identified in the About page |

The HTML loads chart libraries, icons, and fonts from external services. The provided pages do not require a frontend framework or show a build step.

## System Flow

The ESP32 collects readings from the sensors and publishes data to Firebase. The dashboard reads that data to update the interface. User changes to device settings and control commands are sent through Firebase for the hardware to process.

The dashboard sends maintenance requests; the ESP32 executes the sensor operations. Outlet switching is performed by the connected hardware. Exact database paths and command fields must match the JavaScript and firmware.

## Sensors

| Sensor | Dashboard readings | Unit |
| --- | --- | --- |
| Sensirion SCD41 | CO₂ | ppm |
| Sensirion SCD41 | Temperature | °C |
| Sensirion SCD41 | Relative humidity | % |
| Sensirion SGP40 | VOC Index | Unitless index |
| Sensirion SPS30 | PM1.0, PM2.5, PM4.0, PM10.0 | µg/m³ |

Temperature and humidity are displayed as environmental readings. The supplied Settings page provides automation controls for CO₂, VOC Index, and PM2.5.

## Pages

| File | Purpose | Linked page script |
| --- | --- | --- |
| `index.html` | Main monitoring dashboard | `script.js` |
| `graph.html` | Trends and summary statistics | `graph.js` |
| `History.html` | Recorded readings | `history.js` |
| `aeroplug.html` | Operating mode and relay controls | `aeroplug.js` |
| `settings.html` | Device selection, thresholds, outlet assignments, and maintenance | `settings.js` |
| `maintenance.html` | Separate sensor maintenance page | `maintenance.js` |
| `guide.html` | Indoor air quality guide and references | `guide.js` |
| `about.html` | Project, hardware, software, and team information | `about.js` |
| `Login.html` | Email and password login | `Login.js` |
| `Registration.html` | Account registration | `Registration.js` |
| `ChangePassword.html` | Password change using the current password | `ChangePassword.js` |

Maintenance controls are also available in Settings. The separate Maintenance page is not linked in the supplied sidebar. Although the login link says “Forgot Password?”, the supplied destination requires the current password; it is a password-change form.

## Required Files

Keep the HTML pages and their linked scripts together in the web root. Preserve filename capitalization, especially `History.html`, `Login.html`, `Registration.html`, and `ChangePassword.html`.

The pages also reference these supporting files and folders:

| Resource | Used for |
| --- | --- |
| `style.css` | Dashboard, Analytics, History, AeroPlug, Settings, Maintenance, and Guide |
| `about.css` | About page styling |
| `Login.css` | Login and Change Password styling |
| `Registration.css` | Registration styling |
| `pwa.js` | App-related behavior on the main pages |
| `manifest.json` | Web app metadata |
| `logo/` | AeroCube logo |
| `images/` | Sensor images, guide illustrations, and team photos |

**The supplied snapshot contains the HTML pages and `Aerocube.txt` only.** The linked JavaScript, stylesheets, manifest, and image assets must be included before running the complete dashboard. `Aerocube.txt` contains project scope instructions and is not a runtime dependency.

## Local Setup

1. Put the complete website files in one project folder, including all linked scripts, stylesheets, and assets.
2. Configure the Firebase connection in the existing JavaScript modules. Use the same Firebase project and database URL as the device firmware.
3. Confirm that the authentication provider, permitted web domains, and database access rules match the application. The supplied HTML does not include the authentication implementation.
4. Confirm that the device IDs and database fields used by the dashboard match the firmware.
5. Serve the project through a local HTTP server.

For example, with Python 3 installed, run this command from the folder containing `index.html`:

```bash
python -m http.server 8000
```

Open [http://localhost:8000/Login.html](http://localhost:8000/Login.html) to access the login page. VS Code Live Server is another option.

Use HTTP serving instead of opening the HTML directly with `file://`, because most page scripts use JavaScript modules. Internet access is needed for Firebase and the externally loaded libraries and fonts.

## Using the Dashboard

1. Register an account if needed, then sign in.
2. Open **Settings** and save the AeroCube and AeroPlug IDs that match your devices. The form placeholders are `aerocube_01` and `plug_01`.
3. Check **Dashboard** for readings and device status.
4. Use **Analytics** for trends and **History** for recorded readings.
5. In **Settings**, choose each automation threshold and its controlled outlet, then save the configuration.
6. In **AeroPlug**, select Automatic mode for threshold-based control or Manual mode for direct relay control.
7. Use the maintenance controls when required and follow the project's documented sensor procedure.

The interface includes **Clear History** controls. Use them only when recorded readings are no longer needed.

## Automation Settings

The supplied Settings HTML defines the following slider values:

| Parameter | Selectable range | Step | Initial HTML value |
| --- | --- | --- | --- |
| CO₂ | 400–2,500 ppm | 10 ppm | 1,000 ppm |
| VOC Index | 1–500 | 1 | 150 |
| PM2.5 | 0–250 µg/m³ | 1 µg/m³ | 35 µg/m³ |

Each parameter can be assigned to **None**, **Outlet 1**, or **Outlet 2**. Initial HTML values may be replaced by saved configuration when the JavaScript loads.

The Settings page describes a 15% hysteresis margin: an activated outlet turns off when the relevant reading falls more than 15% below its configured threshold. This margin helps avoid repeated switching near a threshold. The firmware determines the actual trigger comparisons and how multiple parameters assigned to one outlet are combined.

Automation thresholds are configurable engineering control points. Keep them separate from the reference classifications shown in the Guide. The dashboard also separates live PM2.5 from its 24-hour average; these represent different time periods.

## Deployment

Deploy the complete web root to a static host such as the project's identified platform, Netlify. Keep relative file paths and filename capitalization intact, configure the deployed domain for the authentication implementation, and verify the Firebase connection after deployment.

The pages include app installation and notification controls, but these depend on the missing runtime files and browser support. Confirm the manifest and any service worker referenced by `pwa.js` are included. Verify installation and notifications on the deployed HTTPS site before demonstrating them.

## Troubleshooting

| Issue | What to check |
| --- | --- |
| Plain layout or missing images | Missing CSS or assets, incorrect paths, or filename capitalization |
| Buttons do nothing | Missing page scripts or JavaScript errors in the browser console |
| Readings stay at `--` | Firebase connection, database permissions, device IDs, and incoming telemetry |
| Empty history or charts | Stored records, selected period, and timestamp handling in the page scripts |
| Missing icons or charts | Internet access and loading of the external libraries |
| Outlet commands have no effect | Selected operating mode, outlet assignment, AeroPlug connection, and firmware command handling |
| Maintenance request does not finish | ESP32 connection and firmware command/status handling |
| Install button does not appear | PWA files, browser support, and installation eligibility |

## Verification

This README was prepared from the supplied HTML pages and project scope document. The JavaScript, CSS, database export, PWA implementation, and firmware were not part of this snapshot, so their runtime behavior has not been tested as part of this documentation task.

Before a demonstration, check account access, live readings, history and charts, saved settings, both operating modes, and hardware responses. Confirm the layout on desktop and mobile with the complete application.

## Development Team

| Member | Role listed in the About page |
| --- | --- |
| Mark Daniel Quinot | Embedded Software Developer |
| Lanz Joshua Dequillo | Frontend Developer |
| Alyza Cañete | Documentation |
| Trisha Gerona | Documentation |
| John Euvir Polido | Documentation / Team Leader |

