#!/usr/bin/env node
const path = require('path');
const { spawn } = require('child_process');
const parseArgs = require("@vanillas/args");

const faucet = require('../lib');
const { parseFilePaths, isExistingFile } = require('../lib/utils');

function tapFaucet() {
    const tapeMain = require.resolve("tape")
    let tapeCmd = path.resolve(path.dirname(tapeMain), "bin/tape")

    if (!isExistingFile(tapeCmd)) {
        console.error("Cannot find tape installed. Please install it and try again")
        return process.exit(1)
    }

    const options = parseArgs(process.argv.slice(2));

    const files = parseFilePaths(options._ || [])

    if (files.length === 0) {
        console.error('usage: `faucet [FILES]` or `| faucet`\n');
        console.error([
            "No test files or stdin provided",
            "and no files in test/ or tests/ directories found."
        ].join(" "));

        return process.exit(1);
    }

    const tap = faucet({
      /* Grab the first non-null value (default to 0) */
      width: [
        options.w,
        options.width,
        process.stdout.isTTY
          ? process.stdout.columns - 5
          : 0
      ].find(arg => arg != null)
    });

    process.on('exit', (code) => {
        if (code === 0 && tap.exitCode !== 0) {
            process.exit(tap.exitCode);
        }
    });
    process.stdout.on('error', () => {});

    if (!process.stdin.isTTY || options._[0] === '-') {
        process.stdin.pipe(tap).pipe(process.stdout);
        return;
    }

    const tape = spawn(tapeCmd, files);
    tape.stderr.pipe(process.stderr);
    tape.stdout.pipe(tap).pipe(process.stdout);

    let tapeCode;

    tape.on('exit', (code) => {
        tapeCode = code;
    });

    process.on('exit', (code) => {
        if (code === 0 && tapeCode !== 0) {
            console.error('# non-zero exit from the `tape` command');
            process.exit(tapeCode);
        }
    });
}

tapFaucet();
