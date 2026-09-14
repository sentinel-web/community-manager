import { Typography } from 'antd';
import React, { useMemo } from 'react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { ATTENDANCE_STATUS_META } from '../../api/attendance/status';
import type { AttendanceStatus } from '../../api/types/shared';
import { useTranslation } from '../../i18n/LanguageContext';

interface AttendanceBreakdownData {
  present: number;
  zeus: number;
  excused: number;
  absent: number;
}

// Breakdown bucket → attendance status; label and color come from the shared
// status map (#365). Cancelled events are not part of the breakdown.
const BREAKDOWN_STATUSES: readonly [keyof AttendanceBreakdownData, AttendanceStatus][] = [
  ['present', 1],
  ['zeus', 2],
  ['excused', 0],
  ['absent', -1],
];

interface AttendancePieChartProps {
  data: AttendanceBreakdownData;
  title: string;
}

export default function AttendancePieChart({ data, title }: AttendancePieChartProps) {
  const { t } = useTranslation();
  const chartData = useMemo(
    () =>
      BREAKDOWN_STATUSES.map(([bucket, status]) => ({
        name: t(ATTENDANCE_STATUS_META[status].labelKey),
        value: data[bucket],
        color: ATTENDANCE_STATUS_META[status].chartColor,
      })).filter(d => d.value > 0),
    [data, t]
  );

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
