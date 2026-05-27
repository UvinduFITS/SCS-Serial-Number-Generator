export default function Select({ label, error, options = [], className = '', ...props }) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-700">{label}</label>
      )}
      <select
        className={
          `w-full px-3 py-2 border rounded-lg text-sm bg-white ` +
          `focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ` +
          `${error ? 'border-red-400' : 'border-gray-300'} ${className}`
        }
        {...props}
      >
        {options.map(({ value, label: optLabel }) => (
          <option key={value} value={value}>
            {optLabel}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
