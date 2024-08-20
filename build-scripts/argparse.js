import { mkdirSync, renameSync, rmSync } from "fs";
import { download_with_progress } from "../util/download.js";
import decompress from "../util/decompress.js";
import { join } from "path";
import { waitFile } from "wait-file";
import { exec } from "../util/exec.js";

export async function build(variables, spinner) {
    const argparse_info = variables.versions.libraries.find(
        (obj) => obj.name === "argparse"
    );

    const argparse_dir = join(variables.BUILD_DIR, argparse_info.out_dir);
    await download_with_progress(
        argparse_info.url,
        join(variables.BUILD_DIR, "argparse.archive"),
        `Downloading ${argparse_info.name} ${argparse_info.version}...`,
        argparse_info.b3sum,
        spinner
    );

    await decompress(
        join(variables.BUILD_DIR, "argparse.archive"),
        join(variables.BUILD_DIR)
    );

    process.chdir(argparse_dir);
    spinner.text = `Generating docs for ${argparse_info.name} ${argparse_info.version}...`;
    await exec("sphinx-build", ["docsrc", "doc"], false, false);

    spinner.text = `Installing ${argparse_info.name} ${argparse_info.version}...`;
    process.chdir(variables.BUILD_DIR);

    const argparse_install_dir = join(
        variables.BUILD_DIR,
        "argparse-tmp-install"
    );
    mkdirSync(argparse_install_dir);

    mkdirSync(join(argparse_install_dir, "share", "lua", "5.4"), {
        recursive: true,
    });
    mkdirSync(join(argparse_install_dir, "doc"), { recursive: true });

    renameSync(
        join(argparse_dir, "src", "argparse.lua"),
        join(argparse_install_dir, "share", "lua", "5.4", "argparse.lua")
    );

    renameSync(
        join(argparse_dir, "doc"),
        join(argparse_install_dir, "doc", "argparse")
    );

    spinner.text = "Cleaning up...";
    await waitFile({
        resources: [argparse_dir],
        delay: 0,
        interval: 75,
        log: false,
        reverse: false,
        timeout: 20000,
        verbose: false,
        window: 250,
    });

    rmSync("argparse.archive");
    rmSync(argparse_dir, { recursive: true, force: true });
    renameSync(argparse_install_dir, argparse_dir);
}