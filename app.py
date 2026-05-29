import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import cohere
from dotenv import load_dotenv
from llm_adapters.cohere_prompts import GYMBRO_SYSTEM_PROMPT
from schemas.models import ChatRequest

# Load environment variables
load_dotenv()

COHERE_API_KEY = os.getenv("COHERE_API_KEY")
if not COHERE_API_KEY:
    raise ValueError("Missing COHERE_API_KEY in environment variables.")

# Initialize Cohere Client (V2 SDK interface)
co = cohere.ClientV2(api_key=COHERE_API_KEY)

app = FastAPI(title="GymBro AI Backend")

# Enable CORS for your friend's local frontend server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, swap "*" for your specific frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def cohere_stream_generator(user_message: str):
    """Generates streamed text chunks directly from Cohere's API."""
    try:
        # Construct the conversation state with the system prompt
        messages = [
            {"role": "system", "content": GYMBRO_SYSTEM_PROMPT},
            {"role": "user", "content": user_message}
        ]
        
        # Call the streaming endpoint using an efficient, fast model
        response = co.chat_stream(
            model="command-a-plus-05-2026", 
            messages=messages
        )
        
        for event in response:
            # Cohere V2 SDK emits 'content-delta' events for streaming tokens
            if event.type == "content-delta":
                text_chunk = event.delta.message.content.text
                if text_chunk is not None:
                    yield text_chunk
                
    except Exception as e:
        yield f"\n[Backend Error: {str(e)}]"

@app.post("/api/chat")
async def chat_endpoint(payload: ChatRequest):
    """
    POST endpoint that takes the user message and returns a text stream.
    Your friend's React application will read this stream chunk-by-chunk.
    """
    return StreamingResponse(
        cohere_stream_generator(payload.message), 
        media_type="text/plain"
    )