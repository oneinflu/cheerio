const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Load .env explicitly from the backend directory
dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function run() {
    try {
        console.log("Connecting strictly to database to generate Massive Workflow: ", process.env.DATABASE_URL.split('@')[1]);

        let nodes = [
            { id: "trigger_1", type: "trigger", position: { x: 400, y: 50 }, data: { triggerType: "new_lead", label: "Massive Workflow Started" } },
        ];
        let edges = [];

        // Generate hundreds of nodes to simulate a highly complex and connected workflow.
        // We will generate 100 iterations of a looping logic map (about 500+ nodes)
        let prevId = "trigger_1";
        let yPos = 200;

        for (let i = 0; i < 50; i++) {
            let condId = `cond_${i}`;
            let leftId = `tmpl_left_${i}`;
            let rightId = `msg_right_${i}`;
            let mergeId = `delay_${i}`;
            let assignId = `assign_${i}`;

            // Create Condition
            nodes.push({
                id: condId, type: "condition", position: { x: 400, y: yPos },
                data: { conditionType: "has_tag", tagName: `stage_${i}`, condition: `Check if Stage ${i}` },
                yes: leftId, no: rightId
            });
            edges.push({ id: `e_${prevId}_${condId}`, source: prevId, target: condId });

            // Create YES side (Send template with Media and Buttons)
            nodes.push({
                id: leftId, type: "send_template", position: { x: 100, y: yPos + 150 },
                data: {
                    template: `promo_media_variant_${i}`, languageCode: "en_US", label: `Pitch Variant ${i}`,
                    components: [
                        { type: "header", parameters: [{ type: "image", image: { link: `https://example.com/slide${i}.jpg` } }] },
                        { type: "body", parameters: [{ type: "text", text: "Suurya " }] }
                    ],
                    buttons: ["Yes", "No", "Talk to Sales"]
                },
                routes: { "Yes": mergeId, "No": mergeId, "Talk to Sales": assignId }
            });
            edges.push({ id: `e_${condId}_yes_${leftId}`, source: condId, sourceHandle: "yes", target: leftId });
            // Edges for buttons
            edges.push({ id: `e_${leftId}_btn0_${mergeId}`, source: leftId, sourceHandle: "button-0", target: mergeId });
            edges.push({ id: `e_${leftId}_btn1_${mergeId}`, source: leftId, sourceHandle: "button-1", target: mergeId });
            edges.push({ id: `e_${leftId}_btn2_${assignId}`, source: leftId, sourceHandle: "button-2", target: assignId });

            // Create NO side (Send plain message)
            nodes.push({
                id: rightId, type: "send_message", position: { x: 700, y: yPos + 150 },
                data: { message: `We missed you at Stage ${i}! Reply YES to continue.` }
            });
            edges.push({ id: `e_${condId}_no_${rightId}`, source: condId, sourceHandle: "no", target: rightId });
            edges.push({ id: `e_${rightId}_${mergeId}`, source: rightId, target: mergeId });


            // Assigment branch 
            nodes.push({
                id: assignId, type: "action", position: { x: 0, y: yPos + 300 },
                data: { actionType: "assign_agent", actionValue: `sales_${i}@influapp.com` }
            });
            edges.push({ id: `e_${assignId}_${mergeId}`, source: assignId, target: mergeId });


            // Create Merge Delay
            nodes.push({
                id: mergeId, type: "delay", position: { x: 400, y: yPos + 400 },
                data: { duration: `${i + 1}`, unit: "hours" }
            });

            // Final action in iteration
            let actionId = `action_tag_${i}`;
            nodes.push({
                id: actionId, type: "action", position: { x: 400, y: yPos + 550 },
                data: { actionType: "add_tag", actionValue: `completed_${i}` }
            });
            edges.push({ id: `e_${mergeId}_${actionId}`, source: mergeId, target: actionId });

            prevId = actionId;
            yPos += 700;
        }

        // Add Final End node
        nodes.push({ id: "end_final", type: "end", position: { x: 400, y: yPos + 150 } });
        edges.push({ id: `e_${prevId}_end`, source: prevId, target: "end_final" });

        const steps = { nodes, edges };

        // Insert into database
        const result = await pool.query(
            `INSERT INTO workflows (name, description, status, steps)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
            ["Ultra Complex AI-Generated Visual Matrix", "A massive 300+ node multi-branch visual matrix featuring media templates, conditions, buttons, and looping logic designed completely autonomously to prove React Flow UI scales beautifully.", "active", steps]
        );

        console.log(`✅ Success! Huge workflow created in Postgres with ID: ${result.rows[0].id}`);
        console.log(`Total nodes inserted into UI Builder canvas: ${nodes.length}`);
        console.log(`Total edges drawn between connectors: ${edges.length}`);
        console.log("You can now open the Frontend Workflow Builder, click on it from the list, and view this massive workflow live on the React Flow Canvas.");

        pool.end();
        process.exit(0);

    } catch (e) {
        console.error("Failed to insert into live DB:", e.message);
        pool.end();
        process.exit(1);
    }
}

run();
