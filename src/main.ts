import {ensureBaseImageExists} from "./ova-cache";

import {VirtualBoxUtils} from "./virtualbox-utils";
import {randomBytes} from "crypto";
import * as fs from "fs";
import * as path from "path";
import {DeploymentUtils} from "./deployment-utils";
import * as os from "os";
import {homeDirectoryName, imageFileName} from "./constants";

const config = require("./config.js");

const vbox = new VirtualBoxUtils(config.virtualbox.command);

const deployment = new DeploymentUtils(config.deployment.ansiblePlaybookCommand,
    config.deployment.directory,
    config.virtualbox.ip4address);

const homeDirectoryPath = config.homeDirectoryOverride ?
    path.resolve(config.homeDirectoryOverride, homeDirectoryName) : path.resolve(os.homedir(), homeDirectoryName);

const imageFilePath = path.resolve(homeDirectoryPath, imageFileName);

const alternativeImageFilePath = (config.virtualbox.homeDirectoryOverride) ?
    `${config.virtualbox.homeDirectoryOverride}/${homeDirectoryName}/${imageFileName}` : undefined;

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
    const buildId = (config.buildIdOverride)? config.buildIdOverride : randomBytes(8).toString('hex');
    const buildDirectory = path.resolve(homeDirectoryPath, buildId);

    await ensureHomeDirectoryExists();

    console.log(`Using "${homeDirectoryPath}" for VM image downloads`);

    await ensureBaseImageExists(imageFilePath, config.image.sha256, config.image.downloadUrl);

    console.log(`Starting build (id: ${buildId})`);

    const vmName = `${config.virtualbox.vmname} ${buildId}`;

    if (alternativeImageFilePath)
        await vbox.import(alternativeImageFilePath, vmName);
    else
        await vbox.import(imageFilePath, vmName);

    await vbox.start(vmName);

    await deployment.initInstanceDirectory(buildId);

    process.stdout.write(deployment.resolveBuildInstanceDirectoryPath(buildId) + "\n");

}

main().catch(reason => {
    process.stderr.write(reason.toString())
});
