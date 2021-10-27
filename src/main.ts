import * as fs from "fs";
import { randomBytes } from "crypto";
import * as path from "path";
import { DeploymentUtils } from "./deployment-utils";
import {
  initInstanceDirectory,
  createDeployUser,
  switchToDeployUser,
  configureNginx,
  configureJava,
  createDatabases,
  copyImages,
  installApiServer,
  installRespondentFrontend,
  installAdminFrontend,
} from "./deployment-utils-alternative";
import * as os from "os";
import { homeDirectoryName } from "./constants";
import { Configuration, ArrayofFunctions, Payload } from "./config-types";
import {
  ensureHomeDirectoryandCacheExistence,
  virtualMachineStart,
} from "./process-utils";

const config: Configuration = require("./config.js");

let inputCommand = parseInt(process.argv[2], 10)
  ? parseInt(process.argv[2], 10)
  : 0;

const homeDirectoryPath = config.homeDirectoryOverride
  ? path.resolve(config.homeDirectoryOverride, homeDirectoryName)
  : path.resolve(os.homedir(), homeDirectoryName);
const buildId = config.buildIdOverride
  ? config.buildIdOverride
  : randomBytes(8).toString("hex");

async function main(): Promise<void> {
  const payload: Payload = {
    homeDirectoryPath: homeDirectoryPath,
    buildId: buildId,
    exampleInstanceDirectoryPath: path.resolve(
      config.deployment.directory,
      "instances",
      "example"
    ),
    buildInstanceDirectoryPath: path.resolve(
      config.deployment.directory,
      "instances",
      buildId
    ),
  };

  const buildDirectory = path.resolve(homeDirectoryPath, buildId);
  const deployment = new DeploymentUtils(config, buildId);

  //Building functions to execute:
  // TODO: allow user to continue from the last step of the process
  const exFunctions: ArrayofFunctions = [
    // [0]: Initial chores to ensure the existing of all necessaryt files and directories
    {
      fn: ensureHomeDirectoryandCacheExistence,
      payload: payload,
    },
    // [1]: Starting virtual box machine
    { fn: virtualMachineStart, payload: payload },
    // [2]: Initializing Deployemnt directory
    {
      fn: initInstanceDirectory,
      payload: payload,
    },
    // [3]: Creating Deploying user, replacing templates and uploading key to VM
    {
      fn: createDeployUser,
      payload: payload,
    },
    // [4]: Switching to Deploy user for SSH to server
    {
      fn: switchToDeployUser,
      payload: payload,
    },
    // [5]: Configure Nginx in deployment directory
    {
      fn: configureNginx,
      payload: payload,
    },
    // [6]: Configure Java at the server
    {
      fn: configureJava,
      payload: payload,
    },
    // [7]: Creating and Populating Database
    {
      fn: createDatabases,
      payload: payload,
    },
    // [8]: Copy Images to server TODO: Fix the image-database/config.json' - no such filel or directory
    // {
    //   fn: copyImages,
    //   payload: payload,
    // },
    // [9]: Install API Server
    {
      fn: installApiServer,
      payload: payload,
    },
    // [10]: Install Survey frontend
    {
      fn: installRespondentFrontend,
      payload: payload,
    },
    // [11]: Install Admin Frontend
    {
      fn: installAdminFrontend,
      payload: payload,
    },
  ];

  if (inputCommand > exFunctions.length - 1) inputCommand = 0;
  console.log("Starting from the step ", inputCommand);

  for (let index = inputCommand; index < exFunctions.length; index++) {
    const log = await exFunctions[index].fn(exFunctions[index].payload);
    if (log !== undefined) fs.writeFileSync("./log.txt", log + "");
    else fs.writeFileSync("./log.txt", "[" + index.toString + "]");
  }
}

main().catch((reason) => {
  process.stderr.write(reason.toString());
});
