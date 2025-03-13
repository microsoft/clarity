import {argv} from 'node:process';
import {promises as fs} from 'fs';
import * as path from 'path';
import {exec} from 'child_process';

type VersionPart = 'major' | 'minor' | 'patch';

const SourceVersionRegExp = /(?<=version = ")[^"]+/;

const bumpVersion = async (): Promise<void> => {
    console.log('Bumping version...');

    const versionPartToBump = getVersionPartToBumpFromCommandLine(argv);
    console.log(`Version part to bump: ${versionPartToBump}`);

    const versionSourceFile = 'packages/clarity-js/src/core/version.ts';
    const jsonFilesToUpdate = [
        'lerna.json',
        'package.json',
        'packages/clarity-decode/package.json',
        'packages/clarity-devtools/package.json',
        'packages/clarity-devtools/static/manifest.json',
        'packages/clarity-js/package.json',
        'packages/clarity-visualize/package.json',
    ];

    try {
        const currentVersion = await getCurrentVersion(versionSourceFile);
        console.log(`Current version: ${currentVersion}`);

        const newVersion = generateNewVersion(currentVersion, versionPartToBump);
        console.log(`New version: ${newVersion}`);

        await updateSourceVersionFile(versionSourceFile, newVersion);
        await updateJsonVersionFiles(jsonFilesToUpdate, newVersion);
        await addVersionFilesToGit(versionSourceFile, jsonFilesToUpdate);

        console.log('Version bump complete.');
    } catch (error) {
        console.error(`Error bumping version: ${(error as Error).message}`);
    }
};

const getVersionPartToBumpFromCommandLine = (argv: string[]): VersionPart => {
    let versionPartToBump: VersionPart = 'patch';

    if (argv.length > 2) {
        const versionPartParameter = argv[2];
        const versionPartToBumpParsed = versionPartParameter.split('=')[1] as VersionPart;

        if (['major', 'minor', 'patch'].includes(versionPartToBumpParsed)) {
            versionPartToBump = versionPartToBumpParsed;
        }
    }
    return versionPartToBump;
};

const getCurrentVersion = async (versionSourceFile: string): Promise<string> => {
    const versionFileContent = await fs.readFile(getFullFilePath(versionSourceFile), 'utf-8');
    const versionMatch = versionFileContent.match(SourceVersionRegExp);

    if (!versionMatch) {
        throw new Error('Version format is invalid');
    }

    return versionMatch[0];
};

const generateNewVersion = (version: string, versionPartToBump: VersionPart): string => {
    const versionParts = version.split('.');

    if (versionParts.length !== 3) {
        throw new Error('Version format is invalid');
    }
    switch (versionPartToBump) {
        case 'major':
            versionParts[0] = (parseInt(versionParts[0]) + 1).toString();
            versionParts[1] = '0';
            versionParts[2] = '0';
            break;
        case 'minor':
            versionParts[1] = (parseInt(versionParts[1]) + 1).toString();
            versionParts[2] = '0';
            break;
        case 'patch':
        default:
            versionParts[2] = (parseInt(versionParts[2]) + 1).toString();
    }

    return versionParts.join('.');
};

const updateSourceVersionFile = async (versionSourceFile: string, newVersion: string): Promise<void> => {
    console.log(`Updating ${versionSourceFile}...`);
    const versionFileContent = await fs.readFile(getFullFilePath(versionSourceFile), 'utf-8');
    const newVersionFileContent = versionFileContent.replace(SourceVersionRegExp, newVersion);
    await fs.writeFile(getFullFilePath(versionSourceFile), newVersionFileContent, 'utf-8');
};

const updateJsonVersionFiles = async (filesToUpdate: string[], newVersion: string): Promise<void> => {
    for (const filePath of filesToUpdate) {
        console.log(`Updating ${filePath}...`);
        const fileContent = await fs.readFile(getFullFilePath(filePath), 'utf-8');
        const newFileContent = updateVersionInJson(fileContent, newVersion);
        await fs.writeFile(getFullFilePath(filePath), newFileContent, 'utf-8');
    }
};

function updateVersionInJson(fileContent: string, newVersion: string): string {
    const versionFieldNames = [
        "version",
        "version_name"
    ];
    const dependencyNames = [
        "clarity-js",
        "clarity-decode",
        "clarity-devtools",
        "clarity-visualize"
    ];

    const json = JSON.parse(fileContent);

    for (const fieldName of versionFieldNames) {
        if (json[fieldName]) {
            json[fieldName] = newVersion;
        }
    }

    for (const dependencyName of dependencyNames) {
        if (json.dependencies && json.dependencies[dependencyName]) {
            json.dependencies[dependencyName] = "^" + newVersion;
        }
    }

    return JSON
        // format json with 2 spaces indentation
        .stringify(json, null, 2)
        // replace LF with CRLF to maintain the current line endings
        .replace(/\n/g, '\r\n');
}

const addVersionFilesToGit = async (versionSourceFile: string, jsonFilesToUpdate: string[]): Promise<void> => {
    const filesToGitAdd = [versionSourceFile, ...jsonFilesToUpdate];
    const filesToGitAddStr = filesToGitAdd.map(file => `"${getFullFilePath(file)}"`).join(' ');

    exec(`git add ${filesToGitAddStr}`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing git command: ${error}`);
            return;
        }

        console.log('Changed version files added to git.');

        if (stderr) {
            console.error(`Git command error output: ${stderr}`);
        }
    });
};

const getFullFilePath = (filePath: string): string => {
    return path.resolve(__dirname, '../', filePath);
};

bumpVersion()