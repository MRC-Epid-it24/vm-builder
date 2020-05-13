import {spawn} from "child_process";
import {exec_display_output} from "./exec-utils";

export class VirtualBoxUtils {
    command: string;

    constructor(command: string) {
        this.command = command;
    }

    async exec(args: ReadonlyArray<string>): Promise<void> {
        return exec_display_output(this.command, args);
    }

    async import(imagePath: string, name: string): Promise<void> {
        process.stdout.write("Importing " + imagePath + " into VirtualBox...\n");
        return this.exec(["import", imagePath, "--vsys", "0", "--vmname", name]);
    }
}
