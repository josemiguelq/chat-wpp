import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { AgentExecutor, createOpenAIToolsAgent } from "langchain/agents";
import { pull } from "langchain/hub";
import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { StateGraph } from "@langchain/langgraph";
import { Annotation } from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { MongoClient } from "mongodb";
import { z } from "zod";

export async function callAgent(client: MongoClient, query: string, thread_id: string) {
  const dbName = "store_wpp_database";
  const db = client.db(dbName);
  const collection = db.collection("products");

  const GraphState = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
      reducer: (x, y) => x.concat(y),
    }),
  });

  const ProductLookupTool = tool(
    async ({ query, n = 10 }) => {
      console.log("Products lookup tool called");

      const dbConfig = {
        collection: collection,
        indexName: "vector_index",
        textKey: "embedding_text",
        embeddingKey: "embedding",
      };

      const vectorStore = new MongoDBAtlasVectorSearch(
        new OpenAIEmbeddings(),
        dbConfig
      );            
      
      const result = await vectorStore.similaritySearchWithScore(query, n);      
      return JSON.stringify(result);
    },
    {
      name: "product_lookup",
      description: "Gathers product details from the Store database",
      schema: z.object({
        query: z.string().describe("The search query"),
        n: z
          .number()
          .optional()
          .default(10)
          .describe("Number of results to return"),
      }),
    }
  );

  const tools = [ProductLookupTool];
  const toolNode = new ToolNode<typeof GraphState.State>(tools);

  const model = new ChatOpenAI({
    modelName: "gpt-4-1106-preview", // ou "gpt-4-turbo", "gpt-3.5-turbo", etc.
    temperature: 0,
    openAIApiKey: process.env.OPENAI_API_KEY,
  }).bindTools(tools);

  function shouldContinue(state: typeof GraphState.State) {
    const messages = state.messages;
    const lastMessage = messages[messages.length - 1] as AIMessage;
    if (lastMessage.tool_calls?.length) {
      return "tools";
    }
    return "__end__";
  }

  async function callModel(state: typeof GraphState.State) {
    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        `Você é um vendedor chamado Joel e atende numa loja de venda de peças de celular no Camelodromo Box 387 e deve responder em portugues. Use the provided tools to progress towards answering the question. If you are unable to fully answer, that's OK, another assistant with different tools will help where you left off. Execute what you can to make progress. If you or any of the other assistants have the final answer or deliverable, prefix your response with FINAL ANSWER so the team knows to stop. You have access to the following tools: {tool_names}.\n{system_message}\nCurrent time: {time}."`,
      ],
      new MessagesPlaceholder("messages"),
    ]);

    const formattedPrompt = await prompt.formatMessages({
      system_message: 'Você é um vendedor que o objetivo é fechar uma venda com um ou mais produtos. Seja sucinto e retorne apenas os preços das variations (MensagemFixa) e no inicio da mensagem coloque o modelo. Substitua \n por una nova linha. Retorne apenas MensagemFixa sem adicionar mais nada. Caso voce nao entenda alguma mensagem responda apenas com "vish, nao sei se entendi". Caso voce nao encontré o produto, responda "No momento esta faltando',
      time: new Date().toISOString(),
      tool_names: tools.map((tool) => tool.name).join(", "),
      recursionLimit: 30, configurable: { thread_id: thread_id },
      messages: state.messages,
    });

    const result = await model.invoke(formattedPrompt);

    return { messages: [result] };
  }

  const workflow = new StateGraph(GraphState)
    .addNode("agent", callModel)
    .addNode("tools", toolNode)
    .addEdge("__start__", "agent")
    .addConditionalEdges("agent", shouldContinue)
    .addEdge("tools", "agent");

  const checkpointer = new MongoDBSaver({ client, dbName });

  const app = workflow.compile({ checkpointer });

  const finalState = await app.invoke(
    {
      messages: [new HumanMessage(query)],
    },
    { recursionLimit: 15, configurable: { thread_id: thread_id } }
  );

  console.log(finalState.messages[finalState.messages.length - 1].content);

  return finalState.messages[finalState.messages.length - 1].content;
}
