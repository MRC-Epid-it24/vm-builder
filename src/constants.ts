import * as path from "path";
import * as os from "os";

export const homeDirectoryName = ".intake24-vm-builder";
export const imageFileName = "base-image.ova";
export const homeDirectoryPath = path.resolve(os.homedir(), homeDirectoryName);
export const imageFilePath = path.resolve(os.homedir(), homeDirectoryName, imageFileName);
