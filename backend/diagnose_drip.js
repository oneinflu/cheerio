const db = require('./db');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function diagnose(phoneNumber, stageName) {
    try {
        console.log(`--- Drip Campaign Diagnosis for ${phoneNumber} in "${stageName}" ---`);

        // 1. Find Stage
        const stageRes = await db.query('SELECT id, name FROM lead_stages WHERE name ILIKE $1 LIMIT 1', [stageName]);
        if (stageRes.rowCount === 0) {
            console.log(`❌ Stage "${stageName}" not found.`);
            return;
        }
        const stageId = stageRes.rows[0].id;
        const actualName = stageRes.rows[0].name;
        console.log(`✅ Found Stage: ${actualName} (${stageId})`);

        // 2. List Workflows in Stage
        const wfs = await db.query(`
            SELECT lsw.workflow_id, lsw.position, lsw.delay_minutes, lsw.is_independent, lsw.target_time, w.name, w.status
            FROM lead_stage_workflows lsw
            JOIN workflows w ON w.id = lsw.workflow_id
            WHERE lsw.stage_id = $1
            ORDER BY lsw.position ASC
        `, [stageId]);
        
        console.log("\n📋 Configured Workflows in this Track:");
        console.table(wfs.rows.map(r => ({
            Pos: r.position,
            Name: r.name,
            Delay: `${r.delay_minutes}m`,
            Target: r.target_time || 'Immediate',
            Independent: r.is_independent ? 'YES' : 'NO (Sequential)',
            Status: r.status
        })));

        // 3. Check specific contact
        const contactRes = await db.query(`
            SELECT id, external_id, lead_stage_id, lead_stage, profile->'course' as course
            FROM contacts 
            WHERE external_id = $1 OR external_id = $2
        `, [phoneNumber, phoneNumber.startsWith('+') ? phoneNumber.slice(1) : `+${phoneNumber}`]);
        
        if (contactRes.rowCount === 0) {
            console.log(`\n❓ Contact ${phoneNumber} not found in DB.`);
        } else {
            console.log(`\n👤 Contact State:`);
            console.table(contactRes.rows);
        }

        // 4. Check Scheduled Tasks
        const tasks = await db.query(`
            SELECT 
                t.id, 
                w.name as workflow, 
                t.scheduled_time, 
                t.status, 
                t.sequence_order as pos,
                t.created_at
            FROM workflow_scheduled_tasks t
            JOIN workflows w ON w.id = t.workflow_id
            WHERE t.contact_phone = $1 OR t.contact_phone = $2
            ORDER BY t.created_at ASC
        `, [phoneNumber, phoneNumber.startsWith('+') ? phoneNumber.slice(1) : `+${phoneNumber}`]);
        
        console.log("\n⏱️ Scheduled Tasks (Queue History):");
        if (tasks.rowCount === 0) {
            console.log("No tasks found for this phone number.");
        } else {
            console.table(tasks.rows.map(t => ({
                ID: t.id,
                Workflow: t.workflow,
                Scheduled: t.scheduled_time.toLocaleString(),
                Status: t.status,
                Pos: t.pos,
                Created: t.created_at.toLocaleString()
            })));
        }

        // 5. Verification
        console.log("\n💡 Analysis:");
        if (wfs.rowCount > 1) {
            const firstSeq = wfs.rows.find(r => !r.is_independent);
            if (firstSeq && firstSeq.delay_minutes > 0) {
                console.log(`- NOTE: The FIRST sequential workflow "${firstSeq.name}" has a ${firstSeq.delay_minutes}m delay.`);
                console.log(`  This delay is applied relative to when the contact ENTERS the stage.`);
            }
            
            const seqs = wfs.rows.filter(r => !r.is_independent);
            if (seqs.length > 1) {
                console.log(`- Sequence detected: ${seqs.map(s => s.name).join(' -> ')}`);
                console.log(`- EACH step's delay is relative to the COMPLETION of the previous step.`);
            }
        }

    } catch (e) {
        console.error("Diagnosis Failed:", e);
    } finally {
        await db.close();
    }
}

const args = process.argv.slice(2);
if (args.length < 2) {
    console.log("Usage: node diagnose_drip.js <phone> <stageName>");
    console.log("Example: node diagnose_drip.js 919988776655 \"N2 Fresh Leads\"");
    process.exit(1);
}
diagnose(args[0], args[1]);
