import { Injectable, BadRequestException } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { ChatMessageDto } from './dto/chat.dto';
import { buildQueryPlannerPrompt, buildQueryPlannerUserContext } from './assistant-prompts';
import { AiDataToolsService, UserScope } from './ai-data-tools.service';

export interface QueryPlan {
  tools: Array<{
    name: string;
    params: Record<string, any>;
  }>;
  reasoning: string;
}

@Injectable()
export class QueryPlannerService {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly aiDataToolsService: AiDataToolsService,
  ) {}

  private detectProvider(apiUrl: string): string {
    try {
      const parsedUrl = new URL(apiUrl);
      const hostname = parsedUrl.hostname;

      if (['localhost', '127.0.0.1', '::1'].includes(hostname.toLowerCase()) || this.isPrivateNetwork(hostname)) {
        return 'ollama';
      }

      if (hostname === 'openrouter.ai' || hostname.endsWith('.openrouter.ai')) return 'openrouter';
      if (hostname === 'api.openai.com' || hostname.endsWith('.api.openai.com')) return 'openai';
      if (hostname === 'api.anthropic.com' || hostname.endsWith('.api.anthropic.com')) return 'anthropic';
      if (hostname === 'generativelanguage.googleapis.com' || hostname.endsWith('.generativelanguage.googleapis.com')) return 'google';
    } catch (e) {
      console.log(e);
    }
    return 'custom';
  }

  private isPrivateNetwork(hostname: string): boolean {
    const privateIPv4Pattern = /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2[0-9]|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})$/;
    return privateIPv4Pattern.test(hostname);
  }

  validateApiUrl(apiUrl: string): string {
    let url: URL;
    try {
      url = new URL(apiUrl);
    } catch {
      throw new BadRequestException('Invalid URL format');
    }

    const allowHttp = ['localhost', '127.0.0.1', '::1'].includes(url.hostname.toLowerCase()) || this.isPrivateNetwork(url.hostname);

    if (url.protocol !== 'https:' && !allowHttp) {
      throw new BadRequestException('Only HTTPS URLs allowed (HTTP is permitted for localhost and private network addresses)');
    }

    return url.toString().replace(/\/$/, '');
  }

  async planQuery(message: string, userScope: UserScope, userId: string, organizationId?: string): Promise<QueryPlan | null> {
    try {
      const [apiKey, model, rawApiUrl] = await Promise.all([
        this.settingsService.get('ai_api_key', userId),
        this.settingsService.get('ai_model', userId, 'deepseek/deepseek-chat-v3-0324:free'),
        this.settingsService.get('ai_api_url', userId, 'https://openrouter.ai/api/v1'),
      ]);

      const apiUrl = rawApiUrl ? this.validateApiUrl(rawApiUrl) : 'https://openrouter.ai/api/v1';
      const provider = this.detectProvider(apiUrl);

      if (!apiKey && provider !== 'ollama') {
        throw new BadRequestException('AI API key not configured. Please set it in settings.');
      }

      const toolCatalog = this.aiDataToolsService.buildToolCatalog(userScope);
      const systemPrompt = buildQueryPlannerPrompt(userScope, toolCatalog);
      
      const accessibleProjectContext = await this.aiDataToolsService.getAccessibleProjectsContext(userScope);
      const userMessage = buildQueryPlannerUserContext(message, accessibleProjectContext);

      const messages: ChatMessageDto[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ];

      const isGpt5Model = typeof model === 'string' && model.startsWith('gpt-5');

      let requestUrl = apiUrl;
      const requestHeaders: any = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      };
      
      let requestBody: any = {
        model,
        messages,
        temperature: 0.1, // Low temp for more deterministic JSON
        max_tokens: 800,
        stream: false,
        response_format: { type: 'json_object' } // Request JSON format if supported
      };

      // Adjust for providers
      switch (provider) {
        case 'openrouter':
          requestUrl = `${apiUrl}/chat/completions`;
          requestHeaders['HTTP-Referer'] = process.env.APP_URL || 'http://localhost:3000';
          requestHeaders['X-Title'] = 'mktask AI Assistant';
          break;
        case 'openai':
          requestUrl = `${apiUrl}/chat/completions`;
          delete requestBody.max_tokens;
          requestBody.max_completion_tokens = 800;
          if (isGpt5Model) {
            delete requestBody.temperature;
          }
          break;
        case 'ollama':
          if (apiUrl.includes('/v1')) {
            requestUrl = apiUrl.endsWith('/chat/completions') ? apiUrl : `${apiUrl}/chat/completions`;
          } else if (apiUrl.includes('/api')) {
            requestUrl = apiUrl.endsWith('/chat') ? apiUrl : `${apiUrl}/chat`;
          } else {
            requestUrl = `${apiUrl}/v1/chat/completions`;
          }
          delete requestHeaders['Authorization'];
          break;
        case 'anthropic':
          requestUrl = `${apiUrl}/messages`;
          requestHeaders['x-api-key'] = apiKey;
          requestHeaders['anthropic-version'] = '2023-06-01';
          delete requestHeaders['Authorization'];
          delete requestBody.response_format; // Anthropic doesn't support this natively in the same way
          requestBody = {
            model,
            messages: messages.filter((m) => m.role !== 'system'),
            system: messages.find((m) => m.role === 'system')?.content,
            max_tokens: 800,
            temperature: 0.1,
          };
          break;
        case 'google':
          requestUrl = `${apiUrl}/models/${encodeURIComponent(String(model))}:generateContent?key=${encodeURIComponent(apiKey || '')}`;
          delete requestHeaders['Authorization'];
          delete requestBody.response_format;
          requestBody = {
            contents: messages.map((m) => ({
              role: m.role === 'assistant' ? 'model' : m.role == 'system' ? 'model' : m.role,
              parts: [{ text: m.content }],
            })),
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 800,
              responseMimeType: "application/json",
            },
          };
          break;
        default:
          requestUrl = `${apiUrl}/chat/completions`;
          break;
      }

      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        console.error(`Query Planner API failed with status ${response.status}`);
        return null;
      }

      const data = await response.json();
      let aiMessage = '';

      switch (provider) {
        case 'anthropic':
          aiMessage = data.content?.[0]?.text || '';
          break;
        case 'google':
          aiMessage = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          break;
        default:
          aiMessage = data.choices?.[0]?.message?.content || '';
          break;
      }

      // Clean markdown formatting if present
      if (aiMessage.startsWith('\`\`\`json')) {
        aiMessage = aiMessage.replace(/^\`\`\`json\s*/, '').replace(/\s*\`\`\`$/, '');
      } else if (aiMessage.startsWith('\`\`\`')) {
        aiMessage = aiMessage.replace(/^\`\`\`\s*/, '').replace(/\s*\`\`\`$/, '');
      }

      try {
        const parsedPlan = JSON.parse(aiMessage);
        return this.validatePlan(parsedPlan, userScope);
      } catch (e) {
        console.error('Failed to parse Query Planner JSON output:', aiMessage, e);
        return null; // Fallback will happen in caller
      }

    } catch (error) {
      console.error('Query Planner execution failed:', error);
      return null;
    }
  }

  private validatePlan(plan: any, userScope: UserScope): QueryPlan | null {
    if (!plan || !Array.isArray(plan.tools)) return null;
    
    // Basic validation
    const validTools = plan.tools.filter((tool: any) => 
      tool && typeof tool.name === 'string' && typeof tool.params === 'object'
    );

    if (validTools.length === 0) return null;

    return {
      tools: validTools,
      reasoning: typeof plan.reasoning === 'string' ? plan.reasoning : 'No reasoning provided'
    };
  }
}
