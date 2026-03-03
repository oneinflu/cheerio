const { runWorkflow, createWorkflow, deleteWorkflow } = require("./src/services/workflows");
const outboundWhatsApp = require("./src/services/outboundWhatsApp");

// Track calls for assertions
const calls = { templates: [], texts: [] };

// Injecting hooks via manual mocking for tests
const fs = require("fs");
const path = require("path");

async function initTestMocking() {
    console.log("Mocking Whatsapp integration externally");
    
    // Inject mock into require.cache
    const outboundRequirePath = require.resolve("./src/services/outboundWhatsApp");
    require.cache[outboundRequirePath].exports = {
        sendTemplate: async (convId, template, lang, params) => {
            console.log(`[MOCK] Expected Template sent: ${template} with ${JSON.stringify(params)}`);
            calls.templates.push({ template, params });
        },
        sendText: async (convId, text) => {
            console.log(`[MOCK] Expected Text sent: ${text}`);
            calls.texts.push({ text });
        }
    };
 
    const metaRequirePath = require.resolve("./src/integrations/meta/whatsappClient");
    require.cache[metaRequirePath].exports = {
       sendTemplateMessage: async () => {},
       getTextMessagePayload: () => {},
       getTemplates: async () => { return { data: { data: [{ name: "foo"}] } }; }
    };
}


async function runIntegrationTest() {
  try {
     await initTestMocking();

     console.log("Creating strict multi-branch test workflow...");
     
     // Complex Workflow: 
     // 1. Trigger -> 2. Action (set_variable context)
     // 3. Condition (branch off set variable)
     // 4 (YES). Send Template -> Delay -> Send Action Tag  -> update Chat Status closed
     // 4 (NO). Send text Message -> End
     
     const mockGraphPayload = {
         id: "test_toughing_wf1",
         name: "Tough End-to-End Stress Test",
         status: "active",
         steps: {
             nodes: [
                 {
                     id: "trigger_1",
                     type: "trigger",
                     data: { triggerType: "new_lead"}
                 },
                 {
                     id: "action_1",
                     type: "action",
                     data: { actionType: "set_variable", variableName: "language", variableValue: "es" }
                 },
                 {
                     id: "condition_2",
                     type: "condition",
                     data: { conditionType: "variable_match", variableName: "language", variableValue: "es" },
                     yes: "template_3",
                     no: "msg_error"
                 },
                 {
                     id: "template_3",
                     type: "send_template",
                     data: { template: "demo_welcome_media", languageCode: "es", components: [ { type: "header", parameters: [ { type: "image", image: { link: "http://example.com/mock.jpg"}}]} ]},
                     next: "delay_4"
                 },
                 {
                     id: "delay_4",
                     type: "delay",
                     data: { duration: 1, unit: "seconds" },
                     next: "action_5"
                 },
                 {
                     id: "action_5",
                     type: "action",
                     data: { actionType: "add_tag", actionValue: "VIP" },
                     next: "action_6"
                 },
                 {
                     id: "action_6",
                     type: "action",
                     data: { actionType: "update_chat_status", actionValue: "closed" },
                     next: "end_7"
                 },
                 {
                     id: "msg_error",
                     type: "send_message",
                     data: { message: "Error routing Spanish." },
                     next: "end_7"
                 },
                 {
                     id: "end_7",
                     type: "end"
                 }
             ],
             edges: []
         }
     };

     // Note: trigger_1 doesnt have a direct .next line link. Wait, `workflows.js` parses the tree natively based on trigger -> next. I need to make sure trigger links to action_1. 
     mockGraphPayload.steps.nodes[0].next = "action_1";
     mockGraphPayload.steps.nodes[1].next = "condition_2";

     let testWF = await createWorkflow(mockGraphPayload);
     console.log("Mock flow created! ID:", testWF.id);
     
     console.log("Starting Execution Environment with simulated number 9999999999");
     const { runWorkflow } = require("./src/services/workflows");
     
     // Execute!
     const res = await runWorkflow(testWF.id, "9999999999");
     
     console.log("Run Logs Result:");
     console.dir(res.log, {depth: null});
     
     // Verification
     if (calls.templates.length === 1 && calls.templates[0].template === "demo_welcome_media") {
         console.log("✅ Passed: Sent correct template route based on YES conditions!");
     } else {
         console.log("❌ Failed: Did not execute expected YES template route");
     }
     
     // Cleanup
     await deleteWorkflow(testWF.id);
     console.log("Test execution finished successfully.");
     process.exit(0);
     
  } catch (err) {
    console.error("Test failed: ", err);
  }
}

runIntegrationTest();
