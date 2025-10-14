from typing import TypedDict, List
from langchain_core.messages import HumanMessage
from langgraph.graph import StateGraph, START, END
from dotenv import load_dotenv
import google.generativeai as genai
import os

# Load environment variables 
load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))


class AgentState(TypedDict):
    messages: List[HumanMessage]


class GeminiLLM:
    def __init__(self, model="gemini-2.5-flash"):
        self.model = genai.GenerativeModel(model)

    def invoke(self, messages: List[HumanMessage]):
        # Combine all messages into a single prompt
        prompt = "\n".join([m.content for m in messages])
        response = self.model.generate_content(prompt)
        return response.text

llm = GeminiLLM()

# --- Node function for the graph ---
def process(state: AgentState) -> AgentState:
    response_text = llm.invoke(state["messages"])
    print(f"\nAI: {response_text}")
    return state

# --- Build the LangGraph ---
g = StateGraph(AgentState)
g.add_node("process", process)
g.add_edge(START, "process")
g.add_edge("process", END)
agent = g.compile()

# --- Chat Loop ---
user_input = input("Enter: ")
while user_input.lower() != "exit":
    agent.invoke({"messages": [HumanMessage(content=user_input)]})
    user_input = input("Enter: ")
