import * as cron from 'node-cron';
import { getAutomations, updateAutomation, createAutomationHistory, updateAutomationHistory, DbAutomation } from './database.js';
import { exec, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { app } from 'electron';
import Store from 'electron-store';
import * as aiService from './ai-service.js';

const store = new Store();

// Store active cron jobs
const activeCronJobs = new Map<string, cron.ScheduledTask>();

// Store currently running automations
const runningAutomations = new Set<string>();

// Store running processes for kill capability
const runningProcesses = new Map<string, ChildProcess>();

// Queue for automations waiting to run
const automationQueue: string[] = [];

// Default max concurrent automations (can be overridden by settings)
let maxConcurrentAutomations = 3;

/**
 * Set the maximum number of concurrent automations
 */
export function setMaxConcurrentAutomations(max: number) {
  maxConcurrentAutomations = Math.max(1, max);
  console.log(`📊 Max concurrent automations set to: ${maxConcurrentAutomations}`);
  processQueue();
}

/**
 * Get current concurrent automation limit
 */
export function getMaxConcurrentAutomations(): number {
  return maxConcurrentAutomations;
}

/**
 * Get currently running automations count
 */
export function getRunningAutomationsCount(): number {
  return runningAutomations.size;
}

/**
 * Check if an automation is currently running
 */
export function isAutomationRunning(automationId: string): boolean {
  return runningAutomations.has(automationId);
}

/**
 * Stop a running automation
 */
export function stopAutomation(automationId: string): boolean {
  const childProcess = runningProcesses.get(automationId);
  if (!childProcess) {
    console.log(`⚠️ No running process found for automation ${automationId}`);
    return false;
  }

  try {
    // Kill the process and all children
    if (childProcess.pid) {
      // On Unix, kill process group
      if (os.platform() !== 'win32') {
        childProcess.kill('SIGTERM');
        // Force kill after 2 seconds if still running
        setTimeout(() => {
          if (!childProcess.killed) {
            childProcess.kill('SIGKILL');
          }
        }, 2000);
      } else {
        // On Windows, use taskkill
        childProcess.kill();
      }
    }

    runningProcesses.delete(automationId);
    runningAutomations.delete(automationId);
    
    // Update automation status
    updateAutomation(automationId, { status: 'failed' });
    
    console.log(`🛑 Stopped automation ${automationId}`);
    
    // Process queue
    processQueue();
    
    return true;
  } catch (error: any) {
    console.error(`❌ Failed to stop automation ${automationId}:`, error);
    return false;
  }
}

/**
 * Execute a browser automation with concurrency control
 */
export async function executeAutomation(
  automationId: string,
  config: any
): Promise<any> {
  // Check if already running
  if (runningAutomations.has(automationId)) {
    console.log(`⚠️ Automation ${automationId} is already running`);
    return { success: false, error: 'Automation is already running' };
  }

  // Check concurrent limit
  if (runningAutomations.size >= maxConcurrentAutomations) {
    console.log(`⚠️ Max concurrent automations reached (${maxConcurrentAutomations}), queuing ${automationId}`);
    if (!automationQueue.includes(automationId)) {
      automationQueue.push(automationId);
    }
    return { success: false, error: 'Queued: max concurrent automations reached', queued: true };
  }

  // Mark as running
  runningAutomations.add(automationId);
  
  // Update automation status
  updateAutomation(automationId, { 
    status: 'running',
    last_run: new Date().toISOString()
  });

  // Create history entry
  const historyId = createAutomationHistory({
    automation_id: automationId,
    status: 'running',
    started_at: new Date().toISOString(),
    completed_at: null,
    result: null,
    error_message: null,
    analysis: null
  });

  console.log(`🚀 Starting automation ${automationId} (${runningAutomations.size}/${maxConcurrentAutomations} running)`);

  try {
    const userDataPath = app.getPath('userData');
    const envPath = path.join(userDataPath, 'python-env');
    const scriptPath = path.join(envPath, `browser_automation_${Date.now()}.py`);

    const pythonScript = `import sys
import json
import asyncio
import logging
import os

# Configure logging to stderr so it doesn't interfere with JSON stdout
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger(__name__)

try:
    from browser_use import Agent, Browser, ChatOpenAI, ChatGoogle
    logger.info("Successfully imported browser-use modules")
except ImportError as e:
    print(json.dumps({"success": False, "error": f"Package not installed: {str(e)}"}))
    sys.exit(1)

async def main():
    config = json.loads(sys.argv[1])
    logger.info(f"Received config: {json.dumps(config, indent=2)}")
    
    try:
        provider = config['llm']['provider']
        logger.info(f"Using LLM provider: {provider}")
        
        if provider == 'gemini':
            llm = ChatGoogle(
                model=config['llm']['model'],
                api_key=config['llm']['api_key'],
                temperature=0.1
            )
            logger.info(f"Initialized ChatGoogle with model: {config['llm']['model']}")
        elif provider == 'openrouter':
            llm = ChatOpenAI(
                model=config['llm']['model'],
                api_key=config['llm']['api_key'],
                base_url="https://openrouter.ai/api/v1",
                temperature=0.1
            )
            logger.info(f"Initialized ChatOpenAI with model: {config['llm']['model']}")
        else:
            raise ValueError(f"Unsupported provider: {provider}")
        
        # Initialize browser with persistent profile
        browser_kwargs = {'headless': config.get('headless', False)}
        
        if 'chrome_profile_path' in config and config['chrome_profile_path']:
            import shutil
            from pathlib import Path
            
            profile_path = config['chrome_profile_path']
            logger.info(f"Chrome profile path: {profile_path}")
            
            # Create persistent browser-use profile directory
            app_data_dir = os.path.expanduser('~/.config/aether-hub-personal-hub')
            browseruse_profile_dir = os.path.join(app_data_dir, 'browseruse-profiles')
            profile_name = os.path.basename(profile_path)
            target_profile = os.path.join(browseruse_profile_dir, profile_name)
            
            os.makedirs(target_profile, exist_ok=True)
            logger.info(f"Persistent profile directory: {target_profile}")
            
            # Copy important Chrome data if profile is empty or old
            important_files = [
                'Cookies', 'Cookies-journal',
                'Local Storage', 
                'History', 'History-journal',
                'Login Data', 'Login Data-journal',
                'Preferences',
                'Web Data', 'Web Data-journal'
            ]
            
            # Check if we need to sync from Chrome profile
            needs_sync = not os.path.exists(os.path.join(target_profile, 'Cookies'))
            
            if needs_sync:
                logger.info("Syncing Chrome profile data to browser-use profile...")
                for item in important_files:
                    src = os.path.join(profile_path, item)
                    dst = os.path.join(target_profile, item)
                    try:
                        if os.path.isfile(src):
                            shutil.copy2(src, dst)
                            logger.info(f"Copied: {item}")
                        elif os.path.isdir(src):
                            if os.path.exists(dst):
                                shutil.rmtree(dst)
                            shutil.copytree(src, dst)
                            logger.info(f"Copied directory: {item}")
                    except Exception as e:
                        logger.warning(f"Failed to copy {item}: {e}")
                logger.info("Profile sync complete")
            else:
                logger.info("Using existing browser-use profile (already synced)")
            
            # Use the persistent profile
            browser_kwargs['user_data_dir'] = browseruse_profile_dir
            browser_kwargs['profile_directory'] = profile_name
            
            logger.info(f"Browser config: {browser_kwargs}")
        else:
            logger.info("No Chrome profile specified, using default browser settings")
        
        browser = Browser(**browser_kwargs)
        logger.info("Browser initialized successfully")
        
        # Create agent with task, llm, and browser
        agent = Agent(
            task=config['task'],
            llm=llm,
            browser=browser
        )
        logger.info(f"Agent created with task: {config['task']}")
        
        logger.info("Starting agent execution...")
        result = await agent.run()
        logger.info(f"Agent execution completed. Result type: {type(result)}")
        
        print(json.dumps({
            "success": True,
            "output": str(result),
            "task": config['task']
        }))
    except Exception as e:
        import traceback
        logger.error(f"Error occurred: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        print(json.dumps({
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__,
            "traceback": traceback.format_exc()
        }))

if __name__ == '__main__':
    logger.info("=== Browser Automation Script Started ===")
    asyncio.run(main())
    logger.info("=== Browser Automation Script Finished ===")
`;

    // Write script to temp file
    fs.writeFileSync(scriptPath, pythonScript, 'utf-8');

    try {
      const configJson = JSON.stringify(config);
      const command = `uv run python "${scriptPath}" '${configJson}'`;

      // Use exec instead of execSync to get child process handle
      const result = await new Promise<string>((resolve, reject) => {
        const childProcess = exec(command, {
          encoding: 'utf-8',
          cwd: envPath,
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
          timeout: 300000 // 5 minute timeout
        }, (error, stdout, stderr) => {
          // Remove from tracking
          runningProcesses.delete(automationId);
          
          if (error) {
            reject(error);
          } else {
            resolve(stdout);
          }
        });
        
        // Store process for kill capability
        runningProcesses.set(automationId, childProcess);
      });

      const output = JSON.parse(result.trim());
      
      // Update automation status
      updateAutomation(automationId, { status: 'completed' });
      
      // Automatically generate AI analysis
      let analysis: string | null = null;
      try {
        console.log(`🤖 Generating AI analysis for automation ${automationId}...`);
        analysis = await aiService.analyzeAutomationResult(
          JSON.stringify(output),
          config.task
        );
        console.log(`✨ AI analysis completed for automation ${automationId}`);
      } catch (analysisError: any) {
        console.warn(`⚠️ Failed to generate AI analysis: ${analysisError.message}`);
        // Continue even if analysis fails - the automation itself succeeded
      }
      
      // Update history with result and analysis
      updateAutomationHistory(historyId, {
        status: 'completed',
        completed_at: new Date().toISOString(),
        result: JSON.stringify(output),
        analysis: analysis
      });

      console.log(`✅ Automation ${automationId} completed successfully`);
      
      return output;
    } catch (error: any) {
      // Update automation status
      updateAutomation(automationId, { status: 'failed' });
      
      // Update history
      updateAutomationHistory(historyId, {
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: error.message || 'Execution failed'
      });

      console.error(`❌ Automation ${automationId} failed:`, error.message);
      
      throw error;
    } finally {
      // Clean up temp file
      try {
        fs.unlinkSync(scriptPath);
      } catch (e) {
        console.warn('Failed to delete temp script:', e);
      }

      // Remove from running set
      runningAutomations.delete(automationId);
      
      // Process queue
      processQueue();
    }
  } catch (error: any) {
    console.error(`❌ Automation ${automationId} execution failed:`, error);
    
    // Remove from running set
    runningAutomations.delete(automationId);
    
    // Process queue
    processQueue();
    
    return {
      success: false,
      error: error.message || 'Execution failed'
    };
  }
}

/**
 * Process queued automations
 */
function processQueue() {
  while (automationQueue.length > 0 && runningAutomations.size < maxConcurrentAutomations) {
    const automationId = automationQueue.shift();
    if (automationId) {
      console.log(`📥 Processing queued automation: ${automationId}`);
      // Re-trigger the automation execution
      // This will be handled by the UI or external call
    }
  }
}

/**
 * Schedule an automation with cron
 */
export function scheduleAutomation(automation: DbAutomation, config: any) {
  // Remove existing schedule if any
  unscheduleAutomation(automation.id);

  if (!automation.cron_schedule) {
    console.log(`⏭️ No schedule for automation ${automation.id}`);
    return;
  }

  // Validate cron expression
  if (!cron.validate(automation.cron_schedule)) {
    console.error(`❌ Invalid cron expression for automation ${automation.id}: ${automation.cron_schedule}`);
    return;
  }

  // Create cron job
  const task = cron.schedule(automation.cron_schedule, async () => {
    console.log(`⏰ Cron triggered automation: ${automation.name} (${automation.id})`);
    await executeAutomation(automation.id, config);
  });

  activeCronJobs.set(automation.id, task);
  console.log(`✅ Scheduled automation ${automation.id} with cron: ${automation.cron_schedule}`);
}

/**
 * Unschedule an automation
 */
export function unscheduleAutomation(automationId: string) {
  const task = activeCronJobs.get(automationId);
  if (task) {
    task.stop();
    activeCronJobs.delete(automationId);
    console.log(`🛑 Unscheduled automation ${automationId}`);
  }
}

/**
 * Load and schedule all automations from database
 */
export function loadAutomationSchedules(getLLMConfig: () => Promise<any>) {
  const automations = getAutomations();
  console.log(`📅 Loading ${automations.length} automation schedules...`);

  for (const automation of automations) {
    if (automation.cron_schedule) {
      getLLMConfig().then(config => {
        const automationConfig = {
          ...config,
          task: automation.task,
          chrome_profile_path: automation.profile_id,
          headless: automation.headless === 1
        };
        scheduleAutomation(automation, automationConfig);
      });
    }
  }

  console.log(`✅ Loaded ${activeCronJobs.size} automation schedules`);
}

/**
 * Run startup automations
 */
export async function runStartupAutomations(getLLMConfig: () => Promise<any>) {
  const automations = getAutomations();
  const startupAutomations = automations.filter(a => a.run_on_startup === 1 && a.status !== 'running');

  console.log(`🚀 Running ${startupAutomations.length} startup automations...`);

  for (const automation of startupAutomations) {
    const config = await getLLMConfig();
    const automationConfig = {
      ...config,
      task: automation.task,
      chrome_profile_path: automation.profile_id,
      headless: automation.headless === 1
    };

    // Execute with delay to avoid overwhelming the system
    setTimeout(() => {
      executeAutomation(automation.id, automationConfig);
    }, 2000 * startupAutomations.indexOf(automation)); // 2 second delay between each
  }
}

/**
 * Stop all running automations
 */
export function stopAllAutomations() {
  console.log('🛑 Stopping all automations and clearing schedules...');
  
  // Stop all cron jobs
  for (const [automationId, task] of activeCronJobs.entries()) {
    task.stop();
    console.log(`🛑 Stopped cron for automation ${automationId}`);
  }
  activeCronJobs.clear();
  
  // Kill all running processes
  for (const [automationId, process] of runningProcesses.entries()) {
    try {
      if (process.pid) {
        process.kill('SIGTERM');
        console.log(`🛑 Killed process for automation ${automationId}`);
      }
    } catch (error) {
      console.error(`Failed to kill process for ${automationId}:`, error);
    }
  }
  runningProcesses.clear();
  
  // Clear running set
  runningAutomations.clear();
  
  // Clear queue
  automationQueue.length = 0;
  
  console.log('✅ All automations stopped');
}

/**
 * Analyze automation result with AI
 */
/**
 * Analyze automation result with AI
 */
export async function analyzeAutomationResult(result: string, task: string): Promise<string> {
  return await aiService.analyzeAutomationResult(result, task);
}
