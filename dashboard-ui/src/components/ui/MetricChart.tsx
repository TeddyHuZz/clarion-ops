import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card } from './card';

interface MetricChartProps {
  title: string;
  data: object[];
  dataKey: string;
  color: string;
  unit?: string;
}

export const MetricChart: React.FC<MetricChartProps> = ({
  title,
  data,
  dataKey,
  color,
  unit = '',
}) => {
  return (
    <Card padding="0">
      <div className="ui-chart-container">
        <div className="ui-chart-header">
          <h3 className="ui-chart-title">{title}</h3>
        </div>
        
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid 
              strokeDasharray="3 3" 
              vertical={false} 
              stroke="rgba(255,255,255,0.05)" 
            />
            <XAxis 
              dataKey="timestamp" 
              hide 
            />
            <YAxis 
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => `${value}${unit}`}
            />
            <Tooltip 
              contentStyle={{ 
                background: 'var(--bg-offset)', 
                border: '1px solid var(--surface-border)',
                borderRadius: '12px'
              }}
              labelStyle={{ color: 'var(--text-muted)' }}
              itemStyle={{ color: color }}
              formatter={(value: unknown) => [
                typeof value === 'number' ? `${value.toFixed(2)}${unit}` : String(value),
                title
              ]}
            />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              animationDuration={500}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};
