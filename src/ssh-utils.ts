import {exec_display_output} from "./exec-utils";
import * as path from "path";

export async function ssh_keygen(destDir: string, file: string) {
    return exec_display_output("ssh-keygen", ["-t", "rsa", "-b", "4096", "-f", path.resolve(destDir, file), "-N", ""]);
}
