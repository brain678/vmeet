/**
 * AdminUI Components - Reusable components for Admin Dashboard
 * These can be used across all admin pages for consistency
 */

import React from 'react';

interface CardProps {
  title: string;
  description?: string;
  count?: number;
  icon?: string;
  color?: string;
  children?: React.ReactNode;
}

export const StatCard: React.FC<CardProps> = ({ title, count, icon, color = 'blue' }) => {
  const colorClasses: { [key: string]: string } = {
    blue: 'border-blue-600 text-blue-600',
    purple: 'border-purple-600 text-purple-600',
    green: 'border-green-600 text-green-600',
    orange: 'border-orange-600 text-orange-600',
    red: 'border-red-600 text-red-600'
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm p-6 border-l-4 ${colorClasses[color]} hover:shadow-md transition`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-gray-600 text-sm font-medium">{title}</p>
          <p className={`text-3xl font-bold ${colorClasses[color]} mt-2`}>{count || 0}</p>
        </div>
        {icon && <span className="text-3xl">{icon}</span>}
      </div>
    </div>
  );
};

interface ActionCardProps {
  title: string;
  description: string;
  icon: string;
  color: string;
  onClick?: () => void;
  href?: string;
}

export const ActionCard: React.FC<ActionCardProps> = ({
  title,
  description,
  icon,
  color,
  onClick
}) => {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg shadow-sm hover:shadow-xl transition duration-300 overflow-hidden cursor-pointer group"
    >
      <div className={`bg-gradient-to-r ${color} p-6 text-white`}>
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-xl font-bold">{title}</h3>
            <p className="text-sm opacity-90 mt-1">{description}</p>
          </div>
          <span className="text-4xl group-hover:scale-110 transition duration-300">{icon}</span>
        </div>
      </div>
      <div className="p-6">
        <div className="flex justify-between items-center">
          <span className="text-blue-600 group-hover:translate-x-1 transition duration-300">
            Click to manage
          </span>
        </div>
      </div>
    </div>
  );
};

interface ModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  isEditing?: boolean;
  submitLabel?: string;
  children: React.ReactNode;
  color?: 'blue' | 'purple' | 'green' | 'orange' | 'red';
}

const colorMap: { [key: string]: string } = {
  blue: 'from-blue-600 to-indigo-600',
  purple: 'from-purple-600 to-purple-700',
  green: 'from-green-600 to-green-700',
  orange: 'from-orange-600 to-orange-700',
  red: 'from-red-600 to-red-700'
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  title,
  onClose,
  onSubmit,
  isEditing = false,
  submitLabel = 'Submit',
  children,
  color = 'blue'
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className={`sticky top-0 bg-gradient-to-r ${colorMap[color]} px-6 py-4 text-white flex justify-between items-center`}>
          <h3 className="text-xl font-bold">
            {isEditing ? `Edit ${title}` : `Add New ${title}`}
          </h3>
          <button onClick={onClose} className="text-white hover:text-opacity-80 text-2xl">
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {children}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-semibold transition"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            className={`px-6 py-2 bg-gradient-to-r ${colorMap[color]} hover:opacity-90 text-white rounded-lg font-semibold transition`}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

interface FormFieldProps {
  label: string;
  type?: string;
  required?: boolean;
  value: string | number;
  onChange: (value: string | number) => void;
  placeholder?: string;
  options?: { label: string; value: string | number }[];
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  type = 'text',
  required = false,
  value,
  onChange,
  placeholder,
  options
}) => {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      {type === 'select' ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
        >
          <option value="">Select {label}</option>
          {options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(type === 'number' ? parseFloat(e.target.value) : e.target.value)}
          placeholder={placeholder}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
        />
      )}
    </div>
  );
};

interface TableProps {
  headers: string[];
  rows: (string | React.ReactNode)[][];
  actions?: { label: string; onClick: (rowIndex: number) => void; color?: string }[];
}

export const DataTable: React.FC<TableProps> = ({ headers, rows, actions }) => {
  return (
    <div className="overflow-x-auto rounded-lg shadow-sm">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {headers.map((header, idx) => (
              <th
                key={idx}
                className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider"
              >
                {header}
              </th>
            ))}
            {actions && <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {rows.map((row, rowIdx) => (
            <tr key={rowIdx} className="hover:bg-gray-50 transition">
              {row.map((cell, cellIdx) => (
                <td key={cellIdx} className="px-6 py-4 text-gray-900">
                  {cell}
                </td>
              ))}
              {actions && (
                <td className="px-6 py-4 whitespace-nowrap space-x-2">
                  {actions.map((action, idx) => (
                    <button
                      key={idx}
                      onClick={() => action.onClick(rowIdx)}
                      className={`px-3 py-1 rounded font-medium text-sm transition ${
                        action.color === 'red'
                          ? 'bg-red-100 hover:bg-red-200 text-red-700'
                          : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                      }`}
                    >
                      {action.label}
                    </button>
                  ))}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

interface AlertProps {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  onClose?: () => void;
}

export const Alert: React.FC<AlertProps> = ({ type, message, onClose }) => {
  const colorClasses: { [key: string]: string } = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  };

  return (
    <div className={`border rounded-lg p-4 ${colorClasses[type]} flex justify-between items-center`}>
      <p className="text-sm">{message}</p>
      {onClose && (
        <button onClick={onClose} className="text-lg font-bold">
          ×
        </button>
      )}
    </div>
  );
};
