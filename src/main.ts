import {ensureBaseImageExists} from "./ova-cache";
import {imageFilePath} from "./constants";

let config = require("./config.js");

ensureBaseImageExists(imageFilePath, config.VM.baseOvaChecksum, config.VM.baseOvaUrl).then();
