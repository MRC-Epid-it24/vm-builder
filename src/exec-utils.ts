import {spawn} from "child_process";

export interface ExecResult {
    stdout: string;
    stderr: string;
}

export async function exec_display_output(command: string, args: ReadonlyArray<string>, workingDirectory?: string): Promise<void> {
    return new Promise((resolve, reject) => {
        let child = spawn(command, args, { cwd: workingDirectory });
        child.stdout.setEncoding("utf8");
        child.stdout.on('data', function(data) {
            process.stdout.write(data);
        });
        child.stderr.on('data', function (data) {
           process.stderr.write(data);
        });
        child.on('close', function(code: number) {
            if(code == 0) {
                resolve();
            } else {
                reject("Process \"" + command + "\" failed with code " + code);
            }
        });
        child.on('error', function (error) {
            reject(error);
        })
    });
}
