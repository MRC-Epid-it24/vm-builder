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
    console.log("Downloading base OVA image, this will take a while...");

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
};


async function checkCachedImage(path: string, checksum: string): Promise<boolean> {
    try {
        let stats = await fs.promises.stat(path);
        console.log("Found cached OVA image, verifying checksum...")
        let sum = await sha256sum(path);

        if (sum == checksum) {
            return Promise.resolve(true);
        } else {
            console.log("Cached OVA image checksum doesn't match, removing file");
            await fs.promises.unlink(path);
            return Promise.resolve(false);
        }
    } catch (err) {
        return Promise.resolve(false);
    }
}

export async function ensureBaseImageExists(cachedImagePath: string, checksum: string, downloadUrl: string): Promise<void> {

    let cacheOk = await checkCachedImage(cachedImagePath, checksum);

    if (cacheOk) {
        console.log("Cached image OK");
        return Promise.resolve();
    } else {
        await download(downloadUrl, cachedImagePath);
        console.log("Verifying the integrity of downloaded image file...");
        let actualChecksum = await sha256sum(cachedImagePath);
        if (actualChecksum == checksum) {
            console.log("Checksum OK");
            return Promise.resolve();
        }
        else {
            fs.unlinkSync(cachedImagePath);
            return Promise.reject("Checksum mismatch for downloaded file, expected " + checksum + ", got " + actualChecksum);
        }
    }
}
