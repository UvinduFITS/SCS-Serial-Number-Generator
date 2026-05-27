export default function Input({ label, error, className = '', ...props }) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-700">{label}</label>
      )}
      <input
        className={
          `w-full px-3 py-2 border rounded-lg text-sm bg-white ` +
          `focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ` +
          `${error ? 'border-red-400' : 'border-gray-300'} ${className}`
        }
        {...props}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
