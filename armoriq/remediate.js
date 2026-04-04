import Groq from "groq-sdk";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

// ── Configuration ─────────────────────────────────────────────────────
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODEL = process.env.GROQ_MODEL || "qwen-2.5-32b";

// ── Core Remediation ──────────────────────────────────────────────────

/**
 * Analyze a vulnerability and generate a fix using Groq LLM.
 *
 * @param {object} finding   - A processed scan result finding
 * @param {string} finding.check_id  - Rule ID that triggered
 * @param {string} finding.path      - File path
 * @param {string} finding.message   - Description of the vulnerability
 * @param {string} finding.severity  - ERROR | WARNING | INFO
 * @param {string} finding.snippet   - Vulnerable code snippet
 * @param {object} finding.snippet_lines - { start, end }
 * @param {string} finding.snippet_extended - Extended context
 * @param {object} finding.snippet_extended_lines - { start, end }
 * @param {object} finding.metadata  - CWE, OWASP, references, etc.
 * @returns {object} { fixedCode, explanation, diff, plan }
 */
export async function generateFix(finding) {
    const {
        check_id,
        path: filePath,
        message,
        severity,
        snippet,
        snippet_lines,
        snippet_extended,
        metadata,
    } = finding;

    // Build a rich prompt with all available context
    const cweList = (metadata?.cwe || []).join(", ");
    const owaspList = (metadata?.owasp || []).join(", ");
    const refs = (metadata?.references || []).join("\n    ");

    const systemPrompt = `You are an expert application security engineer. Your job is to fix security vulnerabilities in source code.

Rules:
1. Return ONLY a valid JSON object — no markdown, no code fences, no explanation outside JSON.
2. The JSON must have these exact keys:
   - "fixed_code": the corrected version of the vulnerable code snippet (same scope, drop-in replacement)
   - "explanation": a concise 2-3 sentence explanation of what was wrong and how you fixed it
   - "security_note": one sentence about residual risk or follow-up actions
3. Preserve the original indentation and style.
4. Do NOT add unrelated changes — fix ONLY the security issue.
5. If the fix requires importing a new module, include the import at the top of fixed_code.`;

    const userPrompt = `Fix this security vulnerability:

**Rule:** ${check_id}
**Severity:** ${severity}
**File:** ${filePath}
**Lines:** ${snippet_lines?.start}-${snippet_lines?.end}
**CWE:** ${cweList || "N/A"}
**OWASP:** ${owaspList || "N/A"}

**Vulnerability Description:**
${message}

**Vulnerable Code:**
\`\`\`
${snippet}
\`\`\`

**Extended Context (surrounding code):**
\`\`\`
${snippet_extended || snippet}
\`\`\`

${refs ? `**References:**\n    ${refs}` : ""}

Generate the fix as a JSON object with keys: fixed_code, explanation, security_note.`;

    const completion = await groq.chat.completions.create({
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
        ],
        model: MODEL,
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 2048,
    });

    const responseText = completion.choices[0]?.message?.content || "{}";
    let plan;
    try {
        plan = JSON.parse(responseText);
    } catch {
        throw new Error(`Failed to parse LLM response as JSON: ${responseText.slice(0, 200)}`);
    }

    // Build a unified diff for display
    const diff = buildDiff(snippet, plan.fixed_code, snippet_lines);

    return {
        fixedCode: plan.fixed_code || "",
        explanation: plan.explanation || "",
        securityNote: plan.security_note || "",
        diff,
        plan,
        model: MODEL,
        finding,
    };
}


/**
 * Apply a fix to the actual source file on disk.
 *
 * @param {string} filePath       - Path to the file to patch
 * @param {object} snippetLines   - { start, end } (1-indexed)
 * @param {string} originalSnippet - The original vulnerable code
 * @param {string} fixedCode      - The replacement code
 * @param {string} [basePath="."] - Base directory for resolving relative paths
 * @returns {object} { success, backupPath, error }
 */
export function applyFix(filePath, snippetLines, originalSnippet, fixedCode, basePath = ".") {
    const absPath = path.resolve(basePath, filePath);

    if (!fs.existsSync(absPath)) {
        return { success: false, error: `File not found: ${absPath}` };
    }

    try {
        const fileContent = fs.readFileSync(absPath, "utf-8");
        const lines = fileContent.split("\n");

        // Create a backup before modifying
        const backupPath = absPath + ".redpen-backup";
        fs.writeFileSync(backupPath, fileContent, "utf-8");

        // Strategy 1: Try to replace using exact string match of the snippet
        const normalizedOriginal = originalSnippet.trim().replace(/\r\n/g, "\n");
        const normalizedContent = fileContent.replace(/\r\n/g, "\n");

        if (normalizedContent.includes(normalizedOriginal)) {
            const patchedContent = normalizedContent.replace(
                normalizedOriginal,
                fixedCode.trim()
            );
            fs.writeFileSync(absPath, patchedContent, "utf-8");
            return { success: true, backupPath };
        }

        // Strategy 2: Replace by line range
        const start = snippetLines.start - 1; // convert to 0-indexed
        const end = snippetLines.end;          // end is inclusive in original, exclusive in splice

        if (start >= 0 && end <= lines.length) {
            const fixedLines = fixedCode.split("\n");
            lines.splice(start, end - start, ...fixedLines);
            fs.writeFileSync(absPath, lines.join("\n"), "utf-8");
            return { success: true, backupPath };
        }

        return { success: false, error: "Could not locate the vulnerable code in the file." };
    } catch (err) {
        return { success: false, error: err.message };
    }
}


/**
 * Revert a previously applied fix using the backup file.
 *
 * @param {string} filePath  - Path to the patched file
 * @param {string} [basePath="."]
 * @returns {object} { success, error }
 */
export function revertFix(filePath, basePath = ".") {
    const absPath = path.resolve(basePath, filePath);
    const backupPath = absPath + ".redpen-backup";

    if (!fs.existsSync(backupPath)) {
        return { success: false, error: `No backup found at ${backupPath}` };
    }

    try {
        const backupContent = fs.readFileSync(backupPath, "utf-8");
        fs.writeFileSync(absPath, backupContent, "utf-8");
        fs.unlinkSync(backupPath);
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}


// ── ArmorIQ Intent Verification (optional layer) ──────────────────────

/**
 * If ArmorIQ credentials are configured, verify the AI fix plan
 * to ensure the AI hasn't proposed destructive or out-of-scope actions.
 *
 * @param {object} plan       - The AI-generated fix plan
 * @param {string} prompt     - The original prompt sent to the LLM
 * @returns {object} { verified, token, error }
 */
export async function verifyWithArmorIQ(plan, prompt) {
    // ArmorIQ is optional — skip if not configured
    if (!process.env.ARMORIQ_API_KEY) {
        return { verified: true, skipped: true, reason: "ArmorIQ not configured" };
    }

    try {
        // Dynamic import since ArmorIQ SDK may not be installed
        const { ArmorIQClient } = await import("@armoriq/sdk");

        const armoriq = new ArmorIQClient({
            apiKey: process.env.ARMORIQ_API_KEY,
            userId: process.env.ARMORIQ_USER_ID || "redpen-user",
            agentId: process.env.ARMORIQ_AGENT_ID || "redpen-remediation-agent",
        });

        // Capture the plan for intent verification
        const planCapture = await armoriq.capturePlan({
            llm: MODEL,
            prompt: prompt,
            plan: plan,
        });

        // Request the execution token — ArmorIQ will reject if the plan
        // contains actions that exceed the agent's delegated authority
        const token = await armoriq.getIntentToken(planCapture);

        return { verified: true, token, skipped: false };
    } catch (err) {
        return {
            verified: false,
            skipped: false,
            error: err.message || "ArmorIQ blocked the action",
        };
    }
}


// ── Utilities ─────────────────────────────────────────────────────────

/**
 * Build a simple unified diff between original and fixed code.
 */
function buildDiff(original, fixed, snippetLines) {
    if (!original || !fixed) return "";

    const origLines = original.split("\n");
    const fixedLines = (fixed || "").split("\n");
    const startLine = snippetLines?.start || 1;

    let diff = `--- original\n+++ fixed\n@@ -${startLine},${origLines.length} +${startLine},${fixedLines.length} @@\n`;

    // Simple line-by-line diff
    const maxLen = Math.max(origLines.length, fixedLines.length);
    for (let i = 0; i < maxLen; i++) {
        const orig = origLines[i];
        const fix = fixedLines[i];

        if (orig === fix) {
            if (orig !== undefined) diff += ` ${orig}\n`;
        } else {
            if (orig !== undefined) diff += `-${orig}\n`;
            if (fix !== undefined) diff += `+${fix}\n`;
        }
    }

    return diff;
}


/**
 * Process a full scan results object and generate fixes for all findings.
 *
 * @param {object} scanResults - The scan results from scanner.py
 * @param {object} options - { dryRun, verifyIntent }
 * @returns {Array} Array of fix results
 */
export async function remediateAll(scanResults, options = {}) {
    const { dryRun = true, verifyIntent = false } = options;
    const results = scanResults?.results || [];
    const fixes = [];

    for (const finding of results) {
        console.log(`\n🔧 Processing: ${finding.check_id} in ${finding.path}:${finding.snippet_lines?.start}`);

        try {
            // Step 1: Generate fix with LLM
            const fix = await generateFix(finding);
            console.log(`  ✅ Fix generated: ${fix.explanation.slice(0, 100)}...`);

            // Step 2: Verify with ArmorIQ (if enabled)
            let verification = { verified: true, skipped: true };
            if (verifyIntent) {
                verification = await verifyWithArmorIQ(fix.plan, `Fix ${finding.check_id}`);
                if (!verification.verified) {
                    console.log(`  🚨 ArmorIQ BLOCKED: ${verification.error}`);
                    fixes.push({ finding, fix, verification, applied: false });
                    continue;
                }
                console.log(
                    verification.skipped
                        ? "  ⏭️  ArmorIQ skipped (not configured)"
                        : "  🛡️  ArmorIQ verified"
                );
            }

            // Step 3: Apply fix (unless dry-run)
            let applied = false;
            if (!dryRun && fix.fixedCode) {
                const result = applyFix(
                    finding.path,
                    finding.snippet_lines,
                    finding.snippet,
                    fix.fixedCode
                );
                applied = result.success;
                if (result.success) {
                    console.log(`  📝 Fix applied! Backup: ${result.backupPath}`);
                } else {
                    console.log(`  ⚠️  Could not apply fix: ${result.error}`);
                }
            }

            fixes.push({ finding, fix, verification, applied });
        } catch (err) {
            console.error(`  ❌ Error: ${err.message}`);
            fixes.push({ finding, fix: null, error: err.message, applied: false });
        }
    }

    return fixes;
}