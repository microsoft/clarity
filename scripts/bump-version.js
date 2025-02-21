const { argv } = require('node:process');
const fs = require("fs");
const path = require("path");

console.log("Bumping version...");

let versionPartToBump = GetVersionPartToBumpFromCommandLine();
console.log(`Version part to bump: ${versionPartToBump}`);

const versionSourceFile = "packages/clarity-js/src/core/version.ts";
const jsonFilesToUpdate = ["lerna.json", "package.json", "packages/clarity-decode/package.json", "packages/clarity-devtools/package.json", "packages/clarity-devtools/static/manifest.json", "packages/clarity-js/package.json", "packages/clarity-visualize/package.json"];

const currentVersion = GetCurrentVersion(versionSourceFile);
console.log(`Current version: ${currentVersion}`);

const newVersion = GenerateNewVersion(currentVersion, versionPartToBump);
console.log(`New version: ${newVersion}`);

UpdateSourceVersionFile(versionSourceFile, newVersion);

UpdateJsonVersionFiles(jsonFilesToUpdate, newVersion);

console.log("Version bump complete.");


function GetVersionPartToBumpFromCommandLine() {
    let versionPartToBump = "patch";

    if (argv.length > 2) {
        const versionPartParameter = argv[2];
        const versionPartToBumpParsed = versionPartParameter.split("=")[1];

        switch (versionPartToBumpParsed) {
            case "major":
                versionPartToBump = "major";
                break;
            case "minor":
                versionPartToBump = "minor";
                break;
            case "patch":
                versionPartToBump = "patch";
                break;
            default:
                versionPartToBump = "patch";
        }
    }
    return versionPartToBump;
}

function GetCurrentVersion(versionSourceFile) {
    const versionFileContent = fs.readFileSync(GetFullFilePath(versionSourceFile), "utf-8");
    const versionMatch = versionFileContent.match(/(?<=version = ")[^"]+/);

    if (!versionMatch) {
        throw new Error('Version format is invalid');
    }

    return versionMatch[0];
}


function GenerateNewVersion(version, versionPartToBump) {
    const versionParts = version.split(".");

    if (versionParts.length !== 3) {
        throw new Error("Version format is invalid");
    }
    switch (versionPartToBump) {
        case "major":
            versionParts[0] = (parseInt(versionParts[0]) + 1).toString();
            versionParts[1] = "0";
            versionParts[2] = "0";
            break;
        case "minor":
            versionParts[1] = (parseInt(versionParts[1]) + 1).toString();
            versionParts[2] = "0";
            break;
        case "patch":
        default:
            versionParts[2] = (parseInt(versionParts[2]) + 1).toString();
    }

    return versionParts.join(".");
}

function UpdateSourceVersionFile(versionSourceFile, newVersion) {
    console.log(`Updating ${versionSourceFile}...`);
    const versionFileContent = fs.readFileSync(GetFullFilePath(versionSourceFile), "utf-8");
    const newVersionFileContent = versionFileContent.replace(/(?<=version = ")[^"]+/, newVersion);
    fs.writeFileSync(GetFullFilePath(versionSourceFile), newVersionFileContent, "utf-8");
}

function UpdateJsonVersionFiles(filesToUpdate, newVersion) {
    filesToUpdate.forEach((filePath) => {
        console.log(`Updating ${filePath}...`);
        const fileContent = fs.readFileSync(GetFullFilePath(filePath), "utf-8");
        const newFileContent = fileContent.replace(/(?<="version": ")[^"]+/, newVersion);
        fs.writeFileSync(GetFullFilePath(filePath), newFileContent, "utf-8");
    });
}

function GetFullFilePath(filePath) {
    return path.join(__dirname, "../", filePath);
}