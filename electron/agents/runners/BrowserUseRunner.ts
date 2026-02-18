import { exec, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import type Store from 'electron-store';
import type { AgentConfig, AgentTaskResult } from '../types.js';
import type { BrowserRunner } from './BrowserRunner.js';

interface LlmConfig {
  provider: string;
  api_key?: string;
  model?: string;
}

export class BrowserUseRunner implements BrowserRunner {
  private persistentSessions = new Map<string, { process: ChildProcess; scriptPath: string }>();

  constructor(private store: Store) {}

  async run(task: string, config: AgentConfig): Promise<AgentTaskResult> {
    const llm = this.getLlmConfig();

    const automationConfig = {
      task,
      llm,
      headless: config.browser.headless,
      chrome_profile_path: config.profileId
    };

    try {
      const output = await this.executeBrowserUse(automationConfig);
      return {
        taskId: `task_${Date.now()}`,
        status: 'completed',
        output
      };
    } catch (error: any) {
      return {
        taskId: `task_${Date.now()}`,
        status: 'failed',
        error: error?.message || 'Browser task failed'
      };
    }
  }

  async startPersistent(config: AgentConfig): Promise<void> {
    if (this.persistentSessions.has(config.id)) return;

    const userDataPath = app.getPath('userData');
    const envPath = path.join(userDataPath, 'python-env');
    const scriptPath = path.join(envPath, `browser_persistent_${config.id}.py`);

    if (!fs.existsSync(envPath)) {
      fs.mkdirSync(envPath, { recursive: true });
    }

    const headless = config.browser.headless ? 'True' : 'False';

    const pythonScript = `import sys
import json
import asyncio
import logging
import os
import signal

# Configure logging to stderr so it doesn't interfere with JSON stdout
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger(__name__)

try:
    from browser_use import Browser
    logger.info("Successfully imported browser-use modules")
except ImportError as e:
    print(json.dumps({"success": False, "error": f"Package not installed: {str(e)}"}))
    sys.exit(1)

async def main():
    config = json.loads(sys.argv[1])
    logger.info(f"Received config: {json.dumps(config, indent=2)}")
    
    try:
        # Initialize browser with persistent profile
        browser_kwargs = {'headless': ${headless}}
        
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
        
        print(json.dumps({"success": True, "status": "browser_started"}))
        sys.stdout.flush()
        
        # Keep the browser alive until process is killed
        stop = asyncio.Event()
        loop = asyncio.get_event_loop()
        for sig in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(sig, stop.set)
        
        logger.info("Persistent browser session running, waiting for termination signal...")
        await stop.wait()
        logger.info("Termination signal received, shutting down browser...")
        
    except Exception as e:
        import traceback
        logger.error(f"Error occurred: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        print(json.dumps({
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }))

if __name__ == '__main__':
    logger.info("=== Persistent Browser Session Started ===")
    asyncio.run(main())
    logger.info("=== Persistent Browser Session Ended ===")
`;

    fs.writeFileSync(scriptPath, pythonScript, 'utf-8');

    const automationConfig = {
      headless: config.browser.headless,
      chrome_profile_path: config.profileId
    };

    const configJson = JSON.stringify(automationConfig);
    // Use shell exec (same as working browseruse:execute) so uv resolves from PATH
    const command = `uv run python "${scriptPath}" '${configJson}'`;

    console.log('🤖 Starting persistent browser for agent:', config.id);
    console.log('🔵 Command:', command);

    const child = exec(command, {
      encoding: 'utf-8',
      cwd: envPath,
      maxBuffer: 10 * 1024 * 1024
    });

    const cleanup = () => {
      console.log(`🔴 Persistent browser for agent ${config.id} exited`);
      this.persistentSessions.delete(config.id);
      try { fs.unlinkSync(scriptPath); } catch (_) {}
    };

    child.on('exit', (code, signal) => {
      console.log(`Persistent browser exit: code=${code} signal=${signal}`);
      cleanup();
    });
    child.stderr?.on('data', (data: string) => {
      console.log(`🤖 Browser [${config.id}]:`, data.toString().trim());
    });
    child.stdout?.on('data', (data: string) => {
      const message = data.toString().trim();
      if (message) {
        console.log(`🤖 Browser stdout [${config.id}]:`, message);
      }
    });

    this.persistentSessions.set(config.id, { process: child, scriptPath });
  }

  async stopPersistent(agentId: string): Promise<void> {
    const session = this.persistentSessions.get(agentId);
    if (!session) return;
    console.log(`🛑 Stopping persistent browser for agent: ${agentId}`);
    session.process.kill('SIGTERM');
    // Give it a moment then force kill if still alive
    setTimeout(() => {
      try { session.process.kill('SIGKILL'); } catch (_) {}
    }, 5000);
    this.persistentSessions.delete(agentId);
    try { fs.unlinkSync(session.scriptPath); } catch (_) {}
  }

  private getLlmConfig(): LlmConfig {
    const provider = (this.store.get('ai_provider') as string) || 'google';

    if (provider === 'google' || provider === 'gemini') {
      return {
        provider: 'gemini',
        api_key: this.store.get('gemini_api_key') as string,
        model: (this.store.get('gemini_model') as string) || 'gemini-2.5-flash'
      };
    }

    if (provider === 'openrouter') {
      return {
        provider: 'openrouter',
        api_key: this.store.get('openrouter_api_key') as string,
        model: (this.store.get('openrouter_model') as string) || 'x-ai/grok-2-1212'
      };
    }

    if (provider === 'openai') {
      return {
        provider: 'openai',
        api_key: this.store.get('openai_api_key') as string,
        model: (this.store.get('openai_model') as string) || 'gpt-4o-mini'
      };
    }

    if (provider === 'anthropic') {
      return {
        provider: 'anthropic',
        api_key: this.store.get('anthropic_api_key') as string,
        model: (this.store.get('anthropic_model') as string) || 'claude-3-5-sonnet-20241022'
      };
    }

    if (provider === 'ollama') {
      return {
        provider: 'ollama',
        model: (this.store.get('ollama_model') as string) || 'llama3.1'
      };
    }

    if (provider === 'local') {
      return {
        provider: 'local',
        api_key: (this.store.get('local_ai_key') as string) || undefined,
        model: (this.store.get('local_ai_model') as string) || 'default'
      };
    }

    return { provider: 'gemini' };
  }

  private executeBrowserUse(config: any): Promise<string> {
    const userDataPath = app.getPath('userData');
    const envPath = path.join(userDataPath, 'python-env');
    const scriptPath = path.join(envPath, `browser_agent_${Date.now()}.py`);

    if (!fs.existsSync(envPath)) {
      fs.mkdirSync(envPath, { recursive: true });
    }

    const pythonScript = `import sys
import json
import asyncio
import logging
import os

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger(__name__)

try:
    from browser_use import Agent, Browser, ChatOpenAI, ChatGoogle
    logger.info('Imported browser-use modules')
except ImportError as e:
    print(json.dumps({'success': False, 'error': f'Package not installed: {str(e)}'}))
    sys.exit(1)

async def main():
    config = json.loads(sys.argv[1])
    try:
        provider = config['llm']['provider']
        if provider == 'gemini':
            llm = ChatGoogle(
                model=config['llm']['model'],
                api_key=config['llm']['api_key'],
                temperature=0.1
            )
        elif provider == 'openrouter':
            llm = ChatOpenAI(
                model=config['llm']['model'],
                api_key=config['llm']['api_key'],
                base_url='https://openrouter.ai/api/v1',
                temperature=0.1
            )
        else:
            llm = ChatOpenAI(
                model=config['llm'].get('model', 'gpt-4o-mini'),
                api_key=config['llm'].get('api_key'),
                temperature=0.1
            )

        browser_kwargs = {'headless': config.get('headless', False)}
        profile_path = config.get('chrome_profile_path')
        if profile_path:
            import shutil
            profile_name = os.path.basename(profile_path)
            app_data_dir = os.path.expanduser('~/.config/aether-hub-personal-hub')
            browseruse_profile_dir = os.path.join(app_data_dir, 'browseruse-profiles')
            target_profile = os.path.join(browseruse_profile_dir, profile_name)
            os.makedirs(target_profile, exist_ok=True)

            important_files = [
                'Cookies', 'Cookies-journal',
                'Local Storage',
                'History', 'History-journal',
                'Login Data', 'Login Data-journal',
                'Preferences',
                'Web Data', 'Web Data-journal'
            ]

            needs_sync = not os.path.exists(os.path.join(target_profile, 'Cookies'))
            if needs_sync:
                for item in important_files:
                    src = os.path.join(profile_path, item)
                    dst = os.path.join(target_profile, item)
                    try:
                        if os.path.isfile(src):
                            shutil.copy2(src, dst)
                        elif os.path.isdir(src):
                            if os.path.exists(dst):
                                shutil.rmtree(dst)
                            shutil.copytree(src, dst)
                    except Exception:
                        pass

            browser_kwargs['user_data_dir'] = browseruse_profile_dir
            browser_kwargs['profile_directory'] = profile_name

        browser = Browser(**browser_kwargs)
        agent = Agent(task=config['task'], llm=llm, browser=browser)
        result = await agent.run()

        print(json.dumps({
            'success': True,
            'output': str(result),
            'task': config['task']
        }))
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e)
        }))

if __name__ == '__main__':
    asyncio.run(main())
`;

    fs.writeFileSync(scriptPath, pythonScript, 'utf-8');

    const configJson = JSON.stringify(config);
    const command = `uv run python "${scriptPath}" '${configJson}'`;

    return new Promise((resolve, reject) => {
      exec(command, {
        encoding: 'utf-8',
        cwd: envPath,
        maxBuffer: 10 * 1024 * 1024,
        timeout: 300000
      }, (error, stdout) => {
        try {
          fs.unlinkSync(scriptPath);
        } catch (_) {
        }

        if (error) {
          reject(error);
          return;
        }

        try {
          const output = JSON.parse(stdout.trim());
          if (!output.success) {
            reject(new Error(output.error || 'Browser task failed'));
            return;
          }
          resolve(output.output || '');
        } catch (parseError) {
          reject(parseError);
        }
      });
    });
  }
}
