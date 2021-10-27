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

export const showConsoleMessage = (key: string | number): void => {
  console.log("inside showMessage");
  switch (key) {
    case "--help":
      console.log("=============Info================");
      console.log(
        "Run node main.js to execute full process of VM creation. \nProvide arguments to this script: node main.js [command]|[step to start from = 0] [step to finish on = last ] \n"
      );
      console.log(
        "\x1b[36m%s\x1b[0m",
        "[command] - command to run. Available commands \n\
          --help - display this help message and available steps\n" +
          "[step to start from] - starting step of the process. By default starts from the 0. \n" +
          "[step to finish on] - finishing step of the process. By default exeutes all available steps = length of the whole set of steps \n" +
          "Steps: \n\
          [0]: Initial chores to ensure the existing of all necessaryt files and directories\n\
          [1]: Starting virtual box machine\n\
          [2]: Initializing Deployemnt directory\n\
          [3]: Creating Deploying user, replacing templates and uploading key to VM\n\
          [4]: Switching to Deploy user for SSH to server\n\
          [5]: Configure Nginx in deployment directory\n\
          [6]: Configure Java at the server\n\
          [7]: Creating and Populating Database"
      );
      console.log(
        "\x1b[31m%s\x1b[31m",
        "          [8]: Copy Images to server - Switched off"
      );
      console.log(
        "\x1b[36m%s\x1b[0m",
        "          [9]: Install API Server\n\
          [10]: Install Survey frontend\n\
          [11]: Install Admin Frontend"
      );
      console.log("\x1b[0m%s\x1b[0m", " ");
      break;
    default:
      console.log("Please type --help to see available options");
      break;
  }
};
