import {exec_display_output} from "./exec-utils";
import * as path from "path";

export async function ssh_keygen(destDir: string, file: string) {
    await exec_display_output("ssh-keygen", ["-t", "rsa", "-b", "4096", "-f", path.resolve(destDir, file), "-N", ""]);
    await exec_display_output("chmod", ["600", path.resolve(destDir, file)]);
    await exec_display_output("chmod", ["644", `${path.resolve(destDir, file)}.pub`]);
}
