import * as fs from "fs";
import * as path from "path";
import { ensureFileExists } from "./download-cache";
import { Configuration, OneInputFunction, Payload } from "./config-types";
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

export const ensureHomeDirectoryandCacheExistence: OneInputFunction = async (
  payload: Payload
) => {
  await ensureHomeDirectoryExists(payload.homeDirectoryPath);

  const imageFilePath = path.resolve(payload.homeDirectoryPath, imageFileName);
  const systemDatabaseFilePath = path.resolve(
    payload.homeDirectoryPath,
    systemDatabaseFileName
  );
  const foodDatabaseFilePath = path.resolve(
    payload.homeDirectoryPath,
    foodDatabaseFileName
  );
  const imageDatabaseFilePath = path.resolve(
    payload.homeDirectoryPath,
    imageDatabaseFileName
  );

  console.log(`\n>>> Verifying and downloading resources >>>`);
  console.log(`\nUsing "${payload.homeDirectoryPath}" for file downloads`);

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

  return "[0]: Initial chores completed (cache exists, files downloaded)";
};

export const virtualMachineStart: OneInputFunction = async (
  payload: Payload
) => {
  const alternativeImageFilePath = config.virtualBox.homeDirectoryOverride
    ? `${config.virtualBox.homeDirectoryOverride}/${homeDirectoryName}/${imageFileName}`
    : undefined;

  const imageFilePath = path.resolve(payload.homeDirectoryPath, imageFileName);

  const vbox = new VirtualBoxUtils(config.virtualBox.command);

  let log = "[1]: Virtual Machine initialization crashed";

  console.log(`\nStarting build (id: ${payload.buildId})`);

  const vmName = `${config.virtualBox.vmname} ${payload.buildId}`;

  if (alternativeImageFilePath)
    await vbox.import(alternativeImageFilePath, vmName);
  else await vbox.import(imageFilePath, vmName);

  /**
   * [1]: Starting virtual box machine
   */
  await vbox
    .start(vmName)
    .then((result) => {
      log = "[1]: VBox started";
    })
    .catch((err) => {
      log = "[1]: Virtual Machine initialization crashed" + err;
    });
};
