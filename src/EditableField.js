import React, { useState, useEffect, useRef } from 'react';

const EditableField = ({ 
  value, 
  onSave, 
  type = 'text', 
  options = [], 
  className = '',
  disabled = false
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(value);
    }
  };

  const handleSave = () => {
    if (editValue !== value) {
      onSave(editValue);
    }
    setIsEditing(false);
  };

  const handleBlur = () => {
    handleSave();
  };

  if (disabled) {
    return <span className={className}>{value}</span>;
  }

  if (!isEditing) {
    return (
      <span 
        className={`${className} cursor-pointer`}
        onClick={() => setIsEditing(true)}
        style={{ cursor: 'pointer' }}
      >
        {type === 'select' ? options.find(opt => opt.value === value)?.label || value : value}
      </span>
    );
  }

  if (type === 'select') {
    return (
      <select
        ref={inputRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="form-select form-select-sm"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      ref={inputRef}
      type={type}
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className="form-control form-control-sm"
    />
  );
};

export default EditableField;