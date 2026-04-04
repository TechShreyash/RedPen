#!/usr/bin/env node
/**
 * RedPen ArmorIQ CLI — AI-powered vulnerability remediation
 *
 * Usage:
 *   node cli.js <scan-results.json>                  # Dry run — show fixes
 *   node cli.js <scan-results.json> --apply           # Apply fixes to files
 *   node cli.js <scan-results.json> --verify          # Verify with ArmorIQ
 *   node cli.js --fix <finding-index> <results.json>  # Fix a single finding
 *   node cli.js --revert <file-path>                  # Revert a fix
 */

import fs from "fs";
import path from "path";
import { generateFix, applyFix, revertFix, remediateAll } from "./remediate.js";

// ── CLI Colors ────────────────────────────────────────────────────────
const c = {
    red: (s) => `\x1b[31m${s}\x1b[0m`,
    green: (s) => `\x1b[32m${s}\x1b[0m`,
    yellow: (s) => `\x1b[33m${s}\x1b[0m`,
    cyan: (s) => `\x1b[36m${s}\x1b[0m`,
    bold: (s) => `\x1b[1m${s}\x1b[0m`,
    dim: (s) => `\x1b[2m${s}\x1b[0m`,
    magenta: (s) => `\x1b[35m${s}\x1b[0m`,
};

// ── Banner ────────────────────────────────────────────────────────────
function printBanner() {
    console.log("");
    console.log(c.red("  ╔═══════════════════════════════════╗"));
    console.log(c.red("  ║  🛡️  RedPen ArmorIQ Remediation   ║"));
    console.log(c.red("  ╚═══════════════════════════════════╝"));
    console.log("");
}

// ── Usage ─────────────────────────────────────────────────────────────
function printUsage() {
    printBanner();
    console.log(c.bold("Usage:"));
    console.log(`  ${c.cyan("node cli.js")} <scan-results.json>                 ${c.dim("# Dry-run — show AI fixes")}`);
    console.log(`  ${c.cyan("node cli.js")} <scan-results.json> ${c.yellow("--apply")}          ${c.dim("# Apply fixes to files")}`);
    console.log(`  ${c.cyan("node cli.js")} <scan-results.json> ${c.yellow("--verify")}         ${c.dim("# Verify fixes with ArmorIQ")}`);
    console.log(`  ${c.cyan("node cli.js")} ${c.yellow("--fix")} <index> <results.json>         ${c.dim("# Fix a single finding")}`);
    console.log(`  ${c.cyan("node cli.js")} ${c.yellow("--revert")} <file-path>                  ${c.dim("# Revert a fix from backup")}`);
    console.log("");
    console.log(c.bold("Environment Variables:"));
    console.log(`  ${c.cyan("GROQ_API_KEY")}      ${c.dim("(required) Your Groq API key")}`);
    console.log(`  ${c.cyan("GROQ_MODEL")}        ${c.dim("(optional) LLM model, default: qwen-2.5-32b")}`);
    console.log(`  ${c.cyan("ARMORIQ_API_KEY")}    ${c.dim("(optional) ArmorIQ key for intent verification")}`);
    console.log("");
}

// ── Load results ──────────────────────────────────────────────────────
function loadResults(filePath) {
    const absPath = path.resolve(filePath);
    if (!fs.existsSync(absPath)) {
        console.error(c.red(`❌ File not found: ${absPath}`));
        process.exit(1);
    }

    try {
        const raw = fs.readFileSync(absPath, "utf-8");
        return JSON.parse(raw);
    } catch (err) {
        console.error(c.red(`❌ Failed to parse JSON: ${err.message}`));
        process.exit(1);
    }
}

// ── Display fix ───────────────────────────────────────────────────────
function displayFix(fix, index) {
    const { finding, fixedCode, explanation, securityNote, diff } = fix;

    const sevColor = finding.severity === "ERROR" ? c.red : finding.severity === "WARNING" ? c.yellow : c.cyan;

    console.log(c.bold(`\n${"═".repeat(70)}`));
    console.log(c.bold(`  Finding #${index + 1}: ${finding.check_id}`));
    console.log(`  ${sevColor(finding.severity)} | ${c.dim(finding.path)}:${finding.snippet_lines?.start}-${finding.snippet_lines?.end}`);
    console.log(c.bold(`${"═".repeat(70)}`));

    console.log(c.yellow("\n  📋 Explanation:"));
    console.log(`  ${explanation}`);

    if (securityNote) {
        console.log(c.magenta("\n  ⚠️  Security Note:"));
        console.log(`  ${securityNote}`);
    }

    if (diff) {
        console.log(c.bold("\n  📄 Diff:"));
        const diffLines = diff.split("\n");
        for (const line of diffLines) {
            if (line.startsWith("+")) {
                console.log(`  ${c.green(line)}`);
            } else if (line.startsWith("-")) {
                console.log(`  ${c.red(line)}`);
            } else {
                console.log(`  ${c.dim(line)}`);
            }
        }
    }
}

// ── Display summary ───────────────────────────────────────────────────
function displaySummary(fixes) {
    const total = fixes.length;
    const generated = fixes.filter((f) => f.fix).length;
    const applied = fixes.filter((f) => f.applied).length;
    const blocked = fixes.filter((f) => f.verification && !f.verification.verified).length;
    const errors = fixes.filter((f) => f.error).length;

    console.log(c.bold(`\n${"═".repeat(70)}`));
    console.log(c.bold("  📊 Remediation Summary"));
    console.log(c.bold(`${"═".repeat(70)}`));
    console.log(`  Total findings:     ${c.bold(total.toString())}`);
    console.log(`  Fixes generated:    ${c.green(generated.toString())}`);
    console.log(`  Fixes applied:      ${c.cyan(applied.toString())}`);
    if (blocked > 0) console.log(`  Blocked by ArmorIQ: ${c.red(blocked.toString())}`);
    if (errors > 0) console.log(`  Errors:             ${c.red(errors.toString())}`);
    console.log("");
}

// ── Single fix mode ───────────────────────────────────────────────────
async function fixSingle(index, resultsPath, shouldApply) {
    const data = loadResults(resultsPath);
    const results = data.results || [];

    if (index < 0 || index >= results.length) {
        console.error(c.red(`❌ Invalid index ${index}. Valid range: 0-${results.length - 1}`));
        process.exit(1);
    }

    const finding = results[index];
    console.log(c.cyan(`\n🔧 Generating fix for finding #${index}: ${finding.check_id}...`));

    const fix = await generateFix(finding);
    displayFix({ finding, ...fix }, index);

    if (shouldApply && fix.fixedCode) {
        console.log(c.yellow("\n📝 Applying fix..."));
        const result = applyFix(finding.path, finding.snippet_lines, finding.snippet, fix.fixedCode);
        if (result.success) {
            console.log(c.green(`✅ Fix applied to ${finding.path}`));
            console.log(c.dim(`   Backup: ${result.backupPath}`));
        } else {
            console.error(c.red(`❌ Failed to apply fix: ${result.error}`));
        }
    }
}

// ── Main ──────────────────────────────────────────────────────────────
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
        printUsage();
        process.exit(0);
    }

    // Check for GROQ_API_KEY
    if (!process.env.GROQ_API_KEY) {
        console.error(c.red("❌ GROQ_API_KEY environment variable is not set."));
        console.error(c.dim("   Set it in a .env file or export it in your shell."));
        process.exit(1);
    }

    printBanner();

    // --revert <file>
    if (args.includes("--revert")) {
        const fileIdx = args.indexOf("--revert") + 1;
        const filePath = args[fileIdx];
        if (!filePath) {
            console.error(c.red("❌ Please specify a file path to revert."));
            process.exit(1);
        }
        const result = revertFix(filePath);
        if (result.success) {
            console.log(c.green(`✅ Reverted ${filePath} from backup.`));
        } else {
            console.error(c.red(`❌ Revert failed: ${result.error}`));
        }
        return;
    }

    // --fix <index> <results.json>
    if (args.includes("--fix")) {
        const fixIdx = args.indexOf("--fix") + 1;
        const index = parseInt(args[fixIdx], 10);
        const resultsPath = args[fixIdx + 1];
        if (isNaN(index) || !resultsPath) {
            console.error(c.red("❌ Usage: --fix <index> <results.json>"));
            process.exit(1);
        }
        await fixSingle(index, resultsPath, args.includes("--apply"));
        return;
    }

    // Default: batch mode
    const resultsPath = args.find((a) => !a.startsWith("--"));
    if (!resultsPath) {
        console.error(c.red("❌ Please provide a scan results JSON file."));
        printUsage();
        process.exit(1);
    }

    const apply = args.includes("--apply");
    const verify = args.includes("--verify");

    const data = loadResults(resultsPath);
    const totalFindings = data.results?.length || 0;

    console.log(c.cyan(`📂 Loaded ${totalFindings} findings from ${resultsPath}`));
    console.log(c.dim(`   Mode: ${apply ? "APPLY" : "DRY-RUN"} | ArmorIQ: ${verify ? "ENABLED" : "SKIP"}`));

    const fixes = await remediateAll(data, {
        dryRun: !apply,
        verifyIntent: verify,
    });

    // Display each fix
    for (let i = 0; i < fixes.length; i++) {
        if (fixes[i].fix) {
            displayFix({ finding: fixes[i].finding, ...fixes[i].fix }, i);
        }
    }

    displaySummary(fixes);
}

main().catch((err) => {
    console.error(c.red(`\n💥 Fatal error: ${err.message}`));
    process.exit(1);
});
