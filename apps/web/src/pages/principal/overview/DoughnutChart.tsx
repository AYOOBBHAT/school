import { DoughnutChartProps } from '../types';

export function DoughnutChart({ title, breakdown, colors = {
  male: '#3B82F6', // blue
  female: '#EC4899', // pink
  other: '#10B981', // green
  unknown: '#9CA3AF', // gray
} }: DoughnutChartProps) {
  const size = 200;
  const strokeWidth = 40;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  const data = [
    { label: 'Male', value: breakdown.male, color: colors.male },
    { label: 'Female', value: breakdown.female, color: colors.female },
    { label: 'Other', value: breakdown.other, color: colors.other },
    { label: 'Not Specified', value: breakdown.unknown, color: colors.unknown },
  ].filter(item => item.value > 0);

  // Calculate angles and paths for each segment
  let currentAngle = -90; // Start at top (12 o'clock)

  const segments = data.map((item) => {
    const percentage = breakdown.total > 0 ? (item.value / breakdown.total) : 0;
    const angle = percentage * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    // Calculate arc path
    const startAngleRad = (startAngle * Math.PI) / 180;
    const endAngleRad = (endAngle * Math.PI) / 180;
    
    const x1 = center + radius * Math.cos(startAngleRad);
    const y1 = center + radius * Math.sin(startAngleRad);
    const x2 = center + radius * Math.cos(endAngleRad);
    const y2 = center + radius * Math.sin(endAngleRad);
    
    const largeArcFlag = angle > 180 ? 1 : 0;
    
    const pathData = [
      `M ${center} ${center}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
      'Z',
    ].join(' ');

    return {
      ...item,
      percentage,
      pathData,
    };
  });

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-700 mb-4">{title}</h3>
      <div className="flex flex-col items-center">
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size}>
            {segments.map((segment, index) => (
              <path
                key={index}
                d={segment.pathData}
                fill={segment.color}
                className="transition-all duration-500"
              />
            ))}
            {breakdown.total === 0 && (
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke="#E5E7EB"
                strokeWidth={strokeWidth}
              />
            )}
            {/* Inner circle to create doughnut effect */}
            <circle
              cx={center}
              cy={center}
              r={radius - strokeWidth}
              fill="white"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900">{breakdown.total}</div>
              <div className="text-xs text-gray-500 mt-1">Total</div>
            </div>
          </div>
        </div>
        <div className="mt-6 w-full max-w-xs">
          <div className="grid grid-cols-2 gap-3">
            {data.map((item, index) => (
              <div key={index} className="flex items-center space-x-2">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-700 truncate">{item.label}</div>
                  <div className="text-xs text-gray-500">
                    {item.value} ({breakdown.total > 0 ? ((item.value / breakdown.total) * 100).toFixed(1) : 0}%)
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
