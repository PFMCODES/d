#!/usr/bin/env node

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import process from 'process';
import os from "os";

const [, , command, ...args] = process.argv;

async function compile(filePath) {
    if (!filePath) {
        console.log('Please provide a file to execute');
        return;
    }

    const code = fs.readFileSync(path.join(process.cwd(), filePath), 'utf-8');

    if (args.includes("-c")) {
        const outFile = filePath.replace(".d", ".js");
        fs.writeFileSync(outFile, code);
        console.log(`Compiled ${filePath} → ${outFile}`);
    } else {
        const tmpPath = path.join(os.tmpdir(), `d_temp_${Date.now()}.js`);
        fs.writeFileSync(tmpPath, code);

        const nodeProcess = spawn('node', [tmpPath], {
            stdio: 'inherit'
        });

        nodeProcess.on('close', (code) => {
            fs.unlinkSync(tmpPath); // cleanup temp file
            if (code !== 0) console.error(`Execution failed with exit code ${code}`);
        });
    }
}

switch (command) {
    default:
        await compile(command);
        break;
}