#!/usr/bin/env node

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import process from 'process';
import os from "os";
import chalk from "chalk";

const [, , command, ...args] = process.argv;

async function compile(filePath) {
    if (!filePath) {
        console.log('Please provide a file to execute');
        return;
    }

    let code = fs.readFileSync(path.join(process.cwd(), filePath), 'utf-8');
    code = await checkTypes(code);
    if (code === true) return;
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

        nodeProcess.on('close', (a) => {
            fs.unlinkSync(tmpPath); // cleanup temp file
            if (a != 0) console.error(`Execution failed with exit code ${a}`);
        });
    }
}

async function checkTypes(code) {
    const lines = code.split("\n");
    let currentFunction = null; // track function context
    let hasErrors = false; // track if any type errors occur

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // -------- Variable declarations --------
        const varMatch = line.match(/\b(let|const|mut)\s+(\w+)\s*:\s*([a-zA-Z|]+)\s*=\s*(.+)/);
        if (varMatch) {
            const [, declType, varName, typeAnno, value] = varMatch;
            
            if (typeAnno !== "any") {
                let inferredType = inferType(value);
                const allowedTypes = typeAnno.split("|").map(t => t.trim());
                if (!allowedTypes.includes(inferredType)) {
                    console.error(chalk.red(`Type Error on line ${i + 1}`) + chalk.redBright(`: Variable '${varName}' is declared as '${typeAnno}' but assigned a '${inferredType}'`));
                    hasErrors = true;
                }
            }
        }

        // -------- Function declarations --------
        const fnMatch = line.match(/\bfn\s+(\w+)\s*\((.*?)\)\s*(:\s*([a-zA-Z|]+))?/);
        if (fnMatch) {
            const [, fnName, params, , returnType] = fnMatch;

            // Parse parameters
            const paramList = params.split(",").map(p => p.trim()).filter(Boolean);
            currentFunction = {
                name: fnName,
                returnType: returnType ? returnType.trim() : null,
                params: paramList.map(p => {
                    const [paramName, paramType] = p.split(":").map(x => x.trim());
                    return { name: paramName, type: paramType };
                }),
                startLine: i
            };
        }

        // -------- Return statements --------
        if (currentFunction && line.startsWith("return")) {
            const returnExpr = line.slice(6).trim();
            const inferredReturnType = inferType(returnExpr);

            if (currentFunction.returnType && !currentFunction.returnType.split("|").map(t => t.trim()).includes(inferredReturnType)) {
                console.error(chalk.red(`Type Error on line ${i + 1}`) + chalk.redBright(`: Function '${currentFunction.name}' should return '${currentFunction.returnType}' but returns '${inferredReturnType}'`));
                hasErrors = true;
            }
        }

        // -------- End of function --------
        if (currentFunction && line === "}") {
            currentFunction = null;
        }
    }

    if (!hasErrors) {
        code = code
            .replace(/\bmut\b/g, "let")
            .replace(/: *number/g, "")
            .replace(/: *string/g, "")
            .replace(/: *boolean/g, "")
            .replace(/: *any/g, "")
            .replace(/\bfn\b/g, "function")
            .replace(/\bprint\s*\(/g, "console.log(");
        return code;
    } else {
        return false;
    }

}

// -------- Helper to infer type from a value --------
function inferType(value) {
    value = value.trim();
    if (/^["'`]/.test(value)) return "string";
    if (/^\d+(\.\d+)?$/.test(value)) return "number";
    if (/^(true|false)$/.test(value)) return "boolean";
    return "any";
}

switch (command) {
    default:
        await compile(command);
        break;
}