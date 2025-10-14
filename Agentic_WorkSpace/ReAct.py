from typing import Annotated, Sequence, TypedDict
from dotenv import load_dotenv
from langchain_core.messages import BaseMessage, ToolMessage, SystemMessage
from langchain_core.tools import tool
from langgraph.graph.message import add_messages
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
import google.generativeai as genai
import os

# --- Load environment variables ---
load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# --- Define state ---
class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add_messages]

# --- Define tools ---
@tool
def add(a: int, b: int):
    """Adds two numbers."""
    return a + b

@tool
def subtract(a: int, b: int):
    """Subtracts two numbers."""
    return a - b

@tool
def multiply(a: int, b: int):
    """Multiplies two numbers."""
    return a * b

tools = [add, subtract, multiply]

# --- Gemini LLM wrapper ---
class GeminiLLM:
    def __init__(self, model="gemini-2.5-flash"):
        self.model = genai.GenerativeModel(model)

    def invoke(self, messages: list[BaseMessage]):
        """Simulates LangChain's invoke method."""
        # Combine all messages into one prompt
        prompt = "\n".join(
            [f"{m.type.upper()}: {getattr(m, 'content', str(m))}" for m in messages]
        )
        response = self.model.generate_content(prompt)
        return SystemMessage(content=response.text)

# --- Initialize Gemini model ---
model = GeminiLLM()

# --- Model call node ---
def model_call(state: AgentState) -> AgentState:
    system_prompt = SystemMessage(
        content="You are my AI assistant. Solve the math first, then reply helpfully to the user."
    )
    response = model.invoke([system_prompt] + state["messages"])
    return {"messages": [response]}

# --- Decide next step ---
def should_continue(state: AgentState):
    messages = state["messages"]
    last_message = messages[-1]
    # Gemini does not yet emit structured tool calls, so we simulate end condition
    return "end"

# --- Build the LangGraph ---
graph = StateGraph(AgentState)
graph.add_node("our_agent", model_call)
tool_node = ToolNode(tools=tools)
graph.add_node("tools", tool_node)

graph.set_entry_point("our_agent")

graph.add_conditional_edges(
    "our_agent",
    should_continue,
    {
        "continue": "tools",
        "end": END,
    },
)

graph.add_edge("tools", "our_agent")

app = graph.compile()

# --- Stream + print ---
def print_stream(stream):
    for s in stream:
        message = s["messages"][-1]
        if isinstance(message, tuple):
            print(message)
        else:
            print(f"{message.content}\n")

inputs = {
    "messages": [("user", "Add 40 + 12 and then multiply the result by 6. Also tell me a dark joke please.")]
}

print_stream(app.stream(inputs, stream_mode="values"))


