/**
 * Weight Input Component
 * Input field for setting question weight
 */

'use client';

interface WeightInputProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function WeightInput({ value, onChange, disabled = false }: WeightInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numValue = parseInt(e.target.value, 10);
    if (!isNaN(numValue)) {
      onChange(Math.max(0, Math.min(100, numValue)));
    }
  };

  const handleBlur = () => {
    if (value < 0) onChange(0);
    if (value > 100) onChange(100);
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min="0"
        max="100"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        className={`w-20 px-3 py-2 border rounded-lg text-center font-medium focus:outline-none focus:ring-2 focus:ring-offset-1 transition-colors ${
          disabled
            ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
            : value > 100
              ? 'border-red-300 focus:ring-red-500 text-red-600'
              : 'border-gray-300 focus:ring-blue-500 text-gray-900'
        }`}
      />
      <span className="text-gray-500 text-sm">pts</span>
    </div>
  );
}
