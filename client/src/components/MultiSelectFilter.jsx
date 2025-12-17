import { useState, useRef, useEffect } from 'react';

// Valor especial para representar null/undefined/empty
const EMPTY_VALUE = '__EMPTY__';
const EMPTY_LABEL = '(Vacías)';

/**
 * MultiSelectFilter Component - Excel-style multi-select filter with checkboxes
 * Enhanced with better positioning, styling, and empty value support
 * 
 * @param {string} label - Column name/label to display
 * @param {array} values - Array of unique values available for selection
 * @param {array} selectedValues - Array of currently selected values
 * @param {function} onChange - Callback function when selection changes
 * @param {boolean} hasEmptyValues - Whether to show "(Vacías)" option for empty/null values
 * @param {string} forcePosition - Force dropdown position: 'top', 'bottom', or undefined for auto
 */
export default function MultiSelectFilter({ label, values = [], selectedValues = [], onChange, hasEmptyValues = false, forcePosition }) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [dropdownPosition, setDropdownPosition] = useState(forcePosition || 'bottom');
    const dropdownRef = useRef(null);
    const buttonRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            const clickedInsideButton = buttonRef.current?.contains(event.target);
            const clickedInsideDropdown = dropdownRef.current?.contains(event.target);

            if (!clickedInsideButton && !clickedInsideDropdown) {
                setIsOpen(false);
                setSearchTerm(''); // Clear search on close
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Calculate optimal dropdown position to avoid cutoff
    useEffect(() => {
        // If position is forced, don't calculate
        if (forcePosition) {
            setDropdownPosition(forcePosition);
            return;
        }

        if (isOpen && buttonRef.current) {
            const buttonRect = buttonRef.current.getBoundingClientRect();
            const windowHeight = window.innerHeight;
            const spaceBelow = windowHeight - buttonRect.bottom;
            const spaceAbove = buttonRect.top;

            // If less than 350px below, try to open upward
            if (spaceBelow < 350 && spaceAbove > spaceBelow) {
                setDropdownPosition('top');
            } else {
                setDropdownPosition('bottom');
            }
        }
    }, [isOpen, forcePosition]);

    // Prepare values list including empty option if needed
    const allValues = hasEmptyValues ? [EMPTY_VALUE, ...values] : values;

    // Filter values based on search term
    const filteredValues = allValues.filter(value => {
        if (value === EMPTY_VALUE) {
            return EMPTY_LABEL.toLowerCase().includes(searchTerm.toLowerCase());
        }
        return value?.toString().toLowerCase().includes(searchTerm.toLowerCase());
    });

    const handleToggle = (value) => {
        const newSelected = selectedValues.includes(value)
            ? selectedValues.filter(v => v !== value)
            : [...selectedValues, value];
        onChange(newSelected);
    };

    const handleSelectAll = () => {
        onChange(filteredValues);
    };

    const handleClearAll = () => {
        onChange([]);
    };

    const selectedCount = selectedValues.length;

    // Format display value (handle empty label)
    const formatDisplayValue = (value) => {
        if (value === EMPTY_VALUE) return EMPTY_LABEL;
        return value;
    };

    return (
        <div style={{ position: 'relative', width: '100%' }}>
            {/* Trigger Button */}
            <button
                ref={buttonRef}
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    width: '100%',
                    padding: '0.35rem 0.5rem',
                    fontSize: '0.75rem',
                    background: selectedCount > 0
                        ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.15))'
                        : 'rgba(255,255,255,0.03)',
                    border: selectedCount > 0
                        ? '1px solid rgba(99, 102, 241, 0.5)'
                        : '1px solid rgba(255,255,255,0.1)',
                    color: selectedCount > 0 ? '#a5b4fc' : '#9ca3af',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.2s ease',
                    boxShadow: selectedCount > 0
                        ? '0 0 0 1px rgba(99, 102, 241, 0.1), 0 2px 4px rgba(0,0,0,0.1)'
                        : 'none'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = selectedCount > 0
                        ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(139, 92, 246, 0.25))'
                        : 'rgba(255,255,255,0.08)';
                    e.currentTarget.style.borderColor = selectedCount > 0
                        ? 'rgba(99, 102, 241, 0.7)'
                        : 'rgba(255,255,255,0.2)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = selectedCount > 0
                        ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.15))'
                        : 'rgba(255,255,255,0.03)';
                    e.currentTarget.style.borderColor = selectedCount > 0
                        ? 'rgba(99, 102, 241, 0.5)'
                        : 'rgba(255,255,255,0.1)';
                }}
            >
                <span style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: selectedCount > 0 ? '500' : '400'
                }}>
                    {selectedCount > 0 ? (
                        <span>
                            <span style={{ color: '#818cf8', fontWeight: '600' }}>{selectedCount}</span>
                            <span style={{ marginLeft: '0.25rem' }}>seleccionado{selectedCount > 1 ? 's' : ''}</span>
                        </span>
                    ) : 'Todos'}
                </span>
                <span style={{
                    fontSize: '0.65rem',
                    transition: 'transform 0.2s ease',
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    display: 'inline-block'
                }}>▼</span>
            </button>

            {/* Dropdown Popup */}
            {isOpen && (
                <div
                    ref={dropdownRef}
                    style={{
                        position: 'absolute',
                        ...(dropdownPosition === 'bottom' ? {
                            top: 'calc(100% + 8px)',
                        } : {
                            bottom: 'calc(100% + 8px)',
                        }),
                        left: 0,
                        right: 0,
                        background: 'linear-gradient(135deg, rgba(45, 55, 72, 0.98), rgba(30, 41, 59, 0.98))',
                        border: '2px solid rgba(139, 92, 246, 0.6)',
                        borderRadius: '8px',
                        padding: '0.75rem',
                        zIndex: 9999,
                        minWidth: '220px',
                        maxHeight: '350px',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.8), 0 0 20px rgba(139, 92, 246, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
                        backdropFilter: 'blur(16px)',
                        animation: 'fadeIn 0.15s ease-out'
                    }}
                >
                    {/* Search Input */}
                    <input
                        type="text"
                        placeholder="🔍 Buscar..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        autoFocus
                        style={{
                            width: '100%',
                            padding: '0.5rem 0.75rem',
                            fontSize: '0.75rem',
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(139, 92, 246, 0.4)',
                            borderRadius: '6px',
                            color: 'white',
                            marginBottom: '0.75rem',
                            outline: 'none',
                            transition: 'all 0.2s ease'
                        }}
                        onFocus={(e) => {
                            e.target.style.background = 'rgba(255,255,255,0.15)';
                            e.target.style.borderColor = 'rgba(139, 92, 246, 0.8)';
                            e.target.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.1)';
                        }}
                        onBlur={(e) => {
                            e.target.style.background = 'rgba(255,255,255,0.1)';
                            e.target.style.borderColor = 'rgba(139, 92, 246, 0.4)';
                            e.target.style.boxShadow = 'none';
                        }}
                        onClick={(e) => e.stopPropagation()}
                    />

                    {/* Action Buttons */}
                    <div style={{
                        display: 'flex',
                        gap: '0.5rem',
                        marginBottom: '0.75rem'
                    }}>
                        <button
                            type="button"
                            onClick={handleSelectAll}
                            style={{
                                flex: 1,
                                padding: '0.4rem 0.5rem',
                                background: 'rgba(16, 185, 129, 0.15)',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                color: '#6ee7b7',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.7rem',
                                fontWeight: '500',
                                transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.background = 'rgba(16, 185, 129, 0.25)';
                                e.target.style.borderColor = 'rgba(16, 185, 129, 0.5)';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.background = 'rgba(16, 185, 129, 0.15)';
                                e.target.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                            }}
                        >
                            ✓ Todos
                        </button>
                        <button
                            type="button"
                            onClick={handleClearAll}
                            style={{
                                flex: 1,
                                padding: '0.4rem 0.5rem',
                                background: 'rgba(239, 68, 68, 0.15)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                color: '#fca5a5',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.7rem',
                                fontWeight: '500',
                                transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.background = 'rgba(239, 68, 68, 0.25)';
                                e.target.style.borderColor = 'rgba(239, 68, 68, 0.5)';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.background = 'rgba(239, 68, 68, 0.15)';
                                e.target.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                            }}
                        >
                            ✕ Limpiar
                        </button>
                    </div>

                    {/* Checkbox List */}
                    <div style={{
                        overflowY: 'auto',
                        overflowX: 'hidden',
                        maxHeight: '220px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        paddingRight: '0.25rem'
                    }}>
                        {filteredValues.length > 0 ? (
                            filteredValues.map((value, index) => {
                                const displayValue = formatDisplayValue(value);
                                const isSelected = selectedValues.includes(value);

                                return (
                                    <label
                                        key={index}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.6rem',
                                            padding: '0.45rem 0.5rem',
                                            cursor: 'pointer',
                                            borderRadius: '6px',
                                            fontSize: '0.75rem',
                                            background: isSelected
                                                ? 'rgba(139, 92, 246, 0.25)'
                                                : 'rgba(255,255,255,0.03)',
                                            border: '1px solid',
                                            borderColor: isSelected
                                                ? 'rgba(139, 92, 246, 0.5)'
                                                : 'rgba(255,255,255,0.1)',
                                            transition: 'all 0.15s ease',
                                            fontStyle: value === EMPTY_VALUE ? 'italic' : 'normal',
                                            color: value === EMPTY_VALUE ? '#9ca3af' : 'white'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = isSelected
                                                ? 'rgba(139, 92, 246, 0.35)'
                                                : 'rgba(255,255,255,0.1)';
                                            e.currentTarget.style.borderColor = isSelected
                                                ? 'rgba(139, 92, 246, 0.7)'
                                                : 'rgba(255,255,255,0.2)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = isSelected
                                                ? 'rgba(139, 92, 246, 0.25)'
                                                : 'rgba(255,255,255,0.03)';
                                            e.currentTarget.style.borderColor = isSelected
                                                ? 'rgba(139, 92, 246, 0.5)'
                                                : 'rgba(255,255,255,0.1)';
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => handleToggle(value)}
                                            style={{
                                                cursor: 'pointer',
                                                width: '16px',
                                                height: '16px',
                                                accentColor: '#6366f1',
                                                flexShrink: 0
                                            }}
                                        />
                                        <span style={{
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            flex: 1,
                                            fontWeight: isSelected ? '500' : '400'
                                        }}>
                                            {displayValue}
                                        </span>
                                    </label>
                                );
                            })
                        ) : (
                            <div style={{
                                padding: '1.5rem 0.5rem',
                                textAlign: 'center',
                                color: '#6b7280',
                                fontSize: '0.75rem',
                                fontStyle: 'italic'
                            }}>
                                No se encontraron valores
                            </div>
                        )}
                    </div>

                    {/* Selected Count Footer */}
                    <div style={{
                        marginTop: '0.75rem',
                        paddingTop: '0.75rem',
                        borderTop: '1px solid rgba(139, 92, 246, 0.3)',
                        fontSize: '0.7rem',
                        color: '#d1d5db',
                        textAlign: 'center',
                        fontWeight: '500'
                    }}>
                        {selectedCount > 0 ? (
                            <>
                                <span style={{ color: '#818cf8', fontWeight: '600' }}>{selectedCount}</span>
                                {' de '}
                                <span>{allValues.length}</span>
                                {' seleccionado'}{selectedCount !== 1 ? 's' : ''}
                            </>
                        ) : (
                            <span style={{ color: '#6b7280' }}>Ninguno seleccionado</span>
                        )}
                    </div>
                </div>
            )}

            {/* Selected Values Badges */}
            {selectedCount > 0 && selectedCount <= 3 && (
                <div style={{
                    display: 'flex',
                    gap: '0.3rem',
                    marginTop: '0.4rem',
                    flexWrap: 'wrap'
                }}>
                    {selectedValues.slice(0, 3).map((value, index) => (
                        <span
                            key={index}
                            style={{
                                padding: '0.15rem 0.4rem',
                                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.2))',
                                border: '1px solid rgba(99, 102, 241, 0.4)',
                                borderRadius: '4px',
                                fontSize: '0.65rem',
                                color: '#c7d2fe',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: '100%',
                                fontWeight: '500',
                                fontStyle: value === EMPTY_VALUE ? 'italic' : 'normal'
                            }}
                        >
                            {formatDisplayValue(value)}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

// Export constant for use in parent components
export { EMPTY_VALUE, EMPTY_LABEL };
