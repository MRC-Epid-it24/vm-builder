import * as fs from "fs";
import * as path from "path";
import { ensureFileExists } from "./download-cache";
import { Configuration } from "./config-types";
import { VirtualBoxUtils } from "./virtualbox-utils";
import {
  foodDatabaseFileName,
  homeDirectoryName,
  imageDatabaseFileName,
  imageFileName,
  systemDatabaseFileName,
} from "./constants";

const config: Configuration = require("./config.js");

async function continueProcess(process_arg: string): Promise<void> {
  if (process_arg === "--continue") {
  } else {
    return;
  }
}

async function ensureHomeDirectoryExists(
  homeDirectoryPath: string
): Promise<void> {
  try {
    let stats = await fs.promises.stat(homeDirectoryPath);
    if (!stats.isDirectory())
      return Promise.reject(
        homeDirectoryPath + " exists but is not a directory"
      );
  } catch (e) {
    await fs.promises.mkdir(homeDirectoryPath, { recursive: true });
  }
}

export async function ensureHomeDirectoryandCacheExistence(
  homeDirectoryPath: string
): Promise<void> {
  await ensureHomeDirectoryExists(homeDirectoryPath);

  const imageFilePath = path.resolve(homeDirectoryPath, imageFileName);
  const systemDatabaseFilePath = path.resolve(
    homeDirectoryPath,
    systemDatabaseFileName
  );
  const foodDatabaseFilePath = path.resolve(
    homeDirectoryPath,
    foodDatabaseFileName
  );
  const imageDatabaseFilePath = path.resolve(
    homeDirectoryPath,
    imageDatabaseFileName
  );

  console.log(`\n>>> Verifying and downloading resources >>>`);
  console.log(`\nUsing "${homeDirectoryPath}" for file downloads`);

  console.log(`\nBase VM image:`);
  await ensureFileExists(
    imageFilePath,
    config.ova.sha256,
    config.ova.downloadUrl,
    config.skipIntegrityChecks
  );

  console.log(`\nSystem database:`);
  await ensureFileExists(
    systemDatabaseFilePath,
    config.systemDatabase.sha256,
    config.systemDatabase.downloadUrl,
    config.skipIntegrityChecks
  );

  console.log(`\nFood database:`);
  await ensureFileExists(
    foodDatabaseFilePath,
    config.foodDatabase.sha256,
    config.foodDatabase.downloadUrl,
    config.skipIntegrityChecks
  );

  console.log(`\nImage database:`);
  await ensureFileExists(
    imageDatabaseFilePath,
    config.imageDatabase.sha256,
    config.imageDatabase.downloadUrl,
    config.skipIntegrityChecks
  );
}

export async function virtualMachineStart(
  homeDirectoryPath: string,
  buildId: string
): Promise<void> {
  const alternativeImageFilePath = config.virtualBox.homeDirectoryOverride
    ? `${config.virtualBox.homeDirectoryOverride}/${homeDirectoryName}/${imageFileName}`
    : undefined;

  const imageFilePath = path.resolve(homeDirectoryPath, imageFileName);

  const vbox = new VirtualBoxUtils(config.virtualBox.command);

  console.log(`\nStarting build (id: ${buildId})`);

  const vmName = `${config.virtualBox.vmname} ${buildId}`;

  if (alternativeImageFilePath)
    await vbox.import(alternativeImageFilePath, vmName);
  else await vbox.import(imageFilePath, vmName);

  /**
   * [1]: Starting virtual box machine
   */
  await vbox
    .start(vmName)
    .then((result) => {
      fs.writeFileSync("./log.txt", "[1]: VBox started");
    })
    .catch((err) => {
      fs.writeFileSync("./log.txt", "[1]: VBox stasrt error: ", err);
    });
}
