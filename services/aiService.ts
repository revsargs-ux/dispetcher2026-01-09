
import { GoogleGenAI } from "@google/genai";

/**
 * Вспомогательная функция для выполнения запросов с повторными попытками
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 2, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0 && (error?.status === 'INTERNAL' || error?.message?.includes('500') || error?.message?.includes('Internal error'))) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

/**
 * ГЛУБОКИЙ БИЗНЕС-АУДИТ
 */
export const analyzeSystemHealth = async (data: { 
  stats: any, 
  orders: any[] 
}) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Экстремальное сжатие данных для предотвращения 500 ошибок
  const statsSummary = `Workers: ${data.stats.total_workers}, Rating: ${data.stats.avg_rating.toFixed(1)}, Orders: ${data.stats.orders_count}`;
  const clients = Array.from(new Set(data.orders.slice(0, 10).map(o => o.client_name))).join(', ');

  const prompt = `
    Role: Senior Business Consultant for Staffing.
    Context: System "Dispatcher.PRO" in Russia. 
    Rates: Client 550 rub/hr, Worker 400 rub/hr.
    Stats: ${statsSummary}.
    Key Clients: ${clients}.

    Task with Google Search:
    1. Check current average market rates for general labor (грузчики/разнорабочие) in Russia 2024-2025.
    2. Compare with 550 rub/hr.
    3. Suggest retention strategies.

    Format output STRICTLY as:
    SCORE: [0-100]
    SENTIMENT: [Short summary]
    MARKET_ANALYSIS: [Comparison]
    CLIENT_STRATEGIES: [Client: Strategy; ...]
    WORKER_INCENTIVES: [Method: Action; ...]
    KPI_METRICS: [Metric: Value; ...]
  `;

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    const text = response.text || "";
    const result: any = {
      score: 80,
      sentiment: "Анализ завершен",
      market_analysis: "Данные рынка получены",
      client_strategies: [],
      worker_incentives: [],
      kpi_metrics: [],
      citations: []
    };

    const lines = text.split('\n');
    lines.forEach(line => {
      const trimLine = line.trim();
      if (trimLine.startsWith('SCORE:')) result.score = parseInt(trimLine.replace('SCORE:', '').trim()) || 80;
      if (trimLine.startsWith('SENTIMENT:')) result.sentiment = trimLine.replace('SENTIMENT:', '').trim();
      if (trimLine.startsWith('MARKET_ANALYSIS:')) result.market_analysis = trimLine.replace('MARKET_ANALYSIS:', '').trim();
      
      if (trimLine.startsWith('CLIENT_STRATEGIES:')) {
        const parts = trimLine.replace('CLIENT_STRATEGIES:', '').trim().split(';');
        result.client_strategies = parts.filter(p => p.includes(':')).map(p => {
          const [name, strat] = p.split(':');
          return { client_name: name.trim(), strategy: (strat || "").trim(), recommended_rate: "550-600 ₽" };
        });
      }
      
      if (trimLine.startsWith('WORKER_INCENTIVES:')) {
        const parts = trimLine.replace('WORKER_INCENTIVES:', '').trim().split(';');
        result.worker_incentives = parts.filter(p => p.includes(':')).map(p => {
          const [group, action] = p.split(':');
          return { group: group.trim(), action: (action || "").trim() };
        });
      }
      
      if (trimLine.startsWith('KPI_METRICS:')) {
        const parts = trimLine.replace('KPI_METRICS:', '').trim().split(';');
        result.kpi_metrics = parts.filter(p => p.includes(':')).map(p => {
          const [label, val] = p.split(':');
          return { label: label.trim(), value: (val || "").trim() };
        });
      }
    });

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (groundingChunks) {
      result.citations = groundingChunks
        .map((chunk: any) => chunk.web)
        .filter((web: any) => web && web.uri);
    }

    return result;
  });
};

export const generateAIDraft = async (context: {
  workerName: string,
  balance: number,
  lastMessages: any[],
  currentOrder?: any
}) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `System Assistant. Worker: ${context.workerName}, Balance: ${context.balance}. Message context: ${JSON.stringify(context.lastMessages.slice(-2))}. Draft a short, professional response.`;
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { thinkingConfig: { thinkingBudget: 0 } }
    });
    return response.text;
  } catch (error) {
    return "Смена подтверждена, ожидайте информацию по выплате.";
  }
};
