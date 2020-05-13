import {ensureBaseImageExists} from "./ova-cache";
import {homeDirectoryPath, imageFilePath} from "./constants";
import {VirtualBoxUtils} from "./virtualbox-utils";
import {randomBytes} from "crypto";
import * as fs from "fs";
import * as path from "path";
import {ssh_keygen} from "./ssh-utils";
import {DeploymentUtils} from "./deployment-utils";


const config = require("./config.js");

const vbox = new VirtualBoxUtils(config.virtualbox.command);
const deployment = new DeploymentUtils(config.deployment.ansiblePlaybookCommand,
    config.deployment.directory,
    config.virtualbox.ip4address);

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
    const buildId = randomBytes(8).toString('hex');
    const buildDirectory = path.resolve(homeDirectoryPath, buildId);

    process.stdout.write(`Build ID: ${buildId}\n`);

    await ensureHomeDirectoryExists();

    //await ssh_keygen(buildDirectory);

    // await ensureBaseImageExists(imageFilePath, config.image.sha256, config.image.downloadUrl);
    // await vbox.import(imageFilePath, `${config.virtualbox.vmname} ${buildId}`);

    await deployment.initInstanceDirectory(buildId)

    process.stdout.write(deployment.resolveBuildInstanceDirectoryPath(buildId) + "\n");

}

main().catch(reason => {
    process.stderr.write(reason.toString())
});
