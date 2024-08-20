import Seven from "node-7z";
import sevenBin from "7zip-bin";
import { basename, dirname, join, parse } from "node:path";
import { randomBytes } from "node:crypto";
import { renameSync, rmSync } from "node:fs";

const decompress_raw = (input, output) => new Promise((res, rej) => {
    const stream = Seven.extractFull(input, output, {
        $bin: sevenBin.path7za
    });
    stream.on("end", res);
    stream.on("error", rej);
});

const decompress = async (input, output, tar) => {
    await decompress_raw(input, output);
    if (tar) {
        // I Love 7-Zip's Mentally Disabled Behaviour Upon Finding Out It Has To Parse A Compressed Tar Archive!
        const old_name = join(output, parse(basename(input)).name);
        const new_name = old_name + "-" + randomBytes(8).toString("hex");
        renameSync(old_name, new_name);
        await decompress_raw(new_name, output);
        rmSync(new_name);
    }
};

export default decompress;