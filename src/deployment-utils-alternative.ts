import * as path from "path";
import * as fs from "fs";
import { copy } from "fs-extra";
// @ts-ignore
import replace from "replace";
import { ssh_keygen } from "./ssh-utils";
import { exec_display_output } from "./exec-utils";
import {
  Configuration,
  DeploymentConfig,
  OneInputFunction,
  Payload,
  VirtualBoxConfig,
} from "./config-types";
import {
  foodDatabaseFileName,
  imageDatabaseFileName,
  systemDatabaseDataFileName,
  systemDatabaseFileName,
  systemDatabaseSchemaFileName,
} from "./constants";

const config: Configuration = require("./config.js");

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

const replaceInFile = async (
  path: string,
  regex: string,
  replacement: string
): Promise<void> => {
  await replaceInFileMultiple(path, [{ regex, replacement }]);
};

const replaceInFileMultiple = async (
  path: string,
  replacements: { regex: string; replacement: string }[]
): Promise<void> => {
  replacements.forEach((r) => {
    replace({
      regex: r.regex,
      replacement: r.replacement,
      paths: [path],
      recursive: false,
      silent: false,
      multiline: true,
    });
  });
};

export const execDeploymentScript = async (
  name: string,
  buildId: string
): Promise<void> => {
  await exec_display_output(
    path.resolve(config.deployment.directory, name),
    [buildId],
    config.deployment.directory
  );
};

export const initInstanceDirectory: OneInputFunction = async (
  payload: Payload
): Promise<string> => {
  console.log("\n>>> Copying instance configuration directory >>>");
  await copy(
    payload.exampleInstanceDirectoryPath,
    payload.buildInstanceDirectoryPath
  );
  return `[2]: Deployment directory "${payload.buildId} created"`;
};

export const createDeployUser: OneInputFunction = async (
  payload: Payload
): Promise<string> => {
  console.log("\n>>> Creating deploy user >>>");

  await replaceInFile(
    path.resolve(payload.buildInstanceDirectoryPath, "hosts"),
    "host\\.name\\.tld",
    config.virtualBox.ip4address
  );

  await fs.promises.rename(
    path.resolve(
      payload.buildInstanceDirectoryPath,
      "host_vars",
      "host.example.tld.bootstrap"
    ),
    path.resolve(
      payload.buildInstanceDirectoryPath,
      "host_vars",
      config.virtualBox.ip4address
    )
  );

  await replaceInFileMultiple(
    path.resolve(
      payload.buildInstanceDirectoryPath,
      "host_vars",
      config.virtualBox.ip4address
    ),
    [
      {
        regex: "ansible_user:.*$",
        replacement: "ansible_user: intake24",
      },
      {
        regex: "ansible_password:.*$",
        replacement: "ansible_password: intake24",
      },
      {
        regex: "ansible_become_pass:.*$",
        replacement: "ansible_become_pass: intake24",
      },
    ]
  );

  await ssh_keygen(
    path.resolve(payload.buildInstanceDirectoryPath, "ssh"),
    "deploy"
  );

  console.log("Waiting for VM start");
  await delay(config.delayTime);
  console.log("Connecting to VM");

  await execDeploymentScript("create-deploy-user.sh", payload.buildId);

  return `[3]: Created Deploying user, replaced templates and uploaded key to VM`;
};

export const switchToDeployUser: OneInputFunction = async (
  payload: Payload
): Promise<string> => {
  console.log(
    "\n>>> Configuring host_vars to use deploy user instead of bootstrap >>>"
  );

  try {
    await fs.promises.unlink(
      path.resolve(
        payload.buildInstanceDirectoryPath,
        "host_vars",
        config.virtualBox.ip4address
      )
    );
  } catch {
    // FIXME: need to check for ENOENT and rethrow other errors
  }

  await fs.promises.rename(
    path.resolve(
      payload.buildInstanceDirectoryPath,
      "host_vars",
      "host.example.tld"
    ),
    path.resolve(
      payload.buildInstanceDirectoryPath,
      "host_vars",
      config.virtualBox.ip4address
    )
  );

  return `[4]: Switching to Deploy user for SSH to server ${payload.buildId}`;
};

export const configureNginx: OneInputFunction = async (
  payload: Payload
): Promise<string> => {
  console.log("\n>>> Configuring nginx >>>");
  await execDeploymentScript("configure-nginx.sh", payload.buildId);
  return `[5]: Configured Nginx in deployment directory for ${payload.buildId}`;
};

export const configureJava: OneInputFunction = async (payload: Payload) => {
  console.log("\n>>> Configuring Java >>>");
  await execDeploymentScript("configure-java.sh", payload.buildId);
  return `[6]: Configured Java at the server (${config.virtualBox.ip4address}) for ${payload.buildId}`;
};

export const createDatabases: OneInputFunction = async (
  payload: Payload
): Promise<string> => {
  console.log("\n>>> Creating databases >>>");

  await exec_display_output(
    "unzip",
    ["-o", systemDatabaseFileName],
    payload.homeDirectoryPath
  );

  await replaceInFileMultiple(
    path.resolve(
      payload.buildInstanceDirectoryPath,
      "database",
      "postgres-configuration.yml"
    ),
    [
      {
        regex: "schema_snapshot_path:.*$",
        replacement: `schema_snapshot_path: ${path.resolve(
          payload.homeDirectoryPath,
          systemDatabaseSchemaFileName
        )}`,
      },
      {
        regex: "data_snapshot_path:.*$",
        replacement: `data_snapshot_path: ${path.resolve(
          payload.homeDirectoryPath,
          systemDatabaseDataFileName
        )}`,
      },
      {
        regex: "(^\\s+snapshot_path):.*$",
        replacement: `$1: ${path.resolve(
          payload.homeDirectoryPath,
          foodDatabaseFileName
        )}`,
      },
      {
        regex: "admin_user_email:.*$",
        replacement: "admin_user_email: admin@localhost",
      },
    ]
  );

  await execDeploymentScript("create-databases.sh", payload.buildId);
  return `[7]: Database at ${config.virtualBox.ip4address} has been created and populating with data`;
};
