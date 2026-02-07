import sys
import json
import asyncio
import logging

# Suppress all logging to stdout
logging.basicConfig(level=logging.CRITICAL)
for logger_name in ['browser_use', 'playwright', 'httpx', 'openai']:
    logging.getLogger(logger_name).setLevel(logging.CRITICAL)

try:
    from browser_use import Agent, Browser, ChatOpenAI, ChatGoogle
except ImportError as e:
    print(json.dumps({"success": False, "error": f"Package not installed: {str(e)}"}))
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
                base_url="https://openrouter.ai/api/v1",
                temperature=0.1
            )
        else:
            raise ValueError(f"Unsupported provider: {provider}")
        
        # Initialize browser with Chrome profile if provided
        browser_kwargs = {}
        if 'chrome_profile_path' in config and config['chrome_profile_path']:
            browser_kwargs['user_data_dir'] = config['chrome_profile_path']
        
        browser = Browser(**browser_kwargs)
        
        # Create agent with task, llm, and browser
        agent = Agent(
            task=config['task'],
            llm=llm,
            browser=browser
        )
        
        result = await agent.run()
        
        print(json.dumps({
            "success": True,
            "output": str(result),
            "task": config['task']
        }))
    except Exception as e:
        import traceback
        print(json.dumps({
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__,
            "traceback": traceback.format_exc()
        }))

if __name__ == '__main__':
    asyncio.run(main())
