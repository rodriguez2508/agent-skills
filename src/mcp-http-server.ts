import express, { Application } from 'express';
import { SkillRegistrationService } from './modules/agents/application/services/skill-registration.service';
import { SkillRulesMappingService } from './modules/agents/application/services/skill-rules-mapping';

export const app: Application = express();
const port = 8004;

app.use(express.json());
app.use((req, res, next) => {
  // Middleware inline logic for extracting client IP
  const forwardedFor = req.headers['x-forwarded-for'] as string;
  const realIp = req.headers['x-real-ip'] as string;

  let ipAddress: string;

  if (forwardedFor) {
    ipAddress = forwardedFor.split(',')[0].trim();
  } else if (realIp) {
    ipAddress = realIp;
  } else {
    ipAddress = req.socket.remoteAddress || '127.0.0.1';
  }

  if (ipAddress.startsWith('::ffff:')) {
    ipAddress = ipAddress.substring(7);
  }

  (req as any).ipAddress = ipAddress;
  (req as any).userId = ipAddress;

  next();
});

const skillService = new SkillRegistrationService();
const rulesMappingService = new SkillRulesMappingService();

// Example: Register a demo skill
skillService.registerSkill({
  id: 'skill1',
  agentId: 'example-agent',
  rules: ['src/rules/example-rule.md'],
  execute: async (inputs) => {
    rulesMappingService.validateRules('skill1'); // Validate rules before execution
    console.log('Executing skill1 with inputs:', inputs);
    return Promise.resolve({ message: 'Skill executed successfully', inputs });
  },
});

// Add rule mappings for skill1
rulesMappingService.addMapping('skill1', ['src/rules/example-rule.md']);



// Endpoint to execute a skill
app.post('/mcp/execute-skill', (req, res) => {
  const { agentId, skillId, inputs } = req.body;
  skillService.executeSkill(skillId, inputs)
    .then((result) => {
      res.json({ status: 'success', result });
    })
    .catch((error) => {
      res.status(404).json({ status: 'error', message: error.message });
    });
});

// Endpoint to list all registered skills
app.get('/mcp/skills', (req, res) => {
  const skills = skillService.listSkills();
  res.json({ skills });
});

app.listen(port, () => {
  console.log(`MCP HTTP server running at http://localhost:${port}`);
});