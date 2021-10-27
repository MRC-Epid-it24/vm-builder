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

export const copyImages: OneInputFunction = async (
  payload: Payload
): Promise<string> => {
  console.log("\n>>> Copying image database, this will take a while >>>");

  await replaceInFileMultiple(
    path.resolve(
      payload.buildInstanceDirectoryPath,
      "image-database",
      "config.json"
    ),
    [
      {
        regex: '"image_database_archive": "/path/to/images.zip"',
        replacement: `"image_database_archive": "${path.resolve(
          payload.homeDirectoryPath,
          imageDatabaseFileName
        )}"`,
      },
    ]
  );

  await execDeploymentScript("copy-image-database.sh", payload.buildId);
  return `[8]: Images has been copied to the server ${config.virtualBox.ip4address}`;
};

export const installApiServer: OneInputFunction = async (
  payload: Payload
): Promise<string> => {
  console.log("\n>>> Installing API server >>>");

  await replaceInFileMultiple(
    path.resolve(
      payload.buildInstanceDirectoryPath,
      "api-server",
      "application.conf"
    ),
    [
      {
        regex:
          'play\\.modules\\.enabled \\+= "modules.S3StorageReadOnlyModule"',
        replacement:
          '# play.modules.enabled += "modules.S3StorageReadOnlyModule"',
      },
      {
        regex: '#play\\.modules\\.enabled \\+= "modules.LocalStorageModule"',
        replacement: 'play.modules.enabled += "modules.LocalStorageModule"',
      },
      {
        regex: "^(  adminFrontendUrl =).*$",
        replacement: `$1 "http://${config.virtualBox.ip4address}:${config.admin.port}"`,
      },
      {
        regex: "^(  surveyFrontendUrl =).*$",
        replacement: `$1 "http://${config.virtualBox.ip4address}:${config.frontend.port}"`,
      },
      {
        regex: '      baseDirectory = "/path/to/intake24-images/"',
        replacement: '      baseDirectory = "/var/opt/intake24/images"',
      },
      {
        regex: '      urlPrefix = "http://192\\.168\\.1\\.1:8001/images"',
        replacement: `      urlPrefix = "http://${config.virtualBox.ip4address}:${config.apiServer.port}/images"`,
      },
    ]
  );

  await replaceInFileMultiple(
    path.resolve(
      payload.buildInstanceDirectoryPath,
      "api-server",
      "play-app.json"
    ),
    [
      {
        regex: '    "debian_package_path": .*$',
        replacement: `    "debian_package_path": "${config.apiServer.v1debianPackagePath}",`,
      },
      {
        regex: '    "java_memory_max": "512m"',
        replacement: '    "java_memory_max": "2048m"',
      },
    ]
  );

  await replaceInFileMultiple(
    path.resolve(
      payload.buildInstanceDirectoryPath,
      "play-shared",
      "http-secret.conf"
    ),
    [
      {
        regex: "play.http.secret.key=.*$",
        replacement: `play.http.secret.key="${config.apiServer.playSecret}"`,
      },
    ]
  );

  await execDeploymentScript("api-server.sh", payload.buildId);

  console.log("\n>>> Installing API V2 server >>>");

  await replaceInFileMultiple(
    path.resolve(
      payload.buildInstanceDirectoryPath,
      "api-server-v2",
      "config.json"
    ),
    [
      {
        regex: '"source_jar_path": ""',
        replacement: `"source_jar_path": "${config.apiServer.v2jarPath}"`,
      },
      {
        regex: '"java_memory_max": "128m"',
        replacement: '"java_memory_max": "256m"',
      },
    ]
  );

  await replaceInFileMultiple(
    path.resolve(
      payload.buildInstanceDirectoryPath,
      "api-server-v2",
      "service.conf"
    ),
    [
      {
        regex: 'url = "jdbc:postgresql://192.168.56.2:5432/intake24_system"',
        replacement: `url = "jdbc:postgresql://localhost:5432/intake24_system"`,
      },
      {
        regex: 'url = "jdbc:postgresql://192.168.56.2:5432/intake24_foods"',
        replacement: 'url = "jdbc:postgresql://localhost:5432/intake24_foods"',
      },
      {
        regex: 'jwtSecret = ""',
        replacement: `jwtSecret = "${config.apiServer.playSecret}"`,
      },
      {
        regex: 'downloadURLPrefix = "http://localhost:6403/files"',
        replacement: `downloadURLPrefix = "http://${config.virtualBox.ip4address}:${config.apiServer.port}/v2/files"`,
      },
    ]
  );

  await execDeploymentScript("api-server-v2.sh", payload.buildId);

  console.log("\n>>> Installing data export service >>>");

  await replaceInFileMultiple(
    path.resolve(
      payload.buildInstanceDirectoryPath,
      "data-export-service",
      "application.conf"
    ),
    [
      {
        regex: "^(  apiServerUrl =).*$",
        replacement: `$1 "http://${config.virtualBox.ip4address}:${config.apiServer.port}"`,
      },
      {
        regex: "^(  surveyFrontendUrl =).*$",
        replacement: `$1 "http://${config.virtualBox.ip4address}:${config.frontend.port}"`,
      },
    ]
  );

  await replaceInFileMultiple(
    path.resolve(
      payload.buildInstanceDirectoryPath,
      "data-export-service",
      "play-app.json"
    ),
    [
      {
        regex: '    "debian_package_path": .*$',
        replacement: `    "debian_package_path": "${config.apiServer.dataExportServiceDebianPackagePath}",`,
      },
    ]
  );

  await execDeploymentScript("data-export-service.sh", payload.buildId);

  await replaceInFileMultiple(
    path.resolve(
      payload.buildInstanceDirectoryPath,
      "api-server",
      "nginx-site"
    ),
    [
      {
        regex: "  listen 8001",
        replacement: `  listen ${config.apiServer.port}`,
      },
      {
        regex: "  listen \\[::\\]:8001",
        replacement: `  listen [::]:${config.apiServer.port}`,
      },
      {
        regex: "  server_name 192\\.168\\.1\\.1",
        replacement: `  server_name ${config.virtualBox.ip4address}`,
      },
      {
        regex: "    alias /path/to/intake24-images/",
        replacement: "    alias /var/opt/intake24/images/",
      },
      {
        regex: "    proxy_pass http://localhost:6406/",
        replacement: "    proxy_pass http://localhost:6403/",
      },
    ]
  );

  await execDeploymentScript("nginx-api-server.sh", payload.buildId);

  return `[9]: API v1 and v2 havew been instaled at ${config.virtualBox.ip4address}`;
};

export const installRespondentFrontend: OneInputFunction = async (
  payload: Payload
): Promise<string> => {
  console.log("\n>>> Installing respondent frontend >>>");

  await replaceInFileMultiple(
    path.resolve(
      payload.buildInstanceDirectoryPath,
      "survey-site",
      "application.conf"
    ),
    [
      {
        regex: "^(  externalApiBaseUrl =).*$",
        replacement: `$1 "http://${config.virtualBox.ip4address}:${config.apiServer.port}"`,
      },
    ]
  );

  await replaceInFileMultiple(
    path.resolve(
      payload.buildInstanceDirectoryPath,
      "survey-site",
      "play-app.json"
    ),
    [
      {
        regex: '    "debian_package_path": .*$',
        replacement: `    "debian_package_path": "${config.frontend.debianPackagePath}",`,
      },
      {
        regex: '"http_port": "8000"',
        replacement: `"http_port": "${config.frontend.port}"`,
      },
      {
        regex: '"http_address": "192.168.1.1"',
        replacement: `"http_address": "${config.frontend.address}"`,
      },
    ]
  );

  await execDeploymentScript("survey-site.sh", payload.buildId);

  await replaceInFileMultiple(
    path.resolve(
      payload.buildInstanceDirectoryPath,
      "survey-site",
      "nginx-site"
    ),
    [
      {
        regex: "  listen 8000",
        replacement: `  listen ${config.frontend.port}`,
      },
      {
        regex: "  listen \\[::\\]:8000",
        replacement: `  listen [::]:${config.frontend.port}`,
      },
      {
        regex: "  server_name 192\\.168\\.1\\.1",
        replacement: `  server_name ${config.virtualBox.ip4address}`,
      },
      {
        regex: "    alias /path/to/intake24-images/",
        replacement: "    alias /var/opt/intake24/images",
      },
    ]
  );

  await execDeploymentScript("nginx-survey-site.sh", payload.buildId);

  return "[10]: Survey Frontend has been installed";
};

export const installAdminFrontend: OneInputFunction = async (
  payload: Payload
): Promise<string> => {
  console.log("\n>>> Installing admin frontend >>>");

  await replaceInFileMultiple(
    path.resolve(payload.buildInstanceDirectoryPath, "admin-site", "app.json"),
    [
      {
        regex: '"api_base_url": "http://192.168.1.1:8001/"',
        replacement: `"api_base_url": "http://${config.virtualBox.ip4address}:${config.apiServer.port}/"`,
      },
      {
        regex: '"http_port": "8000"',
        replacement: `"http_port": "${config.frontend.port}"`,
      },
      {
        regex: '"http_address": "192.168.1.1"',
        replacement: `"http_address": "${config.admin.address}"`,
      },
    ]
  );

  await execDeploymentScript("admin-site.sh", payload.buildId);

  await replaceInFileMultiple(
    path.resolve(
      payload.buildInstanceDirectoryPath,
      "admin-site",
      "nginx-site"
    ),
    [
      {
        regex: "  listen 80\\;",
        replacement: `  listen ${config.admin.port}\;`,
      },
      {
        regex: "  listen \\[::\\]:80\\;",
        replacement: `  listen [::]:${config.admin.port}\;`,
      },
      {
        regex: "  server_name 192\\.168\\.1\\.1",
        replacement: `  server_name ${config.virtualBox.ip4address}`,
      },
    ]
  );

  await replaceInFileMultiple(
    path.resolve(
      payload.buildInstanceDirectoryPath,
      "admin-site",
      "nginx-site.json"
    ),
    [
      {
        regex: `"host_name": "192.168.1.1"`,
        replacement: `"host_name": "${config.virtualBox.ip4address}"`,
      },
    ]
  );

  await execDeploymentScript("nginx-admin-site.sh", payload.buildId);
  return "[11]: Admin Frontend has been installed";
};
