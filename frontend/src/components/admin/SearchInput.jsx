import React from 'react';

export default function SearchInput({ value, onChange, placeholder = 'Search…', style }) {
  return (
    <input
      className="admin-filter-input"
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={style}
    />
  );
}
