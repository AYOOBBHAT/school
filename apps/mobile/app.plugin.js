const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Copies Play Console verification token into native Android assets so the
 * packaged APK contains assets/adi-registration.properties (required by Google).
 */
function withAdiRegistrationAsset(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const src = path.join(projectRoot, "assets", "adi-registration.properties");
      if (!fs.existsSync(src)) {
        throw new Error(
          "Missing assets/adi-registration.properties — add it with your Play Console snippet."
        );
      }
      const destDir = path.join(
        projectRoot,
        "android",
        "app",
        "src",
        "main",
        "assets"
      );
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(src, path.join(destDir, "adi-registration.properties"));
      return config;
    },
  ]);
}

module.exports = withAdiRegistrationAsset;
