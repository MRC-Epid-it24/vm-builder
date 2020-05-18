import {VirtualBoxUtils} from "./virtualbox-utils";
import {randomBytes} from "crypto";
import * as fs from "fs";
import * as path from "path";
import {DeploymentUtils} from "./deployment-utils";
import * as os from "os";
import {
    foodDatabaseFileName,
    homeDirectoryName,
    imageDatabaseFileName,
    imageFileName,
    systemDatabaseFileName
} from "./constants";
import {ensureFileExists} from "./download-cache";
import {Configuration} from "./config-types";

const config: Configuration = require("./config.js");

const vbox = new VirtualBoxUtils(config.virtualBox.command);


const homeDirectoryPath = config.homeDirectoryOverride ?
    path.resolve(config.homeDirectoryOverride, homeDirectoryName) : path.resolve(os.homedir(), homeDirectoryName);

const imageFilePath = path.resolve(homeDirectoryPath, imageFileName);
const systemDatabaseFilePath = path.resolve(homeDirectoryPath, systemDatabaseFileName);
const foodDatabaseFilePath = path.resolve(homeDirectoryPath, foodDatabaseFileName);
const imageDatabaseFilePath = path.resolve(homeDirectoryPath, imageDatabaseFileName);

const alternativeImageFilePath = (config.virtualBox.homeDirectoryOverride) ?
    `${config.virtualBox.homeDirectoryOverride}/${homeDirectoryName}/${imageFileName}` : undefined;

async function ensureHomeDirectoryExists(): Promise<void> {
    try {
        let stats = await fs.promises.stat(homeDirectoryPath);
        if (!stats.isDirectory())
            return Promise.reject(homeDirectoryPath + " exists but is not a directory");
    } catch (e) {
        await fs.promises.mkdir(homeDirectoryPath, {recursive: true});
    }
}

async function main(): Promise<void> {
    const buildId = (config.buildIdOverride) ? config.buildIdOverride : randomBytes(8).toString('hex');
    const buildDirectory = path.resolve(homeDirectoryPath, buildId);

    await ensureHomeDirectoryExists();

    console.log(`\n>>> Verifying and downloading resources >>>`);
    console.log(`\nUsing "${homeDirectoryPath}" for file downloads`);

    console.log(`\nBase VM image:`);
    await ensureFileExists(imageFilePath, config.ova.sha256, config.ova.downloadUrl, config.skipIntegrityChecks);

    console.log(`\nSystem database:`);
    await ensureFileExists(systemDatabaseFilePath, config.systemDatabase.sha256, config.systemDatabase.downloadUrl,
        config.skipIntegrityChecks);

    console.log(`\nFood database:`);
    await ensureFileExists(foodDatabaseFilePath, config.foodDatabase.sha256, config.foodDatabase.downloadUrl,
        config.skipIntegrityChecks);

    console.log(`\nImage database:`);
    await ensureFileExists(imageDatabaseFilePath, config.imageDatabase.sha256, config.imageDatabase.downloadUrl,
        config.skipIntegrityChecks);

    console.log(`\nStarting build (id: ${buildId})`);

    const vmName = `${config.virtualBox.vmname} ${buildId}`;

    if (alternativeImageFilePath)
        await vbox.import(alternativeImageFilePath, vmName);
    else
        await vbox.import(imageFilePath, vmName);

    await vbox.start(vmName);

    const deployment = new DeploymentUtils(config, buildId);

    await deployment.initInstanceDirectory();

    await deployment.createDeployUser();

    await deployment.switchToDeployUser();

    await deployment.configureNginx();

    await deployment.configureJava();

    await deployment.createDatabases(homeDirectoryPath);

    await deployment.installApiServer();

    await deployment.copyImages(homeDirectoryPath);

    await deployment.installRespondentFrontend();

    await deployment.installAdminFrontend();
}

main().catch(reason => {
    process.stderr.write(reason.toString())
});
