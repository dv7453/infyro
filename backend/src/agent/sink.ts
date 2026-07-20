export type AgentEventSink = {
  onToken?(content: string): void;
  onToolCallStarted?(toolName: string): void;
  onToolResult?(toolName: string, success: boolean, summary: string): void;
  onConfirmationRequired?(
    toolName: string,
    params: Record<string, unknown>,
    summary: string,
  ): void;
  onMessageComplete?(): void;
  onError?(message: string): void;
};
