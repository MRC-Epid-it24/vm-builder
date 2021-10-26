import * as fs from "fs";
import { randomBytes } from "crypto";
import * as path from "path";
import { DeploymentUtils } from "./deployment-utils";
import {
  initInstanceDirectory,
  createDeployUser,
  switchToDeployUser,
} from "./deployment-utils-alternative";
import * as os from "os";
import { homeDirectoryName } from "./constants";
import { Configuration, ArrayofFunctions, Payload } from "./config-types";
import {
  ensureHomeDirectoryandCacheExistence,
  virtualMachineStart,
} from "./process-utils";

const config: Configuration = require("./config.js");

const inputCommand = process.argv[2];

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
    // deployment.configureNginx, 			// 5
    // deployment.configureJava, 			// 6
    // deployment.createDatabases, 			// 7
    // deployment.installApiServer, 		// 8
    // deployment.copyImages, 				// 9
    // deployment.installRespondentFrontend,// 10
    // deployment.installAdminFrontend, 	// 11
  ];

  for (let index = 0; index < exFunctions.length; index++) {
    const log = await exFunctions[index].fn(exFunctions[index].payload);
    if (log !== undefined) fs.writeFileSync("./log.txt", log + "");
    else fs.writeFileSync("./log.txt", "[" + index.toString + "]");
  }

  /**
   * [0]: Initial chores to ensure the existing of all necessaryt files and directories
   */
  //await ensureHomeDirectoryandCacheExistence(homeDirectoryPath);

  /**
   * [1]: Starting virtual box machine
   */
  //await virtualMachineStart(homeDirectoryPath, buildId);

  // await deployment.initInstanceDirectory();

  //   await deployment.createDeployUser();

  //   await deployment.switchToDeployUser();

  //   await deployment.configureNginx();

  //   await deployment.configureJava();

  //   await deployment.createDatabases(homeDirectoryPath);

  //   await deployment.installApiServer();

  //   await deployment.copyImages(homeDirectoryPath);

  //   await deployment.installRespondentFrontend();

  //   await deployment.installAdminFrontend();
}

main().catch((reason) => {
  process.stderr.write(reason.toString());
});
