/**
 * 🔮 OMGBUILD Chat Command
 * Interactive AI-powered development assistant
 */

import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { createInterface, Interface } from 'readline';
import { createAIRouter, AIMessage } from '../core/ai-provider';
import { createMemoryManager } from '../core/memory';
import { ConfigManager } from '../core/config';

// ============================================================================
// TYPES
// ============================================================================

interface ChatSession {
  messages: AIMessage[];
  context: {
    projectName: string;
    skills: string[];
    workflows: string[];
    memoryContext: string;
  };
}

// ============================================================================
// CHAT COMMAND
// ============================================================================

export const chatCommand = new Command('chat')
  .description('Interactive AI-powered development assistant')
  .option('--model <model>', 'AI model to use')
  .option('--no-context', 'Don\'t include project context')
  .option('--skill <skill>', 'Focus on a specific skill')
  .action(async (options: {
    model?: string;
    context?: boolean;
    skill?: string;
  }) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    
    if (!await fs.pathExists(omgbuildDir)) {
      console.error('❌ No .omgbuild directory found. Run `omgbuild init` first.');
      process.exit(1);
    }

    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
      console.error(`
❌ No AI API key found.

Please set one of these environment variables:
  export ANTHROPIC_API_KEY=your-key
  export OPENAI_API_KEY=your-key
`);
      process.exit(1);
    }

    await runChat(omgbuildDir, options);
  });

// ============================================================================
// CHAT SESSION
// ============================================================================

async function runChat(
  omgbuildDir: string,
  options: {
    model?: string;
    context?: boolean;
    skill?: string;
  }
) {
  console.log(`
🔮 ╔═══════════════════════════════════════════════════════════════╗
   ║              OMGBUILD INTERACTIVE CHAT                        ║
   ╚═══════════════════════════════════════════════════════════════╝

   Your AI development assistant is ready.
   
   Commands:
     /help       - Show available commands
     /skill      - Switch to a specific skill focus
     /workflow   - Start a workflow
     /memory     - Show project memory
     /clear      - Clear chat history
     /exit       - Exit chat

   Type your message and press Enter to chat.
${'─'.repeat(60)}
`);

  // Initialize components
  const router = await createAIRouter(omgbuildDir);
  const memory = await createMemoryManager(omgbuildDir);
  const configManager = new ConfigManager(omgbuildDir);
  const config = await configManager.load();

  // Get available skills and workflows
  const skillsDir = path.join(omgbuildDir, 'skills');
  const workflowsDir = path.join(omgbuildDir, 'workflows');
  
  const skills = await fs.pathExists(skillsDir) 
    ? (await fs.readdir(skillsDir)).filter(async f => 
        (await fs.stat(path.join(skillsDir, f))).isDirectory()
      )
    : [];

  const workflows = await fs.pathExists(workflowsDir)
    ? (await fs.readdir(workflowsDir))
        .filter(f => f.endsWith('.yaml'))
        .map(f => f.replace('.yaml', ''))
    : [];

  // Get memory context
  const memoryContext = await memory.generateSummary();

  // Initialize session
  const session: ChatSession = {
    messages: [],
    context: {
      projectName: config.project.name,
      skills,
      workflows,
      memoryContext,
    },
  };

  // Build system prompt
  const systemPrompt = buildSystemPrompt(session.context, options.skill);
  session.messages.push({
    role: 'system',
    content: systemPrompt,
  });

  // Create readline interface
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Main chat loop
  const promptUser = () => {
    rl.question('\n💬 You: ', async (input) => {
      if (!input.trim()) {
        promptUser();
        return;
      }

      // Handle commands
      if (input.startsWith('/')) {
        await handleCommand(input, session, rl, memory, skills, workflows);
        promptUser();
        return;
      }

      // Add user message
      session.messages.push({
        role: 'user',
        content: input,
      });

      // Get AI response
      try {
        process.stdout.write('\n🤖 Claude: ');
        
        const response = await router.chat(
          session.messages,
          options.skill,
          { model: options.model }
        );

        console.log(response.content);

        // Add assistant message
        session.messages.push({
          role: 'assistant',
          content: response.content,
        });

        // Check for memory updates
        await checkForMemoryUpdates(response.content, memory);

      } catch (error) {
        console.error(`\n❌ Error: ${(error as Error).message}`);
      }

      promptUser();
    });
  };

  promptUser();
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

function buildSystemPrompt(
  context: ChatSession['context'],
  focusSkill?: string
): string {
  let prompt = `# 🔮 OMGBUILD AI Development Assistant

You are an AI development assistant for the project "${context.projectName}".
You help developers build software following Big Tech engineering practices.

## Your Capabilities
You can help with:
- Analyzing requirements and breaking down features
- Designing system architecture
- Writing high-quality code
- Generating comprehensive tests
- Performing code reviews
- Security analysis
- Documentation

## Available Skills
${context.skills.map(s => `- ${s}`).join('\n')}

## Available Workflows
${context.workflows.map(w => `- ${w}`).join('\n')}

## Project Memory
${context.memoryContext}

## Guidelines
1. Always follow project rules and conventions
2. Be precise and actionable in your responses
3. Ask clarifying questions when requirements are unclear
4. Suggest using appropriate skills when relevant
5. Reference past decisions and patterns when applicable
6. Generate code with proper error handling and tests
7. Think step-by-step for complex tasks

`;

  if (focusSkill) {
    prompt += `
## Current Focus: ${focusSkill}
You are currently focused on the "${focusSkill}" skill. 
Prioritize this skill's capabilities in your responses.
`;
  }

  prompt += `
## Response Format
- Use markdown formatting for clarity
- Wrap code in proper code blocks with language identifiers
- Structure complex responses with headers
- Be concise but thorough
`;

  return prompt;
}

// ============================================================================
// COMMAND HANDLERS
// ============================================================================

async function handleCommand(
  input: string,
  session: ChatSession,
  rl: Interface,
  memory: ReturnType<typeof createMemoryManager> extends Promise<infer T> ? T : never,
  skills: string[],
  workflows: string[]
): Promise<void> {
  const [command, ...args] = input.slice(1).split(' ');

  switch (command.toLowerCase()) {
    case 'help':
      showHelp();
      break;

    case 'skill':
      if (args[0]) {
        console.log(`\n✅ Focus switched to skill: ${args[0]}`);
        // Update system prompt with new skill focus
        session.messages[0] = {
          role: 'system',
          content: buildSystemPrompt(session.context, args[0]),
        };
      } else {
        console.log(`\n📋 Available skills: ${skills.join(', ')}`);
        console.log('   Usage: /skill <name>');
      }
      break;

    case 'workflow':
      if (args[0]) {
        console.log(`\n🔄 To run this workflow, use:`);
        console.log(`   omgbuild run workflow ${args[0]} "your description"`);
      } else {
        console.log(`\n📋 Available workflows: ${workflows.join(', ')}`);
        console.log('   Usage: /workflow <name>');
      }
      break;

    case 'memory':
      const stats = memory.getStats();
      console.log(`
📊 Project Memory:
   • Decisions: ${stats.decisions}
   • Patterns: ${stats.patterns}
   • Learnings: ${stats.learnings}
   • Last Updated: ${stats.lastUpdated || 'Never'}
`);
      break;

    case 'clear':
      // Keep only system message
      session.messages = [session.messages[0]];
      console.log('\n🗑️ Chat history cleared.');
      break;

    case 'exit':
    case 'quit':
      console.log('\n👋 Goodbye! Happy building.\n');
      rl.close();
      process.exit(0);

    case 'save':
      // Save conversation to file
      const savePath = args[0] || `chat-${Date.now()}.md`;
      const conversation = session.messages
        .slice(1) // Skip system message
        .map(m => `## ${m.role === 'user' ? 'You' : 'Claude'}\n${m.content}`)
        .join('\n\n');
      await fs.writeFile(savePath, conversation, 'utf-8');
      console.log(`\n💾 Conversation saved to: ${savePath}`);
      break;

    case 'context':
      console.log(`
📋 Current Context:
   Project: ${session.context.projectName}
   Skills: ${session.context.skills.join(', ')}
   Workflows: ${session.context.workflows.join(', ')}
   Messages: ${session.messages.length - 1} (excluding system)
`);
      break;

    default:
      console.log(`\n❓ Unknown command: /${command}`);
      console.log('   Type /help for available commands.');
  }
}

function showHelp(): void {
  console.log(`
📚 Available Commands:

   /help              Show this help message
   /skill <n>      Focus on a specific skill
   /workflow <n>   Show how to run a workflow
   /memory            Display project memory stats
   /context           Show current chat context
   /clear             Clear chat history
   /save [filename]   Save conversation to file
   /exit              Exit chat

💡 Tips:
   • Ask me to analyze requirements
   • Request code reviews
   • Get architecture suggestions
   • Generate tests for your code
   • Ask about best practices
`);
}

// ============================================================================
// MEMORY INTEGRATION
// ============================================================================

async function checkForMemoryUpdates(
  content: string,
  memory: ReturnType<typeof createMemoryManager> extends Promise<infer T> ? T : never
): Promise<void> {
  // Check for decision patterns
  if (content.toLowerCase().includes('decision:') || 
      content.toLowerCase().includes('we decided') ||
      content.toLowerCase().includes('i recommend')) {
    // Could auto-extract and save decisions in the future
  }

  // Check for pattern discoveries
  if (content.toLowerCase().includes('pattern:') ||
      content.toLowerCase().includes('this pattern')) {
    // Could auto-extract and save patterns in the future
  }
}
