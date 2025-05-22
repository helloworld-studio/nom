const fs = require("fs");
const path = require("path");
const axios = require("axios");

class Agent {
    constructor() {
        const characterPath = path.join(__dirname, "character.json");
        this.character = JSON.parse(fs.readFileSync(characterPath, "utf-8"));
    }

    async analyzeTransaction(transaction) {
        try {
            const highMarketCapThreshold = 5; // SOL
            const highInitialBuyThreshold = 1000000; // Tokens

            if (transaction.marketCapSol < highMarketCapThreshold && 
                transaction.initialBuy < highInitialBuyThreshold) {
                return {
                    success: true,
                    data: "No significant data to analyze. This token is as exciting as watching paint dry. 🎨"
                };
            }

            const prompt = `You are a ${this.character.personality} ${this.character.role} named "${this.character.name}". Your job is to ${this.character.task} and provide ${this.character.tone} insights. ${this.character.instructions.join(" ")}

Here's the token data:
- Name: ${transaction.name}
- Symbol: ${transaction.symbol}
- Initial Buy: ${transaction.initialBuy}
- Sol Amount: ${transaction.solAmount}
- Market Cap: ${transaction.marketCapSol} SOL (not dollars!)
${transaction.creator ? `- Creator: ${transaction.creator}` : ''}
${transaction.decimals ? `- Decimals: ${transaction.decimals}` : ''}`;

            const llmApiEndpoint = process.env.LLM_API_ENDPOINT || "https://api.deepseek.com/v1/chat/completions";
            
            const response = await axios.post(
                llmApiEndpoint,
                {
                    model: "deepseek-chat",
                    messages: [
                        {
                            role: "system",
                            content: `You are a ${this.character.personality} ${this.character.role} named ${this.character.name}. Your responses are ${this.character.tone}. ${this.character.instructions.join(" ")}`,
                        },
                        {
                            role: "user",
                            content: prompt,
                        },
                    ],
                    max_tokens: 150,
                },
                {
                    headers: {
                        Authorization: `Bearer ${process.env.LLM_API_KEY}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            return {
                success: true,
                data: response.data.choices[0].message.content
            };
        } catch (error) {
            console.error(
                "Error calling LLM API:",
                error.response ? error.response.data : error.message
            );
            throw error;
        }
    }
}

module.exports = Agent; 