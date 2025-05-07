import 'dotenv/config';
import express, { Express, Request, Response } from "express";
import { MongoClient } from "mongodb";
import { callAgent } from './agent';
import { create, list } from './src/controllers/products'

const app: Express = express();
app.use(express.json());

// Initialize MongoDB client
const client = new MongoClient(process.env.MONGODB_ATLAS_URI as string);

async function startServer() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    // Set up basic Express route
    // curl -X GET http://localhost:3000/
    app.get('/', (req: Request, res: Response) => {
      res.send('LangGraph Agent Server');
    });

    // API endpoint to start a new conversation
    // curl -X POST -H "Content-Type: application/json" -d '{"message": "Build a team to make an iOS app, and tell me the talent gaps."}' http://localhost:3000/chat
    app.post('/chat', async (req: Request, res: Response) => {      
      const { event, data } = req.body
      if(event == 'messages.upsert' && data.key.fromMe != true) {
        const initialMessage = data.message.conversation;
        const remoteJid = data.key.remoteJid;
        const jobId = remoteJid.split("-")[0]
        const phoneNumber = jobId.length === 12 ? jobId.slice(0, 4) + "9" + jobId.slice(4) : jobId;

        const threadId = Date.now().toString(); // Simple thread ID generation
        try {
          const response = await callAgent(client, initialMessage, phoneNumber);
          
          const options = {
            method: 'POST',
            headers: {
              apikey: '429683C4C977415CAAFCCE10F7D57E11',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              number: phoneNumber,
              text: response,
              // message: {
              //   conversation: "mensagem aqui", 
              // },
            }),
          };
          
          try {
            const res = await fetch('https://evo.quisbert.com.br/message/sendText/MiguelTest', options);
            const data = await res.json();
            console.log(data);
          } catch (err) {
            console.error("Erro ao enviar mensagem:", err);
          }
            
          res.json({ threadId, response });
        } catch (error) {
          console.error('Error starting conversation:', error);
          res.status(500).json({ error: 'Internal server error' });
        }
      }      
    });

    // API endpoint to send a message in an existing conversation
    // curl -X POST -H "Content-Type: application/json" -d '{"message": "What team members did you recommend?"}' http://localhost:3000/chat/123456789
    app.post('/chat/:threadId', async (req: Request, res: Response) => {
      const { threadId } = req.params;
      const { message } = req.body;
      try {
        const response = await callAgent(client, message, threadId);
        res.json({ response });
      } catch (error) {
        console.error('Error in chat:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.post('/api/products/batch', create);

    app.get('api/products', list)

    app.get('/health', async (req: Request, res: Response) => {
      console.log('WebhookHealth')
      res.json({ status: 'ok' });
    });

    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
}

startServer();
