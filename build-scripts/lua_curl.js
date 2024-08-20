import { cpSync, mkdirSync, readdirSync, renameSync, rmSync } from "fs";
import { download_with_progress } from "../util/download.js";
import { join } from "path";
import decompress from "../util/decompress.js";
import { exec, invoke_compiler } from "../util/exec.js";
import { waitFile } from "wait-file";
import { submit_compile_job } from "../util/compiler_worker_wrap.js";

export async function build(variables, spinner) {
    const lua_info = variables.versions.libraries.find(
        (obj) => obj.name === "lua"
    );
    const lcurl_info = variables.versions.libraries.find(
        (obj) => obj.name === "Lua-cURLv3"
    );

    // Make a master build directory
    const master_build_dir = join(variables.BUILD_DIR, "luacurl-build");
    mkdirSync(master_build_dir);

    // Build zlib
    await download_with_progress(
        lcurl_info.dependencies.zlib.url,
        join(master_build_dir, "zlib.archive"),
        "[Lua-cURL-v3] downloading dep: zlib",
        lcurl_info.dependencies.zlib.b3sum,
        spinner
    );

    spinner.text = "[Lua-cURL-v3] extracting dep: zlib";
    await decompress(join(master_build_dir, "zlib.archive"), master_build_dir);

    const zlib_dir = join(
        master_build_dir,
        lcurl_info.dependencies.zlib.out_dir
    );
    const zlib_install_dir = join(master_build_dir, "zlib-bin");

    mkdirSync(join(zlib_dir, "build"));
    process.chdir(join(zlib_dir, "build"));

    spinner.text = "[Lua-cURL-v3] configuring dep: zlib";
    await exec(
        "cmake",
        [
            "-DCMAKE_BUILD_TYPE=Release",
            "-DZLIB_COMPAT=on",
            "-DZLIB_ENABLE_TESTS=off",
            "-DWITH_GTEST=off",
            "-G Ninja",
            "..",
        ],
        false,
        false
    );

    spinner.text = "[Lua-cURL-v3] compiling dep: zlib";
    await exec("ninja", [], false, false);

    spinner.text = "[Lua-cURL-v3] installing dep: zlib";
    await exec(
        "cmake",
        ["--install", ".", "--prefix", zlib_install_dir],
        false,
        false
    );

    // Build brotli
    await download_with_progress(
        lcurl_info.dependencies.brotli.url,
        join(master_build_dir, "brotli.archive"),
        "[Lua-cURL-v3] downloading dep: brotli",
        lcurl_info.dependencies.brotli.b3sum,
        spinner
    );

    spinner.text = "[Lua-cURL-v3] extracting dep: brotli";
    await decompress(
        join(master_build_dir, "brotli.archive"),
        master_build_dir
    );

    const brotli_dir = join(
        master_build_dir,
        lcurl_info.dependencies.brotli.out_dir
    );
    const brotli_install_dir = join(master_build_dir, "brotli-bin");

    mkdirSync(join(brotli_dir, "build"));
    process.chdir(join(brotli_dir, "build"));

    spinner.text = "[Lua-cURL-v3] configuring dep: brotli";
    await exec(
        "cmake",
        [
            "-DCMAKE_BUILD_TYPE=Release",
            "-DBUILD_SHARED_LIBS=off",
            "-G Ninja",
            "..",
        ],
        false,
        false
    );

    spinner.text = "[Lua-cURL-v3] compiling dep: brotli";
    await exec("ninja", [], false, false);

    spinner.text = "[Lua-cURL-v3] installing dep: brotli";
    await exec(
        "cmake",
        ["--install", ".", "--prefix", brotli_install_dir],
        false,
        false
    );

    // Build libssh2
    await download_with_progress(
        lcurl_info.dependencies.libssh2.url,
        join(master_build_dir, "libssh2.archive"),
        "[Lua-cURL-v3] downloading dep: libssh2",
        lcurl_info.dependencies.libssh2.b3sum,
        spinner
    );

    spinner.text = "[Lua-cURL-v3] extracting dep: libssh2";
    await decompress(
        join(master_build_dir, "libssh2.archive"),
        master_build_dir,
        true
    );

    const libssh2_dir = join(
        master_build_dir,
        lcurl_info.dependencies.libssh2.out_dir
    );
    const libssh2_install_dir = join(master_build_dir, "libssh2-bin");

    mkdirSync(join(libssh2_dir, "build"));
    process.chdir(join(libssh2_dir, "build"));

    spinner.text = "[Lua-cURL-v3] configuring dep: libssh2";
    await exec(
        "cmake",
        [
            "-DCMAKE_BUILD_TYPE=Release",
            "-DBUILD_SHARED_LIBS=off",
            "-DBUILD_STATIC_LIBS=on",
            "-DCRYPTO_BACKEND=WinCNG",
            "-DENABLE_ZLIB_COMPRESSION=ON",
            `-DZLIB_INCLUDE_DIR=${join(zlib_install_dir, "include")}`,
            `-DZLIB_LIBRARY=${join(zlib_install_dir, "lib", "libz.a")}`,

            "-G Ninja",
            "..",
        ],
        false,
        false
    );

    spinner.text = "[Lua-cURL-v3] compiling dep: libssh2";
    await exec("ninja", [], false, false);

    spinner.text = "[Lua-cURL-v3] installing dep: libssh2";
    await exec(
        "cmake",
        ["--install", ".", "--prefix", libssh2_install_dir],
        false,
        false
    );

    // Build nghttp2
    await download_with_progress(
        lcurl_info.dependencies.nghttp2.url,
        join(master_build_dir, "nghttp2.archive"),
        "[Lua-cURL-v3] downloading dep: nghttp2",
        lcurl_info.dependencies.nghttp2.b3sum,
        spinner
    );

    spinner.text = "[Lua-cURL-v3] extracting dep: nghttp2";
    await decompress(
        join(master_build_dir, "nghttp2.archive"),
        master_build_dir,
        true
    );

    const nghttp2_dir = join(
        master_build_dir,
        lcurl_info.dependencies.nghttp2.out_dir
    );
    const nghttp2_install_dir = join(master_build_dir, "nghttp2-bin");

    mkdirSync(join(nghttp2_dir, "build"));
    process.chdir(join(nghttp2_dir, "build"));

    spinner.text = "[Lua-cURL-v3] configuring dep: nghttp2";
    await exec(
        "cmake",
        /* 
            One would assume BUILD_SHARED_LIBS=off implies BUILD_STATIC_LIBS=on, 
            but you never know with these guys.. 
        */
        [
            "-DCMAKE_BUILD_TYPE=Release",
            "-DBUILD_SHARED_LIBS=off",
            "-DBUILD_STATIC_LIBS=on",
            "-DENABLE_LIB_ONLY=on",
            "-G Ninja",
            "..",
        ],
        false,
        false
    );

    spinner.text = "[Lua-cURL-v3] compiling dep: nghttp2";
    await exec("ninja", [], false, false);

    spinner.text = "[Lua-cURL-v3] installing dep: nghttp2";
    await exec(
        "cmake",
        ["--install", ".", "--prefix", nghttp2_install_dir],
        false,
        false
    );

    // Build libcurl
    await download_with_progress(
        lcurl_info.dependencies.curl.url,
        join(master_build_dir, "curl.archive"),
        "[Lua-cURL-v3] downloading dep: curl",
        lcurl_info.dependencies.curl.b3sum,
        spinner
    );

    spinner.text = "[Lua-cURL-v3] extracting dep: curl";
    await decompress(
        join(master_build_dir, "curl.archive"),
        master_build_dir,
        true
    );

    const curl_dir = join(
        master_build_dir,
        lcurl_info.dependencies.curl.out_dir
    );
    const curl_install_dir = join(master_build_dir, "curl-bin");

    mkdirSync(join(curl_dir, "build"));
    process.chdir(join(curl_dir, "build"));

    spinner.text = "[Lua-cURL-v3] configuring dep: curl";
    await exec(
        "cmake",
        [
            "-DCMAKE_BUILD_TYPE=Release",
            "-DCURL_ENABLE_SSL=on",
            "-DCURL_USE_SCHANNEL=on",
            "-DUSE_WINDOWS_SSPI=on",
            "-DUSE_WIN32_IDN=on",

            "-DUSE_ZLIB=on",
            `-DZLIB_INCLUDE_DIR=${join(zlib_install_dir, "include")}`,
            `-DZLIB_LIBRARY=${join(zlib_install_dir, "lib", "libz.a")}`,

            "-DCURL_BROTLI=on",
            `-DBROTLI_INCLUDE_DIR=${join(brotli_install_dir, "include")}`,
            `-DBROTLICOMMON_LIBRARY=${join(
                brotli_install_dir,
                "lib",
                "libbrotlicommon.a"
            )}`,
            `-DBROTLIDEC_LIBRARY=${join(
                brotli_install_dir,
                "lib",
                "libbrotlidec.a"
            )}`,

            "-DCURL_USE_LIBSSH2=on",
            `-DLIBSSH2_INCLUDE_DIR=${join(libssh2_install_dir, "include")}`,
            `-DLIBSSH2_LIBRARY=${join(
                libssh2_install_dir,
                "lib",
                "libssh2.a"
            )}`,

            "-DUSE_NGHTTP2=on",
            `-DNGHTTP2_INCLUDE_DIR=${join(nghttp2_install_dir, "include")}`,
            `-DNGHTTP2_LIBRARY=${join(
                nghttp2_install_dir,
                "lib",
                "libnghttp2.a"
            )}`,

            "-DCMAKE_C_FLAGS=-DNGHTTP2_STATICLIB",
            "-G Ninja",
            "..",
        ],
        false,
        false
    );

    spinner.text = "[Lua-cURL-v3] compiling dep: curl";
    await exec("ninja", [], false, false);

    spinner.text = "[Lua-cURL-v3] installing dep: curl";
    await exec(
        "cmake",
        ["--install", ".", "--prefix", curl_install_dir],
        false,
        false
    );
    await exec(
        "strip",
        ["--strip-unneeded", join(curl_install_dir, "bin", "libcurl.dll")],
        false,
        false
    );

    // Build Lua-cURL
    await download_with_progress(
        lcurl_info.url,
        join(master_build_dir, "luacurl.archive"),
        `Downloading ${lcurl_info.name} ${lcurl_info.version}...`,
        lcurl_info.b3sum,
        spinner
    );

    spinner.text = `Extracting ${lcurl_info.name} ${lcurl_info.version}...`;
    await decompress(
        join(master_build_dir, "luacurl.archive"),
        master_build_dir,
        true
    );

    const lcurl_dir = join(master_build_dir, lcurl_info.out_dir);

    process.chdir(join(lcurl_dir, "doc"));
    await exec(
        "C:\\Windows\\System32\\cmd.exe",
        [
            "/c",
            join(variables.BUILD_DIR, "ldoc-bin", "bin", "ldoc.cmd"),
            ".",
            "-d",
            join(lcurl_dir, "docs_out"),
        ],
        false,
        false
    );
    process.chdir(lcurl_dir);

    const files = readdirSync(join(lcurl_dir, "src"))
        .filter((file) => file.endsWith(".c"))
        .map((file) => {
            return {
                compiler: variables.CC,
                includeDirectories: [
                    join(
                        join(variables.BUILD_DIR, lua_info.out_dir),
                        "include"
                    ),
                    join(curl_install_dir, "include"),
                ],
                flags: ["-O3", "-c"],
                sourceFiles: [file],
                linkerFlags: [],
                keepOutput: false,
                log: false,
            };
        });

    const objs = readdirSync(join(lcurl_dir, "src"))
        .filter((file) => file.endsWith(".c"))
        .map((file) => file.split(".").slice(0, -1).concat(["o"]).join("."));

    process.chdir(join(lcurl_dir, "src"));

    spinner.text = `Compiling ${lcurl_info.name} ${lcurl_info.version}...`;
    await submit_compile_job(variables, files);

    spinner.text = `Linking ${lcurl_info.name} ${lcurl_info.version}...`;
    await invoke_compiler({
        compiler: variables.CC,
        flags: ["-O3", "-shared"],
        sourceFiles: [
            ...objs,
            join(curl_install_dir, "bin", "libcurl.dll"),
            join(
                join(variables.BUILD_DIR, lua_info.out_dir),
                "lib",
                "liblua54.a"
            ),
        ],
        output: "lcurl.dll",
        keepOutput: false,
        log: false,
    });
    await exec(
        "strip",
        ["--strip-unneeded", join(lcurl_dir, "src", "lcurl.dll")],
        false,
        false
    );

    spinner.text = `Installing ${lcurl_info.name} ${lcurl_info.version}...`;
    process.chdir(variables.BUILD_DIR);

    const lcurl_install_dir = join(variables.BUILD_DIR, "lcurl-tmp-install");

    mkdirSync(join(lcurl_install_dir, "bin"), {
        recursive: true,
    });

    mkdirSync(join(lcurl_install_dir, "lib", "lua", "5.4"), {
        recursive: true,
    });

    mkdirSync(join(lcurl_install_dir, "share", "lua"), {
        recursive: true,
    });

    mkdirSync(join(lcurl_install_dir, "doc"));

    cpSync(
        join(curl_install_dir, "bin", "libcurl.dll"),
        join(lcurl_install_dir, "bin", "libcurl.dll")
    );

    cpSync(
        join(lcurl_dir, "src", "lcurl.dll"),
        join(lcurl_install_dir, "lib", "lua", "5.4", "lcurl.dll")
    );

    renameSync(
        join(lcurl_dir, "src", "lua"),
        join(lcurl_install_dir, "share", "lua", "5.4")
    );

    renameSync(
        join(lcurl_dir, "docs_out"),
        join(lcurl_install_dir, "doc", "Lua-cURL-v3")
    );

    spinner.text = "Cleaning up...";
    await waitFile({
        resources: [master_build_dir],
        delay: 0,
        interval: 75,
        log: false,
        reverse: false,
        timeout: 20000,
        verbose: false,
        window: 250,
    });
    rmSync(master_build_dir, { recursive: true, force: true });
    renameSync(
        lcurl_install_dir,
        join(variables.BUILD_DIR, lcurl_info.out_dir)
    );
}