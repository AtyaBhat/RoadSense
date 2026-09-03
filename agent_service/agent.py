from schemas import DamageReport
from tools import estimate_severity, check_duplicate
from langchain_groq import ChatGroq
from typing import Annotated, Optional
from langchain_core.messages import HumanMessage, SystemMessage
from typing_extensions import TypedDict
from langgraph.graph.message import add_messages
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import ToolNode, tools_condition
from langgraph.checkpoint.memory import MemorySaver
import os
import uuid
from dotenv import load_dotenv
load_dotenv()

langsmith_key = os.getenv("LANGCHAIN_API_KEY")
if langsmith_key:
    os.environ["LANGCHAIN_API_KEY"] = langsmith_key
    os.environ["LANGCHAIN_TRACING_V2"] = "true"
    os.environ["LANGCHAIN_PROJECT"] = "Pothole"
groq_api_key = os.getenv("GROQ_API_KEY")                    


### Define Tools
tools = [estimate_severity,check_duplicate]

### Create Agents with tool and one with structured output
llm = ChatGroq(model_name="qwen/qwen3.8-27b",groq_api_key=groq_api_key) #reasoning_effort="none"

### Bind LLM to tools
tool_llm = llm.bind_tools(tools)
structured_llm = llm.with_structured_output(DamageReport)

### Creat Architechtre
class State(TypedDict):
    messages: Annotated[list, add_messages]
    report: Optional[DamageReport]

### Create agents
def tool_calling_llm(state: State):
    response = tool_llm.invoke(state["messages"])
    return {"messages": [response]}

def structured_report_node(state: State):
    response = structured_llm.invoke([SystemMessage(
        content="""Generate the final DamageReport.
                    Use the tool outputs if available.
                    Do not call any tools.
                    Return only a valid DamageReport.
                """
        ),
        *state["messages"],])
    return {"report": response}

### Add custom Tool Decider as first agent may or may not call tool so we need to handle case so 
### that if tool is not called still call should pass to structured_llm
def router(state):
    if tools_condition(state) == "tools":
        return "tools"
    return "structured_output"

## Graph
memory = MemorySaver()
builder=StateGraph(State)
builder.add_node("tool_calling_llm",tool_calling_llm)
builder.add_node("tools",ToolNode(tools))
builder.add_node("structured_output",structured_report_node)
## Add Edges
builder.add_edge(START, "tool_calling_llm")
builder.add_conditional_edges("tool_calling_llm",router,
    {
        "tools": "tools",
        "structured_output": "structured_output",
    }
)
builder.add_edge("tools","tool_calling_llm")
builder.add_edge("structured_output",END)

## compile the graph
graph=builder.compile(checkpointer=memory)

def generate_report(detections: list, location: str) -> DamageReport:
    prompt = f"""
        Location:
        {location}

        YOLO detections:
        {detections}

        You are an AI assistant that generates civic issue reports.

        You may use the available tools to:
        - estimate severity
        - check duplicate reports

        If sufficient information is available,
        use the tools before generating the report.

        Return the final report.
        """

    # Unique thread_id per call so reports never share memory/context
    config = {"configurable": {"thread_id": str(uuid.uuid4())}}

    state = graph.invoke(
        {"messages": [HumanMessage(content=prompt)], "report": None},
        config=config,
    )

    return state["report"]

