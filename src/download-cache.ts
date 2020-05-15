import * as fs from "fs";
import {PathLike} from "fs";

import * as https from "https";

const sha256File = require("sha256-file");

async function sha256sum(path: PathLike): Promise<string> {
    return new Promise((resolve, reject) => {
        sha256File(path, (error: any, sum: string) => {
            if (error)
                reject(error);
            else
                resolve(sum);
        });

    });
}

async function download(url: string, dest: string): Promise<void> {
    console.log(`Downloading ${url}, this might take a while...`);

    let file = fs.createWriteStream(dest);

    return new Promise((resolve, reject) => {
        https.get(url, function (response) {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
            });
            file.on("close", () => {
                resolve();
            });
        });
    });
}


async function checkCachedFile(path: string, checksum: string, skipIntegrityCheck: boolean): Promise<boolean> {
    try {
        let stats = await fs.promises.stat(path);

        if (skipIntegrityCheck) {
            console.log(`Found cached ${path}, skipping integrity check`);
            return Promise.resolve(true);
        } else {
            console.log(`Found cached ${path}, verifying checksum...`);
            let sum = await sha256sum(path);

            if (sum == checksum) {
                console.log("Checksum OK");
                return Promise.resolve(true);
            } else {
                console.log(`Cached file checksum doesn't match, removing file`);
                await fs.promises.unlink(path);
                return Promise.resolve(false);
            }
        }
    } catch (err) {
        return Promise.resolve(false);
    }
}

export async function ensureFileExists(cachedFilePath: string, checksum: string, downloadUrl: string, skipIntegrityCheck: boolean): Promise<void> {

    let cacheOk = await checkCachedFile(cachedFilePath, checksum, skipIntegrityCheck);

    if (cacheOk) {
        return Promise.resolve();
    } else {
        await download(downloadUrl, cachedFilePath);
        console.log("Verifying the integrity of downloaded file...");
        let actualChecksum = await sha256sum(cachedFilePath);
        if (actualChecksum == checksum) {
            console.log("Checksum OK");
            return Promise.resolve();
        } else {
            fs.unlinkSync(cachedFilePath);
            return Promise.reject("Checksum mismatch for downloaded file, expected " + checksum + ", got " + actualChecksum);
        }
    }
}
