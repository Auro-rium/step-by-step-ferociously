from typing import TypedDict, List, Union
from langchain_core.messages import HumanMessage, AIMessage
import google.generativeai as genai
from langgraph.graph import StateGraph, START, END
from dotenv import load_dotenv
import os

# --- Load environment variables ---
load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))


# --- Define State ---
class AgentState(TypedDict):
    messages: List[Union[HumanMessage, AIMessage]]


# --- Gemini LLM Wrapper ---
class GeminiLLM:
    def __init__(self, model="gemini-2.5-flash"):
        self.model = genai.GenerativeModel(model)

    def invoke(self, messages: List[HumanMessage]):
        # Combine all messages into a single prompt
        prompt = "\n".join([m.content for m in messages])
        response = self.model.generate_content(prompt)
        return response.text


# --- Initialize model ---
llm = GeminiLLM()


# --- Process node ---
def process(state: AgentState) -> AgentState:
    """This node will solve the request you input"""
    response = llm.invoke(state["messages"])
    state["messages"].append(AIMessage(content=response))
    print(f"\nAI: {response}")
    return state


# --- Build the LangGraph ---
g = StateGraph(AgentState)
g.add_node("process", process)
g.add_edge(START, "process")
g.add_edge("process", END)
agent = g.compile()


# --- Conversation Loop ---
conversation_history = []

try:
    user_input = input("Enter: ")
    while user_input.lower() != "exit":
        conversation_history.append(HumanMessage(content=user_input))
        result = agent.invoke({"messages": conversation_history})
        conversation_history = result["messages"]
        user_input = input("Enter: ")

finally:
    # --- Always save conversation ---
    with open("Agentic_WorkSpace/logging.txt", "w") as file:
        file.write("Your convo here:\n\n")
        for message in conversation_history:
            if isinstance(message, HumanMessage):
                file.write(f"You: {message.content}\n")
            elif isinstance(message, AIMessage):
                file.write(f"AI: {message.content}\n\n")
        file.write("End of Convo\n")

    print("\n✅ Conversation saved to logging.txt")
