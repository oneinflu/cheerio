"use strict";

require('dotenv').config();
const db = require('../db');
const { createWorkflow, runWorkflow, deleteWorkflow } = require('../src/services/workflows');

// Very complex end-to-end integration test
async function runComplexTest() {
  console.log("🚀 Starting Complex Workflow Evaluation Script\n"); 

  let workflowId = null; 

  try {

    // Construct a deeply nested payload utilizing every action structure supported 
    const mockWorkflow = {
      name: "Tough E2E Integration Test Workflow", 
      description: "Stress test covering Delay, Match, Templates, Button branches, and Action updates",
      status: "active",
      steps: {
         nodes: [
             {
                 id: "START",
                 type: "trigger",
                 data: { triggerType: "incoming_webhook", label: "External Webhook Fire" },
                 next: "SET_VAR"
             },
             {
                 id: "SET_VAR",
                 type: "action",
                 data: { actionType: "set_variable", variableName: "test_run", variableValue: "active" },
                 next: "COND_CHECK"
             },
             {
                 id: "COND_CHECK",
                 type: "condition",
                 data: { conditionType: "variable_match", variableName: "test_run", variableValue: "active" },
                 yes: "TMPL_MEDIA",
                 no: "ERR_MSG"
             },
             {
                 id: "TMPL_MEDIA",
                 type: "send_template",
                 data: { 
                     template: "demo_media",
                     label: "Send Complex Template with Media URL and Buttons",
                     languageCode: "en_US", 
                     components: [ 
                         { type: "header", parameters: [ { type: "image", image: { link: "https://hub.influapp.com/logo.png" }}]},
                         { type: "body", parameters: [ { type: "text", text: "Suurya "}]} 
                     ],
                     buttons: ["Wait", "Skip"]
                 },
                 routes: {
                    "Wait": "DELAY",
                    "Skip": "TAG_ADD"
                 }
             },
             {
                 id: "DELAY",
                 type: "delay",
                 data: { duration: 2, unit: "seconds" },
                 next: "TAG_ADD"
             },
             {
                 id: "TAG_ADD",
                 type: "action",
                 data: { actionType: "add_tag", actionValue: "Integration_Tested" },
                 next: "ASSIGN"
             },
             {
                 id: "ASSIGN",
                 type: "action",
                 data: { actionType: "assign_agent", actionValue: "dev@influapp.com" },
                 next: "STATUS_UPDATE" 
             },
             {
                 id: "STATUS_UPDATE",
                 type: "action",
                 data: { actionType: "update_chat_status", actionValue: "snoozed" },
                 next: "FINISH"
             },
             {
                 id: "ERR_MSG",
                 type: "send_message",
                 data: { message: "Test variable validation failed!" },
                 next: "FINISH"
             },
             {
                 id: "FINISH",
                 type: "end",
                 data: { label: "Test Cleanup" }
             }
         ],
         edges: []
      }
    }
    
    console.log("📦 Creating Mock Workflow Configuration Profile in Database...");
    const wf = await createWorkflow(mockWorkflow);
    workflowId = wf.id;
    console.log(`✅ Workflow successfully generated. UUID: ${workflowId}`);
    
    console.log("\n⚡ Initializing Workflow Engine Execution...\n");
    // Run against a dummy number (this creates real db models for tests context temporarily locally)
    const result = await runWorkflow(workflowId, "+919999999999");
    
    console.log("================= ENGINE EXECUTION TRACE ==================");
    console.log(JSON.stringify(result.log, null, 2));
    
    const logs = result.log || []; 
    // Assert correct path taken
    const reachedAssign = logs.find(l => l.nodeId === 'ASSIGN');
    const reachedError = logs.find(l => l.nodeId === 'ERR_MSG');
    
    if (reachedAssign && !reachedError) {
        console.log("\n✅ CRITICAL PATH TESTS PASSED (Conditions Matched True)");
    } else {
        throw new Error("Execution trace deviated from expected paths.");
    }
    
  } catch(e) {
      console.error("\n❌ Test Suite Error:");
      console.error(e.message);
  } finally {
      if (workflowId) { 
         // Cleanup generated DB junk 
         console.log("\n🧹 Cleaning up Database context...");
         await deleteWorkflow(workflowId);
         console.log("Cleanup finished.");
      }
      process.exit(0);
  }

}

runComplexTest();

