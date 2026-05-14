const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, type = 'button' }) => (
  <button
    type={type}
    disabled={disabled}
    onClick={onClick}
    className={`
      ${variant === 'secondary' 
        ? 'bg-gray-200 hover:bg-gray-300 text-gray-800 border border-gray-300' 
        : 'bg-green-500 hover:bg-green-600 text-white shadow-lg hover:shadow-xl'
      }
      ${className}
      disabled:bg-gray-400 disabled:cursor-not-allowed
      px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:-translate-y-0.5
      focus:outline-none focus:ring-4 focus:ring-green-200 focus:ring-opacity-50
    `}
  >
    {children}
  </button>
);

export default Button;
