/**
 * Delete ALL email templates from Brevo account.
 *
 * Usage:
 *   BREVO_API_KEY=xkeysib-xxx node scripts/delete-all-brevo-templates.js
 *
 * Add --dry-run to preview without deleting:
 *   BREVO_API_KEY=xkeysib-xxx node scripts/delete-all-brevo-templates.js --dry-run
 */
const API_KEY = process.env.BREVO_API_KEY
if (!API_KEY) {
    console.error("❌ Set BREVO_API_KEY env var")
    process.exit(1)
}

const DRY_RUN = process.argv.includes("--dry-run")

async function main() {
    const headers = {
        "api-key": API_KEY,
        Accept: "application/json",
    }

    // 1. Fetch all templates (paginate)
    let allTemplates = []
    let offset = 0
    const limit = 50

    console.log("📋 Fetching templates...")

    while (true) {
        const res = await fetch(
            `https://api.brevo.com/v3/smtp/templates?limit=${limit}&offset=${offset}&sort=desc`,
            { headers }
        )
        const data = await res.json()

        if (!res.ok) {
            console.error("❌ Failed to fetch templates:", data)
            break
        }

        const templates = data.templates || []
        if (templates.length === 0) break

        allTemplates.push(...templates)
        console.log(`   Found ${allTemplates.length} templates so far...`)

        if (templates.length < limit) break
        offset += limit
    }

    if (allTemplates.length === 0) {
        console.log("✅ No templates found — nothing to delete.")
        return
    }

    console.log(`\n📋 Total templates found: ${allTemplates.length}`)
    console.log("─".repeat(60))
    for (const t of allTemplates) {
        console.log(`   ID: ${String(t.id).padEnd(6)} | ${t.name}`)
    }
    console.log("─".repeat(60))

    if (DRY_RUN) {
        console.log("\n🔍 DRY RUN — no templates were deleted.")
        return
    }

    // 2. Delete each template
    console.log(`\n🗑️  Deleting ${allTemplates.length} templates...`)
    let deleted = 0
    let failed = 0

    for (const t of allTemplates) {
        try {
            // Step 1: Deactivate
            await fetch(`https://api.brevo.com/v3/smtp/templates/${t.id}`, {
                method: "PUT",
                headers: { ...headers, "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: false }),
            })

            // Step 2: Delete
            const res = await fetch(`https://api.brevo.com/v3/smtp/templates/${t.id}`, {
                method: "DELETE",
                headers,
            })

            if (res.ok || res.status === 204) {
                deleted++
                console.log(`   ✅ Deleted ID: ${t.id} (${t.name})`)
            } else {
                const errData = await res.json().catch(() => ({}))
                failed++
                console.error(`   ❌ ID: ${t.id} — ${errData.message || res.status}`)
            }
        } catch (err) {
            failed++
            console.error(`   ❌ ID: ${t.id} — ${err.message}`)
        }

        // Rate limit
        await new Promise((r) => setTimeout(r, 150))
    }

    console.log(`\n✅ Done! Deleted: ${deleted}, Failed: ${failed}`)
}

main().catch((err) => {
    console.error("Fatal:", err)
    process.exit(1)
})
