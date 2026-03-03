"use strict";

const crypto = require("crypto"); 
function randomUuid() { 
  return crypto.randomBytes(16).toString("hex"); 
}

const outbound WhatsAppMock = {
    sendTemplate: async function(a, b, c, d) {
       let params = [];
       if (d) {
          try {
             params = Array.isArray(d) ? d : [d];
          } catch(e){}
       }
       // Logs out the structure representing JSON payload Meta takes  
       console.log(`[WhatsApp Template Dispatched!]\n-> Template ID: ${b}\n-> Parameters Config: ${JSON.stringify(params)}`);
    },
    sendText: async function(a, b) {
       console.log(`[WhatsApp Text Dispatched!]\n-> Body: ${b}`); 
    }
};

const queryDbMock = async (sql, vars) => {
   // Our testing mock needs valid UUID lengths
   const testConvId = `123e4567-e89b-12d3-a456-426614174000`; 
   const testContactId = `contact-` + randomUuid();

   // Faking Contact Existence Loop Queries
   if (sql.includes("SELECT id, external_id, channel_id FROM contacts")) {
      return { rowCount: 1, rows: [{ id: testContactId, channel_id: testConvId }] };
   }
   
   // Faking active conversation loop query
    if (sql.includes("SELECT id FROM conversations WHERE contact_id")) {
      return { rowCount: 1, rows: [{ id: testConvId }] };
    }

   // Faking Update / Assign querys
   if (sql.includes("UPDATE conversations SET status")) {
       console.log(`[DB Mock] Set Chat status parameter to "${vars[0]}"`);
       return { rowCount: 1 };
   }
   if (sql.includes("UPDATE contacts") && sql.includes("{tags}")) {
      console.log(`[DB Mock] Adding CRM Tags: ${vars[0]}`); 
      return { rowCount: 1 };
   }
   if (sql.includes("INSERT INTO conversation_assignments")) {
     console.log(`[DB Mock] Assigned Ticket Conversation`); 
     return { rowCount: 1 };
   }
   // Returns truthy to variable checking logic
   if (sql.includes("SELECT profile FROM contacts")) {
       return { 
           rowCount: 1, 
           rows: [{ profile: { tags: ["vip", "verified", "Integration_Tested"], attributes: { "test_run": "active"} } } ] 
       };
   }
   if (sql.includes("SELECT id FROM users")) return { rowCount: 1, rows: [{id: 1}] };
   if (sql.includes("SELECT team_id")) return { rowCount: 1, rows: [{team_id: 1}] };
   if (sql.includes("SELECT id FROM conversation_assignments")) return { rowCount: 0 };
   
   return { rowCount: 0, rows: []};
};

const workflowsServiceMockContext = require('../src/services/workflows');
workflowsServiceMockContext._setDBMock && workflowsServiceMockContext._setDBMock(queryDbMock);

// Re-require to load into engine properly if its bound
const MockDBContext = {
    query: queryDbMock
}

async function runTestLocally() {

   try {
       console.log("------------------------------------------");
       console.log("Initializing E2E Workflow Stress Execution...");
       console.log("------------------------------------------");
       
       const mockG = {
          steps: {
              nodes: [
                 { id: "TRIGGER", type: "trigger", data: { triggerType: "incoming_webhook"}, next: "SET_VAR" },
                 { id: "SET_VAR", type: "action", data: { actionType: "set_variable", variableName: "test_run", variableValue: "active" }, next: "COND_CHECK" },
                 { id: "COND_CHECK", type: "condition", data: { conditionType: "variable_match", variableName: "test_run", variableValue: "active" }, yes: "TMPL_MEDIA", no: "ERR" },
                 
                 { id: "TMPL_MEDIA", type: "send_template", data: { 
                     template: "course_registration_promo",
                     languageCode: "en_US", 
                     components: [ 
                         { type: "header", parameters: [ { type: "image", image: { link: "https://hub.influapp.com/logo.png" }}]},
                         { type: "body", parameters: [ { type: "text", text: "Suurya "}]} 
                     ]
                   }, next: "DELAY"
                 },
                 { id: "DELAY", type: "delay", data: { duration: 1, unit: "seconds" }, next: "TAG_ADD" },
                 { id: "TAG_ADD", type: "action", data: { actionType: "add_tag", actionValue: "Integration_Tested" }, next: "ASSIGN" },
                 { id: "ASSIGN", type: "action", data: { actionType: "assign_agent", actionValue: "suurya@influapp.com" }, next: "STATUS_UPDATE"  },
                 { id: "STATUS_UPDATE", type: "action", data: { actionType: "update_chat_status", actionValue: "closed" }, next: "FINISH" },
                 
                 { id: "ERR", type: "send_message", data: { message: "Error" }, next: "FINISH" },
                 { id: "FINISH", type: "end" }
              ],
              edges: []
          }
       };

       console.log("Mock Workflow Initialized. Attempting Run Execution Engine\n");
       
       // Manually construct what `runWorkflow()` does inline here with the Mocks 
       const executionLog = [];
       const nodes = mockG.steps.nodes;
       let currentNode = nodes.find(n => n.type === 'trigger');
       
       while (currentNode) {
         executionLog.push({ step: currentNode.id, type: currentNode.type });
         console.warn(`[Node Processed]: ${currentNode.id} (${currentNode.type})`);
         
         if (currentNode.type === 'send_template') {
            await outboundWhatsAppMock.sendTemplate(
               'conv_id_1', 
               currentNode.data.template, 
               currentNode.data.languageCode, 
               currentNode.data.components
            );
         } else if (currentNode.type === 'action') {
            if (currentNode.data.actionType === 'update_chat_status') {
                 await queryDbMock(`UPDATE conversations SET status = $1 WHERE id = $2`, [currentNode.data.actionValue, 1]);
            } else if (currentNode.data.actionType === 'add_tag') {
                 await queryDbMock(`UPDATE contacts ... {tags}`, [currentNode.data.actionValue]);
            } else if (currentNode.data.actionType === 'assign_agent') {
                 await queryDbMock(`INSERT INTO conversation_assignments`, []);
            }
         } else if (currentNode.type === 'delay') {
            console.log(`[Sleep Engine] Simulating delay of ${currentNode.data.duration} seconds...`);
         }
         
         // Path resolving
         if (currentNode.type === 'condition') {
             // Simulate mock db resolving truthy due to active check match!
             const simulatedDbMatch = true; 
             const nextId = simulatedDbMatch ? currentNode.yes : currentNode.no;
             currentNode = nodes.find(n => n.id === nextId);
         } else if (currentNode.type === 'end') {
             currentNode = null;
         } else {
             const nextId = currentNode.next;
             currentNode = nextId ? nodes.find(n => n.id === nextId) : null;
         }
       }
       
       console.log("\n------------------------------------------");
       console.log("E2E Simulation Finished!");
       console.log("Final Execution Line Output:");
       console.log(executionLog.map(e => e.step).join(' -> '));

   } catch (e) {
      console.error(e);
   }
}

runTestLocally();

