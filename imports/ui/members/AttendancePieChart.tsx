import { Typography } from 'antd';
import React from 'react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

const ATTENDANCE_COLORS = { present: '#52c41a', zeus: '#1890ff', excused: '#faad14', absent: '#ff4d4f' };

interface AttendanceBreakdownData {
  present: number;
  zeus: number;
  excused: number;
  absent: number;
}

interface AttendancePieChartProps {
  data: AttendanceBreakdownData;
  title: string;
}

export default function AttendancePieChart({ data, title }: AttendancePieChartProps) {
  const chartData = [
    { name: 'Present', value: data.present, color: ATTENDANCE_COLORS.present },
    { name: 'Zeus', value: data.zeus, color: ATTENDANCE_COLORS.zeus },
    { name: 'Excused', value: data.excused, color: ATTENDANCE_COLORS.excused },
    { name: 'Absent', value: data.absent, color: ATTENDANCE_COLORS.absent },
  ].filter(d => d.value > 0);

  if (!chartData.length) return <Typography.Text type="secondary">{title}: -</Typography.Text>;

  return (
    <div>
      <Typography.Text type="secondary">{title}</Typography.Text>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
            {chartData.map(entry => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
