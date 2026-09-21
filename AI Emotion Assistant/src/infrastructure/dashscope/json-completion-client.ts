import { ApplicationError } from "../../application/errors.js";

export interface JsonSchemaSpec {
  readonly name: string;
  readonly schema: Readonly<Record<string, unknown>>;
}

export interface JsonCompletionRequest {
  readonly model: string;
  readonly messages: readonly {
    readonly role: "system" | "user" | "assistant";
    readonly content: string;
  }[];
  readonly responseSchema: JsonSchemaSpec;
  readonly temperature: number;
  readonly maxCompletionTokens: number;
}

export interface JsonCompletionClientPort {
  completeJson(request: JsonCompletionRequest): Promise<unknown>;
}

type FetchPort = typeof fetch;
type SleepPort = (milliseconds: number) => Promise<void>;

export interface DashscopeJsonClientOptions {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly maxRetries: number;
  readonly fetchImplementation?: FetchPort;
  readonly sleep?: SleepPort;
}

interface ChatCompletionEnvelope {
  choices?: Array<{
    finish_reason?: string;
    message?: { content?: string };
  }>;
}

const defaultSleep: SleepPort = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export class DashscopeJsonClient implements JsonCompletionClientPort {
  private readonly fetchImplementation: FetchPort;
  private readonly sleep: SleepPort;
  private readonly endpoint: string;

  constructor(private readonly options: DashscopeJsonClientOptions) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.sleep = options.sleep ?? defaultSleep;
    this.endpoint = `${options.baseUrl.replace(/\/+$/u, "")}/chat/completions`;
  }

  async completeJson(request: JsonCompletionRequest): Promise<unknown> {
    for (let attempt = 0; attempt <= this.options.maxRetries; attempt += 1) {
      try {
        return await this.performRequest(request);
      } catch (error) {
        const retryable = this.isRetryable(error);
        if (!retryable || attempt >= this.options.maxRetries) {
          if (error instanceof ProviderHttpError) {
            if (error.status === 429 || error.status >= 500) {
              throw new ApplicationError(
                "MODEL_PROVIDER_UNAVAILABLE",
                "The model provider is temporarily unavailable.",
                503,
              );
            }
            throw new ApplicationError(
              "MODEL_RESPONSE_INVALID",
              "The model provider rejected the structured request.",
              502,
            );
          }
          throw error;
        }
        await this.sleep(200 * 2 ** attempt);
      }
    }

    throw new ApplicationError(
      "MODEL_PROVIDER_UNAVAILABLE",
      "The model provider is temporarily unavailable.",
      503,
    );
  }

  private async performRequest(request: JsonCompletionRequest): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);

    try {
      const response = await this.fetchImplementation(this.endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.options.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          enable_thinking: false,
          temperature: request.temperature,
          max_completion_tokens: request.maxCompletionTokens,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: request.responseSchema.name,
              strict: true,
              schema: request.responseSchema.schema,
            },
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new ApplicationError(
            "MODEL_PROVIDER_AUTH_FAILED",
            "The model provider rejected the configured credentials.",
            503,
          );
        }
        throw new ProviderHttpError(response.status);
      }

      let envelope: ChatCompletionEnvelope;
      try {
        envelope = (await response.json()) as ChatCompletionEnvelope;
      } catch {
        throw new ApplicationError(
          "MODEL_RESPONSE_INVALID",
          "The model provider returned an invalid response envelope.",
          502,
        );
      }
      const choice = envelope.choices?.[0];
      if (choice?.finish_reason === "length") {
        throw new ApplicationError(
          "MODEL_RESPONSE_INVALID",
          "The model response exceeded the configured output limit.",
          502,
        );
      }

      const content = choice?.message?.content;
      if (typeof content !== "string" || content.length === 0) {
        throw new ApplicationError(
          "MODEL_RESPONSE_INVALID",
          "The model provider returned an invalid response envelope.",
          502,
        );
      }

      try {
        return JSON.parse(content) as unknown;
      } catch {
        throw new ApplicationError(
          "MODEL_RESPONSE_INVALID",
          "The model provider returned malformed structured content.",
          502,
        );
      }
    } catch (error) {
      if (error instanceof ApplicationError || error instanceof ProviderHttpError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new ApplicationError(
          "MODEL_REQUEST_TIMEOUT",
          "The model provider request timed out.",
          503,
        );
      }
      throw new ApplicationError(
        "MODEL_PROVIDER_UNAVAILABLE",
        "The model provider is temporarily unavailable.",
        503,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private isRetryable(error: unknown): boolean {
    if (error instanceof ProviderHttpError) {
      return error.status === 429 || error.status >= 500;
    }
    return (
      error instanceof ApplicationError &&
      (error.code === "MODEL_PROVIDER_UNAVAILABLE" || error.code === "MODEL_REQUEST_TIMEOUT")
    );
  }
}

class ProviderHttpError extends Error {
  constructor(readonly status: number) {
    super("Model provider HTTP request failed.");
    this.name = "ProviderHttpError";
  }
}
