const assert = require("assert");
const { parseNaturalLanguageTask, breakdownTaskIntoSubtasks } = require("./aiService");

console.log("=== Testing AI Service Unit Logic ===");

// 1. Natural Language Parser Tests
const p1 = parseNaturalLanguageTask("Prepare system architecture slides for tomorrow #High", new Date("2026-10-24"));
assert.strictEqual(p1.task, "Prepare system architecture slides");
assert.strictEqual(p1.priority, "High");
assert.strictEqual(p1.dueDate, "2026-10-25");
console.log("✓ Test 1 Passed: Tomorrow + #High priority extraction");

const p2 = parseNaturalLanguageTask("Schedule dentist appointment day after tomorrow #low", new Date("2026-10-24"));
assert.strictEqual(p2.task, "Schedule dentist appointment");
assert.strictEqual(p2.priority, "Low");
assert.strictEqual(p2.dueDate, "2026-10-26");
console.log("✓ Test 2 Passed: Day after tomorrow + #low priority extraction");

const p3 = parseNaturalLanguageTask("Deploy hotfix to production asap in 2 days", new Date("2026-10-24"));
assert.strictEqual(p3.task, "Deploy hotfix to production");
assert.strictEqual(p3.priority, "High");
assert.strictEqual(p3.dueDate, "2026-10-26");
console.log("✓ Test 3 Passed: 'in 2 days' + 'asap' priority extraction");

const p4 = parseNaturalLanguageTask("Complete code review by Friday", new Date("2026-10-24")); // Saturday
assert.strictEqual(p4.task, "Complete code review");
assert.strictEqual(p4.dueDate, "2026-10-30"); // Next Friday
console.log("✓ Test 4 Passed: Weekday 'by Friday' extraction");

const p5 = parseNaturalLanguageTask("Simple task without metadata");
assert.strictEqual(p5.task, "Simple task without metadata");
assert.strictEqual(p5.priority, "Medium");
assert.strictEqual(p5.dueDate, null);
console.log("✓ Test 5 Passed: Default fallback for simple tasks");

// 2. Subtask Decomposition Tests
const b1 = breakdownTaskIntoSubtasks("Implement OAuth2 authentication flow", "High");
assert(Array.isArray(b1.subtasks), "Subtasks should be an array");
assert(b1.subtasks.length >= 3, "Should generate at least 3 subtasks");
assert(b1.subtasks.some(s => s.task.toLowerCase().includes("architecture") || s.task.toLowerCase().includes("auth")), "Should tailor subtasks to tech");
console.log("✓ Test 6 Passed: Tech domain subtask decomposition");

const b2 = breakdownTaskIntoSubtasks("Study dynamic programming and recursion", "Medium");
assert(b2.subtasks.some(s => s.task.toLowerCase().includes("syllabus") || s.task.toLowerCase().includes("concepts") || s.task.toLowerCase().includes("practice")), "Should tailor subtasks to study");
console.log("✓ Test 7 Passed: Study domain subtask decomposition");

const b3 = breakdownTaskIntoSubtasks("Launch summer product marketing campaign", "High");
assert(b3.subtasks.some(s => s.task.toLowerCase().includes("audience") || s.task.toLowerCase().includes("messaging") || s.task.toLowerCase().includes("launch")), "Should tailor subtasks to marketing");
console.log("✓ Test 8 Passed: Marketing domain subtask decomposition");

console.log("\nALL 8 AI SERVICE UNIT TESTS PASSED SUCCESSFULLY!");
