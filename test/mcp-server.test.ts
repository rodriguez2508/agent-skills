import * as request from 'supertest';
import { app } from '../src/mcp-http-server';

describe('MCP Server', () => {
  it('should list registered skills', async () => {
    const response = await request(app).get('/mcp/skills');
    expect(response.status).toBe(200);
    expect(response.body.skills).toBeDefined();
    expect(response.body.skills.length).toBeGreaterThan(0);
  });

  it('should execute a skill', async () => {
    const response = await request(app).post('/mcp/execute-skill').send({
      agentId: 'example-agent',
      skillId: 'skill1',
      inputs: { data: 'test input' },
    });
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('success');
    expect(response.body.result).toBeDefined();
    expect(response.body.result.inputs).toEqual({ data: 'test input' });
  });

  it('should fail to execute an unregistered skill', async () => {
    const response = await request(app).post('/mcp/execute-skill').send({
      agentId: 'example-agent',
      skillId: 'non-existent-skill',
      inputs: {},
    });
    expect(response.status).toBe(404);
    expect(response.body.status).toBe('error');
    expect(response.body.message).toContain('not found');
  });
});