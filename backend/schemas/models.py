from pydantic import BaseModel

# Pydantic schema for the incoming chat request
class ChatRequest(BaseModel):
    message: str
    # You can append chat history lists here later for multi-turn context