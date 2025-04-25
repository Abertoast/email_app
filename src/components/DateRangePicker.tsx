import React from 'react';

interface DateRangePickerProps {
  value: string;
  onChange: (value: string) => void;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({ value, onChange }) => {
  const options = [
    { value: 'today', label: 'Today' },
    { value: 'last24hours', label: 'Last 24 Hours' },
    { value: 'last7days', label: 'Last 7 Days' },
    { value: 'last30days', label: 'Last 30 Days' },
    { value: 'custom', label: 'Custom Range' },
  ];
  
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors duration-200 ${
            value === option.value
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

export default DateRangePicker;