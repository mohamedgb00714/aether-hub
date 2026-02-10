# Quick Ollama API Test

Use these commands to verify Ollama is working correctly:

## 1. Check if Ollama is Running

```bash
curl http://localhost:11434/api/tags
```

**Expected output:**
```json
{
  "models": [
    {
      "name": "qwen2:0.5b:latest",
      "modified_at": "2024-01-01T00:00:00Z",
      "size": 2019393189
    }
  ]
}
```

## 2. Test AI Generation (Native Ollama API)

This is the EXACT format aethermsaid hub uses:

```bash
curl http://localhost:11434/api/generate -d '{
  "model": "qwen2:0.5b",
  "prompt": "Say hello in one sentence",
  "stream": false
}'
```

**Expected output:**
```json
{
  "model": "qwen2:0.5b",
  "created_at": "2024-01-01T00:00:00.000000000Z",
  "response": "Hello! How can I assist you today?",
  "done": true,
  "context": [...]
}
```

## 3. Compare with OpenAI-Compatible Format

Newer Ollama (v0.1.17+) also supports this, but we DON'T use it for compatibility:

```bash
curl http://localhost:11434/v1/chat/completions -d '{
  "model": "qwen2:0.5b",
  "messages": [{"role": "user", "content": "Hi"}],
  "stream": false
}'
```

If you get `404 Not Found` for the `/v1/chat/completions` endpoint, your Ollama version is old. **This is fine** - aethermsaid hub uses the native API that works everywhere.

## Troubleshooting

### "Connection refused"
```bash
# Check if Ollama is running
ps aux | grep ollama

# Start Ollama
ollama serve
```

### "model not found"
```bash
# List available models
ollama list

# Pull the model
ollama pull qwen2:0.5b
```

### Test in Chrome/Browser

Open Chrome DevTools Console and paste:

```javascript
fetch('http://localhost:11434/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'qwen2:0.5b',
    prompt: 'Hello',
    stream: false
  })
})
.then(r => r.json())
.then(d => console.log('Response:', d.response))
.catch(e => console.error('Error:', e));
```

**If this works in Chrome but fails in the app**, the issue is likely:
1. Different Ollama URL (check Settings)
2. Model name mismatch (check spelling)
3. Ollama not accessible from Electron (firewall/network)

## What aethermsaid hub Does

1. **Test Connection**: `GET /api/tags` → Lists models
2. **AI Call**: `POST /api/generate` → Gets AI response
3. **Parse Response**: Extracts `data.response` field

This is the SAME as what works in Chrome/curl!
