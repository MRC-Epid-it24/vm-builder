import { randomBytes } from "crypto";
import * as path from "path";
import { DeploymentUtils } from "./deployment-utils";
import * as os from "os";
import { homeDirectoryName } from "./constants";
import { Configuration } from "./config-types";
import {
  ensureHomeDirectoryandCacheExistence,
  virtualMachineStart,
} from "./process-utils";

const config: Configuration = require("./config.js");

const inputCommand = process.argv[2];

const homeDirectoryPath = config.homeDirectoryOverride
  ? path.resolve(config.homeDirectoryOverride, homeDirectoryName)
  : path.resolve(os.homedir(), homeDirectoryName);

async function main(): Promise<void> {
  const buildId = config.buildIdOverride
    ? config.buildIdOverride
    : randomBytes(8).toString("hex");
  const buildDirectory = path.resolve(homeDirectoryPath, buildId);
  const deployment = new DeploymentUtils(config, buildId);

  //Building functions to execute:
  // TODO: allow user to continue fro the last step of the process
  const exFunctions = [
    ensureHomeDirectoryandCacheExistence,
    virtualMachineStart,
  ];

  /**
   * [0]: Initial chores to ensure the existing of all necessaryt files and directories
   */
  await ensureHomeDirectoryandCacheExistence(homeDirectoryPath);

  /**
   * [1]: Starting virtual box machine
   */
  await virtualMachineStart(homeDirectoryPath, buildId);

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

main().catch((reason) => {
  process.stderr.write(reason.toString());
});
