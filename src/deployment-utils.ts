import * as path from "path";
import * as fs from "fs";
import {copy} from "fs-extra";
// @ts-ignore
import replace from "replace";
import {ssh_keygen} from "./ssh-utils";
import {exec_display_output} from "./exec-utils";

export class DeploymentUtils {
    ansiblePlaybookCommand: string;
    deploymentDirectory: string;
    vmIp4Address: string;

    constructor(ansiblePlaybookCommand: string, deploymentDirectory: string,
                vmIp4Address: string) {
        this.ansiblePlaybookCommand = ansiblePlaybookCommand;
        this.deploymentDirectory = deploymentDirectory;
        this.vmIp4Address = vmIp4Address;
    }

    resolveExampleInstanceDirectoryPath(): string {
        return path.resolve(this.deploymentDirectory, "instances", "example");
    }

    resolveBuildInstanceDirectoryPath(buildId: string): string {
        return path.resolve(this.deploymentDirectory, "instances", buildId);
    }

    replaceInFile(path: string, regex: string, replacement: string) {
        this.replaceInFileMultiple(path, [{regex, replacement}]);
    }

    replaceInFileMultiple(path: string, replacements: { regex: string, replacement: string }[]) {
        replacements.forEach(r => {
            replace({
                regex: r.regex,
                replacement: r.replacement,
                paths: [path],
                recursive: false,
                silent: false,
                multiline: true
            });
        });
    }

    async initInstanceDirectory(buildId: string): Promise<void> {
        const directory = this.resolveBuildInstanceDirectoryPath(buildId);

        console.log("Copying instance configuration directory...");

        // hosts file

        await copy(this.resolveExampleInstanceDirectoryPath(), directory);
        this.replaceInFile(path.resolve(directory, "hosts"), "host\\.name\\.tld", this.vmIp4Address);

        await fs.promises.rename(path.resolve(directory, "host_vars", "host.example.tld.bootstrap"),
            path.resolve(directory, "host_vars", this.vmIp4Address));

        this.replaceInFileMultiple(path.resolve(directory, "host_vars", this.vmIp4Address), [
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
            }
        ]);

        await ssh_keygen(path.resolve(directory, "ssh"), "deploy");

        await exec_display_output(path.resolve(this.deploymentDirectory, "create-deploy-user.sh"), [buildId], this.deploymentDirectory);
    }
}
