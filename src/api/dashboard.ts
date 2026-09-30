import { client } from './client';
import type {
  Alert,
  AlertType,
  AnalyticsData,
  CategoryBreakdown,
  DashboardData,
  DeadStockItem,
  TrendPoint,
} from '@/types';

export async function getDashboard(): Promise<DashboardData> {
  const { data } = await client.get<DashboardData>('/dashboard');
  return data;
}

export async function getAlerts(type?: AlertType): Promise<Alert[]> {
  const { data } = await client.get<Alert[]>('/alerts', { params: { type } });
  return data;
}

export async function getAnalytics(days: number): Promise<AnalyticsData> {
  const [trends, deadStock, categoryBreakdown] = await Promise.all([
    client.get<TrendPoint[]>('/analytics/trends', { params: { days } }),
    client.get<DeadStockItem[]>('/analytics/dead-stock'),
    client.get<CategoryBreakdown[]>('/analytics/turnover'),
  ]);
  return {
    trends: trends.data,
    deadStock: deadStock.data,
    categoryBreakdown: categoryBreakdown.data,
  };
}
