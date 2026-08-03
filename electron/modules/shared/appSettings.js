const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const FILE_NAME = "settings.json";

function settingsPath() {
  return path.join(app.getPath("userData"), FILE_NAME);
}

function readSettings() {
  try {
    const raw = fs.readFileSync(settingsPath(), "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeSetting(key, value) {
  try {
    const settings = readSettings();
    settings[key] = value;
    fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2), "utf8");
    return true;
  } catch (err) {
    console.error("[appSettings] writeSetting:", err);
    return false;
  }
}

module.exports = { readSettings, writeSetting };
