import { client } from './client';
import type { Anomaly, AssistantResponse, ReorderRecommendation, StockPrediction } from '@/types';

export async function askAssistant(message: string): Promise<AssistantResponse> {
  const { data } = await client.post<AssistantResponse>('/ai/assistant', { message });
  return data;
}

export async function getPredictions(): Promise<StockPrediction[]> {
  const { data } = await client.get<StockPrediction[]>('/ai/stockout-prediction');
  return data;
}

export async function getReorderRecommendations(): Promise<ReorderRecommendation[]> {
  const { data } = await client.get<ReorderRecommendation[]>('/ai/reorder-recommendation');
  return data;
}

export async function getAnomalies(): Promise<Anomaly[]> {
  const { data } = await client.get<Anomaly[]>('/ai/anomalies');
  return data;
}
